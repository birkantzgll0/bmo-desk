const {app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage, safeStorage, screen} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {loadConfig} = require('./services/config.cjs');
const {TokenStore} = require('./services/tokenStore.cjs');
const {SpotifyApi} = require('./services/spotifyApi.cjs');
const {SpotifyAuth} = require('./services/spotifyAuth.cjs');
const {PlayerService} = require('./services/playerService.cjs');
const transferMath = require('./transferMath.js');
app.disableHardwareAcceleration();

function reportError(error) {
  const message = error?.stack || error?.message || String(error);
  try { fs.appendFileSync(path.join(os.tmpdir(), 'BMO-Desk-error.log'), new Date().toISOString()+' '+message+'\n'); } catch {}
  try { dialog.showErrorBox('BMO Application Error', message); } catch {}
}
process.on('uncaughtException', reportError);
process.on('unhandledRejection', reportError);

app.setName('BMO Desk');
const userData = path.join(app.getPath('appData'), 'BMO Desk');
fs.mkdirSync(userData, {recursive:true});
app.setPath('userData', userData);
app.setAppUserModelId('BMO.Desk');
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) { app.quit(); return; }

let window, tray, api, auth, player;
const guestWindows = new Map();
let peerConnected = false, spotifyPlaying = false, guestTrack = null;
let connection = {stage:'disconnected', message:''};
const config = loadConfig({executableDir:path.dirname(process.execPath), sourceDir:__dirname});
const publishConnection = update => {
  connection = {...connection, ...update};
  if (window && !window.isDestroyed()) window.webContents.send('spotify-connection', connection);
};

function enableChatWindow(owner) {
  let position;
  function fit(bounds) {
    const area = screen.getDisplayMatching(bounds).workArea;
    return {
      x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - bounds.width)),
      y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - bounds.height))
    };
  }
  owner.webContents.setWindowOpenHandler(({url, frameName}) => {
    if (url !== 'about:blank' || frameName !== 'bmo-room') return {action:'deny'};
    const bounds = owner.getBounds();
    const start = fit({...position || {x:bounds.x - 260, y:bounds.y}, width:260,height:215});
    return {action:'allow', overrideBrowserWindowOptions:{
      ...start,width:260,height:215,frame:false,transparent:true,alwaysOnTop:true,
      skipTaskbar:true,resizable:false,hasShadow:false,backgroundColor:'#00000000'
    }};
  });
  owner.webContents.on('did-create-window', child => {
    function confine() {
      if (child.isDestroyed()) return;
      const bounds = child.getBounds();
      position = fit(bounds);
      if (bounds.x !== position.x || bounds.y !== position.y) child.setPosition(position.x,position.y);
    }
    child.on('moved',confine);
    child.on('close',()=>{position=fit(child.getBounds());});
    const closeChat=()=>{if(!child.isDestroyed())child.destroy();};
    owner.once('closed',closeChat);
    child.once('closed',()=>owner.removeListener('closed',closeChat));
    child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  });
}

app.on('second-instance', () => { if (window) { window.show(); window.focus(); } });
app.whenReady().then(() => {
  const store = new TokenStore({userData, appData:app.getPath('appData'), safeStorage});
  api = new SpotifyApi({config, tokenStore:store});
  player = new PlayerService(api);
  connection = {stage:api.isConnected() ? 'connected' : 'disconnected', message:''};
  auth = new SpotifyAuth({config, api, shell, onStatus:publishConnection});

  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
  tray.setToolTip('BMO Desk');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'BMO’yu Göster', click:() => {window?.show(); window?.focus();}},
    {label:'BMO’yu Kapat', click:() => app.quit()}
  ]));
  tray.on('double-click', () => {window?.show(); window?.focus();});

  window = new BrowserWindow({width:220,height:300,frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,resizable:false,skipTaskbar:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  enableChatWindow(window);
  window.setMenu(null);
  window.loadFile(path.join(__dirname,'index.html')).catch(reportError);
  window.webContents.on('render-process-gone', (_, details) => reportError(new Error('Renderer stopped: '+details.reason)));
  window.webContents.on('did-fail-load', (_, code, description) => reportError(new Error('Page load failed: '+code+' '+description)));
  ipcMain.on('renderer-error', (_, message) => reportError(new Error(message)));

  ipcMain.handle('spotify-status', () => ({...connection, configured:!!config.clientId}));
  ipcMain.handle('spotify-connect', () => auth.connect());
  ipcMain.handle('spotify-disconnect', () => { api.disconnect(); auth.finish('disconnected'); });
  const usePlayer = async action => {
    try { return await action(); }
    catch (error) {
      if (error.message === 'SPOTIFY_AUTH_EXPIRED') {
        api.disconnect();
        publishConnection({stage:'disconnected',message:'Spotify oturumu sona erdi. Yeniden bağlan.'});
      }
      throw error;
    }
  };
  ipcMain.handle('spotify-track', () => usePlayer(() => player.currentTrack()));
  ipcMain.handle('spotify-command', (_, command) => usePlayer(() => player.command(command)));
  ipcMain.handle('spotify-volume', (_, delta) => usePlayer(() => player.changeVolume(delta)));
  ipcMain.handle('spotify-play-track', (_, trackId, positionMs) => usePlayer(() => player.playTrack(trackId, positionMs)));
  ipcMain.handle('window-top', (_, flag) => window.setAlwaysOnTop(!!flag));
  ipcMain.handle('guest-initial', event => guestWindows.get(event.sender.id)?.payload || null);
  ipcMain.handle('guest-spawn', (event, payload) => {
    if (event.sender !== window.webContents || guestWindows.size >= 2 || [...guestWindows.values()].some(guest => guest.payload.characterType === payload?.characterType)) return false;
    if (!payload || !['BMO','BMO2'].includes(payload.characterType) || ![payload.posXPercent,payload.posYPercent,payload.velocityX,payload.velocityY].every(Number.isFinite) || payload.posXPercent < 0 || payload.posXPercent > 1 || payload.posYPercent < 0 || payload.posYPercent > 1 || Math.abs(payload.velocityX) > 2 || Math.abs(payload.velocityY) > 2) return false;
    const area = screen.getPrimaryDisplay().workArea;
    const start = transferMath.denormalize(payload, area);
    const guest = new BrowserWindow({width:220,height:300,x:Math.round(start.x),y:Math.round(start.y),frame:false,transparent:true,backgroundColor:'#00000000',alwaysOnTop:true,resizable:false,skipTaskbar:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
    enableChatWindow(guest);
    const guestId = guest.webContents.id;
    guestWindows.set(guestId, {window:guest,payload:{...payload,peerConnected,spotifyPlaying,guestTrack}});
    guest.on('closed', () => guestWindows.delete(guestId));
    guest.loadFile(path.join(__dirname,'index.html'), {query:{guest:'1'}}).catch(reportError);
    return true;
  });
  ipcMain.on('guest-outgoing',(event,message)=>{
    const guest=guestWindows.get(event.sender.id);
    if(guest && typeof message==='string' && message.trim() && !window.isDestroyed()) window.webContents.send('guest-outgoing',{id:event.sender.id,sender:guest.payload.characterType,message:message.trim().slice(0,140)});
  });
  ipcMain.on('guest-result',(event,id,sent)=>{
    if(event.sender===window.webContents) guestWindows.get(id)?.window.webContents.send('guest-result',!!sent);
  });
  ipcMain.on('guest-chat', (event, message) => {
    if (event.sender !== window.webContents || typeof message?.text !== 'string') return;
    for (const guest of guestWindows.values()) guest.window.webContents.send('guest-chat', {text:message.text.slice(0,168),sender:message.sender});
  });
  ipcMain.on('guest-link-status', (event, connected) => {
    if (event.sender !== window.webContents) return;
    peerConnected = !!connected;
    for (const guest of guestWindows.values()) guest.window.webContents.send('guest-link-status', !!connected);
  });
  ipcMain.on('guest-playback', (event, playing) => {
    if (event.sender !== window.webContents) return;
    spotifyPlaying = !!playing;
    for (const guest of guestWindows.values()) guest.window.webContents.send('guest-playback', !!playing);
  });
  ipcMain.on('guest-track', (event, track) => {
    if (event.sender !== window.webContents || !track || typeof track !== 'object') return;
    guestTrack = {
      playing: !!track.playing,
      title: String(track.title || '').slice(0,200),
      artist: String(track.artist || '').slice(0,200)
    };
    for (const guest of guestWindows.values()) guest.window.webContents.send('guest-track', guestTrack);
  });
  ipcMain.on('guest-return', (event, payload) => {
    const guest = guestWindows.get(event.sender.id);
    if (!guest || !payload || !['BMO','BMO2'].includes(payload.characterType) || ![payload.posXPercent,payload.posYPercent,payload.velocityX,payload.velocityY].every(Number.isFinite) || payload.posXPercent < 0 || payload.posXPercent > 1 || payload.posYPercent < 0 || payload.posYPercent > 1 || Math.abs(payload.velocityX) > 2 || Math.abs(payload.velocityY) > 2) return;
    window.webContents.send('guest-return', payload);
    guest.window.close();
  });
  ipcMain.on('window-hide-character', event => { if (event.sender === window.webContents) window.hide(); });
  ipcMain.on('window-show-character', event => { if (event.sender === window.webContents) window.show(); });
  ipcMain.on('window-move', (event, x, y) => {
    const target = BrowserWindow.fromWebContents(event.sender);
    if (!target || target.isDestroyed() || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const bounds = screen.getDisplayMatching(target.getBounds()).workArea;
    target.setPosition(Math.round(Math.max(bounds.x,Math.min(x,bounds.x+bounds.width-220))),Math.round(Math.max(bounds.y,Math.min(y,bounds.y+bounds.height-300))));
  });
  const bounds = screen.getPrimaryDisplay().workArea;
  window.setPosition(bounds.x+bounds.width-245,bounds.y+bounds.height-300);
}).catch(reportError);
app.on('window-all-closed', () => app.quit());
