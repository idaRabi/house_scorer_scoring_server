const path = require('path');

function loadConfig() {
  const configPath = path.join(__dirname, 'configurations.js');
  delete require.cache[require.resolve(configPath)];
  return require('./configurations');
}

function computeScore(listing, locationInfo) {
  const config = loadConfig();
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

  let supermarketScore = 0;
  let supermarketExplanation = null;
  let transitScore = 0;
  let transitExplanation = null;
  let commuteWorkScore = 0;
  let commuteWorkExplanation = null;
  let commuteWifeWorkScore = 0;
  let commuteWifeWorkExplanation = null;

  if (locationInfo) {
    // Supermarkets
    if (locationInfo.supermarkets) {
      let bestRadius = null;
      for (const brand of Object.keys(locationInfo.supermarkets)) {
        const b = locationInfo.supermarkets[brand];
        if (b.within200m && b.within200m.count > 0) {
          bestRadius = 200;
          break;
        }
        if (b.within500m && b.within500m.count > 0) {
          if (bestRadius == null || bestRadius > 500) bestRadius = 500;
        }
        if (b.within1000m && b.within1000m.count > 0) {
          if (bestRadius == null) bestRadius = 1000;
        }
      }
      if (bestRadius === 200) {
        supermarketScore = config.supermarketScore200m || 0;
        supermarketExplanation = 'Supermarket within 200m (+' + supermarketScore + ')';
      } else if (bestRadius === 500) {
        supermarketScore = config.supermarketScore500m || 0;
        supermarketExplanation = 'Supermarket within 500m (+' + supermarketScore + ')';
      } else if (bestRadius === 1000) {
        supermarketScore = config.supermarketScore1000m || 0;
        supermarketExplanation = 'Supermarket within 1km (+' + supermarketScore + ')';
      } else {
        supermarketExplanation = 'No supermarket within 1km (+0)';
      }
    } else {
      supermarketExplanation = 'No supermarket data available (+0)';
    }

    // Transit stations
    if (locationInfo.transitStations) {
      const ts = locationInfo.transitStations;
      if (ts.within200m && ts.within200m.count > 0) {
        transitScore = config.transitScore200m || 0;
        transitExplanation = 'Transit station(s) within 200m (+' + transitScore + ')';
      } else if (ts.within500m && ts.within500m.count > 0) {
        transitScore = config.transitScore500m || 0;
        transitExplanation = 'Transit station(s) within 500m (+' + transitScore + ')';
      } else if (ts.within1000m && ts.within1000m.count > 0) {
        transitScore = config.transitScore1000m || 0;
        transitExplanation = 'Transit station(s) within 1km (+' + transitScore + ')';
      } else {
        transitExplanation = 'No transit station within 1km (+0)';
      }
    } else {
      transitExplanation = 'No transit data available (+0)';
    }

    // Commute
    if (locationInfo.commute) {
      const baseMinutes = config.commuteBaseMinutes || 60;
      const per5 = config.commuteScorePer5Minutes || 5;

      ['work', 'wife_work'].forEach((label) => {
        const c = locationInfo.commute[label];
        if (c && c.durationSeconds != null) {
          const minutes = c.durationSeconds / 60;
          if (minutes < baseMinutes) {
            const blocks = Math.floor((baseMinutes - minutes) / 5);
            const score = blocks * per5;
            const labelText = label === 'work' ? 'Commute to work' : 'Commute to wife work';
            const explanation = labelText + ': ' + c.durationText + ' (' + blocks + 'x5min under ' + baseMinutes + 'min, +' + score + ')';
            if (label === 'work') {
              commuteWorkScore = score;
              commuteWorkExplanation = explanation;
            } else {
              commuteWifeWorkScore = score;
              commuteWifeWorkExplanation = explanation;
            }
          } else {
            const labelText = label === 'work' ? 'Commute to work' : 'Commute to wife work';
            const explanation = labelText + ': ' + c.durationText + ' (over ' + baseMinutes + 'min, +0)';
            if (label === 'work') {
              commuteWorkExplanation = explanation;
            } else {
              commuteWifeWorkExplanation = explanation;
            }
          }
        } else {
          const labelText = label === 'work' ? 'Commute to work' : 'Commute to wife work';
          const explanation = labelText + ': no data (+0)';
          if (label === 'work') {
            commuteWorkExplanation = explanation;
          } else {
            commuteWifeWorkExplanation = explanation;
          }
        }
      });
    } else {
      commuteWorkExplanation = 'Commute to work: no data (+0)';
      commuteWifeWorkExplanation = 'Commute to wife work: no data (+0)';
    }
  }

  const total = locationScore + energyScore + roomScore + accessibilityScore + constructionScore + heatingTypeScore + maintenanceFeeScore + supermarketScore + transitScore + commuteWorkScore + commuteWifeWorkScore;

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
    supermarketScore,
    transitScore,
    commuteWorkScore,
    commuteWifeWorkScore,
    explanation: {
      location: locationExplanation,
      energy: energyExplanation,
      rooms: roomExplanation,
      accessibility: accessibilityExplanation,
      construction: constructionExplanation,
      heatingType: heatingTypeExplanation,
      maintenanceFee: maintenanceFeeExplanation,
      supermarket: supermarketExplanation,
      transit: transitExplanation,
      commuteWork: commuteWorkExplanation,
      commuteWifeWork: commuteWifeWorkExplanation
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

module.exports = { computeScore };
