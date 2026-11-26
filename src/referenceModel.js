export function buildReferenceBmo(THREE, scene, screenTexture, chassisColor) {
  const outlineMat = new THREE.MeshBasicMaterial({
    color: "#172926",
    side: THREE.BackSide
  });
  function addToonOutline(mesh, thickness = 0.024) {
    const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
    outlineMesh.scale.set(1 + thickness, 1 + thickness * 0.85, 1 + thickness);
    mesh.add(outlineMesh);
    return outlineMesh;
  }
  function createRoundedBoxGeometry(width, height, depth, radius, bevelSize, bevelSegments = 5) {
    const shape = new THREE.Shape();
    const w = width - bevelSize * 2;
    const h = height - bevelSize * 2;
    const r = Math.max(0.01, radius - bevelSize);
    const x = -w / 2;
    const y = -h / 2;
    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);
    const extrudeSettings = {
      depth: depth - bevelSize * 2,
      bevelEnabled: true,
      bevelSegments,
      steps: 1,
      bevelSize,
      bevelThickness: bevelSize,
      curveSegments: 14
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }
  function createSidePanelTexture(isRightSide) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = chassisColor || "#58C1A8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ink = "#172926";
    ctx.fillStyle = ink;
    const spX = 256;
    const spY = 175;
    const dotR = 13;
    const ringR = 48;
    ctx.beginPath();
    ctx.arc(spX, spY, dotR, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      ctx.beginPath();
      ctx.arc(spX + Math.cos(angle) * ringR, spY + Math.sin(angle) * ringR, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(256, 375);
    ctx.rotate(isRightSide ? Math.PI / 2 : -Math.PI / 2);
    ctx.font = '900 168px "Arial Black", "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(256, 565);
    ctx.rotate(isRightSide ? Math.PI / 2 : -Math.PI / 2);
    ctx.font = '900 168px "Arial Black", "Inter", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("M", 0, 0);
    ctx.restore();
    const oY = 765;
    ctx.beginPath();
    ctx.arc(256, oY, 72, 0, Math.PI * 2);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(256, oY, 46, 0, Math.PI * 2);
    ctx.fillStyle = "#243b38";
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }
  const bmoRoot = new THREE.Group();
  scene.add(bmoRoot);
  const bmoBodyGroup = new THREE.Group();
  bmoRoot.add(bmoBodyGroup);
  const bodyWidth = 2.15;
  const bodyHeight = 2.82;
  const bodyDepth = 1.32;
  const tealMat = new THREE.MeshStandardMaterial({
    color: chassisColor || "#70C6A6",
    roughness: 0.48,
    metalness: 0.03
  });
  const bodyGeo = createRoundedBoxGeometry(bodyWidth, bodyHeight, bodyDepth, 0.2, 0.065, 6);
  const bodyMesh = new THREE.Mesh(bodyGeo, tealMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bmoBodyGroup.add(bodyMesh);
  addToonOutline(bodyMesh, 0.022);
  const sidePanelGeo = new THREE.PlaneGeometry(bodyDepth - 0.16, bodyHeight - 0.16);
  const rightSidePanel = new THREE.Mesh(
    sidePanelGeo,
    new THREE.MeshStandardMaterial({ map: createSidePanelTexture(true), roughness: 0.5 })
  );
  rightSidePanel.rotation.y = Math.PI / 2;
  rightSidePanel.position.set(bodyWidth / 2 + 2e-3, 0, 0);
  bmoBodyGroup.add(rightSidePanel);
  const leftSidePanel = new THREE.Mesh(
    sidePanelGeo,
    new THREE.MeshStandardMaterial({ map: createSidePanelTexture(false), roughness: 0.5 })
  );
  leftSidePanel.rotation.y = -Math.PI / 2;
  leftSidePanel.position.set(-bodyWidth / 2 - 2e-3, 0, 0);
  bmoBodyGroup.add(leftSidePanel);
  const frontZ = bodyDepth / 2;
  const bezelMat = new THREE.MeshStandardMaterial({
    color: "#172926",
    roughness: 0.7
  });
  const bezelGeo = createRoundedBoxGeometry(1.68, 1.24, 0.04, 0.13, 0.015, 3);
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
  bezelMesh.position.set(0, 0.62, frontZ - 8e-3);
  bmoBodyGroup.add(bezelMesh);
  const screenShape = new THREE.Shape();
  const sw = 1.61, sh = 1.17, sr = 0.11;
  screenShape.moveTo(-sw / 2, -sh / 2 + sr);
  screenShape.lineTo(-sw / 2, sh / 2 - sr);
  screenShape.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2 + sr, sh / 2);
  screenShape.lineTo(sw / 2 - sr, sh / 2);
  screenShape.quadraticCurveTo(sw / 2, sh / 2, sw / 2, sh / 2 - sr);
  screenShape.lineTo(sw / 2, -sh / 2 + sr);
  screenShape.quadraticCurveTo(sw / 2, -sh / 2, sw / 2 - sr, -sh / 2);
  screenShape.lineTo(-sw / 2 + sr, -sh / 2);
  screenShape.quadraticCurveTo(-sw / 2, -sh / 2, -sw / 2, -sh / 2 + sr);
  const screenPlaneGeo = new THREE.ShapeGeometry(screenShape, 12);
  const posAttr = screenPlaneGeo.attributes.position;
  const uvAttr = screenPlaneGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    uvAttr.setXY(i, (posAttr.getX(i) + sw / 2) / sw, (posAttr.getY(i) + sh / 2) / sh);
  }
  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissiveMap: screenTexture,
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: 0.35,
    roughness: 0.28
  });
  const screenMesh = new THREE.Mesh(screenPlaneGeo, screenMat);
  screenMesh.position.set(0, 0.62, frontZ + 0.015);
  bmoBodyGroup.add(screenMesh);
  const slotMat = new THREE.MeshStandardMaterial({ color: "#1b3631", roughness: 0.8 });
  const slotGeo = createRoundedBoxGeometry(0.82, 0.085, 0.05, 0.02, 0.01, 2);
  const slotMesh = new THREE.Mesh(slotGeo, slotMat);
  slotMesh.position.set(-0.36, -0.16, frontZ + 5e-3);
  addToonOutline(slotMesh, 0.06);
  bmoBodyGroup.add(slotMesh);
  const darkBlueMat = new THREE.MeshStandardMaterial({ color: "#1e3a8a", roughness: 0.4 });
  const miniBtnGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.06, 24);
  miniBtnGeo.rotateX(Math.PI / 2);
  const miniBtnMesh = new THREE.Mesh(miniBtnGeo, darkBlueMat);
  miniBtnMesh.position.set(0.54, -0.16, frontZ + 0.015);
  addToonOutline(miniBtnMesh, 0.14);
  bmoBodyGroup.add(miniBtnMesh);
  const interactiveButtons = [];
  function registerButton(mesh, actionName, label, pressAmount = -0.04, pitch = 1) {
    mesh.userData = {
      isButton: true,
      action: actionName,
      label,
      basePos: mesh.position.clone(),
      targetOffset: 0,
      currentOffset: 0,
      pressAmount,
      pitch
    };
    interactiveButtons.push(mesh);
  }
  const yellowMat = new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.38 });
  const dpadX = -0.46;
  const dpadY = -0.62;
  const dpadZ = frontZ + 0.035;
  const dpadCore = new THREE.Mesh(createRoundedBoxGeometry(0.18, 0.18, 0.09, 0.02, 0.01, 2), yellowMat);
  dpadCore.position.set(dpadX, dpadY, dpadZ);
  bmoBodyGroup.add(dpadCore);
  const armL = 0.18, armT = 0.17, armD = 0.09;
  const dpadUp = new THREE.Mesh(createRoundedBoxGeometry(armT, armL, armD, 0.03, 0.015, 2), yellowMat);
  dpadUp.position.set(dpadX, dpadY + 0.16, dpadZ);
  addToonOutline(dpadUp, 0.09);
  bmoBodyGroup.add(dpadUp);
  registerButton(dpadUp, "VOL_UP", "Ses Y\xFCkselt", -0.035, 1.25);
  const dpadDown = new THREE.Mesh(createRoundedBoxGeometry(armT, armL, armD, 0.03, 0.015, 2), yellowMat);
  dpadDown.position.set(dpadX, dpadY - 0.16, dpadZ);
  addToonOutline(dpadDown, 0.09);
  bmoBodyGroup.add(dpadDown);
  registerButton(dpadDown, "VOL_DOWN", "Ses Azalt", -0.035, 0.85);
  const dpadLeft = new THREE.Mesh(createRoundedBoxGeometry(armL, armT, armD, 0.03, 0.015, 2), yellowMat);
  dpadLeft.position.set(dpadX - 0.16, dpadY, dpadZ);
  addToonOutline(dpadLeft, 0.09);
  bmoBodyGroup.add(dpadLeft);
  registerButton(dpadLeft, "PREV_TRACK", "\xD6nceki \u015Eark\u0131", -0.035, 0.95);
  const dpadRight = new THREE.Mesh(createRoundedBoxGeometry(armL, armT, armD, 0.03, 0.015, 2), yellowMat);
  dpadRight.position.set(dpadX + 0.16, dpadY, dpadZ);
  addToonOutline(dpadRight, 0.09);
  bmoBodyGroup.add(dpadRight);
  registerButton(dpadRight, "NEXT_TRACK", "Sonraki \u015Eark\u0131", -0.035, 1.15);
  const triShape = new THREE.Shape();
  const ts = 0.135;
  triShape.moveTo(0, ts);
  triShape.lineTo(-ts * 0.92, -ts * 0.72);
  triShape.lineTo(ts * 0.92, -ts * 0.72);
  triShape.closePath();
  const triGeo = new THREE.ExtrudeGeometry(triShape, {
    depth: 0.075,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.015,
    bevelThickness: 0.015
  });
  triGeo.center();
  const cyanTriMat = new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.35 });
  const triBtn = new THREE.Mesh(triGeo, cyanTriMat);
  triBtn.position.set(0.26, -0.52, frontZ + 0.038);
  triBtn.castShadow = true;
  addToonOutline(triBtn, 0.12);
  bmoBodyGroup.add(triBtn);
  registerButton(triBtn, "WALK_TOGGLE", "Dans", -0.04, 1.35);
  const greenGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.085, 28);
  greenGeo.rotateX(Math.PI / 2);
  const greenBtn = new THREE.Mesh(greenGeo, new THREE.MeshStandardMaterial({ color: "#4ade80", roughness: 0.38 }));
  greenBtn.position.set(0.58, -0.6, frontZ + 0.038);
  greenBtn.castShadow = true;
  addToonOutline(greenBtn, 0.13);
  bmoBodyGroup.add(greenBtn);
  registerButton(greenBtn, "CHAT", "Sohbet", -0.04, 1.2);
  const redGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.095, 32);
  redGeo.rotateX(Math.PI / 2);
  const redBtn = new THREE.Mesh(redGeo, new THREE.MeshStandardMaterial({ color: "#e11d48", roughness: 0.36 }));
  redBtn.position.set(0.35, -0.84, frontZ + 0.042);
  redBtn.castShadow = true;
  addToonOutline(redBtn, 0.1);
  bmoBodyGroup.add(redBtn);
  registerButton(redBtn, "STOP", "Durdur", -0.045, 0.9);
  const pillGeo = createRoundedBoxGeometry(0.21, 0.065, 0.055, 0.03, 0.01, 2);
  const pillLeft = new THREE.Mesh(pillGeo, darkBlueMat);
  pillLeft.position.set(-0.58, -1.04, frontZ + 0.02);
  addToonOutline(pillLeft, 0.1);
  bmoBodyGroup.add(pillLeft);
  registerButton(pillLeft, "STOP", "Durdur", -0.025, 0.8);
  const pillRight = new THREE.Mesh(pillGeo, darkBlueMat);
  pillRight.position.set(-0.29, -1.04, frontZ + 0.02);
  addToonOutline(pillRight, 0.1);
  bmoBodyGroup.add(pillRight);
  registerButton(pillRight, "PLAY_PAUSE", "Oynat / Duraklat", -0.025, 1.3);
  const limbMat = new THREE.MeshStandardMaterial({
    color: "#5A8B96",
    roughness: 0.52,
    metalness: 0.04
  });
  function createArmAssembly(sideSign) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(sideSign * (bodyWidth / 2 - 0.04), -0.68, 0);
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(sideSign * 0.17, -0.26, 0.03),
      new THREE.Vector3(sideSign * 0.24, -0.58, 0.06),
      new THREE.Vector3(sideSign * 0.21, -0.84, 0.08)
    ]);
    const armTubeGeo = new THREE.TubeGeometry(armCurve, 20, 0.072, 14, false);
    const armMesh = new THREE.Mesh(armTubeGeo, limbMat);
    armMesh.castShadow = true;
    addToonOutline(armMesh, 0.16);
    shoulderPivot.add(armMesh);
    const handGroup = new THREE.Group();
    handGroup.position.set(sideSign * 0.21, -0.86, 0.08);
    handGroup.rotation.z = sideSign * 0.15;
    const palmGeo = new THREE.SphereGeometry(0.088, 16, 16);
    palmGeo.scale(0.85, 1.25, 0.72);
    const palmMesh = new THREE.Mesh(palmGeo, limbMat);
    palmMesh.castShadow = true;
    addToonOutline(palmMesh, 0.15);
    handGroup.add(palmMesh);
    const fingerGeo = new THREE.CylinderGeometry(0.022, 0.02, 0.09, 10);
    [-0.042, 0, 0.042].forEach((fz, idx) => {
      const finger = new THREE.Mesh(fingerGeo, limbMat);
      finger.position.set(0, -0.09 - (idx === 1 ? 0.012 : 0), fz);
      addToonOutline(finger, 0.22);
      handGroup.add(finger);
    });
    shoulderPivot.add(handGroup);
    return shoulderPivot;
  }
  const leftArmPivot = createArmAssembly(-1);
  const rightArmPivot = createArmAssembly(1);
  bmoBodyGroup.add(leftArmPivot);
  bmoBodyGroup.add(rightArmPivot);
  function createLegAssembly(sideSign) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(sideSign * 0.44, -bodyHeight / 2 + 0.04, 0.02);
    const legHeight = 0.72;
    const legGeo = new THREE.CylinderGeometry(0.078, 0.076, legHeight, 16);
    const legMesh = new THREE.Mesh(legGeo, limbMat);
    legMesh.position.y = -legHeight / 2;
    legMesh.castShadow = true;
    addToonOutline(legMesh, 0.15);
    hipPivot.add(legMesh);
    const footGeo = createRoundedBoxGeometry(0.175, 0.125, 0.34, 0.06, 0.038, 6);
    const footMesh = new THREE.Mesh(footGeo, limbMat);
    footMesh.position.set(0, -legHeight - 0.02, 0.085);
    footMesh.castShadow = true;
    addToonOutline(footMesh, 0.11);
    hipPivot.add(footMesh);
    return hipPivot;
  }
  const leftLegPivot = createLegAssembly(-1);
  const rightLegPivot = createLegAssembly(1);
  bmoRoot.add(leftLegPivot);
  bmoRoot.add(rightLegPivot);
  function setCharacter(type) {
    const color = type === "BMO2" ? "#FF5BBF" : null;
    if (color === chassisColor) return;
    chassisColor = color;
    tealMat.color.set(color || "#70C6A6");
    for (const panel of [leftSidePanel,rightSidePanel]) {
      panel.material.map.dispose();
      panel.material.map = createSidePanelTexture(panel === rightSidePanel);
    }
  }
  return { setCharacter, root: bmoRoot, body: bmoBodyGroup, buttons: interactiveButtons, arms: [leftArmPivot, rightArmPivot], legs: [leftLegPivot, rightLegPivot] };
}
