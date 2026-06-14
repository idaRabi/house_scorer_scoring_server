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
  },
  maintenanceFeeRatioScore: 3,
  maintenanceFeeRatioMin: 3,
  maintenanceFeeRatioMax: 5
};

function computeScore(listing, config = defaultConfig) {
  let locationScore = 0;
  let matchedLocation = null;
  let locationExplanation = null;

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
      locationExplanation = 'No matched location (+0)';
  } else {
    locationExplanation = 'Matched location: ' + matchedLocation + ' (+' + locationScore + ')';
  }
} else {
  locationScore = config.missingLocationScore;
  locationExplanation = 'No address provided (+0)';
}

  let energyScore = 0;
  let energyExplanation = null;
  const energyCert = listing.energyCertificate || listing.energyClass;
  if (energyCert && config.energyScores) {
    const ecScore = config.energyScores[energyCert];
    if (typeof ecScore === 'number') {
      energyScore = ecScore;
      energyExplanation = 'Energy class: ' + energyCert + ' (+' + energyScore + ')';
    } else {
      energyExplanation = 'Energy class not in scoring table: ' + energyCert + ' (+0)';
    }
  } else {
    energyExplanation = 'No energy certificate provided (+0)';
  }

  let roomScore = 0;
  let roomExplanation = null;
  if (listing.rooms && config.roomScores) {
    const roomMatch = String(listing.rooms).match(/(\d+)/);
    if (roomMatch) {
      const roomCount = roomMatch[1];
      const rcScore = config.roomScores[roomCount];
      if (typeof rcScore === 'number') {
        roomScore = rcScore;
        roomExplanation = roomCount + ' rooms (+' + roomScore + ')';
      } else {
        roomExplanation = 'Room count not in scoring table: ' + roomCount + ' (+0)';
      }
    } else {
      roomExplanation = 'Could not parse room count from: ' + listing.rooms + ' (+0)';
    }
  } else {
    roomExplanation = 'No room info provided (+0)';
  }

  let accessibilityScore = 0;
  let accessibilityExplanation = null;
  if (listing.hasElevator === true) {
    accessibilityScore = config.elevatorScore || 0;
    accessibilityExplanation = 'Has elevator (+' + accessibilityScore + ')';
  } else {
    const floorNum = parseFloor(listing.floor);
    if (floorNum === 0) {
      accessibilityScore = config.groundFloorScore || 0;
      accessibilityExplanation = 'Ground floor, no elevator (+' + accessibilityScore + ')';
    } else if (floorNum === 1) {
      accessibilityScore = config.firstFloorScore || 0;
      accessibilityExplanation = 'First floor, no elevator (+' + accessibilityScore + ')';
    } else {
      accessibilityExplanation = 'No elevator, floor ' + (floorNum != null ? floorNum : 'unknown') + ' (+0)';
    }
  }

  let constructionScore = 0;
  let constructionExplanation = null;
  if (listing.constructionYear) {
    const year = parseInt(listing.constructionYear, 10);
    if (!isNaN(year)) {
      const decade = Math.floor(year / 10) * 10;
      const decades = Math.max(0, Math.floor((decade - config.constructionDecadeBase) / 10));
      constructionScore = decades * config.constructionDecadeScore;
      constructionExplanation = 'Built in ' + decade + 's (' + decades + ' decades after ' + config.constructionDecadeBase + ', +' + constructionScore + ')';
    } else {
      constructionExplanation = 'Invalid construction year: ' + listing.constructionYear + ' (+0)';
    }
  } else {
    constructionExplanation = 'No construction year provided (+0)';
  }

  let heatingTypeScore = 0;
  let heatingTypeExplanation = null;
  if (listing.heatingType && config.heatingTypeScores) {
    const htScore = config.heatingTypeScores[listing.heatingType];
    if (typeof htScore === 'number') {
      heatingTypeScore = htScore;
      heatingTypeExplanation = 'Heating type: ' + listing.heatingType + ' (' + (heatingTypeScore >= 0 ? '+' : '') + heatingTypeScore + ')';
    } else {
      heatingTypeExplanation = 'Heating type not in scoring table: ' + listing.heatingType + ' (+0)';
    }
  } else {
    heatingTypeExplanation = 'No heating type provided (+0)';
  }

  let maintenanceFeeScore = 0;
  let maintenanceFeeExplanation = null;
  if (listing.maintenanceFee && listing.area) {
    const fee = parseFloat(listing.maintenanceFee);
    const areaVal = parseFloat(listing.area);
    if (!isNaN(fee) && !isNaN(areaVal) && areaVal > 0) {
      const ratio = fee / areaVal;
      if (ratio >= config.maintenanceFeeRatioMin && ratio <= config.maintenanceFeeRatioMax) {
        maintenanceFeeScore = config.maintenanceFeeRatioScore;
        maintenanceFeeExplanation = 'Maintenance fee ratio ' + ratio.toFixed(1) + ' €/m² in range [' + config.maintenanceFeeRatioMin + ', ' + config.maintenanceFeeRatioMax + '] (+' + maintenanceFeeScore + ')';
      } else {
        maintenanceFeeExplanation = 'Maintenance fee ratio ' + ratio.toFixed(1) + ' €/m² outside range [' + config.maintenanceFeeRatioMin + ', ' + config.maintenanceFeeRatioMax + '] (+0)';
      }
    } else {
      maintenanceFeeExplanation = 'Invalid maintenance fee or area values (+0)';
    }
  } else {
    maintenanceFeeExplanation = 'No maintenance fee or area provided (+0)';
  }

  const total = locationScore + energyScore + roomScore + accessibilityScore + constructionScore + heatingTypeScore + maintenanceFeeScore;

  return {
    total,
    matchedLocation,
    locationScore,
    energyScore,
    roomScore,
    accessibilityScore,
    constructionScore,
    heatingTypeScore,
    maintenanceFeeScore,
    explanation: {
      location: locationExplanation,
      energy: energyExplanation,
      rooms: roomExplanation,
      accessibility: accessibilityExplanation,
      construction: constructionExplanation,
      heatingType: heatingTypeExplanation,
      maintenanceFee: maintenanceFeeExplanation
    }
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
