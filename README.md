# House Scorer - Scoring Server

Backend server for scoring home advertisements. Accepts listing data and calculates scores based on configurable criteria including location, energy certificate, rooms, construction year, heating type, accessibility, and maintenance fees.

## What it does

This server is the backend companion to the House Scorer browser plugin. When you browse property listings, the plugin sends listing data to this server which:

- **Scores apartments** based on your preferences — location desirability, energy efficiency, room count, construction decade, heating type quality, elevator/floor accessibility, and maintenance fee reasonableness.
- **Analyzes the neighborhood** using Google Maps — counts nearby U-Bahn/S-Bahn stations and popular supermarkets (REWE, EDEKA, Kaufland, Lidl, Aldi, Penny, Netto) within 200m, 500m, and 1km.
- **Calculates commute times** — fastest transit routes from the apartment to your work and your partner's work, with detailed line and stop information. Prioritizes subway/train routes over bus/tram.
- **Caches everything** — scores are saved per listing ID so you can revisit them. Location analysis is cached by geographic cell (h3 resolution 9) to avoid redundant API calls for nearby apartments.

The scoring weights are fully configurable in a standalone file — change your priorities anytime without touching code.

## Requirements

- Node.js 18+
- npm

## Setup

```bash
npm install
```

## Running

```bash
npm start
```

Server starts on port 3001 by default. Set `PORT` environment variable to override.

### Google Maps API (optional)

To enable transit station proximity, supermarket counts, and commute duration features, set the API key:

```bash
set GOOGLE_MAPS_API_KEY=your_api_key_here   # Windows
export GOOGLE_MAPS_API_KEY=your_api_key_here # Linux/Mac
```

Without the key, scoring still works but `locationInfo` and `transit` return an error message.

## API Endpoints

### POST /score/:id

Basic scoring from search page. Accepts partial listing data, does **not** persist results.

**Request body:**
```json
{
  "address": "Linienstraße 142, 10115 Berlin",
  "rooms": "4 Zi.",
  "energyCertificate": "C"
}
```

### POST /expose-score/:id

Full scoring from expose page. Accepts all listing fields, persists results to `DB/<id>.json`.

**Request body:**
```json
{
  "address": "Linienstraße 142, 10115 Berlin",
  "rooms": "4 Zi.",
  "energyCertificate": "C",
  "floor": "3",
  "maintenanceFee": "450",
  "area": "126",
  "constructionYear": "2016",
  "condition": "mint_condition",
  "heatingType": "Fernwärme",
  "primaryEnergySource": null,
  "energyCertificateStatus": "energy_required",
  "energyCertificateType": null,
  "hasElevator": false,
  "latitude": 52.5267,
  "longitude": 13.39049
}
```

### GET /expose-score/:id

Retrieves a previously stored score. Recalculates with latest configuration and updates cache if changed.

## Response structure

```json
{
  "id": "168205078",
  "score": 48,
  "breakdown": {
    "location": 10,
    "energy": 5,
    "rooms": 8,
    "accessibility": 1,
    "construction": 15,
    "heatingType": 4,
    "maintenanceFee": 3
  },
  "matchedLocation": "Neukölln",
  "explanation": {
    "location": "Matched location: Neukölln (+10)",
    "energy": "Energy class: C (+5)",
    "rooms": "4 rooms (+8)",
    "accessibility": "First floor, no elevator (+1)",
    "construction": "Built in 2010s (6 decades after 1950, +30)",
    "heatingType": "Heating type: Fernwärme (+4)",
    "maintenanceFee": "Maintenance fee ratio 3.6 €/m² in range [3, 5] (+3)"
  },
  "input": { ... },
  "transit": {
    "stationName": "U Oranienburger Tor",
    "stationVicinity": "...",
    "walkingDistanceMeters": 320,
    "walkingDurationSeconds": 240,
    "walkingDurationText": "4 mins"
  },
  "locationInfo": {
    "transitStations": { "within200m": {...}, "within500m": {...}, "within1000m": {...}, "nearest": {...} },
    "supermarkets": { "REWE": {...}, "EDEKA": {...}, ... },
    "commute": {
      "work": { "durationSeconds": 1320, "transitModes": ["SUBWAY"], "transitLines": [...] },
      "wife_work": { "durationSeconds": 960, "transitModes": ["TRAM"], "transitLines": [...] }
    }
  },
  "h3Index": "871f1a54fffffff"
}
```

## Configuration

Scoring weights and thresholds are in `src/configurations.js`. Changes take effect on the next request without restarting the server.

## Storage

| Folder | Contents |
|--------|----------|
| `DB/` | Scored expose results (`<exposeId>.json`) |
| `LOC_DB/` | Location analysis cache (`<h3hash>.json`) |
