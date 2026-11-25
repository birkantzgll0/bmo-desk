const fs = require('node:fs');
const path = require('node:path');

function readEnv(file) {
  try {
    return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line && !/^\s*#/.test(line)).map(line => {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) return [];
      return [match[1], match[2].replace(/^(["'])(.*)\1$/, '$2')];
    }).filter(pair => pair.length === 2));
  } catch { return {}; }
}

function loadConfig({executableDir, sourceDir}) {
  const external = path.join(executableDir, '.env');
  const local = path.join(sourceDir, '.env');
  const values = readEnv(fs.existsSync(external) ? external : local);
  const clientId = values.SPOTIFY_CLIENT_ID || '';
  return {
    clientId: /^[a-f\d]{32}$/i.test(clientId) ? clientId : '',
    redirectUri: 'http://127.0.0.1:43891/callback',
    scopes: 'user-read-currently-playing user-read-playback-state user-modify-playback-state'
  };
}

module.exports = {loadConfig, readEnv};
