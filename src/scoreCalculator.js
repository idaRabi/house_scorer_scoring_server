const defaultConfig = {
  locationScores: {
    "Neukölln": 10
  },
  missingLocationScore: 0,
  energyScores: {
    "A+": 5,
    "A": 5,
    "B+": 5,
    "B": 5,
    "C": 5
  },
  roomScores: {
    "1": 0,
    "2": 3,
    "3": 6,
    "4": 8,
    "5": 10,
    "6": 12,
    "7": 14
  }
};

function computeScore(listing, config = defaultConfig) {
  let locationScore = 0;
  let matchedLocation = null;

  if (listing.address) {
    const addrLower = listing.address.toLowerCase();
    const locations = config.locationScores;
    for (const loc of Object.keys(locations)) {
      if (addrLower.includes(loc.toLowerCase())) {
        locationScore = locations[loc];
        matchedLocation = loc;
        break;
      }
    }
    if (!matchedLocation) {
      locationScore = config.missingLocationScore;
    }
  } else {
    locationScore = config.missingLocationScore;
  }

  let energyScore = 0;
  const energyCert = listing.energyCertificate || listing.energyClass;
  if (energyCert && config.energyScores) {
    const ecScore = config.energyScores[energyCert];
    if (typeof ecScore === 'number') {
      energyScore = ecScore;
    }
  }

  let roomScore = 0;
  if (listing.rooms && config.roomScores) {
    const roomMatch = String(listing.rooms).match(/(\d+)/);
    if (roomMatch) {
      const roomCount = roomMatch[1];
      const rcScore = config.roomScores[roomCount];
      if (typeof rcScore === 'number') {
        roomScore = rcScore;
      }
    }
  }

  const total = locationScore + energyScore + roomScore;

  return {
    total,
    matchedLocation,
    locationScore,
    energyScore,
    roomScore
  };
}

module.exports = { computeScore, defaultConfig };
