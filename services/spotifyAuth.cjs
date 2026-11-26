const http = require('node:http');
const crypto = require('node:crypto');

const encode = value => Buffer.from(value).toString('base64url');

class SpotifyAuth {
  constructor({config, api, shell, onStatus, fetchImpl = fetch, createServer = http.createServer}) {
    this.config = config;
    this.api = api;
    this.shell = shell;
    this.onStatus = onStatus;
    this.fetch = fetchImpl;
    this.createServer = createServer;
    this.server = null;
    this.timer = null;
  }

  async connect() {
    if (!this.config.clientId) throw Error('SPOTIFY_NOT_CONFIGURED');
    if (this.server) return;
    const verifier = encode(crypto.randomBytes(48));
    const state = encode(crypto.randomBytes(24));
    const challenge = encode(crypto.createHash('sha256').update(verifier).digest());
    const redirect = new URL(this.config.redirectUri);
    let exchanging = false;
    const server = this.createServer(async (request, response) => {
      let url;
      try { url = new URL(request.url, this.config.redirectUri); }
      catch { response.writeHead(400).end(); return; }
      if (this.server !== server) { response.writeHead(410).end(); return; }
      if (url.pathname !== redirect.pathname) { response.writeHead(404).end(); return; }
      if (url.searchParams.get('state') !== state) { response.writeHead(400).end('Invalid state'); return; }
      if (exchanging) { response.writeHead(409).end(); return; }
      if (url.searchParams.has('error')) { response.writeHead(200).end('Spotify bağlantısı iptal edildi.'); this.finish('disconnected'); return; }
      exchanging = true;
      try {
        const body = new URLSearchParams({grant_type:'authorization_code', code:url.searchParams.get('code') || '', redirect_uri:this.config.redirectUri, client_id:this.config.clientId, code_verifier:verifier});
        const result = await this.fetch('https://accounts.spotify.com/api/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body});
        if (!result.ok) throw Error('Spotify yetkilendirmesi tamamlanamadı');
        const token = await result.json();
        if (this.server !== server) { response.writeHead(410).end(); return; }
        if (!token.access_token || !token.refresh_token || !(token.expires_in > 0)) throw Error('Geçersiz oturum yanıtı');
        this.api.setTokens({access:token.access_token, refresh:token.refresh_token, expires:Date.now()+token.expires_in*1000});
        response.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}).end('<!doctype html><meta charset="utf-8"><title>BMO bağlandı</title><body style="font:20px system-ui;text-align:center;padding:60px;background:#e9fff0;color:#183b32"><h1>BMO, Spotify’a bağlandı!</h1><p>Bu sekmeyi kapatıp BMO’ya dönebilirsin.</p></body>');
        this.finish('connected');
      } catch (error) {
        response.writeHead(500).end('Spotify bağlantısı tamamlanamadı.');
        if (this.server === server) this.finish('error', error.message);
      }
    });
    this.server = server;
    try {
      await new Promise((resolve, reject) => server.listen(Number(redirect.port), redirect.hostname, resolve).on('error', reject));
      if (this.server !== server) return;
      this.timer = setTimeout(() => this.finish('error', 'Bağlantı süresi doldu'), 180_000);
      this.onStatus({stage:'connecting'});
      const query = new URLSearchParams({response_type:'code', client_id:this.config.clientId, scope:this.config.scopes, redirect_uri:this.config.redirectUri, state, code_challenge_method:'S256', code_challenge:challenge});
      await this.shell.openExternal('https://accounts.spotify.com/authorize?'+query);
    } catch (error) {
      if (this.server === server) this.finish('error', 'Spotify giriş sayfası açılamadı');
      throw error;
    }
  }

  finish(stage, message = '') {
    clearTimeout(this.timer);
    if (this.server) this.server.close();
    this.server = null;
    this.onStatus({stage, message});
  }
}

module.exports = {SpotifyAuth};
