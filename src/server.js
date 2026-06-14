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
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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

  let locationInfo = null;
  let transitInfo = null;
  let h3Index = null;

  if (latitude != null && longitude != null) {
    h3Index = h3.latLngToCell(latitude, longitude, 9);
    const [li, tr] = await Promise.all([
      locationService.getLocationInfo(latitude, longitude),
      locationService.getWalkingDistanceToNearestStation(latitude, longitude)
    ]);
    locationInfo = li;
    transitInfo = tr;
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
  }, locationInfo);

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
      maintenanceFee: scoreResult.maintenanceFeeScore,
      supermarket: scoreResult.supermarketScore,
      transit: scoreResult.transitScore,
      commuteWork: scoreResult.commuteWorkScore,
      commuteWifeWork: scoreResult.commuteWifeWorkScore
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
    transit: transitInfo,
    locationInfo: locationInfo,
    h3Index: h3Index,
    visited: false
  };

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

  let transit = cached.transit || null;
  let locationInfo = cached.locationInfo || null;

  if (input.latitude != null && input.longitude != null) {
    if (!transit || !locationInfo) {
      const [li, tr] = await Promise.all([
        locationService.getLocationInfo(input.latitude, input.longitude),
        locationService.getWalkingDistanceToNearestStation(input.latitude, input.longitude)
      ]);
      if (!locationInfo) locationInfo = li;
      if (!transit) transit = tr;
    }
  }

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
  }, locationInfo);

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
      maintenanceFee: scoreResult.maintenanceFeeScore,
      supermarket: scoreResult.supermarketScore,
      transit: scoreResult.transitScore,
      commuteWork: scoreResult.commuteWorkScore,
      commuteWifeWork: scoreResult.commuteWifeWorkScore
    },
    matchedLocation: scoreResult.matchedLocation,
    explanation: scoreResult.explanation,
    input,
    transit,
    locationInfo,
    h3Index: cached.h3Index || (input.latitude != null && input.longitude != null ? h3.latLngToCell(input.latitude, input.longitude, 9) : null),
    visited: cached.visited || false
  };

  if (response.score !== cached.score || response.transit !== cached.transit || response.h3Index !== cached.h3Index || response.locationInfo !== cached.locationInfo) {
    store.save(id, response);
  }

  res.json(response);
});

app.put('/expose-score/:id/visited', (req, res) => {
  const { id } = req.params;
  const { visited } = req.body;
  const cached = store.load(id);
  if (!cached) {
    return res.status(404).json({ error: 'Score not found for id: ' + id });
  }
  cached.visited = visited === true;
  store.save(id, cached);
  res.json({ id, visited: cached.visited });
});

app.get('/expose-score/:id/visited', (req, res) => {
  const { id } = req.params;
  const cached = store.load(id);
  if (!cached) {
    return res.status(404).json({ error: 'Score not found for id: ' + id });
  }
  res.json({ id, visited: cached.visited || false });
});

app.listen(PORT, () => {
  console.log(`Scoring server listening on port ${PORT}`);
});
