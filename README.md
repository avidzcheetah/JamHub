# JamHub — Real-Time Remote Music Jam Platform

> A peer-to-peer video conferencing app built with **WebRTC** for real-time music collaboration.

![Version](https://img.shields.io/badge/version-1.0.0-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎥 **Video & Audio** | Real-time P2P video and audio streaming via WebRTC |
| 💬 **Text Chat** | Inline chat panel alongside video for text communication |
| 🎤 **Mute / Unmute** | Toggle microphone on/off during a session |
| 📷 **Camera Toggle** | Turn camera on/off with an avatar placeholder fallback |
| 🏠 **Room System** | Create or join rooms by entering a room ID |
| 📋 **Copy Room ID** | Click the room badge in the header to copy the ID |
| 🌙 **Dark Theme** | Premium dark UI with gradient accents and glassmorphism |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                      Browser A                         │
│  React UI  ◄──►  useWebRTC Hook  ◄──►  RTCPeerConn    │
└──────────────────────┬─────────────────────┬───────────┘
                       │  Socket.io          │  P2P Media
                       ▼                     │
            ┌─────────────────────┐          │
            │  Signaling Server   │          │
            │  (Node + Socket.io) │          │
            └─────────────────────┘          │
                       ▲                     │
                       │  Socket.io          │
┌──────────────────────┴─────────────────────▼───────────┐
│                      Browser B                         │
│  React UI  ◄──►  useWebRTC Hook  ◄──►  RTCPeerConn    │
└────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, Vanilla CSS |
| Backend | Node.js, Express, Socket.io |
| Real-Time | WebRTC (RTCPeerConnection), Socket.io |
| Icons | Lucide React |
| Fonts | Inter (Google Fonts) |

### Key Components

- **`server/index.js`** — Signaling server handling room joins, offer/answer/ICE candidate exchange, and chat relay.
- **`client/src/hooks/useWebRTC.js`** — Custom React hook encapsulating all WebRTC logic (media capture, peer connections, signaling, chat).
- **`client/src/components/Lobby.jsx`** — Landing page with name and room ID inputs.
- **`client/src/components/VideoGrid.jsx`** — Responsive grid rendering local + remote video tiles.
- **`client/src/components/Controls.jsx`** — Toolbar with mute, camera, leave, and chat buttons.
- **`client/src/components/Chat.jsx`** — Side panel for sending and receiving text messages.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm** 9+

### 1. Clone the Repository

```bash
git clone <repo-url>
cd WebRTC
```

### 2. Start the Signaling Server

```bash
cd server
npm install
npm start
```

The server runs on `http://localhost:3001` by default.

### 3. Start the Client

```bash
cd client
npm install
npm run dev
```

The client runs on `http://localhost:5173`.

### 4. Test It

1. Open **two browser tabs** at `http://localhost:5173`.
2. Enter any name and the **same Room ID** in both tabs.
3. You should see each other's video feeds.
4. Click the 💬 button to open the chat panel and exchange messages.

---

## 🌐 Deployment

### Frontend (Vercel / GitHub Pages)

1. Set the `VITE_SIGNALING_URL` environment variable to your deployed server URL.
2. Build: `npm run build`
3. Deploy the `client/dist` folder.

### Backend (Render / Heroku / Railway)

1. Deploy the `server/` directory as a Node.js app.
2. Ensure WebSocket connections are permitted by the hosting platform.
3. Set `PORT` environment variable if needed.

---

## 🧩 Challenges & Solutions

| Challenge | Solution |
| --- | --- |
| **NAT Traversal** | Used Google's public STUN servers for ICE candidate discovery |
| **Mesh scalability** | Mesh topology works well for 2-6 users (music jams); for larger groups, an SFU (e.g. mediasoup) would be needed |
| **Signaling coordination** | Existing users send offers to newly joined peers, avoiding race conditions |
| **Browser permissions** | Graceful fallback to audio-only if camera access is denied |
| **Low-latency audio** | WebRTC's peer-to-peer model minimizes latency compared to server-relayed solutions |

---

## 📂 Project Structure

```
WebRTC/
├── server/
│   ├── package.json
│   └── index.js              # Signaling server
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css          # Design system
│       ├── socket.js          # Socket.io client singleton
│       ├── hooks/
│       │   └── useWebRTC.js   # WebRTC logic
│       └── components/
│           ├── Lobby.jsx
│           ├── VideoGrid.jsx
│           ├── Controls.jsx
│           └── Chat.jsx
└── README.md                  # This file
```

---

## 📜 License

MIT License — feel free to use, modify, and distribute.
