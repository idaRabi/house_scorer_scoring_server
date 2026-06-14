const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'DB');

class ScoreStore {
  constructor() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
  }

  _filePath(id) {
    return path.join(DB_DIR, id + '.json');
  }

  save(id, result) {
    const data = {
      id,
      savedAt: new Date().toISOString(),
      ...result
    };
    fs.writeFileSync(this._filePath(id), JSON.stringify(data, null, 2), 'utf8');
  }

  load(id) {
    const filePath = this._filePath(id);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  delete(id) {
    const filePath = this._filePath(id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  list() {
    if (!fs.existsSync(DB_DIR)) {
      return [];
    }
    return fs.readdirSync(DB_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(DB_DIR, f), 'utf8'));
        return { id: data.id, savedAt: data.savedAt, score: data.score };
      });
  }
}

module.exports = ScoreStore;
