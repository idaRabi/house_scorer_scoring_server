const express = require('express');
const { computeScore } = require('./scoreCalculator');
const ScoreStore = require('./scoreStore');

const app = express();
const PORT = process.env.PORT || 3001;
const store = new ScoreStore();

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

app.post('/expose-score/:id', (req, res) => {
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
    area
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
      hasElevator: hasElevator || null
    }
  };

  store.save(id, response);

  res.json(response);
});

app.listen(PORT, () => {
  console.log(`Scoring server listening on port ${PORT}`);
});
