// ─────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────
const socket = io();

// ─────────────────────────────────────────────
// CANVAS
// ─────────────────────────────────────────────
const canvas = document.getElementById('wall');
const ctx    = canvas.getContext('2d');

// ─────────────────────────────────────────────
// GRID CONSTANTS  (must match server + desktop exactly)
// ─────────────────────────────────────────────
const COLS = 10;

// Derive ROWS using the same 3D frustum math the desktop uses:
// FOV=55°, camera z=7, STEP_Y_3d = BH+GY = 0.28+0.038 = 0.318
const _visH_3d = 2 * Math.tan(55 / 2 * Math.PI / 180) * 7;
const ROWS     = Math.ceil(_visH_3d / 0.318) + 1;  // matches desktop (~24)

// ─────────────────────────────────────────────
// LAYOUT  — recalculated on resize
// ─────────────────────────────────────────────
let bricks = {};
let BRICK_W, BRICK_H, STEP_X, STEP_Y;

function layout() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // Each column gets an equal share of the width; no gap between bricks —
  // the 1px stroke acts as the visual separator.
  STEP_X  = canvas.width / COLS;
  BRICK_W = STEP_X;
  BRICK_H = BRICK_W * (28 / 82);   // match desktop aspect ratio
  STEP_Y  = BRICK_H;

  // Rebuild grid, preserving any fallen state from before resize
  const prev = {};
  for (const [id, b] of Object.entries(bricks)) prev[id] = b.fallen;

  bricks = {};
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const id     = `${col}_${row}`;
      const offset = (row % 2) * (STEP_X / 2);   // stagger odd rows
      bricks[id] = {
        id,
        x:      col * STEP_X + offset,
        y:      (ROWS - 1 - row) * STEP_Y,       // invert: row 0 = bottom, matches 3D desktop
        fallen: prev[id] ?? false,
      };
    }
  }
}

// ─────────────────────────────────────────────
// PERIMETER LOCK STATE
// ─────────────────────────────────────────────
const lockedBricks = new Set();

// ─────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const { id, x, y, fallen } of Object.values(bricks)) {
    if (fallen) {
      // Fallen: solid black — brick is gone
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, BRICK_W, BRICK_H);
    } else if (lockedBricks.has(id)) {
      // Perimeter of a hole: red, cannot be clicked
      ctx.fillStyle = 'rgba(200, 30, 30, 0.45)';
      ctx.fillRect(x, y, BRICK_W, BRICK_H);
      ctx.strokeStyle = 'rgba(220, 50, 50, 0.8)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, BRICK_W - 1, BRICK_H - 1);
    } else {
      // Not fallen: outline only — flat, selectable
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, BRICK_W - 1, BRICK_H - 1);
    }
  }
}

layout();
draw();

window.addEventListener('resize', () => { layout(); draw(); });

// ─────────────────────────────────────────────
// SOCKET EVENTS
// ─────────────────────────────────────────────
socket.on('user-count', (n) => {
  document.getElementById('user-count').textContent = `● ${n} online`;
});

socket.on('init-state', (state) => {
  for (const [id, data] of Object.entries(state)) {
    if (bricks[id]) bricks[id].fallen = data.fallen;
  }
  draw();
});

socket.on('group-fall', ({ brickIds }) => {
  brickIds.forEach(id => { if (bricks[id]) bricks[id].fallen = true; });
  draw();
});

socket.on('group-return', ({ brickIds }) => {
  brickIds.forEach(id => { if (bricks[id]) bricks[id].fallen = false; });
  draw();
});

socket.on('perimeter-update', ({ lockedBrickIds }) => {
  lockedBricks.clear();
  lockedBrickIds.forEach(id => lockedBricks.add(id));
  draw();
});

// ─────────────────────────────────────────────
// INPUT
// ─────────────────────────────────────────────
function onInteract(clientX, clientY) {
  for (const brick of Object.values(bricks)) {
    if (brick.fallen) continue;
    if (lockedBricks.has(brick.id)) continue;
    if (
      clientX >= brick.x && clientX <= brick.x + BRICK_W &&
      clientY >= brick.y && clientY <= brick.y + BRICK_H
    ) {
      socket.emit('brick-click', { brickId: brick.id });
      return;
    }
  }
}

canvas.addEventListener('click', e => onInteract(e.clientX, e.clientY));

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  onInteract(t.clientX, t.clientY);
}, { passive: false });
