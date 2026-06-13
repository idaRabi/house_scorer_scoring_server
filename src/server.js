const express = require('express');
const { computeScore } = require('./scoreCalculator');

const app = express();
const PORT = process.env.PORT || 3001;

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
    matchedLocation: scoreResult.matchedLocation
  });
});

app.listen(PORT, () => {
  console.log(`Scoring server listening on port ${PORT}`);
});
