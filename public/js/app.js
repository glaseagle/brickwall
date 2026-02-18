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
// RENDERER
// ─────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

// ─────────────────────────────────────────────
// SCENE & CAMERA
// ─────────────────────────────────────────────
const scene  = new THREE.Scene();
scene.background = new THREE.Color(0x04040a);
scene.fog = new THREE.FogExp2(0x04040a, 0.04);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 7);

// ─────────────────────────────────────────────
// BLOOM POST-PROCESSING
// ─────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.35,  // strength
  0.55,  // radius
  0.08   // threshold (low = more things bloom)
);
composer.addPass(bloom);

// ─────────────────────────────────────────────
// LIGHTS
// ─────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x111133, 3));

const fill = new THREE.DirectionalLight(0x6688cc, 1.2);
fill.position.set(2, 3, 5);
scene.add(fill);

// ─────────────────────────────────────────────
// WALL CONFIGURATION
// ─────────────────────────────────────────────
const COLS   = 20;
const ROWS   = 12;
const BW     = 0.82;   // brick width
const BH     = 0.28;   // brick height
const BD     = 0.24;   // brick depth
const GX     = 0.038;  // gap x (mortar)
const GY     = 0.038;  // gap y (mortar)
const STEP_X = BW + GX;
const STEP_Y = BH + GY;

// ─────────────────────────────────────────────
// BACK WALL — warm glow visible through holes
// ─────────────────────────────────────────────
const backMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(5.0, 2.2, 0.4), // HDR warm amber → blooms hard
});
const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(COLS * STEP_X + 1.5, ROWS * STEP_Y + 1.5),
  backMat
);
backWall.position.z = -(BD / 2 + 0.06);
scene.add(backWall);

// ─────────────────────────────────────────────
// SHARED BRICK GEOMETRY & MATERIALS
// ─────────────────────────────────────────────
const brickGeo = new THREE.BoxGeometry(BW, BH, BD);
const edgeGeo  = new THREE.EdgesGeometry(brickGeo);

const brickMat = new THREE.MeshStandardMaterial({
  color:              0x11101a,
  roughness:          0.88,
  metalness:          0.04,
  emissive:           0x050318,
  emissiveIntensity:  0.8,
});

// One shared edge material — pulsed in the render loop
const edgeMat = new THREE.LineBasicMaterial({
  color:       new THREE.Color(0.0, 2.8, 2.8), // bright cyan, HDR → blooms
  transparent: true,
  opacity:     0.85,
});

// ─────────────────────────────────────────────
// BUILD BRICK GRID
// ─────────────────────────────────────────────
const bricks      = {};  // id → brick object
const brickMeshes = [];  // for raycasting

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const id = `${col}_${row}`;

    // Staggered hex offset on odd rows
    const hexOff = (row % 2) * (STEP_X / 2);
    const x = (col - COLS / 2 + 0.5) * STEP_X + hexOff;
    const y = (row - ROWS / 2 + 0.5) * STEP_Y;

    const mesh  = new THREE.Mesh(brickGeo, brickMat);
    mesh.position.set(x, y, 0);
    mesh.userData.brickId = id;
    scene.add(mesh);

    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    mesh.add(edges); // edges follow brick transform automatically

    bricks[id] = { id, mesh, x, y, fallen: false, animating: false };
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

  // Tumble toward camera then hide
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

  // Slot in from behind the wall
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

socket.on('brick-fall',   (id) => { console.log('[recv] brick-fall', id); const b = bricks[id]; if (b) fallBrick(b);   });
socket.on('brick-return', (id) => { console.log('[recv] brick-return', id); const b = bricks[id]; if (b) returnBrick(b); });

// ─────────────────────────────────────────────
// INPUT — mouse & touch
// ─────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

function onInteract(clientX, clientY) {
  pointer.set(
     (clientX / window.innerWidth)  * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);

  const visible = brickMeshes.filter(m => m.visible);
  const hit     = raycaster.intersectObjects(visible, false)[0];

  console.log('[click]', { pointer: pointer.toArray(), visibleCount: visible.length, hit: !!hit });

  if (hit) {
    const id   = hit.object.userData.brickId;
    const brick = bricks[id];
    console.log('[hit]', id, { fallen: brick?.fallen, animating: brick?.animating });
    if (brick && !brick.fallen && !brick.animating) {
      socket.emit('brick-click', id);
      console.log('[emit] brick-click', id);
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

  // Pulse edge glow — gentle sine wave
  const pulse   = 0.5 + 0.5 * Math.sin(t * 1.7);
  edgeMat.opacity = 0.3 + 0.6 * pulse;
  edgeMat.color.setRGB(
    0.05 * pulse,
    2.2 + 0.6 * pulse,
    2.8
  );

  composer.render();
}());

// ─────────────────────────────────────────────
// RESIZE
// ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.resolution.set(window.innerWidth, window.innerHeight);
});
