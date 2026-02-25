import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ─────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────
const socket = io();

socket.on('connect', () => console.log('[socket] connected', socket.id));
socket.on('connect_error', (e) => console.error('[socket] error', e.message));

socket.on('user-count', (n) => {
  document.getElementById('user-count').textContent = `● ${n} online`;
});

// ─────────────────────────────────────────────
// RENDERER — fixed 1920×1080, CSS-scaled to fit
// ─────────────────────────────────────────────
const W = 1920, H = 1080;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

function fitCanvas() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const ar   = W / H;
  let cw, ch;
  if (winW / winH > ar) { ch = winH; cw = winH * ar; }
  else                   { cw = winW; ch = winW / ar; }
  renderer.domElement.style.width  = cw + 'px';
  renderer.domElement.style.height = ch + 'px';
}
fitCanvas();

// ─────────────────────────────────────────────
// SCENE & CAMERA
// ─────────────────────────────────────────────
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
camera.position.set(0, 0, 7);

// ─────────────────────────────────────────────
// BLOOM POST-PROCESSING
// threshold raised to 0.9 so video colours don't over-bloom;
// HDR edge/glow colours (>1.0 luminance) still bloom hard
// ─────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(W, H),
  1.35,  // strength
  0.55,  // radius
  0.9    // threshold
);
composer.addPass(bloom);

// ─────────────────────────────────────────────
// LIGHTS
// ─────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 1.8));

const fill = new THREE.DirectionalLight(0xfff5ee, 2.2);
fill.position.set(2, 3, 5);
scene.add(fill);

const rim = new THREE.DirectionalLight(0x8ab4f8, 0.6);
rim.position.set(-3, -2, 4);
scene.add(rim);

// ─────────────────────────────────────────────
// WALL CONFIGURATION
// ─────────────────────────────────────────────
const COLS   = 20;
const BW     = 0.82;
const BH     = 0.28;
const BD     = 0.24;
const GX     = 0.038;
const GY     = 0.038;
const STEP_X = BW + GX;
const STEP_Y = BH + GY;

// Compute rows needed to fill the visible frustum height
const _visH   = 2 * Math.tan(THREE.MathUtils.degToRad(55) / 2) * 7;
const ROWS    = Math.ceil(_visH / STEP_Y) + 1; // +1 for margin

// Drop camera to the bottom row's Y, angle it up to wall centre
const bottom_y = (0.5 - ROWS / 2) * STEP_Y;
camera.position.y = bottom_y + 6 * STEP_Y;
camera.lookAt(0, 0, 0);


// ─────────────────────────────────────────────
// LAYER 2 (middle): video — revealed as bricks fall
// ─────────────────────────────────────────────
const videoEl = document.createElement('video');
videoEl.src        = '/video/giant';
videoEl.loop       = true;
videoEl.muted      = true;
videoEl.playsInline = true;
videoEl.autoplay   = true;
videoEl.play().catch(() => {
  document.addEventListener('click', () => videoEl.play(), { once: true });
});

const videoTex = new THREE.VideoTexture(videoEl);
videoTex.colorSpace = THREE.SRGBColorSpace;

// Render video as a screen-space background plate —
// always fills the canvas, never moves with the camera
scene.background = videoTex;

// ─────────────────────────────────────────────
// LAYER 3 (front): shared brick geometry & materials
// ─────────────────────────────────────────────
const brickGeo = new THREE.BoxGeometry(BW, BH, BD);
const edgeGeo  = new THREE.EdgesGeometry(brickGeo);

// ─────────────────────────────────────────────
// PROCEDURAL CANVAS TEXTURES & MATERIALS
// ─────────────────────────────────────────────
const MAT_TYPES = ['brick','wood','metal','glass','concrete','asphalt','plastic'];

function makeCanvasTex(type, seed) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');

  // Deterministic LCG seeded random
  let _s = (seed + 1) * 9301 + 49297;
  function rnd() { _s = (_s * 9301 + 49297) % 233280; return _s / 233280; }
  function rr(a, b) { return a + rnd() * (b - a); }

  switch (type) {
    case 'brick': {
      const hue = rr(8, 22), sat = rr(55, 70), lgt = rr(22, 35);
      ctx.fillStyle = `hsl(${hue},${sat}%,${lgt}%)`;
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = `hsla(${hue+rr(-8,8)},${sat}%,${lgt+rr(-12,12)}%,${rr(0.25,0.55)})`;
        ctx.beginPath(); ctx.arc(rnd()*S, rnd()*S, rr(0.5,3.5), 0, Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'wood': {
      const hue = rr(22, 35), sat = rr(50, 70), lgt = rr(15, 30);
      ctx.fillStyle = `hsl(${hue},${sat}%,${lgt}%)`;
      ctx.fillRect(0, 0, S, S);
      const ng = Math.floor(rr(10, 22)), off = rnd() * S;
      for (let i = 0; i < ng * 4; i++) {
        const yBase = (i / (ng * 4)) * S * 1.5 - S * 0.25;
        ctx.strokeStyle = `hsla(${hue+rr(0,8)},${sat}%,${lgt+rr(-10,10)}%,${rr(0.3,0.7)})`;
        ctx.lineWidth = rr(1, 4);
        ctx.beginPath();
        for (let x = 0; x <= S; x += 8) {
          const y = yBase + Math.sin((x + off) * 0.04 + rnd()*0.3) * rr(3, 10);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'metal': {
      const base = Math.floor(rr(120, 175));
      ctx.fillStyle = `rgb(${base},${base+5},${base+12})`;
      ctx.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += rr(0.8, 2.5)) {
        const b = Math.floor(base + rr(-18, 18));
        ctx.strokeStyle = `rgba(${b},${b+5},${b+12},${rr(0.2,0.5)})`;
        ctx.lineWidth = rr(0.5, 2);
        ctx.beginPath(); ctx.moveTo(0, y+rr(-0.5,0.5)); ctx.lineTo(S, y+rr(-0.5,0.5)); ctx.stroke();
      }
      break;
    }
    case 'glass': {
      const hue = rr(190, 225);
      ctx.fillStyle = `hsl(${hue},65%,52%)`;
      ctx.fillRect(0, 0, S, S);
      const grd = ctx.createLinearGradient(0, 0, S, S);
      grd.addColorStop(0,   `hsla(${hue},80%,82%,0.45)`);
      grd.addColorStop(0.5, `hsla(${hue},60%,48%,0.05)`);
      grd.addColorStop(1,   `hsla(${hue},70%,30%,0.35)`);
      ctx.fillStyle = grd; ctx.fillRect(0, 0, S, S);
      const rx = rr(0.15,0.4), ry = rr(0.08,0.3);
      const grd2 = ctx.createRadialGradient(rx*S, ry*S, 0, rx*S+10, ry*S+10, S*0.45);
      grd2.addColorStop(0, 'rgba(255,255,255,0.72)');
      grd2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd2; ctx.fillRect(0, 0, S, S);
      break;
    }
    case 'concrete': {
      const base = Math.floor(rr(88, 140));
      ctx.fillStyle = `rgb(${base},${base-2},${base-6})`;
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 2800; i++) {
        const b = Math.floor(base + rr(-30, 30));
        ctx.fillStyle = `rgba(${b},${b-2},${b-5},${rr(0.25,0.6)})`;
        ctx.beginPath(); ctx.arc(rnd()*S, rnd()*S, rr(0.4,3), 0, Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'asphalt': {
      const base = Math.floor(rr(20, 42));
      ctx.fillStyle = `rgb(${base},${base},${Math.max(0,base-4)})`;
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 2200; i++) {
        const b = Math.floor(base + rr(0, 50));
        ctx.fillStyle = `rgba(${b},${b},${Math.max(0,b-3)},${rr(0.35,0.65)})`;
        ctx.beginPath(); ctx.arc(rnd()*S, rnd()*S, rr(0.4,2.2), 0, Math.PI*2); ctx.fill();
      }
      break;
    }
    case 'plastic': {
      const hue = rnd() * 360, sat = rr(65, 90), lgt = rr(38, 58);
      ctx.fillStyle = `hsl(${hue},${sat}%,${lgt}%)`;
      ctx.fillRect(0, 0, S, S);
      const grd = ctx.createRadialGradient(S*0.35, S*0.22, 0, S*0.5, S*0.5, S*0.7);
      grd.addColorStop(0,   `hsla(${hue},${sat}%,${lgt+28}%,0.65)`);
      grd.addColorStop(0.5, `hsla(${hue},${sat}%,${lgt+10}%,0.1)`);
      grd.addColorStop(1,   `hsla(${hue},${sat}%,${lgt-10}%,0)`);
      ctx.fillStyle = grd; ctx.fillRect(0, 0, S, S);
      break;
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const MAT_PROPS = {
  brick:    { roughness: .97, metalness: 0   },
  concrete: { roughness: .98, metalness: 0   },
  wood:     { roughness: .94, metalness: 0   },
  metal:    { roughness: .65, metalness: .92 },
  glass:    { roughness: .45, metalness: .04, transparent: true, opacity: 0.90 },
  asphalt:  { roughness: .99, metalness: 0   },
  plastic:  { roughness: .72, metalness: 0   },
};

// Pre-generate a pool of 12 materials per type
const POOL_SIZE = 12;
const MAT_POOL = {};
MAT_TYPES.forEach((type, ti) => {
  MAT_POOL[type] = Array.from({ length: POOL_SIZE }, (_, i) => {
    const tex = makeCanvasTex(type, ti * 1000 + i * 137 + 1);
    return new THREE.MeshStandardMaterial({ ...MAT_PROPS[type], map: tex });
  });
});

const edgeMat = new THREE.LineBasicMaterial({
  color:       new THREE.Color(0.0, 2.8, 2.8),
  transparent: true,
  opacity:     0.85,
});

// ─────────────────────────────────────────────
// BUILD BRICK GRID
// ─────────────────────────────────────────────
const bricks      = {};
const brickMeshes = [];

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const id = `${col}_${row}`;

    const hexOff = (row % 2) * (STEP_X / 2);
    const x = (col - COLS / 2 + 0.5) * STEP_X + hexOff;
    const y = (row - ROWS / 2 + 0.5) * STEP_Y;

    const _mt   = MAT_TYPES[Math.floor(Math.random() * MAT_TYPES.length)];
    const _pool = MAT_POOL[_mt];
    const mesh  = new THREE.Mesh(brickGeo, _pool[Math.floor(Math.random() * _pool.length)]);
    mesh.position.set(x, y, 0);
    mesh.userData.brickId = id;
    scene.add(mesh);

    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    mesh.add(edges);

    bricks[id] = { id, mesh, x, y, fallen: false, animating: false, matType: _mt };
    brickMeshes.push(mesh);
  }
}

// ─────────────────────────────────────────────
// ANIMATIONS
// ─────────────────────────────────────────────
function fallBrick(brick) {
  if (brick.fallen || brick.animating) return;
  brick.fallen    = true;
  brick.animating = true;

  const { mesh, x, y } = brick;
  const spin = Math.random() < 0.5 ? 1 : -1;

  gsap.to(mesh.position, {
    z:        6.8,
    y:        y - 2.8,
    x:        x + (Math.random() - 0.5) * 1.8,
    duration: 0.9,
    ease:     'power2.in',
    onComplete() {
      mesh.visible = false;
      mesh.position.set(x, y, 0);
      mesh.rotation.set(0, 0, 0);
      brick.animating = false;
    },
  });

  gsap.to(mesh.rotation, {
    x:        spin * Math.PI * (0.35 + Math.random() * 0.5),
    y:        spin * Math.PI * (0.25 + Math.random() * 0.55),
    z:              Math.PI * (Math.random() - 0.5) * 0.4,
    duration: 0.9,
    ease:     'power2.in',
  });
}

function returnBrick(brick) {
  brick.animating = true;
  const { mesh, x, y } = brick;

  mesh.position.set(x, y, -8);
  mesh.rotation.set(0, 0, 0);
  mesh.visible = true;

  gsap.to(mesh.position, {
    z:        0,
    duration: 0.72,
    ease:     'back.out(1.6)',
    onComplete() {
      brick.fallen    = false;
      brick.animating = false;
    },
  });
}

// ─────────────────────────────────────────────
// SOCKET.IO EVENTS
// ─────────────────────────────────────────────
socket.on('init-state', (state) => {
  for (const [id, data] of Object.entries(state)) {
    if (data.fallen && bricks[id]) {
      bricks[id].fallen       = true;
      bricks[id].mesh.visible = false;
    }
  }
});

socket.on('group-fall', ({ brickIds }) => {
  brickIds.forEach((id, i) => {
    const b = bricks[id];
    if (b) setTimeout(() => fallBrick(b), i === 0 ? 0 : Math.random() * 260);
  });
});

socket.on('group-return', ({ brickIds, material }) => {
  const pool = MAT_POOL[material] || MAT_POOL['brick'];
  brickIds.forEach(id => {
    const b = bricks[id];
    if (!b) return;
    b.mesh.material = pool[Math.floor(Math.random() * pool.length)];
    b.matType = material;
    returnBrick(b);
  });
});

// ─────────────────────────────────────────────
// INPUT — mouse & touch (uses canvas rect for letterbox-safe coords)
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

function onInteract(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(
     ((clientX - rect.left) / rect.width)  * 2 - 1,
    -((clientY - rect.top)  / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);

  const visible = brickMeshes.filter(m => m.visible);
  const hit     = raycaster.intersectObjects(visible, false)[0];

  console.log('[click]', { pointer: pointer.toArray(), visibleCount: visible.length, hit: !!hit });

  if (hit) {
    const id    = hit.object.userData.brickId;
    const brick = bricks[id];
    console.log('[hit]', id, { fallen: brick?.fallen, animating: brick?.animating });
    if (brick && !brick.fallen && !brick.animating) {
      socket.emit('brick-click', { brickId: id, material: brick.matType });
      console.log('[emit] brick-click', id, brick.matType);
    }
  }
}

renderer.domElement.addEventListener('click', (e) => {
  onInteract(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('touchend', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  onInteract(t.clientX, t.clientY);
}, { passive: false });

// ─────────────────────────────────────────────
// RENDER LOOP
// ─────────────────────────────────────────────
const clock = new THREE.Clock();

(function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  const pulse = 0.5 + 0.5 * Math.sin(t * 1.7);
  edgeMat.opacity = 0.3 + 0.6 * pulse;
  edgeMat.color.setRGB(
    0.05 * pulse,
    2.2 + 0.6 * pulse,
    2.8
  );

  composer.render();
}());

// ─────────────────────────────────────────────
// RESIZE — only re-fit CSS, renderer stays 1920×1080
// ─────────────────────────────────────────────
window.addEventListener('resize', fitCanvas);
