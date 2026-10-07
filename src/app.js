import { intersectSolid } from './intersections.js';
import * as THREE from 'three';

/* ================================================================
   LaserScan Lab — educational terrestrial laser scanner simulator
   ================================================================ */
const T = THREE;
const DEG = Math.PI / 180;
const ROOM = { w: 16, d: 11, h: 3.4 };
const W2 = ROOM.w / 2, D2 = ROOM.d / 2, RH = ROOM.h;
const MAXPTS = 1200000;
const PALETTE = [0xff5a52, 0x35c4b5, 0xf2b544];
const PALETTE_CSS = ['#ff5a52', '#35c4b5', '#f2b544'];
const SPEEDS = [1, 2, 4, 8, 16, 32, 64, 128, 256, Infinity];

const state = {
  hStep: 1.2, vStep: 1.2, vfov: 135, maxRange: 25, noise: 6, cutoff: 82,
  height: 1.6, speedIdx: 1, colorMode: 'distance', ptSize: 0.048,
  cloudOnly: false, showLaser: true, autoRescan: true, viewMode: 'orbit', mode: 'room', showGaps: false
};

/* ---------------- renderer & scene ---------------- */
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.getElementById('scene').appendChild(renderer.domElement);

const scene = new T.Scene();
const BG_LIGHT = 0xdedcd9, BG_DARK = 0x14151a;
scene.background = new T.Color(BG_LIGHT);

const camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 400);

const hemi = new T.HemisphereLight(0xffffff, 0x8a7c6c, 0.85);
scene.add(hemi);
const sun = new T.DirectionalLight(0xffffff, 0.75);
sun.position.set(7, 10, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -13; sun.shadow.camera.right = 13;
sun.shadow.camera.top = 13; sun.shadow.camera.bottom = -13;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0004;
scene.add(sun);

/* ---------------- room (inward-facing planes = dollhouse view) ---------------- */
const roomG = new T.Group();
function roomPlane(w, h, color) {
  const m = new T.Mesh(new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));
  m.receiveShadow = true;
  return m;
}
const floor = roomPlane(ROOM.w, ROOM.d, 0x9d8b7a); floor.rotation.x = -Math.PI / 2; roomG.add(floor);
const ceil = roomPlane(ROOM.w, ROOM.d, 0xe9e7e4); ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; roomG.add(ceil);
const wallN = roomPlane(ROOM.w, RH, 0xdbd9d5); wallN.position.set(0, RH / 2, -D2); roomG.add(wallN);
const wallS = roomPlane(ROOM.w, RH, 0xd6d4d0); wallS.rotation.y = Math.PI; wallS.position.set(0, RH / 2, D2); roomG.add(wallS);
const wallW = roomPlane(ROOM.d, RH, 0xdedcd8); wallW.rotation.y = Math.PI / 2; wallW.position.set(-W2, RH / 2, 0); roomG.add(wallW);
const wallE = roomPlane(ROOM.d, RH, 0xd8d6d2); wallE.rotation.y = -Math.PI / 2; wallE.position.set(W2, RH / 2, 0); roomG.add(wallE);
scene.add(roomG);

/* ---------------- scanner (tripod + head) ---------------- */
function cylBetween(a, b, r, mat) {
  const d = new T.Vector3().subVectors(b, a);
  const len = d.length();
  const m = new T.Mesh(new T.CylinderGeometry(r, r, len, 10), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return m;
}
function makeScanner(colorHex) {
  const g = new T.Group();
  const H = state.height;
  const dark = new T.MeshStandardMaterial({ color: 0x35363c, roughness: 0.55, metalness: 0.35 });
  const dark2 = new T.MeshStandardMaterial({ color: 0x26272c, roughness: 0.5, metalness: 0.45 });
  const hubY = H - 0.42;
  const spread = 0.5 * Math.max(0.75, H / 1.6);
  for (let k = 0; k < 3; k++) {
    const a = k * (Math.PI * 2 / 3) + 0.52;
    g.add(cylBetween(new T.Vector3(Math.cos(a) * spread, 0, Math.sin(a) * spread),
      new T.Vector3(0, hubY, 0), 0.026, dark));
  }
  const col = new T.Mesh(new T.CylinderGeometry(0.048, 0.048, H - 0.2 - hubY + 0.04, 12), dark);
  col.position.y = (hubY + H - 0.2) / 2; g.add(col);
  const body = new T.Mesh(new T.BoxGeometry(0.3, 0.24, 0.24), dark2);
  body.position.y = H - 0.08; g.add(body);

  const head = new T.Group(); head.position.y = H + 0.05;
  const postGeo = new T.CylinderGeometry(0.028, 0.028, 0.18, 10);
  const p1 = new T.Mesh(postGeo, dark2); p1.position.set(0, 0.02, 0.105); head.add(p1);
  const p2 = new T.Mesh(postGeo, dark2); p2.position.set(0, 0.02, -0.105); head.add(p2);
  const scope = new T.Mesh(new T.CylinderGeometry(0.046, 0.046, 0.36, 14), dark);
  scope.rotation.z = Math.PI / 2; scope.position.set(-0.1, 0.05, 0); head.add(scope);
  const mirSpin = new T.Group();
  mirSpin.position.set(0.12, 0.05, 0);
  const mirror = new T.Mesh(new T.CylinderGeometry(0.065, 0.065, 0.012, 20),
    [dark2, new T.MeshPhongMaterial({ color: 0xdde6f2, specular: 0xffffff, shininess: 150 }), dark2]);
  mirror.rotation.z = Math.PI / 4;
  mirSpin.add(mirror);
  head.add(mirSpin);
  const dot = new T.Mesh(new T.SphereGeometry(0.013, 8, 8),
    new T.MeshBasicMaterial({ color: 0xff2016 }));
  dot.position.set(0.02, 0.05, 0); head.add(dot);
  g.add(head);

  const ring = new T.Mesh(new T.RingGeometry(0.24, 0.34, 32),
    new T.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; g.add(ring);

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, head, mir: mirSpin };
}

/* ---------------- stations & obstacles ---------------- */
const stations = [];   // {x, z, color, mesh, head}
const obstacles = [];  // {kind:'aabb'|'cyl', label, mesh, sx,sy,sz | r,h}
const obstGroup = new T.Group(); scene.add(obstGroup);
const markerGroup = new T.Group(); markerGroup.visible = false; scene.add(markerGroup);
let obCounter = { box: 0, col: 0, wall: 0, table: 0, sphere: 0 };

function disposeObject(root, keepMaterials = false) {
  const geometries = new Set(), materials = new Set();
  root.traverse(o => { if (o.geometry) geometries.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
  geometries.forEach(g => g.dispose());
  if (!keepMaterials) materials.forEach(m => m.dispose());
  if (root.parent) root.parent.remove(root);
}
function rebuildStations() {
  stations.forEach(s => { if (s.mesh) disposeObject(s.mesh); });
  stations.forEach((s, i) => {
    s.color = PALETTE[i];
    const built = makeScanner(PALETTE[i]);
    built.group.position.set(s.x, 0, s.z);
    built.group.userData.dragRef = { kind: 'station', rec: s };
    built.group.visible = !state.cloudOnly;
    s.mesh = built.group; s.head = built.head; s.mir = built.mir;
    scene.add(built.group);
  });
  refreshStationChips();
  rebuildMarkers();
}
function addStation(x, z, silent) {
  if (stations.length >= 3) { toast('Maximum 3 stations'); return null; }
  const spots = [[3.6, -2.2], [-4.2, 2.6], [4.2, 3.2]];
  if (x === undefined) { const s = spots[stations.length]; x = s[0]; z = s[1]; }
  const rec = { x, z, color: PALETTE[stations.length], mesh: null, head: null };
  stations.push(rec);
  rebuildStations();
  if (stations.length >= 2 && state.colorMode !== 'station') {
    state.colorMode = 'station';
    document.querySelectorAll('#segColor button').forEach(x =>
      x.classList.toggle('on', x.dataset.m === 'station'));
    recolorAll();
    toast('Coloring by station — one color per setup (change in Display)');
  }
  if (!silent) scheduleRescan();
  return rec;
}
function removeStation(i) {
  if (stations.length <= 1) { toast('At least one station is needed'); return; }
  disposeObject(stations[i].mesh);
  stations.splice(i, 1);
  rebuildStations();
  scheduleRescan();
}
function setStations(list) {
  stations.forEach(s => { if (s.mesh) disposeObject(s.mesh); });
  stations.length = 0;
  list.forEach(p => stations.push({ x: p[0], z: p[1], color: 0, mesh: null, head: null }));
  rebuildStations();
}
function rebuildMarkers() {
  while (markerGroup.children.length) disposeObject(markerGroup.children[0]);
  stations.forEach(s => {
    const m = new T.Mesh(new T.SphereGeometry(0.08, 12, 12),
      new T.MeshBasicMaterial({ color: s.color }));
    m.position.set(s.x, state.height + 0.05, s.z);
    markerGroup.add(m);
    const lg = new T.BufferGeometry().setFromPoints(
      [new T.Vector3(s.x, 0, s.z), new T.Vector3(s.x, state.height, s.z)]);
    markerGroup.add(new T.Line(lg, new T.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.35 })));
  });
}

function addObstacle(kind, x, z, opts, silent) {
  if (x === undefined) {
    const a = Math.random() * Math.PI * 2, r = 1.8 + Math.random() * 2.6;
    x = Math.max(-W2 + 1.4, Math.min(W2 - 1.4, Math.cos(a) * r));
    z = Math.max(-D2 + 1.2, Math.min(D2 - 1.2, Math.sin(a) * r));
  }
  const grey = new T.MeshStandardMaterial({ color: 0xb6b0a8, roughness: 0.92 });
  const grey2 = new T.MeshStandardMaterial({ color: 0xc6c0b7, roughness: 0.92 });
  const wood = new T.MeshStandardMaterial({ color: 0xa08a6f, roughness: 0.85 });
  const g = new T.Group();
  g.position.set(x, 0, z);
  const solids = [];
  let label = '';
  function slab(sx, sy, sz, cx, cy, cz, mat) {
    const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat);
    m.position.set(cx, cy, cz);
    g.add(m);
    solids.push({ s: 'a', dx: cx, dz: cz, hx: sx / 2, hz: sz / 2, y0: cy - sy / 2, y1: cy + sy / 2 });
  }
  if (kind === 'cyl') {
    const r = (opts && opts.r) || 0.3;
    const m = new T.Mesh(new T.CylinderGeometry(r, r, RH, 22), grey);
    m.position.y = RH / 2; g.add(m);
    solids.push({ s: 'c', dx: 0, dz: 0, r, y1: RH });
    label = 'Column ' + (++obCounter.col);
  } else if (kind === 'table') {
    slab(1.6, 0.06, 0.9, 0, 0.71, 0, wood);
    [[-0.72, -0.37], [0.72, -0.37], [-0.72, 0.37], [0.72, 0.37]].forEach(l =>
      slab(0.07, 0.68, 0.07, l[0], 0.34, l[1], wood));
    label = 'Table ' + (++obCounter.table);
  } else if (kind === 'sphere') {
    const base = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 0.04, 16), grey);
    base.position.y = 0.02; g.add(base);
    const th = (opts && opts.h) || 1.44;
    const pole = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, th - 0.12, 10), grey);
    pole.position.y = (th - 0.12) / 2; g.add(pole);
    const sph = new T.Mesh(new T.SphereGeometry(0.16, 20, 16),
      new T.MeshStandardMaterial({ color: 0xf4f4f6, roughness: 0.35 }));
    sph.position.y = th; g.add(sph);
    solids.push({ s: 'c', dx: 0, dz: 0, r: 0.02, y1: th - 0.16 });
    solids.push({ s: 'sp', dy: th, r: 0.16 });
    label = 'Target ' + (++obCounter.sphere);
  } else {
    let sx = 1.25, sy = 1.1, sz = 0.95, mat = grey;
    if (kind === 'wall') {
      sx = 3.4; sy = 2.3; sz = 0.18; mat = grey2;
      if (opts && opts.rot) { const t = sx; sx = sz; sz = t; }
      label = 'Wall ' + (++obCounter.wall);
    } else label = 'Box ' + (++obCounter.box);
    if (opts && opts.sx) { sx = opts.sx; sy = opts.sy; sz = opts.sz; }
    slab(sx, sy, sz, 0, sy / 2, 0, mat);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const rec = { kind, label, mesh: g, solids };
  g.userData.dragRef = { kind: 'obstacle', rec };
  obstGroup.add(g);
  obstacles.push(rec);
  refreshObChips();
  if (!silent) scheduleRescan();
  return rec;
}
let structure = [];
const structGroup = new T.Group();
scene.add(structGroup);
const structM = new T.MeshStandardMaterial({ color: 0xd3d0cb, roughness: 0.95 });
function setStructure(list) {
  while (structGroup.children.length) disposeObject(structGroup.children[0], true);
  structure = list.slice();
  structure.forEach(w => {
    const m = new T.Mesh(new T.BoxGeometry(w.sx, RH, w.sz), structM);
    m.position.set(w.cx, RH / 2, w.cz);
    m.castShadow = true; m.receiveShadow = true;
    structGroup.add(m);
  });
}
const APARTMENT = [
  { cx: -6.275, cz: 2.3, sx: 3.45, sz: 0.18 },
  { cx: 0, cz: 2.3, sx: 6.9, sz: 0.18 },
  { cx: 6.275, cz: 2.3, sx: 3.45, sz: 0.18 },
  { cx: 0, cz: -1.6, sx: 0.18, sz: 7.8 }
];
const SCENES = {
  empty: { items: [] },
  columns: { items: [['cyl', -4.5, -2.2], ['cyl', 0, -2.2], ['cyl', 4.5, -2.2],
             ['cyl', -4.5, 2.2], ['cyl', 0, 2.2], ['cyl', 4.5, 2.2]] },
  office: { items: [['wall', 0.6, -1.0, null], ['table', -3.4, 1.8, null], ['table', 3.0, 2.6, null],
            ['box', 5.8, -3.4, { sx: 0.9, sy: 1.9, sz: 0.5 }],
            ['box', -5.4, -3.3, { sx: 1.2, sy: 1.1, sz: 0.9 }], ['cyl', 4.6, 0.4, null]] },
  flat: { structure: APARTMENT,
          items: [['table', -4.8, -1.4, null], ['box', 5.2, -3.6, { sx: 0.9, sy: 1.9, sz: 0.5 }]] }
};
function loadScene(name) {
  invalidateScan();
  $('lessonCard').style.display = 'none';
  const def = SCENES[name];
  clearObstacles(true);
  setStructure(def.structure || []);
  (def.items || []).forEach(a => addObstacle(a[0], a[1], a[2], a[3] || null, true));
  scheduleRescan();
}
function removeObstacle(i) {
  disposeObject(obstacles[i].mesh);
  obstacles.splice(i, 1);
  refreshObChips();
  scheduleRescan();
}
function clearObstacles(silent) {
  while (obstacles.length) disposeObject(obstacles.pop().mesh);
  obCounter = { box: 0, col: 0, wall: 0, table: 0, sphere: 0 };
  refreshObChips();
  if (!silent) scheduleRescan();
}

/* ---------------- point cloud buffers ---------------- */
const $ = id => document.getElementById(id);
const pGeom = new T.BufferGeometry();
const pPos = new Float32Array(MAXPTS * 3);
const pCol = new Float32Array(MAXPTS * 3);
const mDist = new Float32Array(MAXPTS);
const mInc = new Float32Array(MAXPTS);
const mSt = new Uint8Array(MAXPTS);
const posAttr = new T.BufferAttribute(pPos, 3); posAttr.setUsage(T.DynamicDrawUsage);
const colAttr = new T.BufferAttribute(pCol, 3); colAttr.setUsage(T.DynamicDrawUsage);
pGeom.setAttribute('position', posAttr);
pGeom.setAttribute('color', colAttr);
pGeom.setDrawRange(0, 0);
function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.72, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
const DOT = makeDotTexture();
const pMat = new T.PointsMaterial({ size: state.ptSize, vertexColors: true, sizeAttenuation: true,
  map: DOT, alphaTest: 0.5 });
const points = new T.Points(pGeom, pMat);
points.frustumCulled = false;
points.raycast = function () {};
const pHaloMat = new T.PointsMaterial({ size: state.ptSize * 1.55, color: 0x2b2723,
  sizeAttenuation: true, map: DOT, alphaTest: 0.5 });
const pHalo = new T.Points(pGeom, pHaloMat);
pHalo.frustumCulled = false; pHalo.raycast = function () {};
pHalo.renderOrder = 0; points.renderOrder = 1;
scene.add(pHalo);
scene.add(points);

let count = 0, uploaded = 0, colorsDirtyAll = false;
let stCounts = [0, 0, 0];

/* ---------------- colors ---------------- */
function gauss() {
  let u = 0; while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}
const GRAD_D = [[0, 0x3a8dff], [0.35, 0x2eb3a4], [0.65, 0xf09c1a], [1, 0xff5a52]];
const GRAD_I = [[0, 0x39d98a], [0.55, 0xffd23f], [1, 0xff4d45]];
const PAL_RGB = PALETTE.map(c => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]);
const _rgb = [0, 0, 0];
function gradSample(stops, t, out) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const f = (t - a[0]) / (b[0] - a[0]);
      const ca = a[1], cb = b[1];
      out[0] = (((ca >> 16) & 255) + f * (((cb >> 16) & 255) - ((ca >> 16) & 255))) / 255;
      out[1] = (((ca >> 8) & 255) + f * (((cb >> 8) & 255) - ((ca >> 8) & 255))) / 255;
      out[2] = ((ca & 255) + f * ((cb & 255) - (ca & 255))) / 255;
      return;
    }
  }
  const c = stops[stops.length - 1][1];
  out[0] = ((c >> 16) & 255) / 255; out[1] = ((c >> 8) & 255) / 255; out[2] = (c & 255) / 255;
}
function colorPoint(i) {
  const j = i * 3, m = state.colorMode;
  if (m === 'single') { pCol[j] = 1; pCol[j + 1] = 0.353; pCol[j + 2] = 0.322; }
  else if (m === 'distance') {
    gradSample(GRAD_D, mDist[i] / state.maxRange, _rgb);
    pCol[j] = _rgb[0]; pCol[j + 1] = _rgb[1]; pCol[j + 2] = _rgb[2];
  } else if (m === 'incidence') {
    gradSample(GRAD_I, mInc[i] / 90, _rgb);
    pCol[j] = _rgb[0]; pCol[j + 1] = _rgb[1]; pCol[j + 2] = _rgb[2];
  } else {
    const c = PAL_RGB[mSt[i]] || PAL_RGB[0];
    pCol[j] = c[0]; pCol[j + 1] = c[1]; pCol[j + 2] = c[2];
  }
}
function recolorAll() {
  for (let i = 0; i < count; i++) colorPoint(i);
  colorsDirtyAll = true;
}

/* ---------------- analytic ray casting ---------------- */
const HIT = { t: 0, nx: 0, ny: 0, nz: 0, source: null };
let colliders = [];
function buildColliders() {
  colliders = [];
  for (const ob of obstacles) {
    const p = ob.mesh.position;
    const first = colliders.length;
    for (const s of ob.solids) {
      if (s.s === 'a') colliders.push({ kind: 0,
        minx: p.x + s.dx - s.hx, maxx: p.x + s.dx + s.hx,
        miny: s.y0, maxy: s.y1,
        minz: p.z + s.dz - s.hz, maxz: p.z + s.dz + s.hz, tag: -1 });
      else if (s.s === 'c') colliders.push({ kind: 1, cx: p.x + s.dx, cz: p.z + s.dz, r: s.r, y1: s.y1, tag: -1 });
      else colliders.push({ kind: 2, cx: p.x, cy: s.dy, cz: p.z, r: s.r, tag: -1 });
    }
    for (let i = first; i < colliders.length; i++) colliders[i].source = ob;
  }
  for (const w of structure) {
    colliders.push({ kind: 0, minx: w.cx - w.sx / 2, maxx: w.cx + w.sx / 2, miny: 0, maxy: RH,
      minz: w.cz - w.sz / 2, maxz: w.cz + w.sz / 2, tag: -1 });
  }
  stations.forEach((s, i) => {
    colliders.push({ kind: 1, cx: s.x, cz: s.z, r: 0.27, y1: state.height + 0.18, tag: i });
  });
}
function castAll(ox, oy, oz, dx, dy, dz, exSt) {
  let bt = Infinity, nx = 0, ny = 0, nz = 0;
  HIT.source = null;
  let t, hx, hy, hz;
  if (dy < 0) { t = -oy / dy; if (t > 1e-4 && t < bt) { hx = ox + dx * t; hz = oz + dz * t;
    if (hx >= -W2 && hx <= W2 && hz >= -D2 && hz <= D2) { bt = t; nx = 0; ny = 1; nz = 0; } } }
  if (dy > 0) { t = (RH - oy) / dy; if (t > 1e-4 && t < bt) { hx = ox + dx * t; hz = oz + dz * t;
    if (hx >= -W2 && hx <= W2 && hz >= -D2 && hz <= D2) { bt = t; nx = 0; ny = -1; nz = 0; } } }
  if (dz < 0) { t = (-D2 - oz) / dz; if (t > 1e-4 && t < bt) { hx = ox + dx * t; hy = oy + dy * t;
    if (hx >= -W2 && hx <= W2 && hy >= 0 && hy <= RH) { bt = t; nx = 0; ny = 0; nz = 1; } } }
  if (dz > 0) { t = (D2 - oz) / dz; if (t > 1e-4 && t < bt) { hx = ox + dx * t; hy = oy + dy * t;
    if (hx >= -W2 && hx <= W2 && hy >= 0 && hy <= RH) { bt = t; nx = 0; ny = 0; nz = -1; } } }
  if (dx < 0) { t = (-W2 - ox) / dx; if (t > 1e-4 && t < bt) { hz = oz + dz * t; hy = oy + dy * t;
    if (hz >= -D2 && hz <= D2 && hy >= 0 && hy <= RH) { bt = t; nx = 1; ny = 0; nz = 0; } } }
  if (dx > 0) { t = (W2 - ox) / dx; if (t > 1e-4 && t < bt) { hz = oz + dz * t; hy = oy + dy * t;
    if (hz >= -D2 && hz <= D2 && hy >= 0 && hy <= RH) { bt = t; nx = -1; ny = 0; nz = 0; } } }
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.tag === exSt) continue;
    const hit = intersectSolid(c, {x:ox, y:oy, z:oz}, {x:dx, y:dy, z:dz});
    if (hit && hit.t < bt) { bt = hit.t; nx = hit.x; ny = hit.y; nz = hit.z; HIT.source = c.source || null; }
  }
  if (bt < Infinity) { HIT.t = bt; HIT.nx = nx; HIT.ny = ny; HIT.nz = nz; return true; }
  return false;
}

/* ---------------- single-beam visual (one laser, spinning mirror) ---------------- */
function makeBeam(radius, colorHex) {
  const g = new T.CylinderGeometry(radius, radius, 1, 8, 1, true);
  g.translate(0, 0.5, 0);
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: colorHex }));
  m.frustumCulled = false;
  m.visible = false;
  const up = new T.Vector3(0, 1, 0), tmp = new T.Vector3();
  m.userData.aim = function (ox, oy, oz, dx, dy, dz, len) {
    m.position.set(ox, oy, oz);
    tmp.set(dx, dy, dz);
    m.quaternion.setFromUnitVectors(up, tmp);
    m.scale.set(1, len, 1);
    m.visible = true;
  };
  return m;
}
const roomBeam = makeBeam(0.008, 0xff3226);
scene.add(roomBeam);
const roomHit = new T.Mesh(new T.SphereGeometry(0.045, 10, 10),
  new T.MeshBasicMaterial({ color: 0xff5346 }));
roomHit.visible = false;
scene.add(roomHit);
let beamPhase = 0;
function hideBeam() { roomBeam.visible = false; roomHit.visible = false; }
function updateRoomBeam(col) {
  const st = stations[col.si];
  if (!st) return;
  const ox = st.x, oy = state.height + 0.07, oz = st.z;
  const az = col.k * (360 / col.n) * DEG;
  beamPhase += Math.max(3, elCount / 6);
  const j = Math.floor(beamPhase) % elCount;
  const sA = Math.sin(az), cA = Math.cos(az);
  const dx = elCos[j] * sA, dy = elSin[j], dz = elCos[j] * cA;
  const hitOk = castAll(ox, oy, oz, dx, dy, dz, col.si);
  const te = Math.min(hitOk ? HIT.t : state.maxRange, state.maxRange);
  roomBeam.userData.aim(ox, oy, oz, dx, dy, dz, te);
  roomHit.position.set(ox + dx * te, oy + dy * te, oz + dz * te);
  roomHit.visible = hitOk && HIT.t <= state.maxRange;
  if (st.mir) st.mir.rotation.x = Math.PI / 2 - Math.asin(elSin[j]);
}

/* ---------------- scan engine ---------------- */
let job = null, rescanTimer = null;
let scanStatus = 'Ready';
function invalidateScan() {
  if (rescanTimer) { clearTimeout(rescanTimer); rescanTimer = null; }
  job = null;
  pendingRegGame = false;
  hideBeam();
  endRegGame();
  count = 0; uploaded = 0; stCounts = [0, 0, 0];
  pGeom.setDrawRange(0, 0); gapGeom.setDrawRange(0, 0);
  $('hudCov').textContent = '–';
  $('hudOvWrap').style.display = 'none';
  $('hudTgtWrap').style.display = 'none';
  scanStatus = 'Changed — scan to measure';
  setScanBtn(); hudLive();
}
let elSin = null, elCos = null, elCount = 0;
function buildElevations() {
  const minEl = 90 - state.vfov;
  const n = Math.floor(state.vfov / state.vStep) + 2;
  elSin = new Float32Array(n); elCos = new Float32Array(n);
  let c = 0;
  for (let e = 90; e >= minEl - 1e-9 && c < n; e -= state.vStep) {
    elSin[c] = Math.sin(e * DEG); elCos[c] = Math.cos(e * DEG); c++;
  }
  elCount = c;
}
function scanColumn(si, k, n, record) {
  const st = stations[si];
  const ox = st.x, oy = state.height + 0.07, oz = st.z;
  const az = k * (360 / n) * DEG;
  const sA = Math.sin(az), cA = Math.cos(az);
  const cut = state.cutoff, softLo = cut - 7;
  const nz10 = state.noise * 1e-4;
  const maxR = state.maxRange;
  for (let j = 0; j < elCount; j++) {
    if (j === 0 && k > 0) continue;
    const dx = elCos[j] * sA, dy = elSin[j], dz = elCos[j] * cA;
    const hitOk = castAll(ox, oy, oz, dx, dy, dz, si);
    let t = hitOk ? HIT.t : Infinity;
    const inRange = hitOk && t <= maxR;
    if (!record || !inRange) continue;
    const cosI = Math.abs(dx * HIT.nx + dy * HIT.ny + dz * HIT.nz);
    const inc = Math.acos(Math.min(1, cosI)) / DEG;
    if (inc > cut) continue;
    if (inc > softLo && Math.random() < (inc - softLo) / 7 * 0.9) continue;
    if (nz10 > 0) t += gauss() * (nz10 * t * (1 + (1 - cosI) * 1.2));
    if (count >= MAXPTS) return;
    const i3 = count * 3;
    pPos[i3] = ox + dx * t; pPos[i3 + 1] = oy + dy * t; pPos[i3 + 2] = oz + dz * t;
    mDist[count] = t; mInc[count] = inc; mSt[count] = si;
    colorPoint(count);
    stCounts[si]++;
    count++;
  }
}
function startScan(animated) {
  if (!stations.length || state.mode !== 'room') return;
  endRegGame();
  if (rescanTimer) { clearTimeout(rescanTimer); rescanTimer = null; }
  buildColliders();
  const invalid = stations.findIndex((st, si) => colliders.some(c => {
    if (c.tag === si) return false;
    const x=st.x, y=state.height+0.07, z=st.z;
    if (c.kind === 0) return x>=c.minx && x<=c.maxx && y>=c.miny && y<=c.maxy && z>=c.minz && z<=c.maxz;
    if (c.kind === 1) return y<=c.y1 && (x-c.cx)**2+(z-c.cz)**2<=c.r**2;
    return (x-c.cx)**2+(y-c.cy)**2+(z-c.cz)**2<=c.r**2;
  }));
  if (invalid >= 0) { invalidateScan(); scanStatus = 'Move station ' + (invalid+1) + ' out of the obstacle'; hudLive(); toast(scanStatus); return; }
  buildElevations();
  count = 0; uploaded = 0; stCounts = [0, 0, 0];
  pGeom.setDrawRange(0, 0);
  const n = Math.max(8, Math.round(360 / state.hStep));
  const cols = [];
  for (let si = 0; si < stations.length; si++)
    for (let k = 0; k < n; k++) cols.push({ si, k, n });
  job = { cols, i: 0, animated };
  scanStatus = 'Scanning';
  hideBeam();
  setScanBtn();
  lastHud = 0;
  hudLive();
}
function stepJob() {
  const cap = job.animated ? SPEEDS[state.speedIdx] : Infinity;
  const budget = (job.animated && cap !== Infinity) ? 12 : 26;
  const t0 = performance.now();
  let done = 0, last = null;
  while (job.i < job.cols.length && done < cap && performance.now() - t0 < budget) {
    last = job.cols[job.i++];
    scanColumn(last.si, last.k, last.n, true);
    if (count >= MAXPTS) job.i = job.cols.length;
    done++;
  }
  if (last) {
    const st = stations[last.si];
    if (st && st.head) st.head.rotation.y = last.k * (360 / last.n) * DEG;
    if (job.animated && state.showLaser && job.i < job.cols.length) updateRoomBeam(last);
    else hideBeam();
  }
  if (job.i >= job.cols.length) {
    job = null;
    scanStatus = count >= MAXPTS ? 'Complete — point limit reached' : 'Complete';
    hideBeam();
    setScanBtn();
    statsRefresh();
    computeCoverage();
    targetAudit();
    if (pendingRegGame) { pendingRegGame = false; startRegGame(); }
  }
  hudLive();
}
function scheduleRescan(force) {
  invalidateScan();
  statsRefresh();
  if (state.mode !== 'room') return;
  if (!state.autoRescan && !force) return;
  if (rescanTimer) clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => { rescanTimer = null; startScan(false); }, 240);
}

/* ---------------- stats & HUD ---------------- */
function fmtLen(m) {
  if (m < 0.01) return (m * 1000).toFixed(1) + ' mm';
  if (m < 1) return (m * 100).toFixed(1) + ' cm';
  return m.toFixed(2) + ' m';
}
function fmtTime(s) {
  if (s < 90) return Math.round(s) + ' s';
  return (s / 60).toFixed(1) + ' min';
}
function statsRefresh() {
  const nAz = Math.max(8, Math.round(360 / state.hStep));
  const nEl = Math.floor(state.vfov / state.vStep) + 1;
  const proj = stations.length * (nAz * (nEl - 1) + 1);
  $('sp5').textContent = fmtLen(5 * state.hStep * DEG);
  $('sp10').textContent = fmtLen(10 * state.hStep * DEG);
  $('projPts').textContent = proj.toLocaleString('en-US');
  $('fTime').textContent = fmtTime(proj / 50000 + stations.length * 180);
  $('hudForm').innerHTML = 's ≈ R·Δθ → <b>' + fmtLen(10 * state.hStep * DEG) + '</b> @ 10 m';
  const blind = 180 - state.vfov;
  $('blindNote').textContent = blind >= 90
    ? 'Blind cone: ' + blind + '° from nadir — the floor is outside the FOV entirely.'
    : 'Blind cone under the tripod: ~' + fmtLen((state.height + 0.07) * Math.tan(blind * DEG)) +
      ' floor gap radius (' + blind + '° from nadir).';
}
let lastHud = 0;
function hudLive() {
  const now = performance.now();
  if (now - lastHud < 90 && job) return;
  lastHud = now;
  $('hudPts').textContent = count.toLocaleString('en-US');
  $('scanStatus').textContent = scanStatus;
  if (stations.length > 1) {
    $('hudSt').innerHTML = stations.map((s, i) =>
      '<div class="srow"><span class="sdot" style="background:' + PALETTE_CSS[i] + '"></span>ST' +
      (i + 1) + ' · ' + stCounts[i].toLocaleString('en-US') + '</div>').join('');
  } else $('hudSt').innerHTML = '';
  $('hudWarn').style.display = count >= MAXPTS ? 'block' : 'none';
  if (job) {
    $('btnScan').textContent = 'Stop ' + Math.round(100 * job.i / job.cols.length) + '%';
  }
}
function setScanBtn() {
  const b = $('btnScan');
  if (job) { b.classList.add('busy'); b.textContent = 'Stop 0%'; }
  else { b.classList.remove('busy'); b.textContent = 'Scan'; }
}

/* ---------------- coverage analysis ---------------- */
const GAPMAX = 6000;
const gapPosA = new Float32Array(GAPMAX * 3);
const gapGeom = new T.BufferGeometry();
const gapAttr = new T.BufferAttribute(gapPosA, 3); gapAttr.setUsage(T.DynamicDrawUsage);
gapGeom.setAttribute('position', gapAttr);
gapGeom.setDrawRange(0, 0);
const gapsPts = new T.Points(gapGeom,
  new T.PointsMaterial({ size: 0.09, color: 0xf2b544, sizeAttenuation: true,
    map: DOT, alphaTest: 0.5 }));
gapsPts.frustumCulled = false; gapsPts.raycast = function () {};
const gapsHalo = new T.Points(gapGeom,
  new T.PointsMaterial({ size: 0.14, color: 0x2b2723, sizeAttenuation: true,
    map: DOT, alphaTest: 0.5 }));
gapsHalo.frustumCulled = false; gapsHalo.raycast = function () {};
gapsHalo.renderOrder = 0; gapsPts.renderOrder = 1;
gapsPts.visible = false; gapsHalo.visible = false;
scene.add(gapsHalo);
scene.add(gapsPts);
let probes = null;
function buildProbes() {
  const P = [], N = [];
  const st = 0.5, e = 0.012;
  for (let x = -W2 + st / 2; x < W2; x += st) for (let z = -D2 + st / 2; z < D2; z += st) {
    P.push(x, e, z); N.push(0, 1, 0);
    P.push(x, RH - e, z); N.push(0, -1, 0);
  }
  for (let x = -W2 + st / 2; x < W2; x += st) for (let y = st / 2; y < RH; y += st) {
    P.push(x, y, -D2 + e); N.push(0, 0, 1);
    P.push(x, y, D2 - e); N.push(0, 0, -1);
  }
  for (let z = -D2 + st / 2; z < D2; z += st) for (let y = st / 2; y < RH; y += st) {
    P.push(-W2 + e, y, z); N.push(1, 0, 0);
    P.push(W2 - e, y, z); N.push(-1, 0, 0);
  }
  probes = { p: Float32Array.from(P), n: Float32Array.from(N), count: P.length / 3 };
}
function insideSolid(x, y, z) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.kind === 0) {
      if (x > c.minx && x < c.maxx && y > c.miny && y < c.maxy && z > c.minz && z < c.maxz) return true;
    } else if (c.kind === 1) {
      if (y > 0 && y < c.y1 && (x - c.cx) * (x - c.cx) + (z - c.cz) * (z - c.cz) < c.r * c.r) return true;
    } else {
      if ((x - c.cx) * (x - c.cx) + (y - c.cy) * (y - c.cy) + (z - c.cz) * (z - c.cz) < c.r * c.r) return true;
    }
  }
  return false;
}
function computeCoverage() {
  if (!stations.length) return;
  if (!probes) buildProbes();
  buildColliders();
  const minEl = 90 - state.vfov, maxR = state.maxRange, cut = state.cutoff;
  const H = state.height + 0.07;
  let valid = 0, covered = 0, multi = 0, g = 0;
  for (let i = 0; i < probes.count; i++) {
    const i3 = i * 3;
    const px = probes.p[i3], py = probes.p[i3 + 1], pz = probes.p[i3 + 2];
    if (insideSolid(px, py, pz)) continue;
    valid++;
    let seen = 0;
    for (let si = 0; si < stations.length && seen < 2; si++) {
      const ox = stations[si].x, oz = stations[si].z;
      let dx = px - ox, dy = py - H, dz = pz - oz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > maxR || dist < 1e-4) continue;
      dx /= dist; dy /= dist; dz /= dist;
      if (Math.asin(Math.max(-1, Math.min(1, dy))) / DEG < minEl) continue;
      const cosI = Math.abs(dx * probes.n[i3] + dy * probes.n[i3 + 1] + dz * probes.n[i3 + 2]);
      if (Math.acos(Math.min(1, cosI)) / DEG > cut) continue;
      // Probes sit just inside the shell. At grazing incidence the shell hit
      // can be well beyond the probe; only a nearer solid blocks the sightline.
      if (castAll(ox, H, oz, dx, dy, dz, si) && HIT.t >= dist - 1e-4) seen++;
    }
    if (seen > 0) covered++;
    if (seen > 1) multi++;
    if (seen === 0 && g < GAPMAX) {
      const j = g * 3;
      gapPosA[j] = px + probes.n[i3] * 0.03;
      gapPosA[j + 1] = py + probes.n[i3 + 1] * 0.03;
      gapPosA[j + 2] = pz + probes.n[i3 + 2] * 0.03;
      g++;
    }
  }
  gapGeom.setDrawRange(0, g);
  gapAttr.updateRange.offset = 0;
  gapAttr.updateRange.count = g * 3;
  gapAttr.needsUpdate = true;
  $('hudCov').textContent = valid ? (100 * covered / valid).toFixed(1) + '%' : '–';
  const showOv = stations.length > 1 && valid;
  $('hudOvWrap').style.display = showOv ? '' : 'none';
  if (showOv) $('hudOv').textContent = (100 * multi / valid).toFixed(1) + '%';
}
let lastShared = -1;
function targetAudit() {
  const spheres = obstacles.filter(o => o.kind === 'sphere');
  const wrap = $('hudTgtWrap');
  if (!spheres.length || stations.length < 2) { wrap.style.display = 'none'; lastShared = -1; return; }
  buildColliders();
  const H = state.height + 0.07, minEl = 90 - state.vfov, cut = state.cutoff;
  const pairs = [];
  for (let a = 0; a < stations.length; a++) for (let b = a + 1; b < stations.length; b++) pairs.push({a, b, count: 0});
  for (const sp of spheres) {
    const sol = sp.solids.find(s => s.s === 'sp');
    const cx = sp.mesh.position.x, cy = sol.dy, cz = sp.mesh.position.z, r = sol.r;
    const visible = [];
    for (let si = 0; si < stations.length; si++) {
      const ox = stations[si].x, oz = stations[si].z;
      let dx = cx - ox, dy = cy - H, dz = cz - oz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > state.maxRange || dist < r + 0.3) continue;
      dx /= dist; dy /= dist; dz /= dist;
      if (Math.asin(Math.max(-1, Math.min(1, dy))) / DEG < minEl) continue;
      if (castAll(ox, H, oz, dx, dy, dz, si) && HIT.source === sp && Math.abs(HIT.t - (dist - r)) < 0.001) visible.push(si);
    }
    pairs.forEach(pair => { if (visible.includes(pair.a) && visible.includes(pair.b)) pair.count++; });
  }
  lastShared = Math.min(...pairs.map(pair => pair.count));
  wrap.style.display = '';
  $('hudTgt').textContent = pairs.map(pair => 'ST' + (pair.a+1) + '–' + (pair.b+1) + ': ' + pair.count + ' / ' + spheres.length).join(' · ');
}

/* ---------------- export ---------------- */
function exportXYZ() {
  if (job || regActive || !scanStatus.startsWith('Complete')) { toast('Complete a scan and finish alignment before exporting'); return; }
  if (!count) { toast('Nothing to export — run a scan first'); return; }
  const parts = []; let buf = [];
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    buf.push(pPos[j].toFixed(3) + ' ' + pPos[j + 1].toFixed(3) + ' ' + pPos[j + 2].toFixed(3) + ' ' +
      Math.round(pCol[j] * 255) + ' ' + Math.round(pCol[j + 1] * 255) + ' ' + Math.round(pCol[j + 2] * 255));
    if (buf.length === 20000) { parts.push(buf.join('\n')); buf = []; }
  }
  if (buf.length) parts.push(buf.join('\n'));
  const blob = new Blob([parts.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'laserscanlab_cloud.xyz';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Exported ' + count.toLocaleString('en-US') + ' points (y-up)');
}

/* ---------------- camera controls ---------------- */
const ctrl = { target: new T.Vector3(0, 1.1, 0), theta: 0.82, phi: 1.12, radius: 14, povYaw: 0, povPitch: -0.05 };
function ctrlApply() {
  if (state.viewMode === 'pov' && stations.length) {
    const s = stations[0];
    camera.position.set(s.x, state.height + 0.12, s.z);
    camera.quaternion.setFromEuler(new T.Euler(ctrl.povPitch, ctrl.povYaw, 0, 'YXZ'));
  } else {
    const phi = state.viewMode === 'top' ? 0.045 : ctrl.phi;
    camera.position.set(
      ctrl.target.x + ctrl.radius * Math.sin(phi) * Math.sin(ctrl.theta),
      ctrl.target.y + ctrl.radius * Math.cos(phi),
      ctrl.target.z + ctrl.radius * Math.sin(phi) * Math.cos(ctrl.theta));
    camera.lookAt(ctrl.target);
  }
}
function setView(v) {
  state.viewMode = v;
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  camera.fov = v === 'pov' ? 75 : 55;
  camera.updateProjectionMatrix();
  if (v === 'pov' && stations.length) {
    const s = stations[0];
    ctrl.povYaw = Math.atan2(s.x, s.z);
    ctrl.povPitch = -0.05;
  }
}
function panBy(dx, dy) {
  const k = ctrl.radius * 0.0016;
  const fx = -Math.sin(ctrl.theta), fz = -Math.cos(ctrl.theta);
  const rx = Math.cos(ctrl.theta), rz = -Math.sin(ctrl.theta);
  ctrl.target.x = Math.max(-W2, Math.min(W2, ctrl.target.x - rx * dx * k + fx * dy * k));
  ctrl.target.z = Math.max(-D2, Math.min(D2, ctrl.target.z - rz * dx * k + fz * dy * k));
}

/* ---------------- pointer input ---------------- */
const raycaster = new T.Raycaster();
const ndc = new T.Vector2();
const canvas = renderer.domElement;
const pointers = new Map();
let dragObj = null, dragOff = { x: 0, z: 0 }, dragMoved = false;
let pinchDist = 0, pinchMid = { x: 0, y: 0 };
const _gp = { x: 0, z: 0 };

function pickDraggable(e) {
  ndc.x = (e.clientX / innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const targets = [];
  stations.forEach(s => { if (s.mesh && s.mesh.visible) targets.push(s.mesh); });
  if (obstGroup.visible) obstacles.forEach(o => targets.push(o.mesh));
  const hits = raycaster.intersectObjects(targets, true);
  for (const h of hits) {
    let o = h.object;
    while (o) { if (o.userData.dragRef) return o.userData.dragRef; o = o.parent; }
  }
  return null;
}
function obstacleExtent(rec) {
  return {x: Math.max(...rec.solids.map(s => Math.abs(s.dx || 0) + (s.hx || s.r))),
    z: Math.max(...rec.solids.map(s => Math.abs(s.dz || 0) + (s.hz || s.r)))};
}
function groundPoint(e, out) {
  ndc.x = (e.clientX / innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if (Math.abs(d.y) < 1e-6) return false;
  const t = -o.y / d.y;
  if (t <= 0) return false;
  out.x = o.x + d.x * t; out.z = o.z + d.z * t;
  return true;
}
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    dragMoved = false;
    dragObj = null;
    if (state.mode === 'room' && state.viewMode !== 'pov' && !regActive) {
      const ref = pickDraggable(e);
      if (ref) {
        dragObj = ref;
        const p = ref.rec.mesh.position;
        if (groundPoint(e, _gp)) { dragOff.x = p.x - _gp.x; dragOff.z = p.z - _gp.z; }
        else { dragOff.x = 0; dragOff.z = 0; }
        canvas.style.cursor = 'grabbing';
      }
    }
  } else if (pointers.size === 2) {
    dragObj = null;
    const ps = [...pointers.values()];
    pinchDist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    pinchMid.x = (ps[0].x + ps[1].x) / 2; pinchMid.y = (ps[0].y + ps[1].y) / 2;
  }
});
canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    if (dragObj) {
      if (groundPoint(e, _gp)) {
        const rec = dragObj.rec;
        const extent = dragObj.kind === 'station' ? {x: 0.6, z: 0.6} : obstacleExtent(rec);
        const nx = Math.max(-W2 + extent.x, Math.min(W2 - extent.x, _gp.x + dragOff.x));
        const nz = Math.max(-D2 + extent.z, Math.min(D2 - extent.z, _gp.z + dragOff.z));
        if (!dragMoved && (nx !== rec.mesh.position.x || nz !== rec.mesh.position.z)) invalidateScan();
        rec.mesh.position.x = nx; rec.mesh.position.z = nz;
        if (dragObj.kind === 'station') { rec.x = nx; rec.z = nz; }
        dragMoved = true;
      }
      return;
    }
    if (state.viewMode === 'pov') {
      ctrl.povYaw -= dx * 0.004;
      ctrl.povPitch = Math.max(-1.45, Math.min(1.45, ctrl.povPitch - dy * 0.004));
    } else if (state.viewMode === 'top' || e.buttons === 2 || e.buttons === 4) {
      panBy(dx, dy);
    } else {
      ctrl.theta -= dx * 0.0055;
      ctrl.phi = Math.max(0.12, Math.min(1.52, ctrl.phi - dy * 0.005));
    }
  } else if (pointers.size === 2) {
    const ps = [...pointers.values()];
    const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
    if (pinchDist > 0 && d > 0) ctrl.radius = Math.max(2.5, Math.min(60, ctrl.radius * pinchDist / d));
    pinchDist = d;
    const mx = (ps[0].x + ps[1].x) / 2, my = (ps[0].y + ps[1].y) / 2;
    panBy(mx - pinchMid.x, my - pinchMid.y);
    pinchMid.x = mx; pinchMid.y = my;
  }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (dragObj && pointers.size === 0) {
    canvas.style.cursor = '';
    if (dragMoved) { rebuildMarkers(); scheduleRescan(); }
    dragObj = null;
  }
  if (pointers.size < 2) pinchDist = 0;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  ctrl.radius = Math.max(2.5, Math.min(60, ctrl.radius * Math.pow(1.0015, e.deltaY)));
}, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- cloud-only mode ---------------- */
function applyCloudMode(v) {
  state.cloudOnly = v;
  roomG.visible = !v;
  obstGroup.visible = !v;
  structGroup.visible = !v;
  stations.forEach(s => { if (s.mesh) s.mesh.visible = !v; });
  markerGroup.visible = v;
  if (v) rebuildMarkers();
  scene.background.setHex(v ? BG_DARK : BG_LIGHT);
  $('btnCloud').classList.toggle('on', v);
}

/* ---------------- UI wiring ---------------- */
function bindRange(id, key, fmt, after) {
  const el = $(id);
  el.value = state[key];
  const upd = () => { el.value = state[key]; $(id.replace('rng', 'val')).textContent = fmt(state[key]); };
  el.refreshValue = upd;
  upd();
  el.addEventListener('input', () => {
    state[key] = parseFloat(el.value);
    upd();
    if (after) after();
  });
}
bindRange('rngH', 'hStep', v => v.toFixed(2) + '°', scheduleRescan);
bindRange('rngV', 'vStep', v => v.toFixed(2) + '°', scheduleRescan);
bindRange('rngRange', 'maxRange', v => v.toFixed(1) + ' m', scheduleRescan);
bindRange('rngNoise', 'noise', v => v + ' mm', scheduleRescan);
bindRange('rngCut', 'cutoff', v => v + '°', scheduleRescan);
bindRange('rngVfov', 'vfov', v => v + '°', scheduleRescan);
bindRange('rngHeight', 'height', v => v.toFixed(2) + ' m', () => { rebuildStations(); scheduleRescan(); });
bindRange('rngSize', 'ptSize', v => (v * 1000).toFixed(0) + ' mm', () => { pMat.size = state.ptSize; pHaloMat.size = state.ptSize * 1.55; });
bindRange('rngSpeed', 'speedIdx', v => SPEEDS[v] === Infinity ? 'Instant' : SPEEDS[v] + '×', null);

function bindSwitch(id, key, after) {
  const el = $(id);
  el.classList.toggle('on', state[key]);
  el.setAttribute('aria-checked', state[key]);
  el.addEventListener('click', () => {
    state[key] = !state[key];
    el.classList.toggle('on', state[key]);
    el.setAttribute('aria-checked', state[key]);
    if (after) after();
  });
}
bindSwitch('tglLaser', 'showLaser', () => { if (!state.showLaser) hideBeam(); });
bindSwitch('tglAuto', 'autoRescan', () => {
  if (state.autoRescan) scheduleRescan();
  else if (rescanTimer) { clearTimeout(rescanTimer); rescanTimer = null; }
});
bindSwitch('tglGaps', 'showGaps', () => { gapsPts.visible = state.showGaps; gapsHalo.visible = state.showGaps; });

document.querySelectorAll('#segColor button').forEach(b => {
  b.addEventListener('click', () => {
    state.colorMode = b.dataset.m;
    document.querySelectorAll('#segColor button').forEach(x => x.classList.toggle('on', x === b));
    recolorAll();
  });
});
document.querySelectorAll('#viewSeg button').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.v)));

$('btnCloud').addEventListener('click', () => applyCloudMode(!state.cloudOnly));
$('btnScan').addEventListener('click', () => {
  if (job) { job = null; pendingRegGame = false; scanStatus = 'Stopped — partial cloud'; hideBeam(); setScanBtn(); statsRefresh(); hudLive(); }
  else startScan(true);
});
$('btnMenu').addEventListener('click', () => $('panel').classList.toggle('open'));
$('btnAddSt').addEventListener('click', () => addStation());
$('btnBox').addEventListener('click', () => addObstacle('box'));
$('btnCol').addEventListener('click', () => addObstacle('cyl'));
$('btnWall').addEventListener('click', () => addObstacle('wall'));
$('btnClearObs').addEventListener('click', () => clearObstacles());
$('btnTable').addEventListener('click', () => addObstacle('table'));
$('btnSphere').addEventListener('click', () => addObstacle('sphere'));
$('btnScEmpty').addEventListener('click', () => loadScene('empty'));
$('btnScCols').addEventListener('click', () => loadScene('columns'));
$('btnScOffice').addEventListener('click', () => loadScene('office'));
$('btnScFlat').addEventListener('click', () => loadScene('flat'));
$('btnExport').addEventListener('click', exportXYZ);
$('lClose').addEventListener('click', () => { $('lessonCard').style.display = 'none'; });

function refreshStationChips() {
  $('stChips').innerHTML = '';
  stations.forEach((s, i) => {
    const c = document.createElement('div'); c.className = 'chip';
    c.innerHTML = '<span class="cdot" style="background:' + PALETTE_CSS[i] + '"></span>Station ' + (i + 1);
    const x = document.createElement('button'); x.textContent = '×';
    x.setAttribute('aria-label', 'Remove station ' + (i + 1));
    x.addEventListener('click', () => removeStation(i));
    c.appendChild(x);
    $('stChips').appendChild(c);
  });
}
function refreshObChips() {
  $('obChips').innerHTML = '';
  obstacles.forEach((o, i) => {
    const c = document.createElement('div'); c.className = 'chip';
    c.innerHTML = '<span class="cdot" style="background:#b6b0a8"></span>' + o.label;
    const x = document.createElement('button'); x.textContent = '×';
    x.setAttribute('aria-label', 'Remove ' + o.label);
    x.addEventListener('click', () => removeObstacle(i));
    c.appendChild(x);
    $('obChips').appendChild(c);
  });
}
function syncUI() {
  [['rngH', 'hStep'], ['rngV', 'vStep'], ['rngRange', 'maxRange'], ['rngNoise', 'noise'],
   ['rngCut', 'cutoff'], ['rngVfov', 'vfov'], ['rngHeight', 'height'], ['rngSize', 'ptSize'],
   ['rngSpeed', 'speedIdx']].forEach(p => {
    $(p[0]).value = state[p[1]];
    $(p[0]).refreshValue();
  });
  document.querySelectorAll('#segColor button').forEach(x =>
    x.classList.toggle('on', x.dataset.m === state.colorMode));
  $('tglLaser').classList.toggle('on', state.showLaser);
  $('tglAuto').classList.toggle('on', state.autoRescan);
  $('tglGaps').classList.toggle('on', state.showGaps);
  gapsPts.visible = state.showGaps;
  gapsHalo.visible = state.showGaps;
  rebuildStations();
  pMat.size = state.ptSize; pHaloMat.size = state.ptSize * 1.55;
  document.querySelectorAll('[role=switch]').forEach(el => el.setAttribute('aria-checked', el.classList.contains('on')));
}

/* ---------------- lessons ---------------- */
const LESSONS = {
  res: {
    title: 'Lesson 1 — Angular resolution',
    body: 'The scanner fires one pulse every step angle, so spacing between points grows linearly with range (s ≈ R·Δθ). Watch the far wall stay sparse while nearby surfaces are dense. Halving both angular steps roughly quadruples the emitted samples and acquisition time; setup time stays fixed. Try 0.4° vs 2.5°.',
    apply() {
      clearObstacles(true);
      setStations([[-2, 0.8]]);
      Object.assign(state, { hStep: 2.2, vStep: 2.2, noise: 2, cutoff: 85, vfov: 135, maxRange: 30, colorMode: 'single', showGaps: false });
    }
  },
  noise: {
    title: 'Lesson 2 — Range noise',
    body: 'Every distance measurement carries uncertainty that grows with range, grazing angles and dark surfaces. Here only range and incidence affect noise; reflectivity is not simulated. Flat walls thicken into fuzz — worst at the far end. Real scanners sit around ±1–5 mm at 10 m; here it is exaggerated so you can see it. Points are colored by range.',
    apply() {
      clearObstacles(true);
      setStations([[-2, 0.8]]);
      Object.assign(state, { hStep: 0.9, vStep: 0.9, noise: 28, cutoff: 85, vfov: 135, maxRange: 30, colorMode: 'distance', showGaps: false });
    }
  },
  occl: {
    title: 'Lesson 3 — Occlusion',
    body: 'Laser light travels in straight lines: everything behind a wall, a column — or under a table top — is a scan shadow with zero data. Toggle “Cloud only” to see the holes, then drag the scanner or the furniture and watch the shadows move.',
    apply() {
      clearObstacles(true);
      addObstacle('wall', 0.4, -0.6, null, true);
      addObstacle('cyl', 2.6, -2.6, null, true);
      addObstacle('table', 1.6, 2.3, null, true);
      setStations([[-4.6, 0.6]]);
      Object.assign(state, { hStep: 1.0, vStep: 1.0, noise: 4, cutoff: 82, vfov: 135, maxRange: 30, colorMode: 'single', showGaps: false });
    }
  },
  place: {
    title: 'Lesson 4 — Scanner placement',
    body: 'Placement is how you fight occlusion. Watch “surface coverage” in the HUD and the amber gap markers: drag the tripod, raise it, add stations — try to beat 95%. Rules of thumb: stand where many surfaces are visible at once, keep overlap between stations, and prefer open diagonals to corners behind furniture.',
    apply() {
      clearObstacles(true);
      SCENES.office.items.forEach(a => addObstacle(a[0], a[1], a[2], a[3] || null, true));
      setStations([[-6.4, -4.0]]);
      Object.assign(state, { hStep: 1.3, vStep: 1.3, noise: 3, cutoff: 82, vfov: 135, maxRange: 30, colorMode: 'single', showGaps: true });
    }
  },
  reg: {
    title: 'Lesson 5 — Registration with targets',
    body: 'Each station scans in its own coordinate system; registration is the rigid transform that fuses them into one cloud. Classic method: place reference spheres, scan them from every station, fit their centres and match them — each target-based registration link needs at least three non-collinear shared targets, well spread and at different heights (the HUD counts them). Zoom into a sphere and you will see both colours land on it. Modern workflows are mostly targetless: cloud-to-cloud matching (ICP) on overlapping geometry, initialised by onboard sensors, with visual tracking between setups on newer scanners. Targets survive where millimetre control or georeferencing is required.',
    apply() {
      clearObstacles(true);
      addObstacle('sphere', -5.2, 3.4, { h: 1.2 }, true);
      addObstacle('sphere', 0.4, -4.6, { h: 1.75 }, true);
      addObstacle('sphere', 5.6, 2.8, { h: 1.45 }, true);
      addObstacle('wall', 0.6, -0.8, null, true);
      addObstacle('table', 2.8, 2.4, null, true);
      setStations([[-4.6, 0.8], [4.2, -1.2]]);
      Object.assign(state, { hStep: 0.5, vStep: 0.5, noise: 2, cutoff: 84, vfov: 135, maxRange: 30, colorMode: 'station', showGaps: false });
    }
  },
  corridor: {
    title: 'Lesson 6 — Registration lab: two rooms + a corridor',
    structure: APARTMENT,
    body: 'No single position sees this floor plan, so scans are chained and registered: registration finds the shift + rotation that merges coordinate systems. The rule: each target-based registration link needs at least THREE non-collinear shared targets — the HUD now counts them. Here all three spheres sit in the doorway sight-lines at different heights, so both stations capture them. After the scan Station 2 arrives misaligned: slide and rotate it until the spheres coincide, or press Show correct alignment to reveal the known solution (no ICP is performed). Move a sphere out of the overlap, rescan, and watch the counter fall below 3.',
    apply() {
      clearObstacles(true);
      addObstacle('sphere', -4.0, 0.9, { h: 1.5 }, true);
      addObstacle('sphere', -3.8, 2.75, { h: 1.1 }, true);
      addObstacle('sphere', -4.85, 1.35, { h: 1.9 }, true);
      setStations([[-5.0, -2.2], [-4.0, 3.5]]);
      Object.assign(state, { hStep: 0.8, vStep: 0.8, noise: 2, cutoff: 84, vfov: 135, maxRange: 30, colorMode: 'station', showGaps: false });
      pendingRegGame = true;
    }
  }
};
document.querySelectorAll('.lessons button').forEach(b => {
  b.addEventListener('click', () => {
    const L = LESSONS[b.dataset.l];
    endRegGame();
    pendingRegGame = false;
    if (job) { job = null; hideBeam(); }
    setStructure(L.structure || []);
    L.apply();
    applyCloudMode(false);
    syncUI();
    $('lTitle').textContent = L.title;
    $('lBody').textContent = L.body;
    $('lessonCard').style.display = 'block';
    if (innerWidth < 760) $('panel').classList.remove('open');
    startScan(true);
  });
});

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- registration lab (align two scans) ---------------- */
let regActive = false, pendingRegGame = false, regAnim = null, regObjs = null;
const regOff = { x: 0, z: 0, yaw: 0 };
function makeRegCloud(pos, col, n) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.setDrawRange(0, n);
  const pts = new T.Points(g, new T.PointsMaterial({ size: state.ptSize, vertexColors: true,
    sizeAttenuation: true, map: DOT, alphaTest: 0.5 }));
  const halo = new T.Points(g, new T.PointsMaterial({ size: state.ptSize * 1.55, color: 0x2b2723,
    sizeAttenuation: true, map: DOT, alphaTest: 0.5 }));
  pts.frustumCulled = false; halo.frustumCulled = false;
  pts.raycast = function () {}; halo.raycast = function () {};
  halo.renderOrder = 0; pts.renderOrder = 1;
  return { g, pts, halo };
}
function startRegGame() {
  if (regActive || stations.length < 2 || !count) return;
  const s2 = stations[1], px = s2.x, pz = s2.z;
  let nA = 0, nB = 0;
  for (let i = 0; i < count; i++) { if (mSt[i] === 0) nA++; else nB++; }
  if (!nA || !nB) return;
  const pA = new Float32Array(nA * 3), cA = new Float32Array(nA * 3);
  const pB = new Float32Array(nB * 3), cB = new Float32Array(nB * 3);
  let a = 0, b = 0;
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    if (mSt[i] === 0) {
      pA[a] = pPos[j]; pA[a + 1] = pPos[j + 1]; pA[a + 2] = pPos[j + 2];
      cA[a] = pCol[j]; cA[a + 1] = pCol[j + 1]; cA[a + 2] = pCol[j + 2];
      a += 3;
    } else {
      pB[b] = pPos[j] - px; pB[b + 1] = pPos[j + 1]; pB[b + 2] = pPos[j + 2] - pz;
      cB[b] = pCol[j]; cB[b + 1] = pCol[j + 1]; cB[b + 2] = pCol[j + 2];
      b += 3;
    }
  }
  const A = makeRegCloud(pA, cA, nA);
  const B = makeRegCloud(pB, cB, nB);
  const grp = new T.Group();
  grp.add(B.halo); grp.add(B.pts);
  scene.add(A.halo); scene.add(A.pts); scene.add(grp);
  regObjs = { A, B, grp, px, pz };
  points.visible = false; pHalo.visible = false;
  regOff.x = 0.55; regOff.z = -0.42; regOff.yaw = 4.5 * DEG;
  regActive = true; regAnim = null;
  applyRegOff();
  $('lessonCard').style.display = 'none';
  $('regPad').style.display = 'block';
  toast(lastShared >= 0 && lastShared < 3
    ? '⚠ fewer than 3 shared targets — real software would struggle here'
    : 'Station 2 came in misaligned — line it up');
}
function applyRegOff() {
  if (!regObjs) return;
  regObjs.grp.position.set(regObjs.px + regOff.x, 0, regObjs.pz + regOff.z);
  regObjs.grp.rotation.y = regOff.yaw;
  const tErr = Math.hypot(regOff.x, regOff.z);
  const rErr = Math.abs(regOff.yaw) / DEG;
  const good = tErr < 0.06 && rErr < 0.4;
  if (good && (regOff.x || regOff.z || regOff.yaw)) {
    regOff.x = 0; regOff.z = 0; regOff.yaw = 0; regAnim = null;
    regObjs.grp.position.set(regObjs.px, 0, regObjs.pz);
    regObjs.grp.rotation.y = 0;
    toast('Registered — one cloud, one coordinate system');
  }
  $('regErr').innerHTML = (tErr < 0.06 && rErr < 0.4)
    ? '<b style="color:#39d98a">Registered ✓</b>'
    : 'misalignment: <b>' + tErr.toFixed(2) + ' m · ' + rErr.toFixed(1) + '°</b>';
}
function endRegGame() {
  regAnim = null;
  if (!regActive) return;
  regActive = false;
  scene.remove(regObjs.A.pts); scene.remove(regObjs.A.halo); scene.remove(regObjs.grp);
  [regObjs.A, regObjs.B].forEach(c => { c.g.dispose(); c.pts.material.dispose(); c.halo.material.dispose(); });
  regObjs = null;
  points.visible = true; pHalo.visible = true;
  $('regPad').style.display = 'none';
}
function regStep(k) {
  if (!regActive) return;
  regAnim = null;
  const d = 0.05, r = 0.5 * DEG;
  if (k === 'x-') regOff.x -= d; else if (k === 'x+') regOff.x += d;
  else if (k === 'z-') regOff.z -= d; else if (k === 'z+') regOff.z += d;
  else if (k === 'ry+') regOff.yaw += r; else if (k === 'ry-') regOff.yaw -= r;
  applyRegOff();
}
document.querySelectorAll('#regPad [data-r]').forEach(btn => {
  let iv = null;
  const stop = () => { if (iv) { clearInterval(iv); iv = null; } };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    regStep(btn.dataset.r);
    iv = setInterval(() => regStep(btn.dataset.r), 110);
  });
  btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); regStep(btn.dataset.r); } });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
});
$('regAuto').addEventListener('click', () => {
  if (!regActive || regAnim) return;
  regAnim = { k: 0, n: 55, x: regOff.x, z: regOff.z, yaw: regOff.yaw };
});
$('regDone').addEventListener('click', () => {
  if (Math.hypot(regOff.x, regOff.z) > 0.001 || Math.abs(regOff.yaw) > 0.001) { toast('Align the cloud first, or reveal the correct alignment'); return; }
  endRegGame();
});

/* ================= PRINCIPLE SCENE — how a scanner works ================= */
const PRW2 = 6, PRD2 = 4.5, PRH = 4;
const prScene = new T.Scene();
prScene.background = new T.Color(BG_LIGHT);
{
  prScene.add(new T.HemisphereLight(0xffffff, 0x8a7c6c, 0.85));
  const dl = new T.DirectionalLight(0xffffff, 0.75);
  dl.position.set(5, 8, 3);
  dl.castShadow = true;
  dl.shadow.mapSize.set(1024, 1024);
  dl.shadow.camera.left = -8; dl.shadow.camera.right = 8;
  dl.shadow.camera.top = 8; dl.shadow.camera.bottom = -8;
  dl.shadow.camera.near = 1; dl.shadow.camera.far = 25;
  dl.shadow.bias = -0.0004;
  prScene.add(dl);
  const mk = (w, h, c) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({ color: c, roughness: 0.95 }));
    m.receiveShadow = true;
    return m;
  };
  const fl = mk(12, 9, 0x9d8b7a); fl.rotation.x = -Math.PI / 2; prScene.add(fl);
  const ce = mk(12, 9, 0xe9e7e4); ce.rotation.x = Math.PI / 2; ce.position.y = PRH; prScene.add(ce);
  const wn = mk(12, PRH, 0xdbd9d5); wn.position.set(0, PRH / 2, -PRD2); prScene.add(wn);
  const ws = mk(12, PRH, 0xd6d4d0); ws.rotation.y = Math.PI; ws.position.set(0, PRH / 2, PRD2); prScene.add(ws);
  const ww = mk(9, PRH, 0xdedcd8); ww.rotation.y = Math.PI / 2; ww.position.set(-PRW2, PRH / 2, 0); prScene.add(ww);
  const we = mk(9, PRH, 0xd8d6d2); we.rotation.y = -Math.PI / 2; we.position.set(PRW2, PRH / 2, 0); prScene.add(we);
}
const prBodyM = new T.MeshStandardMaterial({ color: 0x3b3d45, roughness: 0.45, metalness: 0.35 });
const prBody2M = new T.MeshStandardMaterial({ color: 0x26272d, roughness: 0.4, metalness: 0.45 });
const prPanelM = new T.MeshStandardMaterial({ color: 0x54565f, roughness: 0.55, metalness: 0.25 });
const prMirrorFaceM = new T.MeshPhongMaterial({ color: 0xdde6f2, specular: 0xffffff, shininess: 160 });
const prBrassM = new T.MeshPhongMaterial({ color: 0xc9a24a, specular: 0xfff3c0, shininess: 90 });
const prRedM = new T.MeshBasicMaterial({ color: 0xff3226 });
/* tripod + levelling base (static) */
{
  const sm = m => { m.castShadow = true; prScene.add(m); return m; };
  const hubY = 1.16;
  for (let k = 0; k < 3; k++) {
    const a = k * (Math.PI * 2 / 3) + 0.5;
    const foot = new T.Vector3(Math.cos(a) * 0.85, 0, Math.sin(a) * 0.85);
    sm(cylBetween(foot, new T.Vector3(0, hubY, 0), 0.045, prBodyM));
    const f = sm(new T.Mesh(new T.SphereGeometry(0.05, 10, 10), prBody2M));
    f.position.copy(foot); f.position.y = 0.04;
  }
  const hub = sm(new T.Mesh(new T.CylinderGeometry(0.22, 0.26, 0.09, 20), prBody2M));
  hub.position.y = hubY;
  const col = sm(new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.24, 14), prBodyM));
  col.position.y = 1.28;
  const lev = sm(new T.Mesh(new T.CylinderGeometry(0.2, 0.23, 0.09, 20), prBody2M));
  lev.position.y = 1.42;
}
/* rotating head: turntable, twin towers, laser module, spinning disc mirror */
const prRig = new T.Group();
prScene.add(prRig);
{
  const turn = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.1, 28), prBodyM);
  turn.position.y = 1.51; prRig.add(turn);
  const ring = new T.Mesh(new T.TorusGeometry(0.31, 0.014, 8, 40), prRedM);
  ring.rotation.x = Math.PI / 2; ring.position.y = 1.565; prRig.add(ring);
  [-1, 1].forEach(s => {
    const tw = new T.Mesh(new T.BoxGeometry(0.34, 0.92, 0.52), prBodyM);
    tw.position.set(s * 0.53, 2.0, 0); prRig.add(tw);
    const round = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.92, 20), prBodyM);
    round.position.set(s * 0.66, 2.0, 0); prRig.add(round);
    const cap = new T.Mesh(new T.BoxGeometry(0.36, 0.05, 0.54), prPanelM);
    cap.position.set(s * 0.53, 2.48, 0); prRig.add(cap);
    const panel = new T.Mesh(new T.BoxGeometry(0.3, 0.62, 0.02), prPanelM);
    panel.position.set(s * 0.53, 1.98, 0.27); prRig.add(panel);
  });
  const scr = new T.Mesh(new T.BoxGeometry(0.22, 0.15, 0.015),
    new T.MeshPhongMaterial({ color: 0x14161c, specular: 0x8899aa, shininess: 60 }));
  scr.position.set(0.53, 2.14, 0.285); prRig.add(scr);
  const pwr = new T.Mesh(new T.SphereGeometry(0.02, 8, 8), prRedM);
  pwr.position.set(0.53, 1.76, 0.29); prRig.add(pwr);
  prRig.add(cylBetween(new T.Vector3(0.36, 1.8, 0), new T.Vector3(0.12, 1.8, 0), 0.035, prBody2M));
  const drum = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.1, 16), prBody2M);
  drum.rotation.z = Math.PI / 2; drum.position.set(0.24, 1.8, 0); prRig.add(drum);
  const barrel = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.24, 16), prBrassM);
  barrel.rotation.z = Math.PI / 2; barrel.position.set(-0.34, 1.8, 0); prRig.add(barrel);
  const ringF = new T.Mesh(new T.CylinderGeometry(0.056, 0.056, 0.03, 16), prBody2M);
  ringF.rotation.z = Math.PI / 2; ringF.position.set(-0.235, 1.8, 0); prRig.add(ringF);
  const tip = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.012, 12), prRedM);
  tip.rotation.z = Math.PI / 2; tip.position.set(-0.218, 1.8, 0); prRig.add(tip);
}
const prMirror = new T.Group();
prMirror.position.set(0, 1.8, 0);
{
  const disc = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.022, 36),
    [prBody2M, prMirrorFaceM, prBody2M]);
  disc.rotation.z = Math.PI / 4;
  prMirror.add(disc);
  const spot = new T.Mesh(new T.SphereGeometry(0.02, 8, 8), prRedM);
  spot.position.set(-0.015, 0.015, 0);
  prMirror.add(spot);
  const hub2 = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.14, 14), prBody2M);
  hub2.rotation.z = Math.PI / 2; hub2.position.set(0.1, 0, 0);
  prMirror.add(hub2);
}
prRig.add(prMirror);
prRig.traverse(o => { if (o.isMesh) o.castShadow = true; });
/* beams, hit marker, pulse */
const prSrcBeam = makeBeam(0.012, 0xff3226);
prRig.add(prSrcBeam);
prSrcBeam.userData.aim(-0.21, 1.8, 0, 1, 0, 0, 0.21);
const prOut = makeBeam(0.016, 0xff3226);
prScene.add(prOut);
const prHit = new T.Mesh(new T.SphereGeometry(0.07, 12, 12), new T.MeshBasicMaterial({ color: 0xff5346 }));
prScene.add(prHit);
const prPulse = new T.Mesh(new T.SphereGeometry(0.09, 12, 12), new T.MeshBasicMaterial({ color: 0xf2a41f }));
prPulse.visible = false;
prScene.add(prPulse);
/* dots */
const PRMAX = 90000;
const prPosA = new Float32Array(PRMAX * 3);
const prColA = new Float32Array(PRMAX * 3);
const prGeom = new T.BufferGeometry();
const prAttr = new T.BufferAttribute(prPosA, 3); prAttr.setUsage(T.DynamicDrawUsage);
const prColAttr = new T.BufferAttribute(prColA, 3); prColAttr.setUsage(T.DynamicDrawUsage);
prGeom.setAttribute('position', prAttr);
prGeom.setAttribute('color', prColAttr);
prGeom.setDrawRange(0, 0);
const prPts = new T.Points(prGeom, new T.PointsMaterial({ size: 0.048, vertexColors: true, sizeAttenuation: true,
  map: DOT, alphaTest: 0.5 }));
prPts.frustumCulled = false; prPts.raycast = function () {};
const prHalo = new T.Points(prGeom, new T.PointsMaterial({ size: 0.075, color: 0x2b2723,
  sizeAttenuation: true, map: DOT, alphaTest: 0.5 }));
prHalo.frustumCulled = false; prHalo.raycast = function () {};
prHalo.renderOrder = 0; prPts.renderOrder = 1;
prScene.add(prHalo);
prScene.add(prPts);
let prCount = 0, prUploaded = 0;
function prResetDots() { prCount = 0; prUploaded = 0; prGeom.setDrawRange(0, 0); }
/* Ray cast against the room; the 45-degree nadir cone emits no measurements. */
function prCast(dx, dy, dz) {
  if (dy < -Math.cos(45 * DEG)) return Infinity;
  const oy = 1.8;
  let bt = Infinity, t, hx, hy, hz;
  if (dy < 0) { t = -oy / dy; hx = dx * t; hz = dz * t;
    if (t > 1e-4 && t < bt && hx >= -PRW2 && hx <= PRW2 && hz >= -PRD2 && hz <= PRD2) bt = t; }
  if (dy > 0) { t = (PRH - oy) / dy; hx = dx * t; hz = dz * t;
    if (t > 1e-4 && t < bt && hx >= -PRW2 && hx <= PRW2 && hz >= -PRD2 && hz <= PRD2) bt = t; }
  if (dz < 0) { t = -PRD2 / dz; hx = dx * t; hy = oy + dy * t;
    if (t > 1e-4 && t < bt && hx >= -PRW2 && hx <= PRW2 && hy >= 0 && hy <= PRH) bt = t; }
  if (dz > 0) { t = PRD2 / dz; hx = dx * t; hy = oy + dy * t;
    if (t > 1e-4 && t < bt && hx >= -PRW2 && hx <= PRW2 && hy >= 0 && hy <= PRH) bt = t; }
  if (dx < 0) { t = -PRW2 / dx; hz = dz * t; hy = oy + dy * t;
    if (t > 1e-4 && t < bt && hz >= -PRD2 && hz <= PRD2 && hy >= 0 && hy <= PRH) bt = t; }
  if (dx > 0) { t = PRW2 / dx; hz = dz * t; hy = oy + dy * t;
    if (t > 1e-4 && t < bt && hz >= -PRD2 && hz <= PRD2 && hy >= 0 && hy <= PRH) bt = t; }
  return bt;
}
function prDirOf(a, yaw, out) {
  const h = Math.cos(a);
  out.x = h * Math.sin(yaw); out.y = Math.sin(a); out.z = h * Math.cos(yaw);
}
/* tick */
let prStepN = 1, prLastT = 0, prPhase = 0.4, prYaw = 0, prNextA = 0.4;
const prFlags = { spin: true, plot: true, yaw: false, rate: 2.2 };
let pulseT = -1, pulseDist = 0, lastAuto = 0;
const pulseDir = new T.Vector3(0, 0, 1);
const _pd = new T.Vector3();
function prTick(now) {
  const dt = Math.min(0.05, (now - prLastT) / 1000 || 0.016);
  prLastT = now;
  if (prFlags.spin) {
    const prev = prPhase;
    prPhase += dt * prFlags.rate;
    prMirror.rotation.x = Math.PI / 2 - prPhase;
    if (prFlags.plot) {
      const stepA = 1.2 * DEG;
      while (prNextA <= prPhase) {
        prDirOf(prNextA, prYaw, _pd);
        const t = prCast(_pd.x, _pd.y, _pd.z);
        if (t < 9.5 && prCount < PRMAX) {
          const i3 = prCount * 3;
          prPosA[i3] = _pd.x * t; prPosA[i3 + 1] = 1.8 + _pd.y * t; prPosA[i3 + 2] = _pd.z * t;
          gradSample(GRAD_D, t / 7.5, _rgb);
          prColA[i3] = _rgb[0]; prColA[i3 + 1] = _rgb[1]; prColA[i3 + 2] = _rgb[2];
          prCount++;
        }
        prNextA += stepA;
      }
    } else prNextA = prPhase;
  }
  if (prFlags.yaw) { prYaw += dt * 0.1; prRig.rotation.y = prYaw; }
  prDirOf(prPhase, prYaw, _pd);
  const bt = prCast(_pd.x, _pd.y, _pd.z);
  prOut.visible = Number.isFinite(bt);
  prHit.visible = Number.isFinite(bt);
  if (Number.isFinite(bt)) {
    prOut.userData.aim(0, 1.8, 0, _pd.x, _pd.y, _pd.z, bt);
    prHit.position.set(_pd.x * bt, 1.8 + _pd.y * bt, _pd.z * bt);
  }
  if (prStepN === 2 && pulseT < 0 && now - lastAuto > 3200) firePulse();
  if (pulseT >= 0) {
    pulseT += dt;
    const leg = pulseDist / 6;
    let s = -1;
    if (pulseT < leg) s = pulseT * 6;
    else if (pulseT < 2 * leg) s = pulseDist - (pulseT - leg) * 6;
    else { pulseT = -1; prPulse.visible = false; showTof(); }
    if (s >= 0) {
      prPulse.visible = true;
      prPulse.position.set(pulseDir.x * s, 1.8 + pulseDir.y * s, pulseDir.z * s);
    }
  }
  if (prCount > prUploaded) {
    prAttr.updateRange.offset = prUploaded * 3;
    prAttr.updateRange.count = (prCount - prUploaded) * 3;
    prAttr.needsUpdate = true;
    prColAttr.updateRange.offset = prUploaded * 3;
    prColAttr.updateRange.count = (prCount - prUploaded) * 3;
    prColAttr.needsUpdate = true;
    prUploaded = prCount;
    prGeom.setDrawRange(0, prCount);
  }
}
function firePulse() {
  if (pulseT >= 0) return;
  prDirOf(prPhase, prYaw, pulseDir);
  pulseDist = prCast(pulseDir.x, pulseDir.y, pulseDir.z);
  if (!Number.isFinite(pulseDist)) return;
  pulseT = 0;
  lastAuto = performance.now();
  $('prExtra').textContent = 'pulse in flight…';
  $('prExtra').style.display = 'block';
}
function showTof() {
  if (prCount < PRMAX) {
    const i3 = prCount * 3;
    prPosA[i3] = pulseDir.x * pulseDist;
    prPosA[i3 + 1] = 1.8 + pulseDir.y * pulseDist;
    prPosA[i3 + 2] = pulseDir.z * pulseDist;
    gradSample(GRAD_D, pulseDist / 7.5, _rgb);
    prColA[i3] = _rgb[0]; prColA[i3 + 1] = _rgb[1]; prColA[i3 + 2] = _rgb[2];
    prCount++;
  }
  const dNs = 2 * pulseDist / 0.299792458;
  const fac = Math.round(((2 * pulseDist / 6) / (dNs * 1e-9)) / 1e6);
  $('prExtra').innerHTML = 'Δt = ' + dNs.toFixed(1) + ' ns &nbsp;→&nbsp; d = c·Δt/2 = ' +
    '<b style="color:var(--red)">' + pulseDist.toFixed(2) + ' m</b> ' +
    '<span style="color:var(--dim)">(pulse slowed ≈' + fac + ' million×)</span>';
  lastAuto = performance.now();
}
/* steps */
const PRSTEPS = [
  { t: 'A single laser, a spinning mirror',
    b: 'This simplified scanner uses one laser, pulsed repeatedly at a small mirror tilted 45° that spins. The mirror steers that one beam around a full vertical circle — and wherever the beam lands, a distance is measured and a point is born, coloured by range: blue = near, red = far.',
    spin: true, plot: true, yaw: false, fire: false, reset: true, go: false, rate: 2.2 },
  { t: 'Measuring one distance — time of flight',
    b: 'For every direction the scanner times a light pulse: out to the surface and back. Distance = c · Δt ⁄ 2. Light crosses a room in nanoseconds, so the pulse here is slowed enormously. Each timed pulse becomes exactly one point of the cloud.',
    spin: false, plot: false, yaw: false, fire: true, reset: false, go: false, rate: 0 },
  { t: 'One revolution = one vertical profile',
    b: 'At working speed the mirror turns many times per second, so every revolution samples a complete vertical slice — floor, wall, ceiling, thousands of points a second. Note the gap at the bottom: the scanner’s own body blocks the beam.',
    spin: true, plot: true, yaw: false, fire: false, reset: true, go: false, rate: 6.5 },
  { t: 'A slow turn sweeps the whole room',
    b: 'A second motor rotates the head slowly about the vertical axis. Fast mirror × slow rotation covers every direction, and the profile slices fan out into a dome of points. This is exactly what happens in the room scan.',
    spin: true, plot: true, yaw: true, fire: false, reset: true, go: true, rate: 6.5 }
];
function prSetStep(n) {
  prStepN = n;
  const S = PRSTEPS[n - 1];
  prFlags.spin = S.spin; prFlags.plot = S.plot; prFlags.yaw = S.yaw; prFlags.rate = S.rate;
  prNextA = prPhase;
  if (!S.spin) { prPhase = 0; prMirror.rotation.x = Math.PI / 2; }
  if (n <= 2) { prYaw = 0; prRig.rotation.y = 0; }
  if (n === 1 || n === 3) prResetDots();
  pulseT = -1; prPulse.visible = false;
  $('prStep').textContent = 'STEP ' + n + ' OF 4';
  $('prTitle').textContent = S.t;
  $('prBody').textContent = S.b;
  $('prExtra').textContent = n === 2 ? 'Watch the pulse — it fires on its own, or press the button.' : '';
  $('prExtra').style.display = n === 2 ? 'block' : 'none';
  $('prFire').style.display = S.fire ? '' : 'none';
  $('prReset').style.display = S.reset ? '' : 'none';
  $('prGo').style.display = S.go ? '' : 'none';
  $('prNext').style.display = S.go ? 'none' : '';
  $('prPrev').style.visibility = n === 1 ? 'hidden' : 'visible';
  $('prDots').innerHTML = [1, 2, 3, 4].map(i => '<span class="pd' + (i === n ? ' on' : '') + '"></span>').join('');
  lastAuto = performance.now() + 800;
}
$('prNext').addEventListener('click', () => prSetStep(Math.min(4, prStepN + 1)));
$('prPrev').addEventListener('click', () => prSetStep(Math.max(1, prStepN - 1)));
$('prFire').addEventListener('click', firePulse);
$('prReset').addEventListener('click', prResetDots);
$('prGo').addEventListener('click', () => setMode('room'));
document.querySelectorAll('#modeSeg button').forEach(b =>
  b.addEventListener('click', () => setMode(b.dataset.mode)));
/* mode switching */
const camSave = {
  principle: { tx: 0, ty: 1.75, tz: 0, theta: 0.85, phi: 1.05, r: 6.2 },
  room: { tx: 0, ty: 1.1, tz: 0, theta: 0.82, phi: 1.12, r: 14 }
};
let roomVisited = false;
function setMode(m) {
  if (state.mode === m) return;
  const cs = camSave[state.mode];
  cs.tx = ctrl.target.x; cs.ty = ctrl.target.y; cs.tz = ctrl.target.z;
  cs.theta = ctrl.theta; cs.phi = ctrl.phi; cs.r = ctrl.radius;
  state.mode = m;
  const cl = camSave[m];
  ctrl.target.set(cl.tx, cl.ty, cl.tz);
  ctrl.theta = cl.theta; ctrl.phi = cl.phi; ctrl.radius = cl.r;
  const room = m === 'room';
  if (!room) {
    if (rescanTimer) { clearTimeout(rescanTimer); rescanTimer = null; }
    if (job) { job = null; scanStatus = 'Stopped — partial cloud'; setScanBtn(); }
    hideBeam();
    endRegGame();
    pendingRegGame = false;
    if (state.viewMode !== 'orbit') setView('orbit');
    prLastT = performance.now();
  }
  $('panel').style.display = room ? '' : 'none';
  $('hud').style.display = room ? '' : 'none';
  $('btnScan').style.display = room ? '' : 'none';
  $('btnCloud').parentElement.style.display = room ? '' : 'none';
  $('viewSeg').style.display = room ? '' : 'none';
  $('btnMenu').parentElement.style.display = room ? '' : 'none';
  $('lessonCard').style.display = 'none';
  $('prCard').style.display = room ? 'none' : 'block';
  document.querySelectorAll('#modeSeg button').forEach(b =>
    b.classList.toggle('on', b.dataset.mode === m));
  if (room && !roomVisited) {
    roomVisited = true;
    startScan(true);
    if (innerWidth <= 760) {
      const mb = $('btnMenu').parentElement;
      if (mb.classList) { mb.classList.add('attn'); setTimeout(() => mb.classList.remove('attn'), 3400); }
      setTimeout(() => toast('☰  scenes, furniture, lessons & export live here'), 1300);
    }
  }
}

/* ---------------- main loop & boot ---------------- */
function animate() {
  requestAnimationFrame(animate);
  if (state.mode === 'principle') {
    prTick(performance.now());
    ctrlApply();
    renderer.render(prScene, camera);
    return;
  }
  if (job) stepJob();
  if (regAnim && regActive) {
    regAnim.k++;
    const t = Math.min(1, regAnim.k / regAnim.n);
    const e = 1 - Math.pow(1 - t, 3);
    regOff.x = regAnim.x * (1 - e);
    regOff.z = regAnim.z * (1 - e);
    regOff.yaw = regAnim.yaw * (1 - e);
    applyRegOff();
    if (regAnim && t >= 1) regAnim = null;
  }
  if (count > uploaded) {
    posAttr.updateRange.offset = uploaded * 3;
    posAttr.updateRange.count = (count - uploaded) * 3;
    posAttr.needsUpdate = true;
    colAttr.updateRange.offset = uploaded * 3;
    colAttr.updateRange.count = (count - uploaded) * 3;
    colAttr.needsUpdate = true;
    uploaded = count;
  }
  if (colorsDirtyAll) {
    colAttr.updateRange.offset = 0;
    colAttr.updateRange.count = count * 3;
    colAttr.needsUpdate = true;
    colorsDirtyAll = false;
  }
  pGeom.setDrawRange(0, count);
  ctrlApply();
  const povMesh = state.viewMode === 'pov' && stations[0]?.mesh;
  if (povMesh) povMesh.visible = false;
  renderer.render(scene, camera);
  if (povMesh) povMesh.visible = !state.cloudOnly;
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

addStation(-2, 0.8, true);
addObstacle('table', 2.6, 1.8, null, true);
addObstacle('cyl', -3.6, -2.4, null, true);
syncUI();
statsRefresh();
refreshObChips();
hudLive();
prSetStep(1);
setMode('principle');
animate();
document.body.classList.add('app-ready');
const updateLayout = () => document.documentElement.style.setProperty('--toolbar-bottom',
  Math.ceil($('topbar').getBoundingClientRect().bottom + 10) + 'px');
new ResizeObserver(updateLayout).observe($('topbar'));
updateLayout();
setTimeout(() => toast('Walk through the 4 steps, then switch to Room scan'), 2600);

if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) {
  window.lab = { state, stations, obstacles, LESSONS, SCENES, loadScene, setStations,
    setStructure, addObstacle, clearObstacles, addStation, removeStation, startScan,
    buildColliders, computeCoverage, targetAudit, syncUI, setMode, prSetStep, prCast,
    cast(ox,oy,oz,dx,dy,dz,exclude=99) { return castAll(ox,oy,oz,dx,dy,dz,exclude) ? {...HIT, source: HIT.source?.label || null} : null; },
    snapshot(includePoints = false) { return {count, status:scanStatus, running:!!job, regActive, pendingRegGame,
      prCount, prPoints:includePoints ? Array.from(prPosA.subarray(0,prCount*3)) : [], counts:[...stCounts],
      shared:lastShared, regOff:{...regOff}, points:includePoints ? Array.from(pPos.subarray(0,Math.min(count,200000)*3)) : [],
      memory:{...renderer.info.memory}}; }
  };
}
