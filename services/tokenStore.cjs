const fs = require('node:fs');
const path = require('node:path');

class TokenStore {
  constructor({userData, appData, safeStorage}) {
    this.file = path.join(userData, 'spotify-tokens.bin');
    this.legacy = [path.join(userData, 'spotify.json'), path.join(appData, 'BMO-Desk', 'spotify.json'), path.join(appData, 'bmodesk-webgl', 'spotify.json')];
    this.safeStorage = safeStorage;
  }

  ensureEncryption() {
    if (!this.safeStorage.isEncryptionAvailable()) throw Error('Güvenli oturum saklama kullanılamıyor');
  }

  load() {
    if (fs.existsSync(this.file)) {
      this.ensureEncryption();
      return JSON.parse(this.safeStorage.decryptString(fs.readFileSync(this.file)));
    }
    for (const file of this.legacy) {
      try {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!saved.tokens?.access || !saved.tokens?.refresh) continue;
        this.save(saved.tokens);
        fs.unlinkSync(file);
        return saved.tokens;
      } catch {}
    }
    return null;
  }

  save(tokens) {
    this.ensureEncryption();
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    fs.writeFileSync(this.file, this.safeStorage.encryptString(JSON.stringify(tokens)));
  }

  clear() {
    if (fs.existsSync(this.file)) fs.unlinkSync(this.file);
  }
}

module.exports = {TokenStore};
