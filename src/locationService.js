const https = require('https');
const fs = require('fs');
const path = require('path');
const h3 = require('h3-js');

const LOC_DB_DIR = path.join(__dirname, '..', 'LOC_DB');

const SUPERMARKET_BRANDS = ['REWE', 'EDEKA', 'Kaufland', 'Lidl', 'Aldi', 'Penny', 'Netto'];
const RADII = [200, 500, 1000];

const WORK_LOCATIONS = [
  { label: 'work', lat: 52.499249, lng: 13.445675 },
  { label: 'wife_work', lat: 52.502698, lng: 13.412727 }
];

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class LocationService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    if (!fs.existsSync(LOC_DB_DIR)) {
      fs.mkdirSync(LOC_DB_DIR, { recursive: true });
    }
  }

  _h3Key(lat, lng) {
    return h3.latLngToCell(lat, lng, 9);
  }

  _cachePath(h3Key) {
    return path.join(LOC_DB_DIR, h3Key + '.json');
  }

  _loadFromCache(h3Key) {
    const filePath = this._cachePath(h3Key);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
  }

  _saveToCache(h3Key, data) {
    fs.writeFileSync(this._cachePath(h3Key), JSON.stringify(data, null, 2), 'utf8');
  }

  _httpGet(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('Failed to parse response: ' + body.substring(0, 200)));
          }
        });
      }).on('error', reject);
    });
  }

  async _nearbySearch(lat, lng, radius, type, keyword) {
    let url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
      '?location=' + encodeURIComponent(lat + ',' + lng) +
      '&radius=' + radius +
      '&key=' + encodeURIComponent(this.apiKey);
    if (type) {
      url += '&type=' + encodeURIComponent(type);
    }
    if (keyword) {
      url += '&keyword=' + encodeURIComponent(keyword);
    }
    return this._httpGet(url);
  }

  async _fetchTransitStations(lat, lng) {
    const result = this._httpGet(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
      '?location=' + encodeURIComponent(lat + ',' + lng) +
      '&radius=1000' +
      '&type=transit_station' +
      '&key=' + encodeURIComponent(this.apiKey)
    );
    return result;
  }

  async _fetchSupermarkets(lat, lng, brand) {
    return this._nearbySearch(lat, lng, 1000, 'supermarket', brand);
  }

  async _fetchDirections(lat, lng, destLat, destLng) {
    return this._httpGet(
      'https://maps.googleapis.com/maps/api/directions/json' +
      '?origin=' + encodeURIComponent(lat + ',' + lng) +
      '&destination=' + encodeURIComponent(destLat + ',' + destLng) +
      '&mode=transit' +
      '&departure_time=now' +
      '&alternatives=true' +
      '&key=' + encodeURIComponent(this.apiKey)
    );
  }

  _extractRouteInfo(route) {
    const leg = route.legs[0];
    const transitModes = new Set();
    const transitLines = [];
    for (const step of leg.steps) {
      if (step.travel_mode === 'TRANSIT' && step.transit_details) {
        const vehicle = step.transit_details.line.vehicle.type;
        transitModes.add(vehicle);
        transitLines.push({
          line: step.transit_details.line.short_name || step.transit_details.line.name,
          vehicle: vehicle,
          departure: step.transit_details.departure_stop.name,
          arrival: step.transit_details.arrival_stop.name
        });
      }
    }
    const busTramCount = transitLines.filter(l => l.vehicle === 'BUS' || l.vehicle === 'TRAM').length;
    return {
      durationSeconds: leg.duration.value,
      durationText: leg.duration.text,
      distanceMeters: leg.distance.value,
      distanceText: leg.distance.text,
      transitModes: Array.from(transitModes),
      transitLines: transitLines,
      departureTime: leg.departure_time ? leg.departure_time.text : null,
      arrivalTime: leg.arrival_time ? leg.arrival_time.text : null,
      _busTramCount: busTramCount
    };
  }

  _pickBestRoute(routes) {
    if (!routes || routes.length === 0) return null;
    let best = routes[0];
    let bestInfo = this._extractRouteInfo(best);
    for (let i = 1; i < routes.length; i++) {
      const info = this._extractRouteInfo(routes[i]);
      if (info._busTramCount < bestInfo._busTramCount ||
          (info._busTramCount === bestInfo._busTramCount && info.durationSeconds < bestInfo.durationSeconds)) {
        best = routes[i];
        bestInfo = info;
      }
    }
    delete bestInfo._busTramCount;
    return bestInfo;
  }

  _bucketByRadius(results, lat, lng) {
    const buckets = { '200': [], '500': [], '1000': [] };
    for (const place of results) {
      const dist = haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
      place.distanceMeters = Math.round(dist);
      if (dist <= 200) buckets['200'].push(place);
      if (dist <= 500) buckets['500'].push(place);
      if (dist <= 1000) buckets['1000'].push(place);
    }
    return buckets;
  }

  _summarizePlaces(places) {
    return places.map(p => ({
      name: p.name,
      vicinity: p.vicinity,
      lat: p.geometry.location.lat,
      lng: p.geometry.location.lng,
      distanceMeters: p.distanceMeters,
      place_id: p.place_id,
      rating: p.rating || null,
      types: p.types || []
    }));
  }

  async getLocationInfo(lat, lng) {
    const h3Key = this._h3Key(lat, lng);

    const cached = this._loadFromCache(h3Key);
    if (cached) {
      return cached;
    }

    if (!this.apiKey) {
      return { error: 'GOOGLE_MAPS_API_KEY not configured', h3Key };
    }

    try {
      const [transitResult, ...supermarketResults] = await Promise.all([
        this._fetchTransitStations(lat, lng),
        ...SUPERMARKET_BRANDS.map(brand => this._fetchSupermarkets(lat, lng, brand))
      ]);

      const transitByRadius = transitResult.results
        ? this._bucketByRadius(transitResult.results, lat, lng)
        : { '200': [], '500': [], '1000': [] };

      const transitStations = {
        within200m: { count: transitByRadius['200'].length, stations: this._summarizePlaces(transitByRadius['200']) },
        within500m: { count: transitByRadius['500'].length, stations: this._summarizePlaces(transitByRadius['500']) },
        within1000m: { count: transitByRadius['1000'].length, stations: this._summarizePlaces(transitByRadius['1000']) },
        nearest: transitResult.results && transitResult.results.length > 0
          ? {
            name: transitResult.results[0].name,
            vicinity: transitResult.results[0].vicinity,
            lat: transitResult.results[0].geometry.location.lat,
            lng: transitResult.results[0].geometry.location.lng,
            place_id: transitResult.results[0].place_id
          }
          : null
      };

      const supermarkets = {};
      for (let i = 0; i < SUPERMARKET_BRANDS.length; i++) {
        const brand = SUPERMARKET_BRANDS[i];
        const results = supermarketResults[i].results || [];
        const byRadius = this._bucketByRadius(results, lat, lng);
        supermarkets[brand] = {
          within200m: { count: byRadius['200'].length, stores: this._summarizePlaces(byRadius['200']) },
          within500m: { count: byRadius['500'].length, stores: this._summarizePlaces(byRadius['500']) },
          within1000m: { count: byRadius['1000'].length, stores: this._summarizePlaces(byRadius['1000']) }
        };
      }

      const commute = {};
      for (const wl of WORK_LOCATIONS) {
        const dirResult = await this._fetchDirections(lat, lng, wl.lat, wl.lng);
        if (dirResult.status === 'OK' && dirResult.routes && dirResult.routes.length > 0) {
          commute[wl.label] = this._pickBestRoute(dirResult.routes);
        } else {
          commute[wl.label] = { error: dirResult.status || 'unknown' };
        }
      }

      const result = {
        h3Key,
        queriedAt: new Date().toISOString(),
        transitStations,
        supermarkets,
        commute
      };

      this._saveToCache(h3Key, result);
      return result;
    } catch (err) {
      const result = { h3Key, error: err.message };
      this._saveToCache(h3Key, result);
      return result;
    }
  }

  async getWalkingDistanceToNearestStation(lat, lng) {
    const info = await this.getLocationInfo(lat, lng);
    if (info.error && !info.transitStations) {
      return info;
    }

    const nearest = info.transitStations && info.transitStations.nearest;
    if (!nearest || !nearest.place_id) {
      return { h3Key: info.h3Key, error: 'No transit station found' };
    }

    if (!this.apiKey) {
      return { error: 'GOOGLE_MAPS_API_KEY not configured', h3Key: info.h3Key };
    }

    const distanceUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json' +
      '?origins=' + encodeURIComponent(lat + ',' + lng) +
      '&destinations=place_id:' + encodeURIComponent(nearest.place_id) +
      '&mode=walking' +
      '&key=' + encodeURIComponent(this.apiKey);

    const distanceResult = await this._httpGet(distanceUrl);

    if (distanceResult.status !== 'OK' ||
        !distanceResult.rows || !distanceResult.rows[0] ||
        !distanceResult.rows[0].elements ||
        distanceResult.rows[0].elements[0].status !== 'OK') {
      return {
        h3Key: info.h3Key,
        stationName: nearest.name,
        stationVicinity: nearest.vicinity,
        error: 'Could not compute walking distance'
      };
    }

    const element = distanceResult.rows[0].elements[0];

    return {
      h3Key: info.h3Key,
      stationName: nearest.name,
      stationVicinity: nearest.vicinity,
      walkingDistanceMeters: element.distance.value,
      walkingDistanceText: element.distance.text,
      walkingDurationSeconds: element.duration.value,
      walkingDurationText: element.duration.text,
      queriedAt: new Date().toISOString()
    };
  }
}

module.exports = LocationService;
