# Project Report: JamHub — Real-Time Remote Music Jam Platform

---

## 1. Introduction

**JamHub** is a web-based real-time video conferencing application built using WebRTC technology. It is designed to enable music enthusiasts in different locations to collaborate through live video, audio, and text chat — creating a virtual "jam session" experience.

The application leverages peer-to-peer (P2P) communication to minimize latency, which is critical for musical collaboration where timing is everything.

---

## 2. Problem Statement

Musicians who want to jam together but are geographically distributed face a key challenge: latency. Traditional server-relayed video conferencing (Zoom, Google Meet) introduces processing delays that make real-time musical collaboration difficult.

**Goal**: Build a P2P communication platform using WebRTC that reduces audio/video latency by establishing direct connections between browsers, only using a server for initial signaling.

---

## 3. Architecture

### 3.1 High-Level Overview

The application follows a **Mesh** architecture where each participant maintains a direct P2P connection with every other participant:

```
     Peer A ──── Peer B
       \          /
        \        /
         Peer C
```

A lightweight **signaling server** (Node.js + Socket.io) is used only for initial connection negotiation (exchanging SDP offers/answers and ICE candidates). Once the P2P connection is established, all media flows directly between browsers.

### 3.2 Signaling Flow

1. **User A** joins a room via the signaling server
2. **User B** joins the same room
3. The server notifies **User B** about existing users (User A)
4. **User B** creates an RTCPeerConnection, generates an SDP offer, and sends it to **User A** via the server
5. **User A** receives the offer, creates an answer, and sends it back
6. Both peers exchange ICE candidates for NAT traversal
7. A direct P2P media stream is established

### 3.3 Chat Architecture

Text chat messages are relayed through the Socket.io signaling server. This is simpler than WebRTC Data Channels for this use case and ensures messages are delivered even if a P2P connection briefly interrupts.

---

## 4. Technology Stack

| Component | Technology | Justification |
| --- | --- | --- |
| Frontend Framework | React 18 | Component-based architecture, efficient re-rendering |
| Build Tool | Vite 5 | Fast HMR, zero-config React support |
| Styling | Vanilla CSS | Full design control, no utility-class bloat |
| Real-Time Communication | WebRTC | Native browser P2P support, low latency |
| Signaling | Socket.io | Reliable WebSocket transport with fallbacks |
| Backend Runtime | Node.js | Event-driven, lightweight, ideal for I/O-intensive signaling |
| Icons | Lucide React | Lightweight, tree-shakeable icon library |
| Typography | Inter (Google Fonts) | Modern, readable, widely supported |

---

## 5. Implementation Details

### 5.1 Signaling Server (`server/index.js`)

- **Room Management**: In-memory Map tracking users per room
- **Events Handled**:
  - `join-room` — Registers user in a room, notifies others
  - `offer` / `answer` / `ice-candidate` — WebRTC signaling relay
  - `chat-message` — Broadcasts chat text to room
  - `disconnect` — Cleanup and notification

### 5.2 WebRTC Hook (`useWebRTC.js`)

A custom React hook that encapsulates:
- **Media capture**: `getUserMedia` with camera + mic (fallback to audio-only)
- **Peer connection management**: Creates RTCPeerConnections for each remote peer
- **Signaling integration**: Listens for Socket.io events and orchestrates offer/answer exchange
- **Audio/Video toggles**: Enables/disables tracks without recreating streams
- **Chat**: Dispatches and receives messages via the signaling server

### 5.3 UI Components

| Component | Responsibility |
| --- | --- |
| `Lobby.jsx` | Landing page with name/room inputs |
| `VideoGrid.jsx` | Responsive grid of local + remote video tiles |
| `Controls.jsx` | Mute, camera toggle, leave, chat toggle buttons |
| `Chat.jsx` | Side panel with message history and input |

### 5.4 STUN Servers

The application uses Google's free public STUN servers for ICE candidate discovery:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

These help peers discover their public IP addresses for NAT traversal.

---

## 6. Features Implemented

1. **Peer-to-Peer Video & Audio** — Direct WebRTC media streams between participants
2. **Text Chat** — Real-time messaging alongside video
3. **Mute / Unmute** — Toggle microphone during a call
4. **Camera Toggle** — Turn camera on/off with an avatar placeholder
5. **Room System** — Join sessions by entering a shared room ID
6. **Responsive Design** — Works on desktop and mobile browsers
7. **Copy Room ID** — Click the room badge to copy it to clipboard

---

## 7. Challenges & Solutions

### 7.1 NAT Traversal
**Challenge**: Most users are behind NATs/firewalls, making direct P2P connections impossible without help.
**Solution**: Used STUN servers for ICE candidate discovery to determine public IP/port mappings.

### 7.2 Signaling Race Conditions
**Challenge**: When two peers join simultaneously, both might try to create offers, causing duplicate connections.
**Solution**: Implemented a deterministic flow: existing users are notified, and only the new peer initiates offers to existing peers.

### 7.3 Mesh Scalability
**Challenge**: A full mesh topology requires N*(N-1)/2 connections, which degrades performance beyond 4-6 users.
**Solution**: For the music jam use case (typically 2-4 musicians), mesh is adequate. For larger groups, an SFU (Selective Forwarding Unit) like mediasoup would be recommended.

### 7.4 Browser Permission Handling
**Challenge**: Users may deny camera/microphone access.
**Solution**: Implemented graceful fallback — if camera is denied, the app attempts audio-only mode.

### 7.5 Audio Latency
**Challenge**: Musicians need very low latency (<50ms) for synchronous playing.
**Solution**: WebRTC's P2P architecture eliminates server relay hops, reducing latency to network RTT. For additional optimization, one could disable audio processing (echo cancellation, noise suppression) in `getUserMedia` constraints.

---

## 8. Deployment Guide

### Frontend
Deploy to **Vercel** or **GitHub Pages**:
1. Set `VITE_SIGNALING_URL` to the deployed server URL
2. Run `npm run build` and deploy the `dist/` folder

### Backend
Deploy to **Render**, **Railway**, or **Heroku**:
1. Deploy the `server/` directory
2. Ensure WebSocket support is enabled

---

## 9. Future Enhancements

- **Screen Sharing** — Share instruments/DAW screen via `getDisplayMedia`
- **TURN Server** — For users behind symmetric NATs where STUN fails
- **Recording** — Record jam sessions using MediaRecorder API
- **Low-Latency Mode** — Disable WebRTC audio processing for raw instrument audio
- **Virtual Instruments** — Integrate Web Audio API synthesizers

---

## 10. Conclusion

JamHub successfully demonstrates the power of WebRTC for building low-latency, peer-to-peer communication applications. The mesh architecture provides a simple, effective solution for small-group collaboration like music jams. The modern React frontend with dark theme styling delivers a premium user experience, while the lightweight Socket.io signaling server ensures reliable connection establishment.
