# Brick Wall

A real-time collaborative interactive brick wall. Click any brick and it tumbles toward you in 3D, revealing warm light from behind the wall. All connected users see every interaction live.

Built with Node.js, Socket.IO, and Three.js.

![Brick Wall](https://img.shields.io/badge/three.js-r160-black) ![Socket.IO](https://img.shields.io/badge/socket.io-4.x-white) ![Node](https://img.shields.io/badge/node-18+-green)

---

## Features

- Real-time multiplayer — all users see all brick interactions
- 3D fall animation with random tumble, then bricks slot back in after 5–10 seconds
- Glowing pulsing cyan edges with bloom post-processing
- Warm light spills through holes in the wall
- Works on desktop and mobile

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or later

---

## Run locally

```bash
git clone https://github.com/glaseagle/brickwall.git
cd brickwall
npm install
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Multiplayer on your local network

Other devices on the same Wi-Fi can connect, but WSL2 requires a couple of extra steps on Windows.

### 1. Find your WSL2 IP

In WSL terminal:
```bash
ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1
```

### 2. Forward the port (run in Windows PowerShell as Administrator)

Replace `<WSL_IP>` with the IP from step 1:
```powershell
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL_IP>
```

### 3. Allow port 3000 through Windows Firewall (PowerShell as Administrator)

```powershell
New-NetFirewallRule -DisplayName "BrickWall Node 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

### 4. Find your Windows local IP

```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" }).IPAddress
```

Other devices connect to `http://<WINDOWS_IP>:3000`.

> **Note:** The WSL2 IP changes on every restart. Re-run step 2 with the new IP if it stops working after a reboot.

---

## Running natively on Windows (simpler for network access)

If Node.js is installed on Windows, skip the WSL steps entirely:

```powershell
git clone https://github.com/glaseagle/brickwall.git
cd brickwall
npm install
node server.js
```

Other devices connect to `http://<WINDOWS_IP>:3000` — no port forwarding needed.
