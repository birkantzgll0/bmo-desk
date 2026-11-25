const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {loadConfig} = require('../services/config.cjs');
const {TokenStore} = require('../services/tokenStore.cjs');
const {SpotifyApi} = require('../services/spotifyApi.cjs');
const {PlayerService} = require('../services/playerService.cjs');
const {SpotifyAuth} = require('../services/spotifyAuth.cjs');

test('config reads client ID only from .env', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bmo-config-'));
  try {
    const id = 'a'.repeat(32);
    fs.writeFileSync(path.join(directory, '.env'), 'SPOTIFY_CLIENT_ID='+id+'\n');
    assert.equal(loadConfig({executableDir:directory,sourceDir:directory}).clientId, id);
    fs.writeFileSync(path.join(directory, '.env'), 'SPOTIFY_CLIENT_ID=invalid\n');
    assert.equal(loadConfig({executableDir:directory,sourceDir:directory}).clientId, '');
  } finally { fs.rmSync(directory, {recursive:true,force:true}); }
});

test('legacy session migrates into encrypted token file without client ID', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bmo-token-'));
  const legacy = path.join(directory, 'spotify.json');
  const tokens = {access:'access-token',refresh:'refresh-token',expires:Date.now()+60_000};
  fs.writeFileSync(legacy, JSON.stringify({clientId:'b'.repeat(32),tokens}));
  const encryption = {isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value.split('').reverse().join('')),decryptString:value=>value.toString().split('').reverse().join('')};
  try {
    const store = new TokenStore({userData:directory,appData:directory,safeStorage:encryption});
    assert.deepEqual(store.load(), tokens);
    assert.equal(fs.existsSync(legacy), false);
    assert.equal(fs.readFileSync(store.file).includes(Buffer.from(tokens.access)), false);
    store.clear();
    assert.equal(fs.existsSync(store.file), false);
  } finally { fs.rmSync(directory, {recursive:true,force:true}); }
});

test('player commands accept successful non-JSON Spotify responses', async () => {
  const calls = [];
  const store = {load:()=>({access:'token',refresh:'refresh',expires:Date.now()+120_000}),save:()=>{},clear:()=>{}};
  const fetchImpl = async (url, options) => {
    calls.push({url,method:options.method,body:options.body});
    if (url.endsWith('/me/player')) return {ok:true,status:200,text:async()=>JSON.stringify({device:{id:'device',volume_percent:55},item:{id:'song'}})};
    return {ok:true,status:200,text:async()=> 'non-json-success'};
  };
  const api = new SpotifyApi({config:{clientId:'c'.repeat(32)},tokenStore:store,fetchImpl});
  const player = new PlayerService(api);
  assert.equal(await player.command('pause'), null);
  assert.equal(await player.changeVolume(5), 60);
  assert.equal(await player.playTrack('A'.repeat(22), 12345), null);
  assert.ok(calls.some(call=>call.url.endsWith('/me/player/pause') && call.method==='PUT'));
  assert.ok(calls.some(call=>call.url.includes('volume_percent=60')));
  assert.ok(calls.some(call=>call.url.endsWith('/me/player/play') && JSON.parse(call.body).uris[0]==='spotify:track:'+'A'.repeat(22) && JSON.parse(call.body).position_ms===12345));
});

test('PKCE connection exchanges callback and reports connected state', async () => {
  const config = {clientId:'d'.repeat(32),redirectUri:'http://127.0.0.1:43891/callback',scopes:'user-read-playback-state'};
  let saved, authorizationUrl, callbackHandler, connected = false;
  const response = {writeHead:()=>response,end:()=>response};
  const server = {listen:(_port,_host,done)=>{queueMicrotask(done);return {on:()=>{}};},close:()=>{}};
  const auth = new SpotifyAuth({
    config,
    api:{setTokens:tokens => saved = tokens},
    shell:{openExternal:async url => {
      authorizationUrl = new URL(url);
      const callback = new URL(config.redirectUri);
      callback.searchParams.set('code', 'code');
      callback.searchParams.set('state', authorizationUrl.searchParams.get('state'));
      await callbackHandler({url:callback.pathname+callback.search}, response);
    }},
    onStatus:status => {if(status.stage === 'connected') connected = true;},
    createServer:handler => {callbackHandler = handler; return server;},
    fetchImpl:async (_, options) => {
      assert.equal(options.body.get('code_verifier')?.length > 20, true);
      return {ok:true,json:async()=>({access_token:'access',refresh_token:'refresh',expires_in:3600})};
    }
  });
  await auth.connect();
  assert.equal(connected, true);
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(saved.access, 'access');
  assert.equal(saved.refresh, 'refresh');
});
