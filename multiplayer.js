class BmoRoom {
  constructor({PeerClass = window.Peer, onState = () => {}, onMessage = () => {}} = {}) {
    this.PeerClass = PeerClass;
    this.onState = onState;
    this.onMessage = onMessage;
    this.peer = null;
    this.connection = null;
    this.roomCode = '';
    this.isHost = false;
    this.attempts = 0;
  }

  static code() {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    return 'BMO-' + String(random[0] % 10000).padStart(4, '0');
  }

  start() {
    if (!this.PeerClass) { this.onState({status:'error',message:'WebRTC yüklenemedi'}); return; }
    this.roomCode = BmoRoom.code();
    const peer = new this.PeerClass(this.roomCode, {debug:0});
    this.peer = peer;
    this.onState({status:'opening',roomCode:this.roomCode});
    peer.on('open', id => this.onState({status:'ready',roomCode:id}));
    peer.on('connection', connection => this.attach(connection, true));
    peer.on('disconnected', () => {if(!this.connection?.open)this.onState({status:'offline',roomCode:this.roomCode});});
    peer.on('error', error => {
      if (error.type === 'unavailable-id' && ++this.attempts < 5) { peer.destroy(); this.start(); return; }
      if(this.connection?.open) return;
      if(this.connection){const pending=this.connection;this.connection=null;pending.close();}
      this.onState({status:'error',roomCode:this.roomCode,message:error.message || 'Oda bağlantısı kurulamadı'});
    });
  }

  connect(code) {
    if (this.connection) return;
    const normalized = String(code).trim().toUpperCase();
    if (!/^BMO-\d{4}$/.test(normalized)) throw Error('Oda kodu BMO-0000 biçiminde olmalı');
    if (normalized === this.roomCode) throw Error('Kendi odana bağlanamazsın');
    if (!this.peer?.open) throw Error('Odan henüz hazır değil');
    this.onState({status:'connecting',roomCode:this.roomCode});
    this.attach(this.peer.connect(normalized, {reliable:true}), false);
  }

  attach(connection, isHost) {
    if (this.connection) { connection.close(); return; }
    this.connection = connection;
    this.isHost = isHost;
    connection.on('open', () => this.onState({status:'connected',roomCode:this.roomCode,peerCode:connection.peer,isHost}));
    connection.on('data', data => {
      if (this.connection!==connection || !data || typeof data !== 'object') return;
      try { if (JSON.stringify(data).length > 1000) return; } catch { return; }
      if (data.type === 'CHAT' && typeof data.message === 'string' && data.message.length <= 140) this.onMessage({type:'CHAT',sender:data.sender==='BMO2'?'BMO2':'BMO',message:data.message,...(typeof data.name==='string' && data.name.trim()?{name:data.name.trim().slice(0,24)}:{})});
      if (data.type === 'TRANSFER' && Number.isFinite(data.posXPercent) && data.posXPercent >= 0 && data.posXPercent <= 1 && Number.isFinite(data.posYPercent) && data.posYPercent >= 0 && data.posYPercent <= 1 && Number.isFinite(data.velocityX) && Math.abs(data.velocityX) <= 2 && Number.isFinite(data.velocityY) && Math.abs(data.velocityY) <= 2 && ['BMO','BMO2'].includes(data.characterType)) this.onMessage(data);
    });
    connection.on('close', () => { if (this.connection === connection) { this.connection = null; this.onState({status:'ready',roomCode:this.roomCode}); } });
    connection.on('error', error => {
      if(this.connection!==connection) return;
      this.connection=null;connection.close();
      this.onState({status:'error',roomCode:this.roomCode,message:error.message || 'Eş bağlantısı koptu'});
    });
  }

  send(payload) {
    if (!this.connection?.open) return false;
    this.connection.send(payload);
    return true;
  }

  close() { this.connection?.close(); this.peer?.destroy(); }
}

if (typeof window !== 'undefined') window.BmoRoom = BmoRoom;
if (typeof module !== 'undefined' && module.exports) module.exports = BmoRoom;
