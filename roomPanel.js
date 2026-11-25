class BmoRoomPanel {
  constructor({bmo, onTransfer = () => {}, onPeerState = () => {}}) {
    this.bmo = bmo;
    this.onTransfer = onTransfer;
    this.onPeerState = onPeerState;
    this.panel = document.querySelector('#roomPanel');
    this.floating = new FloatingRoom(this.panel);
    this.status = this.panel.querySelector('#roomStatus');
    this.chatBubble = document.querySelector('#chatBubble');
    this.room = new window.BmoRoom({onState:state => this.update(state),onMessage:message => this.receive(message)});
    this.characterType = 'BMO';
  }

  init() {
    this.bmo.onGuestOutgoing(({id,message,sender}) => this.bmo.guestResult(id,this.publishChat(this.characterType,message)));
    this.panel.querySelector('#roomClose').onclick = () => this.close();
    this.panel.querySelector('#roomConnect').onclick = () => {
      try { this.room.connect(this.panel.querySelector('#peerCode').value); }
      catch (error) { this.status.textContent = error.message; }
    };
    document.querySelector('#chatSend').onclick = () => this.sendChat();
    this.panel.querySelector('#chatInput').onkeydown = event => { if (event.key === 'Enter') this.sendChat(); };
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') { this.close(); document.activeElement.blur(); }
      if (event.key.toLowerCase() === 'c' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {event.preventDefault();this.open(true);}
    });
    this.nameInput=document.querySelector('#displayName');
    this.nameInput.value=localStorage.getItem('bmo.displayName') || '';
    this.nameInput.oninput=()=>localStorage.setItem('bmo.displayName',this.nameInput.value.slice(0,24));
    this.room.start();
  }

  update(state) {
    this.panel.querySelector('#roomCode').textContent = state.status === 'opening' ? 'Hazırlanıyor' : (state.roomCode || 'Hazırlanıyor');
    const labels = {opening:'Oda açılıyor…',ready:'Kodunu arkadaşınla paylaş',connecting:'Arkadaşına bağlanıyor…',connected:'Bağlandı: '+state.peerCode,offline:'Ağ bağlantısı kesildi',error:state.message || 'Bağlantı hatası'};
    this.status.textContent = labels[state.status] || 'Eş bağlantısı bekleniyor';
    this.characterType = this.isConnected() && !this.room.isHost ? 'BMO2' : 'BMO';
    if (state.status === 'connected') this.status.textContent += this.room.isHost ? ' · Yeşil BMO' : ' · Pembe PMO';
    this.panel.querySelector('#roomConnect').disabled = !this.room.peer?.open || !!this.room.connection || state.status==='connecting';
    this.nameInput.placeholder=this.characterType==='BMO2'?'PMO':'BMO';
    if(state.status==='connected'){ this.open(); this.panel.querySelector('#roomDetails').open=false; }
    this.onPeerState(state);
    this.bmo.guestLinkStatus(state.status === 'connected');
  }

  open(focusChat = false) { this.floating.open(); if (!this.isConnected()) this.panel.querySelector('#roomDetails').open=true; if (focusChat) this.panel.querySelector('#chatInput').focus(); }
  close() { this.floating.close(); }
  isConnected() { return !!this.room.connection?.open; }

  showChat(message) {
    this.chatBubble.textContent = message;
    this.chatBubble.style.display = 'block';
    clearTimeout(this.chatTimer);
    this.chatTimer = setTimeout(() => this.chatBubble.style.display = 'none', 4000);
  }

  sendChat() {
    const input = this.panel.querySelector('#chatInput');
    const message = input.value.trim().slice(0,140);
    if (!message) return;
    if (!this.publishChat(this.characterType,message)) { this.panel.querySelector('#roomDetails').open=true; this.status.textContent = 'Önce bir arkadaşa bağlan'; return; }
    input.value = '';
    input.focus();
  }

  publishChat(sender,message) {
    const chat={type:'CHAT',sender,message,name:this.nameInput.value.trim().slice(0,24)};
    if (!this.room.send(chat)) return false;
    this.receive(chat);
    return true;
  }

  receive(message) {
    if (message.type === 'CHAT') {
      const text = (message.name || (message.sender==='BMO2'?'PMO':'BMO'))+': '+message.message;
      this.chatBubble.dataset.sender=message.sender;
      this.showChat(text);
      this.bmo.guestChat({text,sender:message.sender});
    }
    if (message.type === 'TRANSFER') this.onTransfer(message);

  }

  sendTransfer(payload) { return this.room.send({type:'TRANSFER',...payload}); }

}

window.BmoRoomPanel = BmoRoomPanel;
