const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/video/giant', (req, res) => {
  res.sendFile(path.resolve('C:/Users/mcull/Downloads/Giant.mov'));
});

// Grid dimensions must match client
const COLS     = 20;
const ROWS_MAX = 30;

// brickId -> { fallen: bool, timer: Timeout | null }
const brickState = {};
let userCount    = 0;
let groupCounter = 0;

function getSnapshot() {
  const snap = {};
  for (const [id, s] of Object.entries(brickState)) {
    snap[id] = { fallen: s.fallen };
  }
  return snap;
}

// Returns the 6 surrounding brick IDs for a staggered-row brick wall.
// Odd rows are offset right by half a brick step.
function getNeighborIds(col, row) {
  const candidates = [
    [col - 1, row],
    [col + 1, row],
  ];
  if (row % 2 === 0) {
    candidates.push([col - 1, row + 1], [col, row + 1]);
    candidates.push([col - 1, row - 1], [col, row - 1]);
  } else {
    candidates.push([col, row + 1], [col + 1, row + 1]);
    candidates.push([col, row - 1], [col + 1, row - 1]);
  }
  return candidates
    .filter(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS_MAX)
    .map(([c, r]) => `${c}_${r}`);
}

io.on('connection', (socket) => {
  userCount++;
  console.log(`[+] ${socket.id} connected  (${userCount} online)`);
  io.emit('user-count', userCount);

  socket.emit('init-state', getSnapshot());

  socket.on('brick-click', ({ brickId, material } = {}) => {
    if (typeof brickId !== 'string') return;
    if (brickState[brickId]?.fallen) return;

    const [col, row] = brickId.split('_').map(Number);

    // Collect available (non-fallen) neighbours
    const available = getNeighborIds(col, row).filter(id => !brickState[id]?.fallen);

    // Pick 3–6 of them at random
    const shuffled   = available.sort(() => Math.random() - 0.5);
    const takeCount  = Math.min(available.length, 3 + Math.floor(Math.random() * 4));
    const groupIds   = [brickId, ...shuffled.slice(0, takeCount)];
    const groupId    = `g${++groupCounter}`;
    const returnMat  = typeof material === 'string' ? material : 'brick';

    const delay = 5000 + Math.random() * 5000;
    const timer = setTimeout(() => {
      groupIds.forEach(id => {
        if (brickState[id]) { brickState[id].fallen = false; brickState[id].timer = null; }
      });
      io.emit('group-return', { brickIds: groupIds, material: returnMat });
    }, delay);

    groupIds.forEach(id => { brickState[id] = { fallen: true, timer }; });

    io.emit('group-fall', { groupId, brickIds: groupIds });
  });

  socket.on('disconnect', () => {
    userCount = Math.max(0, userCount - 1);
    console.log(`[-] ${socket.id} disconnected (${userCount} online)`);
    io.emit('user-count', userCount);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nBrick Wall running → http://localhost:${PORT}`);
  console.log('Other devices on your network can connect via your local IP.\n');
});
