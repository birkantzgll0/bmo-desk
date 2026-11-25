const {contextBridge,ipcRenderer}=require('electron');
let lastX,lastY;
contextBridge.exposeInMainWorld('bmo',{
 status:()=>ipcRenderer.invoke('spotify-status'),
 connect:()=>ipcRenderer.invoke('spotify-connect'),
 disconnect:()=>ipcRenderer.invoke('spotify-disconnect'),
 track:()=>ipcRenderer.invoke('spotify-track'),
 command:cmd=>ipcRenderer.invoke('spotify-command',cmd),
 volume:delta=>ipcRenderer.invoke('spotify-volume',delta),
 playTrack:(id,positionMs)=>ipcRenderer.invoke('spotify-play-track',id,positionMs),
 top:flag=>ipcRenderer.invoke('window-top',flag),
 move:(x,y)=>{
   x=Math.round(x); y=Math.round(y);
   if(x===lastX && y===lastY) return;
   lastX=x;lastY=y;ipcRenderer.send('window-move',x,y);
 },
 guestOutgoing:message=>ipcRenderer.send('guest-outgoing',message),
 onGuestOutgoing:fn=>ipcRenderer.on('guest-outgoing',(_,data)=>fn(data)),
 guestResult:(id,sent)=>ipcRenderer.send('guest-result',id,sent),
 onGuestResult:fn=>ipcRenderer.on('guest-result',(_,sent)=>fn(sent)),
 guestInitial:()=>ipcRenderer.invoke('guest-initial'),
 spawnGuest:payload=>ipcRenderer.invoke('guest-spawn',payload),
 guestChat:message=>ipcRenderer.send('guest-chat',message),
 guestReturn:payload=>ipcRenderer.send('guest-return',payload),
 guestLinkStatus:connected=>ipcRenderer.send('guest-link-status',connected),
 guestPlayback:playing=>ipcRenderer.send('guest-playback',playing),
 guestTrack:track=>ipcRenderer.send('guest-track',track),
 hideCharacter:()=>ipcRenderer.send('window-hide-character'),
 showCharacter:()=>ipcRenderer.send('window-show-character'),
 onGuestChat:fn=>ipcRenderer.on('guest-chat',(_,message)=>fn(message)),
 onGuestReturn:fn=>ipcRenderer.on('guest-return',(_,payload)=>fn(payload)),
 onGuestLinkStatus:fn=>ipcRenderer.on('guest-link-status',(_,connected)=>fn(connected)),
 onGuestPlayback:fn=>ipcRenderer.on('guest-playback',(_,playing)=>fn(playing)),
 onGuestTrack:fn=>ipcRenderer.on('guest-track',(_,track)=>fn(track)),
 onConnection:fn=>ipcRenderer.on('spotify-connection',(_,status)=>fn(status)),
 rendererError:message=>ipcRenderer.send('renderer-error',message)
});
