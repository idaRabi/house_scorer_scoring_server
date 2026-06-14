module.exports = {
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
  maintenanceFeeRatioMax: 5,
  supermarketScore200m: 20,
  supermarketScore500m: 10,
  supermarketScore1000m: 3,
  transitScore200m: 20,
  transitScore500m: 10,
  transitScore1000m: 1,
  commuteBaseMinutes: 60,
  commuteScorePer5Minutes: 5
};
