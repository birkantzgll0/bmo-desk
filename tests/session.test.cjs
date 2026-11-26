const test = require('node:test');
const assert = require('node:assert/strict');
const {SpotifyApi} = require('../services/spotifyApi.cjs');
const {SpotifyAuth} = require('../services/spotifyAuth.cjs');

function expiredStore() {
  return {
    tokens: {access:'old', refresh:'old-refresh', expires:0},
    load() { return this.tokens; },
    save(tokens) { this.tokens = tokens; },
    clear() { this.tokens = null; }
  };
}

test('simultaneous requests share one refresh and logout discards its result', async () => {
  const store = expiredStore();
  const gate = Promise.withResolvers();
  let calls = 0;
  const api = new SpotifyApi({config:{}, tokenStore:store, fetchImpl:() => {calls++; return gate.promise;}});
  const results = Promise.allSettled([api.request('/track'), api.request('/track')]);
  assert.equal(calls, 1);
  api.disconnect();
  gate.resolve({ok:true, json:async () => ({access_token:'late', expires_in:3600})});
  for (const result of await results) assert.match(result.reason.message, /SESSION_CHANGED/);
  assert.equal(store.tokens, null);
  assert.equal(api.isConnected(), false);
});

test('temporary refresh failure preserves login and invalid_grant clears it', async () => {
  const store = expiredStore();
  let error = 'temporarily_unavailable';
  const api = new SpotifyApi({config:{}, tokenStore:store, fetchImpl:async () => ({
    ok:false, json:async () => ({error})
  })});
  await assert.rejects(api.request('/track'), /REFRESH_FAILED/);
  assert.equal(store.tokens.access, 'old');
  error = 'invalid_grant';
  await assert.rejects(api.request('/track'), /AUTH_EXPIRED/);
  assert.equal(store.tokens, null);
});

test('unreadable token store starts disconnected and allows a new login', () => {
  const store = expiredStore();
  store.load = () => { throw Error('Unreadable encrypted file'); };
  const api = new SpotifyApi({config:{}, tokenStore:store});
  assert.equal(api.isConnected(), false);
  assert.ok(api.loadError);
  api.setTokens({access:'new', refresh:'new-refresh', expires:Date.now()+120000});
  assert.equal(api.isConnected(), true);
});

test('invalid state keeps callback alive and a cancelled exchange cannot finish a later login', async () => {
  const gate = Promise.withResolvers();
  const attempts = [];
  const statuses = [];
  let saves = 0;
  const auth = new SpotifyAuth({
    config:{clientId:'fixture', redirectUri:'http://127.0.0.1:43891/callback'},
    createServer(handler) {
      attempts.push({handler});
      return { listen(port, host, done) { queueMicrotask(done); return this; }, on(){}, close(){} };
    },
    shell:{openExternal:async url => { attempts.at(-1).state = new URL(url).searchParams.get('state'); }},
    api:{setTokens(){ saves++; }},
    onStatus:status => statuses.push(status.stage),
    fetchImpl:() => gate.promise
  });
  const response = () => ({writeHead(code){this.code=code; return this;}, end(){}});
  try {
    await auth.connect();
    const first = attempts[0];
    const invalid = response();
    await first.handler({url:'/callback?state=wrong'}, invalid);
    assert.equal(invalid.code, 400);
    assert.ok(auth.server);
    const late = response();
    const pending = first.handler({url:'/callback?code=test&state='+first.state}, late);
    auth.finish('disconnected');
    await auth.connect();
    const current = auth.server;
    gate.resolve({ok:true, json:async () => ({access_token:'late', refresh_token:'r', expires_in:3600})});
    await pending;
    assert.equal(late.code, 410);
    assert.equal(auth.server, current);
    assert.equal(statuses.at(-1), 'connecting');
    assert.equal(saves, 0);
  } finally { auth.finish('disconnected'); }
});
