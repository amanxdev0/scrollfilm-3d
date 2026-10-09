/* SCROLLFILM — the film engine.
 * A scroll-driven cinematic WebGL scene. The scroll position is a playhead
 * (0 → 1); the render loop INTERPOLATES toward it every frame instead of
 * snapping, so janky ~20 Hz scroll input still renders buttery motion.
 */
import * as THREE from 'three';

const canvas = document.getElementById('film');
const hudBar = document.getElementById('hudBar');
const hudKnob = document.getElementById('hudKnob');
const hudFps = document.getElementById('hudFps');
const hudScene = document.getElementById('hudScene');
const labFps = document.getElementById('labFps');
const fpsNote = document.getElementById('fpsNote');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarse = matchMedia('(pointer: coarse)').matches;

/* ---------------- helpers ---------------- */
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const env = (p, a, b, c, d) => sstep(a, b, p) * (1 - sstep(c, d, p));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- renderer ---------------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('no-webgl');
  document.getElementById('nogl').hidden = false;
  document.querySelectorAll('.chapter').forEach((el) => el.classList.add('is-active'));
  throw e;
}

const PR_CAP = isCoarse ? 1.5 : 2;   // never render above this pixel ratio
let pixelRatio = Math.min(devicePixelRatio || 1, PR_CAP);
renderer.setPixelRatio(pixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);
scene.fog = new THREE.Fog(0x05070f, 55, 250);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1200);

/* ---------------- act 1: nebula ---------------- */
function makeNebula(count, size, spread) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const palette = [[0.34, 0.9, 1.0], [1.0, 0.45, 0.75], [1.0, 0.75, 0.4], [0.7, 0.8, 1.0]];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = spread * (0.25 + 0.75 * Math.random());
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
    pos[i * 3 + 2] = r * Math.cos(ph) - 40;
    c.setRGB(...palette[(Math.random() * palette.length) | 0]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  return new THREE.Points(g, m);
}
const nebulaFar = makeNebula(isCoarse ? 1200 : 2200, 1.1, 150);
const nebulaNear = makeNebula(isCoarse ? 400 : 800, 0.55, 90);
const nebulaGroup = new THREE.Group();
nebulaGroup.add(nebulaFar, nebulaNear);
scene.add(nebulaGroup);

/* ---------------- act 2: the planet ---------------- */
const planetGroup = new THREE.Group();
const planetWire = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(11, 1)),
  new THREE.LineBasicMaterial({ color: 0x57e6ff, transparent: true, opacity: 0.85 })
);
const planetGlow = new THREE.Mesh(
  new THREE.SphereGeometry(10.4, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0x1a6cff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false })
);
planetGroup.add(planetWire, planetGlow);
scene.add(planetGroup);

/* ---------------- act 3: the tunnel ---------------- */
const tunnelGroup = new THREE.Group();
const rings = [];
const RING_COUNT = 26;
for (let i = 0; i < RING_COUNT; i++) {
  const mat = new THREE.MeshBasicMaterial({
    color: i % 2 ? 0xffb454 : 0x57e6ff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(13, 0.12, 8, 72), mat);
  ring.position.z = -25 - i * 7;
  tunnelGroup.add(ring);
  rings.push(ring);
}
scene.add(tunnelGroup);

/* ---------------- act 4: terrain + finale ---------------- */
const TER_W = 600, TER_SEG = 44;
const terGeo = new THREE.PlaneGeometry(TER_W, TER_W, TER_SEG, TER_SEG);
terGeo.rotateX(-Math.PI / 2);
const terBase = terGeo.attributes.position.array.slice();
const terrain = new THREE.Mesh(
  terGeo,
  new THREE.MeshBasicMaterial({ color: 0x2fd4c4, wireframe: true, transparent: true, opacity: 0.5 })
);
terrain.position.set(0, -16, -170);
const terrainGroup = new THREE.Group();
terrainGroup.add(terrain);
scene.add(terrainGroup);

const finaleGroup = new THREE.Group();
const finaleRing = new THREE.Mesh(
  new THREE.TorusGeometry(14, 0.35, 12, 90),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
);
finaleRing.position.set(0, 6, -232);
finaleGroup.add(finaleRing);
scene.add(finaleGroup);

/* ---------------- camera path (the film timeline) ---------------- */
const CAM_KEYS = [
  { p: 0.00, pos: [0, 1.5, 72],   look: [0, 0, 0] },
  { p: 0.18, pos: [27, 9, 42],    look: [0, 0, 0] },
  { p: 0.38, pos: [-16, -5, 28],  look: [0, 0, -40] },
  { p: 0.55, pos: [0, 0, 4],      look: [0, 0, -70] },
  { p: 0.72, pos: [0, 0, -125],   look: [0, 0, -195] },
  { p: 0.86, pos: [0, 12, -150],  look: [0, -8, -235] },
  { p: 1.00, pos: [0, 30, -115],  look: [0, 2, -235] },
];
const COL_KEYS = [
  { p: 0.00, c: new THREE.Color(0x05070f) },
  { p: 0.30, c: new THREE.Color(0x0a1626) },
  { p: 0.55, c: new THREE.Color(0x241016) },
  { p: 0.75, c: new THREE.Color(0x2e1a10) },
  { p: 1.00, c: new THREE.Color(0x100f22) },
];
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _c = new THREE.Color();

function keyedLerp(keys, p, out, isColor) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const a = keys[i], b = keys[i + 1];
  const t = sstep(a.p, b.p, p);
  if (isColor) { out.copy(a.c).lerp(b.c, t); }
  else { out.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)); }
  return out;
}

/* ---------------- render one film frame at playhead p ---------------- */
function render(p, t) {
  // camera
  keyedLerp(CAM_KEYS, p, _v1, false);
  camera.position.copy(_v1);
  camera.position.x += Math.sin(t * 0.5) * 0.5;   // handheld sway
  camera.position.y += Math.cos(t * 0.4) * 0.35;
  // look target: interpolate between the bracketing keyframes
  let i = 0;
  while (i < CAM_KEYS.length - 2 && p > CAM_KEYS[i + 1].p) i++;
  const A = CAM_KEYS[i], B = CAM_KEYS[i + 1], tt = sstep(A.p, B.p, p);
  _v2.set(lerp(A.look[0], B.look[0], tt), lerp(A.look[1], B.look[1], tt), lerp(A.look[2], B.look[2], tt));
  camera.lookAt(_v2);
  camera.rotation.z += Math.sin(p * Math.PI * 2) * 0.03; // subtle roll

  // color grade
  keyedLerp(COL_KEYS, p, _c, true);
  scene.background.copy(_c);
  scene.fog.color.copy(_c);

  // act envelopes
  const eNeb = env(p, -0.01, 0.02, 0.30, 0.46);
  nebulaGroup.visible = eNeb > 0.004;
  nebulaFar.material.opacity = 0.9 * eNeb;
  nebulaNear.material.opacity = 0.9 * eNeb;
  nebulaGroup.rotation.y = t * 0.006 + p * 0.7;
  nebulaGroup.rotation.x = p * 0.15;

  const ePla = env(p, 0.14, 0.26, 0.40, 0.54);
  planetGroup.visible = ePla > 0.004;
  planetGroup.scale.setScalar(Math.max(0.001, ePla));
  planetWire.material.opacity = 0.85 * ePla;
  planetGlow.material.opacity = 0.07 * ePla;
  planetGroup.rotation.y = t * 0.18;
  planetGroup.rotation.x = 0.25 + p * 0.6;

  const eTun = env(p, 0.40, 0.50, 0.70, 0.82);
  tunnelGroup.visible = eTun > 0.004;
  rings.forEach((r, k) => {
    r.material.opacity = 0.8 * eTun;
    const s = 1 + 0.05 * Math.sin(t * 2.2 - k * 0.45);
    r.scale.set(s, s, 1);
  });

  const eTer = env(p, 0.66, 0.78, 0.96, 1.02);
  terrainGroup.visible = eTer > 0.004;
  terrain.material.opacity = 0.5 * eTer;
  if (terrainGroup.visible) {
    const posA = terGeo.attributes.position;
    for (let k = 0; k < posA.count; k++) {
      const x = terBase[k * 3], z = terBase[k * 3 + 2];
      posA.array[k * 3 + 1] = terBase[k * 3 + 1]
        + Math.sin(x * 0.055 + t * 1.15) * Math.cos(z * 0.05 + t * 0.85) * 2.4 * eTer;
    }
    posA.needsUpdate = true;
  }

  const eFin = env(p, 0.85, 0.93, 1.02, 1.04);
  finaleGroup.visible = eFin > 0.004;
  finaleRing.material.opacity = 0.9 * eFin;
  finaleRing.rotation.z = t * 0.25;
  finaleRing.rotation.x = Math.sin(t * 0.3) * 0.2;

  renderer.render(scene, camera);
}

/* ---------------- the interpolation engine ---------------- */
let targetP = 0;   // where the scrollbar says we should be (janky, ~20 Hz)
let smoothP = 0;   // where the film actually is (smooth, display rate)

function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  targetP = max > 0 ? clamp01(scrollY / max) : 0;
}
addEventListener('scroll', readScroll, { passive: true });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  readScroll();
});
readScroll();

/* chapters: real HTML synced to the same playhead */
const chapters = [...document.querySelectorAll('.chapter')].map((el) => ({
  el,
  from: parseFloat(el.dataset.from),
  to: parseFloat(el.dataset.to),
  active: false,
}));
function syncChapters(p) {
  for (const ch of chapters) {
    const on = p > ch.from && p < ch.to;
    if (on !== ch.active) { ch.active = on; ch.el.classList.toggle('is-active', on); }
  }
  const sceneNo = p < 0.2 ? 1 : p < 0.45 ? 2 : p < 0.7 ? 3 : 4;
  hudScene.textContent = `SCENE ${sceneNo} / 4`;
}

/* HUD */
function syncHud(p) {
  const pct = (p * 100).toFixed(2) + '%';
  hudBar.style.width = pct;
  hudKnob.style.left = pct;
}

/* fps meter + adaptive quality */
let fpsEma = 60, lastFpsText = 0, lastQuality = 0;
function syncPerf(dt, t) {
  if (dt > 0) fpsEma += (1 / dt - fpsEma) * 0.06;
  if (t - lastFpsText > 0.5) {
    lastFpsText = t;
    const f = Math.round(fpsEma);
    hudFps.textContent = `${f} fps`;
    hudFps.className = 'hud-fps ' + (f >= 40 ? 'good' : 'warn');
    labFps.textContent = f;
    fpsNote.textContent = f >= 50 ? '· butter smooth' : f >= 40 ? '· on target' : '· adaptive quality engaged';
  }
  if (t - lastQuality > 2.5) {
    lastQuality = t;
    if (fpsEma < 34 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
    } else if (fpsEma > 57 && pixelRatio < PR_CAP) {
      pixelRatio = Math.min(PR_CAP, pixelRatio + 0.25);
      renderer.setPixelRatio(pixelRatio);
    }
  }
}

/* main loop */
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  // THE trick: ease the rendered playhead toward the scroll target every
  // frame, with frame-rate-independent damping. Scroll events may arrive at
  // ~20 Hz; this loop runs at display rate, so motion stays smooth.
  const k = 1 - Math.exp(-dt * 5.5);
  smoothP += (targetP - smoothP) * k;
  if (Math.abs(targetP - smoothP) < 0.0004) smoothP = targetP;
  render(smoothP, t);
  syncChapters(smoothP);
  syncHud(smoothP);
  syncPerf(dt, t);
}

renderer.setSize(innerWidth, innerHeight);

if (reducedMotion) {
  // one still frame; every word stays readable
  render(0.12, 0);
  chapters.forEach((ch) => { ch.active = true; ch.el.classList.add('is-active'); });
  hudBar.style.width = '12%';
  hudKnob.style.left = '12%';
  hudFps.textContent = 'still';
} else {
  frame();
}

/* ---------------- lab controls ---------------- */
const xrayBtn = document.getElementById('xrayBtn');
xrayBtn.addEventListener('click', () => {
  const on = document.body.classList.toggle('xray');
  xrayBtn.setAttribute('aria-pressed', String(on));
  xrayBtn.textContent = on ? 'X-ray off' : 'X-ray the layers';
});

const LOOP_SNIPPET = `function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const k = 1 - Math.exp(-dt * 5.5); // frame-rate independent damping
  smooth += (target - smooth) * k;   // interpolate toward playhead
  render(smooth);
}`;
document.getElementById('copyLoop').addEventListener('click', async (ev) => {
  const btn = ev.currentTarget;
  try {
    await navigator.clipboard.writeText(LOOP_SNIPPET);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = LOOP_SNIPPET;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const old = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = old; }, 1600);
});
