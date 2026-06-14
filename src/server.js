const express = require('express');
const h3 = require('h3-js');
const { computeScore } = require('./scoreCalculator');
const ScoreStore = require('./scoreStore');
const LocationService = require('./locationService');

const app = express();
const PORT = process.env.PORT || 3001;
const store = new ScoreStore();
const locationService = new LocationService();

app.use(express.json());

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.post('/score/:id', (req, res) => {
  const { id } = req.params;
  const listing = req.body;

  if (!listing || typeof listing !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const scoreResult = computeScore(listing);

  res.json({
    id,
    score: scoreResult.total,
    breakdown: {
      location: scoreResult.locationScore,
      energy: scoreResult.energyScore,
      rooms: scoreResult.roomScore
    },
    matchedLocation: scoreResult.matchedLocation,
    explanation: scoreResult.explanation
  });
});

app.post('/expose-score/:id', async (req, res) => {
  const { id } = req.params;
  const {
    address,
    rooms,
    energyCertificate,
    floor,
    maintenanceFee,
    constructionYear,
    condition,
    heatingType,
    primaryEnergySource,
    energyCertificateStatus,
    energyCertificateType,
    hasElevator,
    area,
    latitude,
    longitude
  } = req.body;

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const scoreResult = computeScore({
    address,
    rooms,
    energyClass: energyCertificate,
    hasElevator,
    floor,
    constructionYear,
    heatingType,
    maintenanceFee,
    area
  });

  const response = {
    id,
    score: scoreResult.total,
    breakdown: {
      location: scoreResult.locationScore,
      energy: scoreResult.energyScore,
      rooms: scoreResult.roomScore,
      accessibility: scoreResult.accessibilityScore,
      construction: scoreResult.constructionScore,
      heatingType: scoreResult.heatingTypeScore,
      maintenanceFee: scoreResult.maintenanceFeeScore
    },
    matchedLocation: scoreResult.matchedLocation,
    explanation: scoreResult.explanation,
    input: {
      address: address || null,
      rooms: rooms || null,
      energyCertificate: energyCertificate || null,
      floor: floor || null,
      maintenanceFee: maintenanceFee || null,
      area: area || null,
      constructionYear: constructionYear || null,
      condition: condition || null,
      heatingType: heatingType || null,
      primaryEnergySource: primaryEnergySource || null,
      energyCertificateStatus: energyCertificateStatus || null,
      energyCertificateType: energyCertificateType || null,
      hasElevator: hasElevator || null,
      latitude: latitude || null,
      longitude: longitude || null
    },
    transit: null,
    h3Index: null
  };

  if (latitude != null && longitude != null) {
    response.h3Index = h3.latLngToCell(latitude, longitude, 9);
    const transitResult = await locationService.getWalkingDistanceToNearestStation(latitude, longitude);
    response.transit = transitResult;
  }

  store.save(id, response);

  res.json(response);
});

app.get('/expose-score/:id', async (req, res) => {
  const { id } = req.params;
  const cached = store.load(id);
  if (!cached) {
    return res.status(404).json({ error: 'Score not found for id: ' + id });
  }

  const input = cached.input || {};
  const scoreResult = computeScore({
    address: input.address,
    rooms: input.rooms,
    energyClass: input.energyCertificate,
    hasElevator: input.hasElevator,
    floor: input.floor,
    constructionYear: input.constructionYear,
    heatingType: input.heatingType,
    maintenanceFee: input.maintenanceFee,
    area: input.area
  });

  let transit = cached.transit || null;
  if (!transit && input.latitude != null && input.longitude != null) {
    transit = await locationService.getWalkingDistanceToNearestStation(input.latitude, input.longitude);
  }

  const response = {
    id,
    score: scoreResult.total,
    breakdown: {
      location: scoreResult.locationScore,
      energy: scoreResult.energyScore,
      rooms: scoreResult.roomScore,
      accessibility: scoreResult.accessibilityScore,
      construction: scoreResult.constructionScore,
      heatingType: scoreResult.heatingTypeScore,
      maintenanceFee: scoreResult.maintenanceFeeScore
    },
    matchedLocation: scoreResult.matchedLocation,
    explanation: scoreResult.explanation,
    input,
    transit,
    h3Index: cached.h3Index || (input.latitude != null && input.longitude != null ? h3.latLngToCell(input.latitude, input.longitude, 9) : null)
  };

  if (response.score !== cached.score || response.transit !== cached.transit || response.h3Index !== cached.h3Index) {
    store.save(id, response);
  }

  res.json(response);
});

app.listen(PORT, () => {
  console.log(`Scoring server listening on port ${PORT}`);
});
