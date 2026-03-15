# 🎸 JamHub

**Real-time video collaboration. Zero latency.**

🚀 **Status:** Live & Deployed on [Render](https://render.com)
  
JamHub is a state-of-the-art, WebRTC-powered video conferencing application. It features real-time peer-to-peer audio and video streaming, dynamic screen sharing, robust in-room text chat, and a premium "Glassmorphism" UI design. Built purely with Vanilla Web Technologies on the frontend and Node.js with Socket.IO on the backend, JamHub requires zero third-party UI frameworks while delivering a highly polished, responsive experience for desktop and mobile.

![JamHub Lobby](https://raw.githubusercontent.com/avidzcheetah/JamHub/main/client/screenshots/lobby.png)

---

## ✨ Comprehensive Feature Set

### 1. Peer-to-Peer Video & Audio (WebRTC)
Utilizes the WebRTC API to establish direct connections between users. This ensures ultra-low latency media streaming and reduces server bandwidth load. Connection reliability across restrictive firewalls and NATs is maintained via integrated STUN and TURN servers (provided by Metered.ca).

### 2. Dynamic Video Layout Engine
The application intelligently scales how users are displayed on screen. As participants join and leave the room, the CSS Grid engine automatically recalculates available viewport space, assigning equal-sized responsive video boxes to all participants without vertical scrolling.

### 3. Screen Sharing
Supports seamless 1-click screen sharing. The application leverages `navigator.mediaDevices.getDisplayMedia()` to capture your screen, instantly replacing your active camera `MediaStreamTrack` across all remote peer connections without dropping the call. 

### 4. Interactive In-Room Chat
Features a slide-in glassmorphism chat panel. Participants can text in real-time, backed by Socket.IO events. The UI proactively alerts users of unread messages via a visual badge indicator on the floating control bar when the chat is closed.

### 5. Premium "Glassmorphism" UI/UX
The application abandons traditional flat design for a deeply immersive, dark-purple aesthetic:
- Blurred transparency (`backdrop-filter`) over animated backgrounds.
- Floating circular control overlays with SVG glow effects.
- Unified 3-page flow: Lobby → Preview (Mic/Cam check) → Conference.

### 6. Animated Interactive Particle Background
The Lobby and Preview pages feature a custom HTML5 `<canvas>` simulation. It renders a floating constellation of purple particles that respond to user mouse movements by applying repulsive physics.

### 7. Core Meeting Mechanics
- **Name Persistence:** Users enter their custom "Display Name" in the lobby, which accurately renders as name tags over their video streams. 
- **Randomize Rooms:** ⚡ Auto-generator for music-themed room IDs (e.g., `drift-mix-752`).
- **Host Delegation:** The first person to join a room is marked as Host. Upon their departure, host permissions are automatically delegated to the next oldest peer.

---

## 🛠️ Technology Stack & Architecture

### Frontend (Client Tier)
- **HTML5 & Vanilla CSS3**: Uses CSS Variables (`var()`), Flexbox, and complex CSS Grid behaviors to handle dynamic viewport scaling.
- **Vanilla JavaScript (ES6+)**: Handles all presentation logic, canvas animations, and WebRTC lifecycle events without UI wrappers like React or Vue.
- **MediaDevices API**: Accesses local hardware (Cameras, Microphones, Display Surfaces).
- **RTCPeerConnection API**: The browser-native engine that encapsulates SDP (Session Description Protocol) negotiation and ICE (Interactive Connectivity Establishment) candidate exchange.
- **Socket.IO Client**: Establishes the WebSocket connection used uniquely as the signaling bridge.

### Backend (Signaling Tier)
- **Node.js**: The asynchronous runtime powering the signaling server.
- **Express.js**: Serves the static client assets (`index.html`, `styles.css`, `app.js`).
- **Socket.IO**: A real-time, bi-directional event engine. It orchestrates "Rooms", acts as the intermediary to forward SDP offers/answers between specific clients, and relays real-time chat messages. Note: *Media streams do NOT pass through this server.*
- **Self-signed TLS**: A built-in HTTPS development server using the `selfsigned` library, allowing LAN devices to test hardware constraints which normally block microphone/camera access on unencrypted connections.

### Infrastructure & Deployment
- **STUN & TURN Network**: Powered by `Metered.ca` to guarantee calls connect globally, regardless of symmetric NATs or restrictive corporate firewalls.
- **Hosting Platform**: Successfully deployed on **Render** utilizing their Node.js Native Runtime environment. Render's built-in SSL termination fulfills the browser's requirement for Secure Contexts (HTTPS), allowing the `getUserMedia` API to function securely over the internet.

---

## 📁 System Architecture & Data Flow

1. **Lobby Entry:** The user chooses a display name and room ID. 
2. **Preview Phase:** The browser requests hardware access (`getUserMedia`). The local video stream is painted to a preview `<video>` tag for validation.
3. **Signaling (Socket.IO):** Upon hitting "Join Session", the client emits a `join-room` event to the Node.js server. 
4. **SDP Exchange:** The Node.js server informs existing room participants. The `RTCPeerConnection` creates an *Offer*, sending it via Socket.IO to the new user. The new user processes this Offer and returns an *Answer*.
5. **ICE Traversal:** Simultaneously, browsers gather network routes (ICE Candidates) from STUN/TURN servers. These candidates are traded over Socket.IO.
6. **P2P Establishment:** Once negotiation concludes, the browsers establish direct UDP/TCP tunnels. The local `MediaStream` is injected into the remote peer's `<video>` elements on the DOM, completely bypassing the backend.

---

## 🛡️ License

MIT License - Copyright (c) 2026 JamHub Contributors. 
