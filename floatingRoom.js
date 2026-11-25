class FloatingRoom {
  constructor(panel) {
    this.panel = panel;
    this.home = panel.parentNode;
    this.popup = null;
  }

  open() {
    if (this.popup && !this.popup.closed) {
      this.popup.focus();
      return;
    }
    const popup = window.open('about:blank','bmo-room','popup,width=260,height=215');
    if (!popup) return;
    this.popup = popup;
    const doc = popup.document;
    doc.title = 'BMO · Sohbet';
    doc.head.append(document.querySelector('style').cloneNode(true));
    doc.documentElement.className = 'floating';
    doc.body.className = document.body.className;
    doc.body.append(this.panel);
    this.panel.style.display = 'block';
    const restore = () => {
      this.panel.style.display = 'none';
      this.home.append(this.panel);
      this.popup = null;
    };
    popup.addEventListener('pagehide',restore,{once:true});
    popup.addEventListener('keydown',e=>{if(e.key==='Escape') this.close();});
    popup.focus();
  }

  close() { if(this.popup && !this.popup.closed) this.popup.close(); }
}
