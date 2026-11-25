class SpotifyApi {
  constructor({config, tokenStore, fetchImpl = fetch}) {
    this.config = config;
    this.tokenStore = tokenStore;
    this.fetch = fetchImpl;
    this.tokens = tokenStore.load();
  }

  isConnected() { return !!this.tokens; }
  setTokens(tokens) { this.tokenStore.save(tokens); this.tokens = tokens; }
  disconnect() { this.tokenStore.clear(); this.tokens = null; }

  async refreshToken() {
    const body = new URLSearchParams({grant_type:'refresh_token', refresh_token:this.tokens.refresh, client_id:this.config.clientId});
    const response = await this.fetch('https://accounts.spotify.com/api/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body});
    if (!response.ok) throw Error('SPOTIFY_AUTH_EXPIRED');
    const updated = await response.json();
    this.setTokens({access:updated.access_token, refresh:updated.refresh_token || this.tokens.refresh, expires:Date.now()+updated.expires_in*1000});
  }

  async request(route, method = 'GET', jsonBody = null) {
    if (!this.tokens) throw Error('SPOTIFY_NOT_CONNECTED');
    if (Date.now() > this.tokens.expires - 60_000) await this.refreshToken();
    const headers = {Authorization:'Bearer '+this.tokens.access};
    if (jsonBody) headers['Content-Type'] = 'application/json';
    const response = await this.fetch('https://api.spotify.com/v1'+route, {method, headers, ...(jsonBody ? {body:JSON.stringify(jsonBody)} : {})});
    if (response.status === 204) return null;
    if (!response.ok) {
      const detail = await response.text();
      const code = response.status === 404 ? 'NO_ACTIVE_DEVICE' : response.status === 401 ? 'SPOTIFY_AUTH_EXPIRED' : response.status === 403 ? 'SPOTIFY_PERMISSION' : 'Spotify API: '+response.status+' '+detail.slice(0,120);
      throw Error(code);
    }
    if (method !== 'GET') return null;
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }
}

module.exports = {SpotifyApi};
