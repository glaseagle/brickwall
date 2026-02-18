const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Track brick state: brickId -> { fallen: bool, timer: Timeout | null }
const brickState = {};
let userCount = 0;

function getSnapshot() {
  const snap = {};
  for (const [id, s] of Object.entries(brickState)) {
    snap[id] = { fallen: s.fallen };
  }
  return snap;
}

io.on('connection', (socket) => {
  userCount++;
  console.log(`[+] ${socket.id} connected  (${userCount} online)`);
  io.emit('user-count', userCount);

  // Send current wall state to the new client
  socket.emit('init-state', getSnapshot());

  socket.on('brick-click', (brickId) => {
    if (typeof brickId !== 'string') return;
    if (brickState[brickId]?.fallen) return; // already down

    // Schedule the brick to return after 5–10 s
    const delay = 5000 + Math.random() * 5000;
    const timer = setTimeout(() => {
      if (brickState[brickId]) {
        brickState[brickId].fallen = false;
        brickState[brickId].timer = null;
      }
      io.emit('brick-return', brickId);
    }, delay);

    brickState[brickId] = { fallen: true, timer };

    // Broadcast the fall to every connected client
    io.emit('brick-fall', brickId);
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
