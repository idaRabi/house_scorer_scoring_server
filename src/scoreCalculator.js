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
  },
  elevatorScore: 3,
  groundFloorScore: 2,
  firstFloorScore: 1,
  constructionDecadeBase: 1950,
  constructionDecadeScore: 5,
  heatingTypeScores: {
    "Wärmepumpe": 5,
    "Fernwärme": 4,
    "Zentralheizung": 3,
    "Gasetagenheizung": 1,
    "Ölheizung": -2,
    "Nachtspeicher": -3
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

  let accessibilityScore = 0;
  if (listing.hasElevator === true) {
    accessibilityScore = config.elevatorScore || 0;
  } else {
    const floorNum = parseFloor(listing.floor);
    if (floorNum === 0) {
      accessibilityScore = config.groundFloorScore || 0;
    } else if (floorNum === 1) {
      accessibilityScore = config.firstFloorScore || 0;
    }
  }

  let constructionScore = 0;
  if (listing.constructionYear) {
    const year = parseInt(listing.constructionYear, 10);
    if (!isNaN(year)) {
      const decade = Math.floor(year / 10) * 10;
      const decades = Math.max(0, Math.floor((decade - config.constructionDecadeBase) / 10));
      constructionScore = decades * config.constructionDecadeScore;
    }
  }

  let heatingTypeScore = 0;
  if (listing.heatingType && config.heatingTypeScores) {
    const htScore = config.heatingTypeScores[listing.heatingType];
    if (typeof htScore === 'number') {
      heatingTypeScore = htScore;
    }
  }

  const total = locationScore + energyScore + roomScore + accessibilityScore + constructionScore + heatingTypeScore;

  return {
    total,
    matchedLocation,
    locationScore,
    energyScore,
    roomScore,
    accessibilityScore,
    constructionScore,
    heatingTypeScore
  };
}

function parseFloor(floor) {
  if (floor === null || floor === undefined) {
    return null;
  }
  const s = String(floor).trim().toLowerCase();
  if (s === 'eg' || s === 'erdgeschoss' || s === 'ground floor') {
    return 0;
  }
  const match = s.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

module.exports = { computeScore, defaultConfig };
