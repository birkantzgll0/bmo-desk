class BmoConnectionPanel {
  constructor(bmo, onChange) {
    this.bmo = bmo;
    this.onChange = onChange;
    this.root = document.querySelector('#settings');
    this.state = document.querySelector('#connectionState');
    this.connectButton = document.querySelector('#connect');
    this.disconnectButton = document.querySelector('#disconnect');
    this.error = document.querySelector('#error');
    this.configured = false;
    this.stage = 'disconnected';
  }

  async init() {
    this.connectButton.onclick = () => this.connect();
    this.disconnectButton.onclick = () => this.disconnect();
    document.querySelector('#hide').onclick = () => this.hide();
    document.querySelector('#top').onchange = event => this.bmo.top(event.target.checked);
    this.bmo.onConnection(status => this.update(status));
    this.update(await this.bmo.status(), true);
    if (this.stage !== 'connected') this.show();
  }

  update(status, initial = false) {
    const wasConnected = this.stage === 'connected';
    this.configured = status.configured ?? this.configured;
    this.stage = status.stage;
    this.state.className = status.stage === 'connected' ? 'connected' : status.stage === 'error' ? 'error' : '';
    this.state.textContent = !this.configured ? 'Kurulum eksik: .env dosyasını kontrol et' : status.stage === 'connected' ? 'Spotify bağlı · BMO hazır' : status.stage === 'connecting' ? 'Spotify sayfasında izin bekleniyor…' : status.message || 'Spotify bağlantısı bekleniyor';
    this.connectButton.disabled = !this.configured || status.stage === 'connecting' || status.stage === 'connected';
    this.connectButton.textContent = status.stage === 'connected' ? 'Spotify bağlı' : status.stage === 'connecting' ? 'Bağlanıyor…' : 'Spotify ile bağlan';
    this.disconnectButton.style.display = status.stage === 'connected' ? 'block' : 'none';
    this.error.textContent = status.stage === 'error' ? status.message : '';
    this.onChange(status, {initial, wasConnected});
    if (status.stage === 'connected' && !initial) this.hide();
  }

  async connect() {
    this.update({stage:'connecting'});
    try { await this.bmo.connect(); }
    catch (error) { this.update({stage:'error', message:String(error.message || error)}); }
  }

  async disconnect() {
    try { await this.bmo.disconnect(); }
    catch (error) { this.update({stage:'error', message:String(error.message || error)}); }
  }

  show() { this.root.style.display = 'block'; }
  hide() { this.root.style.display = 'none'; }
}

window.BmoConnectionPanel = BmoConnectionPanel;
