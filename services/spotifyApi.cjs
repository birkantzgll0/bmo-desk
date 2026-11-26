class SpotifyApi {
  constructor({config, tokenStore, fetchImpl = fetch}) {
    this.config = config;
    this.tokenStore = tokenStore;
    this.fetch = fetchImpl;
    this.tokens = null;
    this.loadError = '';
    this.refreshJob = null;
    try {
      const saved = tokenStore.load();
      if (saved) {
        if (!saved.access || !saved.refresh || !Number.isFinite(saved.expires)) throw Error('Invalid session');
        this.tokens = saved;
      }
    } catch {
      this.loadError = 'Kayıtlı Spotify oturumu okunamadı. Yeniden bağlan.';
    }
  }

  isConnected() { return !!this.tokens; }
  setTokens(tokens) { this.tokenStore.save(tokens); this.tokens = tokens; }
  disconnect() { this.tokenStore.clear(); this.tokens = null; }

  refreshToken() {
    const session = this.tokens;
    if (this.refreshJob?.session === session) return this.refreshJob.promise;
    const job = {session};
    this.refreshJob = job;
    job.promise = this.refreshSession(session).finally(() => {
      if (this.refreshJob === job) this.refreshJob = null;
    });
    return job.promise;
  }

  expireSession(session) {
    if (this.tokens !== session) throw Error('SPOTIFY_SESSION_CHANGED');
    this.disconnect();
    throw Error('SPOTIFY_AUTH_EXPIRED');
  }

  async refreshSession(session) {
    const body = new URLSearchParams({grant_type:'refresh_token', refresh_token:session.refresh, client_id:this.config.clientId});
    const response = await this.fetch('https://accounts.spotify.com/api/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body});
    const updated = await response.json().catch(() => null);
    if (this.tokens !== session) throw Error('SPOTIFY_SESSION_CHANGED');
    if (updated?.error === 'invalid_grant') this.expireSession(session);
    if (!response.ok || !updated?.access_token || !(updated.expires_in > 0)) throw Error('SPOTIFY_REFRESH_FAILED');
    this.setTokens({access:updated.access_token, refresh:updated.refresh_token || session.refresh, expires:Date.now()+updated.expires_in*1000});
  }

  async request(route, method = 'GET', jsonBody = null) {
    if (!this.tokens) throw Error('SPOTIFY_NOT_CONNECTED');
    if (Date.now() > this.tokens.expires - 60_000) await this.refreshToken();
    const session = this.tokens;
    if (!session) throw Error('SPOTIFY_NOT_CONNECTED');
    const headers = {Authorization:'Bearer '+session.access};
    if (jsonBody) headers['Content-Type'] = 'application/json';
    const response = await this.fetch('https://api.spotify.com/v1'+route, {method, headers, ...(jsonBody ? {body:JSON.stringify(jsonBody)} : {})});
    if (response.status === 401) this.expireSession(session);
    if (response.status === 204) return null;
    if (!response.ok) {
      const detail = await response.text();
      const code = response.status === 404 ? 'NO_ACTIVE_DEVICE' : response.status === 403 ? 'SPOTIFY_PERMISSION' : 'Spotify API: '+response.status+' '+detail.slice(0,120);
      throw Error(code);
    }
    if (method !== 'GET') return null;
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  }
}

module.exports = {SpotifyApi};
