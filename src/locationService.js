const https = require('https');
const fs = require('fs');
const path = require('path');
const h3 = require('h3-js');

const LOC_DB_DIR = path.join(__dirname, '..', 'LOC_DB');

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

  async getWalkingDistanceToNearestStation(lat, lng) {
    const h3Key = this._h3Key(lat, lng);

    const cached = this._loadFromCache(h3Key);
    if (cached) {
      return cached;
    }

    if (!this.apiKey) {
      return { error: 'GOOGLE_MAPS_API_KEY not configured', h3Key };
    }

    try {
      const nearbyUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
        '?location=' + encodeURIComponent(lat + ',' + lng) +
        '&rankby=distance' +
        '&type=transit_station' +
        '&key=' + encodeURIComponent(this.apiKey);

      const nearbyResult = await this._httpGet(nearbyUrl);

      if (nearbyResult.status !== 'OK' || !nearbyResult.results || nearbyResult.results.length === 0) {
        const result = { h3Key, error: 'No transit station found nearby' };
        this._saveToCache(h3Key, result);
        return result;
      }

      const station = nearbyResult.results[0];

      const distanceUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json' +
        '?origins=' + encodeURIComponent(lat + ',' + lng) +
        '&destinations=place_id:' + encodeURIComponent(station.place_id) +
        '&mode=walking' +
        '&key=' + encodeURIComponent(this.apiKey);

      const distanceResult = await this._httpGet(distanceUrl);

      if (distanceResult.status !== 'OK' ||
          !distanceResult.rows || !distanceResult.rows[0] ||
          !distanceResult.rows[0].elements ||
          distanceResult.rows[0].elements[0].status !== 'OK') {
        const result = {
          h3Key,
          stationName: station.name,
          stationVicinity: station.vicinity,
          error: 'Could not compute walking distance'
        };
        this._saveToCache(h3Key, result);
        return result;
      }

      const element = distanceResult.rows[0].elements[0];

      const result = {
        h3Key,
        stationName: station.name,
        stationVicinity: station.vicinity,
        walkingDistanceMeters: element.distance.value,
        walkingDistanceText: element.distance.text,
        walkingDurationSeconds: element.duration.value,
        walkingDurationText: element.duration.text,
        queriedAt: new Date().toISOString()
      };

      this._saveToCache(h3Key, result);
      return result;
    } catch (err) {
      const result = { h3Key, error: err.message };
      this._saveToCache(h3Key, result);
      return result;
    }
  }
}

module.exports = LocationService;
