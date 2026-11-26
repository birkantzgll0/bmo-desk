import * as THREE from 'three';
import { ACESFilmicToneMapping, AmbientLight, CanvasTexture, DirectionalLight, LinearFilter, OrthographicCamera, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from 'three';
import { buildReferenceBmo } from './referenceModel.js';

(async () => {
  const canvas = document.querySelector("#scene"), bubble = document.querySelector("#bubble"), thought = document.querySelector("#thought");
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false });
  renderer.setSize(180, 240, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.78, 1.78, 2.37, -2.37, 0.1, 20);
  camera.position.set(3.5, 2.2, 7);
  camera.lookAt(0, -0.35, 0);
  scene.add(new AmbientLight("#ffffff", 0.72));
  const light = new DirectionalLight("#fffaf0", 0.95);
  light.position.set(4.5, 7.5, 5.5);
  scene.add(light);
  const fill2 = new DirectionalLight("#ffe4b5", 0.35);
  fill2.position.set(-5, 2, 4);
  scene.add(fill2);
  const screenCanvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(512, 512) : document.createElement("canvas");
  screenCanvas.width = 512;
  screenCanvas.height = 512;
  const ctx = screenCanvas.getContext("2d", { alpha: false });
  const screenTexture = new CanvasTexture(screenCanvas);
  screenTexture.colorSpace = SRGBColorSpace;
  screenTexture.minFilter = LinearFilter;
  screenTexture.magFilter = LinearFilter;
  const guestInitial = new URLSearchParams(location.search).has("guest") ? await window.bmo.guestInitial() : null;
  const model = buildReferenceBmo(THREE, scene, screenTexture, guestInitial?.characterType === "BMO2" ? "#FF5BBF" : null);
  const group = model.root, body = model.body;
  group.scale.setScalar(0.9);
  group.position.y = -0.22;
  const [leftArm, rightArm] = model.arms, [leftLeg, rightLeg] = model.legs;
  const actionMap = { CHAT:"chat", PREV_TRACK: "previous", NEXT_TRACK: "next", PLAY_PAUSE: "toggle", STOP: "pause", VOL_UP: "volumeUp", VOL_DOWN: "volumeDown", EXPRESSION: "expression", WALK_TOGGLE: "dance" };
  const clickable = model.buttons.map((mesh) => ({ mesh, command: actionMap[mesh.userData.action] }));
  let state = { playing: false, title: "", artist: "", art: "", trackId: "" }, blink = false, expressionIndex = 0, danceMode = false;
  let roomPanel = null, characterAway = false;
  let volumeLevel = null, volumeUntil = 0, volumeTimer = null;
  function rounded(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.closePath();
  }
  function paintScreen() {
    ctx.fillStyle = "#C5F8CE";
    ctx.fillRect(0, 0, 512, 512);
    {
      const ink = "#142623", eyeY = 225, mouthY = 280;
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (blink) {
        ctx.lineWidth = 9;
        ctx.beginPath();
        for (const x of [144, 368]) {ctx.moveTo(x - 18, eyeY);ctx.lineTo(x + 18, eyeY);}
        ctx.stroke();
      } else if (expressionIndex === 1) {
        ctx.lineWidth = 10;
        ctx.beginPath();
        for (const x of [144, 368]) ctx.arc(x, eyeY + 8, 18, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else if (expressionIndex === 2) {
        ctx.fillRect(108, eyeY - 14, 72, 32);
        ctx.fillRect(332, eyeY - 14, 72, 32);
      } else {
        ctx.beginPath();
        for (const x of [144, 368]) ctx.arc(x, eyeY, expressionIndex === 3 ? 19 : 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(210, mouthY);
      ctx.quadraticCurveTo(256, mouthY - 5, 302, mouthY);
      ctx.bezierCurveTo(302, mouthY + 42, 210, mouthY + 42, 210, mouthY);
      ctx.closePath();
      ctx.fillStyle = "#254a40";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#fff";
      ctx.fillRect(210, mouthY - 2, 92, 10);
      ctx.fillStyle = "#58C1A8";
      ctx.beginPath();
      ctx.ellipse(256, mouthY + 28, 28, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (volumeLevel !== null && performance.now() < volumeUntil) {
      ctx.fillStyle = "rgba(20,55,47,.86)";
      rounded(77, 416, 358, 67, 10);
      ctx.fill();
      ctx.fillStyle = "#eaffef";
      ctx.textAlign = "center";
      ctx.font = "bold 18px system-ui";
      ctx.fillText("SES " + volumeLevel + "%", 256, 437);
      for (let i = 0; i < 10; i++) {
        const x = 103 + i * 31;
        ctx.fillStyle = "#9db8a9";
        ctx.fillRect(x, 448, 23, 18);
        const fill = Math.max(0, Math.min(1, volumeLevel / 10 - i));
        if (fill > 0) {ctx.fillStyle = "#8ff4aa";ctx.fillRect(x + 2, 450, 19 * fill, 14);}
      }
    }
    ctx.fillStyle = "rgba(20,65,55,.035)";
    for (let y = 0; y < 512; y += 8) ctx.fillRect(0, y, 512, 2);
    const gloss = ctx.createLinearGradient(0, 0, 512, 512);
    gloss.addColorStop(0, "rgba(255,255,255,.2)");
    gloss.addColorStop(0.48, "rgba(255,255,255,0)");
    gloss.addColorStop(1, "rgba(255,255,255,.04)");
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, 512, 512);
    screenTexture.needsUpdate = true;
    thought.style.display = state.playing && state.title ? "block" : "none";
    thought.querySelector(".track").textContent = state.title;
    thought.querySelector(".artist").textContent = state.artist;
  }
  const ray = new Raycaster(), pointer = new Vector2();
  const buttonPoint = new Vector3();
  function pickButton(e){
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    pointer.set(e.offsetX / 180 * 2 - 1, -e.offsetY / 240 * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(clickable.map((x) => x.mesh), true);

    let nearest = null, nearestDistance = Infinity;
    for (const candidate of clickable) {
      candidate.mesh.getWorldPosition(buttonPoint).project(camera);
      const x = (buttonPoint.x + 1) * 90, y = (1 - buttonPoint.y) * 120;
      const distance = Math.hypot(e.offsetX - x, e.offsetY - y);
      const radius = candidate.mesh.userData.action === "STOP" ? 11 : 9;
      if (distance <= radius && distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    if (hits.length) {
      let object = hits[0].object, entry;
      while (object && !entry) {
        entry = clickable.find((x) => x.mesh === object);
        object = object.parent;
      }
      if(entry) nearest=entry;
    }
    return nearest;
  }
  paintScreen();
  if (new URLSearchParams(location.search).has("guest")) {
    document.body.classList.add("guest");
    const transfer = guestInitial;
    if (!transfer) return;
    let avatar = group;
    const area = {x:window.screen.availLeft,y:window.screen.availTop,width:window.screen.availWidth,height:window.screen.availHeight};
    const sim = window.BmoTransferMath.denormalize(transfer,area);
    sim.x = window.screenX; sim.y = window.screenY;
    let renderX = sim.x, renderY = sim.y, grabbed = false, lastPointer = null, previousFrame = performance.now(), blinkAt = 0;
    let guestDance = false, guestPlaying = !!transfer.spotifyPlaying, peerConnected = !!transfer.peerConnected;
    window.bmo.onGuestLinkStatus(connected => peerConnected = connected);
    window.bmo.onGuestPlayback(playing => guestPlaying = playing);
    function updateGuestTrack(track) {
      if (!track) return;
      guestPlaying = !!track.playing;
      state = {...state,playing:guestPlaying,title:track.title,artist:track.artist};
      paintScreen();
    }
    window.bmo.onGuestTrack(updateGuestTrack);
    updateGuestTrack(transfer.guestTrack);

    const guestMotion=model;
    const panel=document.querySelector('#roomPanel'), input=document.querySelector('#chatInput');
    const status=document.querySelector('#roomStatus');
    const floating = new FloatingRoom(panel);
    function openChat(){
      floating.open();
      status.textContent=peerConnected?'Mesajını yaz':'Ana BMO üzerinden odaya bağlan';
      input.focus();
    }
    document.querySelector('#roomClose').onclick=()=>floating.close();
    const send=()=>{if(input.value.trim()) window.bmo.guestOutgoing(input.value);};
    document.querySelector('#chatSend').onclick=send;
    input.onkeydown=e=>{if(e.key==='Enter' && !e.repeat) send();};
    window.bmo.onGuestResult(sent=>{
      if(sent){input.value='';input.focus();}
      else status.textContent='Önce ana BMO üzerinden odaya bağlan';
    });

    let busy=false;
    canvas.addEventListener("pointerdown",async e=>{
      const hit=pickButton(e);
      if(hit){
        const action=hit.command;
        if(action==='chat') openChat();
        else if(action==='dance') guestDance=!guestDance;
        else if(action==='expression'){expressionIndex=(expressionIndex+1)%4;paintScreen();}
        else if(!busy){
          busy=true;
          try {
            if(action==='volumeUp'||action==='volumeDown'){
              volumeLevel=await window.bmo.volume(action==='volumeUp'?5:-5);
              volumeUntil=performance.now()+2600;paintScreen();
              clearTimeout(volumeTimer);volumeTimer=setTimeout(paintScreen,2700);
            } else await window.bmo.command(action==='toggle'?(guestPlaying?'pause':'play'):action);
          } catch {say('Spotify bağlantını kontrol et');}
          finally {busy=false;}
        }
        return;
      }
      grabbed = true;lastPointer={x:e.screenX,y:e.screenY,time:performance.now()};try{canvas.setPointerCapture(e.pointerId);}catch{}
    });
    window.addEventListener('keydown',e=>{if(e.target.tagName!=='INPUT' && e.key.toLowerCase()==='d'){guestDance=!guestDance;say(guestDance?'PMO dans ediyor!':'PMO dinleniyor',1800);}});
    window.addEventListener("pointermove", e => {
      if (!grabbed || !lastPointer) return;
      const dt = Math.max(.008,(performance.now()-lastPointer.time)/1000);
      const dx=e.screenX-lastPointer.x,dy=e.screenY-lastPointer.y;
      sim.x+=dx;sim.y+=dy;sim.vx=Math.max(-600,Math.min(600,dx/dt));sim.vy=Math.max(-900,Math.min(900,dy/dt));
      lastPointer={x:e.screenX,y:e.screenY,time:performance.now()};
      window.bmo.move(sim.x,sim.y);
    });
    const release = e => {
      if (!grabbed) return;
      grabbed=false;
      if (e?.pointerId!==void 0 && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const left=area.x,right=area.x+area.width-220;
      if ((!transfer.localOnly || peerConnected) && ((sim.x<=left+8&&sim.vx< -180)||(sim.x>=right-8&&sim.vx>180))) window.bmo.guestReturn(window.BmoTransferMath.normalize({x:sim.x,y:sim.y,vx:sim.vx,vy:sim.vy,area,characterType:transfer.characterType}));
    };
    window.addEventListener("pointerup",release);
    window.addEventListener("pointercancel",release);
    window.addEventListener("blur",()=>release());
    let chatTimer;
    window.bmo.onGuestChat(message=>{
      const bubble=document.querySelector('#chatBubble');bubble.textContent=message.text;bubble.dataset.sender=message.sender;bubble.style.display='block';
      clearTimeout(chatTimer);chatTimer=setTimeout(()=>bubble.style.display='none',4000);
    });
    function animateGuest(now) {
      if(now-previousFrame < 1000/30-1){requestAnimationFrame(animateGuest);return;}
      const dt=Math.min(.05,(now-previousFrame)/1000);previousFrame=now;
      if (!grabbed) window.BmoTransferMath.step(sim,dt,area);
      renderX=window.BmoTransferMath.lerp(renderX,sim.x,dt);
      renderY=window.BmoTransferMath.lerp(renderY,sim.y,dt);
      if(!grabbed) window.bmo.move(renderX,renderY);
      const pose=window.BmoCharacterMotion.pose(now/1000,guestDance,guestPlaying);
      avatar.rotation.z=window.BmoCharacterMotion.ease(avatar.rotation.z,pose.sway+Math.max(-.12,Math.min(.12,sim.vx*.00025)),dt);
      if (guestMotion) {
        body.position.y=pose.bounce;
        const [armL,armR]=guestMotion.arms,[legL,legR]=guestMotion.legs;
        const leftTarget=pose.leftArm;
        const rightTarget=pose.rightArm;
        armL.rotation.z=window.BmoCharacterMotion.ease(armL.rotation.z,leftTarget,dt);
        armR.rotation.z=window.BmoCharacterMotion.ease(armR.rotation.z,rightTarget,dt);
        legL.rotation.x=pose.leftLeg;
        legR.rotation.x=pose.rightLeg;
      }
      if (now-blinkAt>4000) {blinkAt=now;blink=true;paintScreen();setTimeout(()=>{blink=false;paintScreen();},140);}
      renderer.render(scene,camera);
      requestAnimationFrame(animateGuest);
    }
    requestAnimationFrame(animateGuest);
    return;
  }
  async function applyTrack(data) {
    const item = data?.item, playing = !!data?.is_playing, title = item?.name || "", artist = item?.artists?.map((x) => x.name).join(", ") || "";
    const trackId = item?.id || "";
    state.progressMs = Math.max(0, Math.round(data?.progress_ms || 0));
    if (state.playing === playing && state.title === title && state.artist === artist && state.trackId === trackId) return;
    state = { playing, title, artist, trackId, progressMs: Math.max(0, Math.round(data?.progress_ms || 0)) };
    window.bmo.guestPlayback(playing);
    window.bmo.guestTrack({playing,title,artist});
    paintScreen();
  }
  let connected = false, polling = false;
  const connectionPanel = new window.BmoConnectionPanel(window.bmo, (status, meta) => {
    connected = status.stage === "connected";
    if (connected && !meta.initial && !meta.wasConnected) { refresh(); say("Spotify ba\u011Fland\u0131!"); }
    if (!connected) applyTrack(null);
  });
  async function refresh() {
    if (!connected || polling) return;
    polling = true;
    try {
      await applyTrack(await window.bmo.track());
    } catch (e) {
      if (String(e).includes("SPOTIFY_AUTH_EXPIRED")) connectionPanel.update({stage:"disconnected",message:"Oturum sona erdi. Yeniden bağlan."});
    } finally {
      polling = false;
    }
  }
  await connectionPanel.init();
  roomPanel = new window.BmoRoomPanel({
    bmo:window.bmo,
    onTransfer:payload => {
      if (characterAway && payload.characterType === roomPanel.characterType) {characterAway=false;window.bmo.showCharacter();}
      else window.bmo.spawnGuest(payload);
    },
    onPeerState:status => {
      model.setCharacter(roomPanel.characterType);
      if (characterAway && ['ready','offline','error'].includes(status.status)) {characterAway=false;window.bmo.showCharacter();}
    }
  });
  roomPanel.init();
  window.bmo.onGuestReturn(payload => roomPanel.sendTransfer(payload));
  setInterval(refresh, 3e3);
  refresh();
  let commandQueue = Promise.resolve(), pendingCommands = 0;
  function command(which) {
    if (pendingCommands >= 4) return;
    pendingCommands++;
    commandQueue = commandQueue.then(() => runCommand(which)).catch(() => say("Komut i\u015Flenemedi")).finally(() => pendingCommands--);
  }
  async function runCommand(which) {
    if (which === "expression") {
      expressionIndex = (expressionIndex + 1) % 4;
      paintScreen();
      say("BMO!");
      return;
    }
    if (which === "dance") {
      danceMode = !danceMode;
      say(danceMode ? "Dans zaman\u0131!" : "Biraz dinleneyim");
      return;
    }
    if (!connected) {
      say("Spotify i\xE7in sa\u011F t\u0131kla");
      return;
    }
    try {
      if (which === "volumeUp" || which === "volumeDown") {
        const level = await window.bmo.volume(which === "volumeUp" ? 5 : -5);
        volumeLevel = level;
        volumeUntil = performance.now() + 2600;
        clearTimeout(volumeTimer);
        volumeTimer = setTimeout(paintScreen, 2700);
        paintScreen();
        say("Ses: " + level + "%");
        return;
      }
      const cmd = which === "toggle" ? state.playing ? "pause" : "play" : which;
      await window.bmo.command(cmd);
      if (which === "toggle" || which === "pause") {
        state.playing = cmd === "play";
        paintScreen();
      }
      setTimeout(refresh, 450);
    } catch (e) {
      const message = String(e);
      if (message.includes("NO_ACTIVE_DEVICE") || message.includes("404")) say("Play something on Spotify first!");
      else if (message.includes("SPOTIFY_PERMISSION") || message.includes("401") || message.includes("403")) {
        connected = false;
        say("Spotify iznini yenile");
        showSettings();
      } else say(message.match(/Spotify API: \d+/)?.[0] || "Spotify komutu ba\u015Far\u0131s\u0131z");
    }
  }
  let dragging = false, start = null, last = null, vx = 0, vy = 0, windowX = window.screenX, windowY = window.screenY, lastTime = 0;
  canvas.addEventListener("pointerdown", (e) => {
    const nearest=pickButton(e);
    if (nearest) {
      nearest.mesh.userData.targetOffset = nearest.mesh.userData.pressAmount;
      setTimeout(() => nearest.mesh.userData.targetOffset = 0, 130);
      if(nearest.command==="chat") roomPanel.open(true);
      else command(nearest.command);
      return;
    }
    dragging = true;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    start = { x: e.screenX, y: e.screenY };
    last = start;
    windowX = window.screenX;
    windowY = window.screenY;
    vx = 0;
    vy = 0;
    lastTime = performance.now();
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now(), dt = Math.max(8e-3, (now - lastTime) / 1e3), dx = e.screenX - last.x, dy = e.screenY - last.y;
    vx = 0.5 * vx + 0.5 * dx / dt;
    vy = 0.5 * vy + 0.5 * dy / dt;
    vx = Math.max(-600, Math.min(600, vx));
    vy = Math.max(-900, Math.min(900, vy));
    windowX += dx;
    windowY += dy;
    window.bmo.move(windowX, windowY);
    last = { x: e.screenX, y: e.screenY };
    lastTime = now;
  });
  function finishDrag(e) {
    if (!dragging) return;
    dragging = false;
    if (e?.pointerId !== void 0 && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    const floor = window.screen.availTop + window.screen.availHeight - 300;
    if (windowY < floor - 4) say("D\xFC\u015F\xFCyorum!");
    else if (Math.abs(vx) + Math.abs(vy) > 200) say("Dur, yapma!");
  }
  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
  window.addEventListener("blur", () => finishDrag());
  function say(text, duration = 2500) {
    clearTimeout(say.timer);
    clearTimeout(say.hideTimer);
    bubble.textContent = text;
    bubble.style.display = "block";
    requestAnimationFrame(() => bubble.style.opacity = "1");
    say.timer = setTimeout(() => {
      bubble.style.opacity = "0";
      say.hideTimer = setTimeout(() => bubble.style.display = "none", 300);
    }, duration);
  }
  function showSettings() {
    connectionPanel.show();
  }
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showSettings();
  });
  let previous = performance.now(), blinkTime = 0;
  function animate(now) {
      if(now-previous < 1000/30-1){requestAnimationFrame(animate);return;}
    const dt = Math.min(0.05, (now - previous) / 1e3);
    previous = now;
    const t = now / 1e3;
    if (!dragging) {
      vy += 1850 * dt;
      windowX += vx * dt;
      windowY += vy * dt;
      vx *= Math.exp(-5 * dt);
      const left = window.screen.availLeft, right = left + window.screen.availWidth - 220;
      const crossing = windowX < left && vx < -250 || windowX > right && vx > 250;
      if (crossing && !characterAway && roomPanel?.isConnected()) {
        const area = {x:left,y:window.screen.availTop,width:window.screen.availWidth,height:window.screen.availHeight};
        const payload = window.BmoTransferMath.normalize({x:windowX,y:windowY,vx,vy,area,characterType:roomPanel.characterType});
        if (roomPanel.sendTransfer(payload)) {characterAway=true;window.bmo.hideCharacter();vx=0;vy=0;}
      }
      if (windowX < left) {
        windowX = left;
        vx = Math.abs(vx) * 0.36;
      }
      if (windowX > right) {
        windowX = right;
        vx = -Math.abs(vx) * 0.36;
      }
      const floor = window.screen.availTop + window.screen.availHeight - 300;
      if (windowY >= floor) {
        windowY = floor;
        if (vy > 130) {
          vy *= -0.35;
          say("Ah!");
        } else vy = 0;
      }
      if (Math.abs(vx) + Math.abs(vy) > 1) window.bmo.move(windowX, windowY);
    }
    const pose = window.BmoCharacterMotion.pose(t,danceMode,state.playing);
    group.rotation.z += (Math.max(-0.2, Math.min(0.2, vx * 25e-5)) + pose.sway - group.rotation.z) * Math.min(1, dt * 7);
    body.position.y = pose.bounce;
    leftArm.rotation.z = window.BmoCharacterMotion.ease(leftArm.rotation.z,pose.leftArm,dt);
    rightArm.rotation.z = window.BmoCharacterMotion.ease(rightArm.rotation.z,pose.rightArm,dt);
    leftLeg.rotation.x = pose.leftLeg;
    rightLeg.rotation.x = pose.rightLeg;
    for (const entry of clickable) {
      const d = entry.mesh.userData;
      d.currentOffset += (d.targetOffset - d.currentOffset) * 0.28;
      entry.mesh.position.z = d.basePos.z + d.currentOffset;
    }
    if (t - blinkTime > 4) {
      blinkTime = t;
      blink = true;
      paintScreen();
      setTimeout(() => {
        blink = false;
        paintScreen();
      }, 140);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
})().catch((error2) => {
  document.body.style.background = "#70C6A6";
  document.body.innerText = "BMO render error: " + (error2?.message || error2);
  window.bmo?.rendererError?.(String(error2?.stack || error2));
});
