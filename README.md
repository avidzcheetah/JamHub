# 🎸 JamHub

**Real-time video collaboration. Zero latency.**

JamHub is a WebRTC-powered video conferencing app with screen sharing, in-room chat, and a sleek glassmorphism UI. Built with vanilla JS on the frontend and Node.js + Socket.IO on the backend.

![JamHub Lobby](https://raw.githubusercontent.com/avidzcheetah/JamHub/main/client/screenshots/lobby.png)

---

## ✨ Features

- 🎥 **Peer-to-peer video & audio** — WebRTC with STUN/TURN for NAT traversal
- 🖥️ **Screen sharing** — One-click screen share with automatic track replacement
- 💬 **In-room chat** — Real-time messaging with slide-in panel
- 👤 **Display names & host system** — Automatic host assignment with transfer on leave
- 🎲 **Random room IDs** — Music-themed names like `drift-mix-752`
- 📷 **Camera preview** — Preview your camera/mic before joining
- 🔒 **HTTPS mode** — Self-signed cert for LAN camera access
- 🌐 **Deploy anywhere** — Works on Render, Railway, Fly.io, etc.

---

## 📁 Project Structure

```
JamHub/
├── client/                 # Frontend (vanilla HTML/CSS/JS)
│   ├── index.html          # 3-page UI: lobby → preview → conference
│   ├── app.js              # WebRTC, Socket.IO, particle animation
│   └── styles.css          # Dark purple glassmorphism theme
├── server/                 # Backend (Node.js)
│   ├── server.js           # Express + Socket.IO signaling server
│   ├── start-https.js      # HTTPS launcher (self-signed cert)
│   ├── package.json        # Dependencies
│   └── package-lock.json
└── .gitignore
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- **Node.js** v16+
- A modern browser (Chrome, Edge, Firefox)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/avidzcheetah/JamHub.git
cd JamHub

# 2. Install dependencies
cd server
npm install

# 3. Start the server
npm start
```

Open **http://localhost:10000** in your browser.

### HTTPS Mode (for LAN access)

Browsers block camera/mic on non-localhost HTTP. For testing on other devices on your network:

```bash
npm run start:https
```

Then open `https://<YOUR-PC-IP>:10000` and accept the self-signed certificate warning.

---

## 🌍 Free Deployment Guide

### Option 1: Render (Recommended — Easiest)

[Render](https://render.com) offers a free tier that can host JamHub with zero config.

**Steps:**

1. **Sign up** at [render.com](https://render.com) (GitHub login works)

2. **New → Web Service** → Connect your GitHub repo `avidzcheetah/JamHub`

3. **Configure the service:**

   | Setting | Value |
   |---|---|
   | **Name** | `jamhub` |
   | **Region** | Pick closest to you |
   | **Runtime** | `Node` |
   | **Root Directory** | `server` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Instance Type** | `Free` |

4. Click **Deploy Web Service**

5. Your app will be live at `https://jamhub.onrender.com` (or similar)

> ⚠️ Free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s.

---

### Option 2: Railway

[Railway](https://railway.app) offers a free trial with $5 credit/month.

1. Sign up at [railway.app](https://railway.app)
2. **New Project → Deploy from GitHub Repo** → Select `JamHub`
3. Go to **Settings:**
   - **Root Directory:** `server`
   - **Start Command:** `npm start`
4. Railway auto-detects Node.js and deploys
5. Go to **Settings → Networking → Generate Domain** for a public URL

---

### Option 3: Fly.io

[Fly.io](https://fly.io) offers a free tier with 3 shared VMs.

1. Install the CLI: `irm https://fly.io/install.ps1 | iex`
2. Sign up: `fly auth signup`
3. From the `server/` directory:

```bash
fly launch --name jamhub
```

4. When prompted, choose the free plan and closest region
5. Deploy: `fly deploy`

---

### After Deployment

Once deployed, your app is accessible at the URL provided by the platform. Share the link — anyone can join a room by entering a name and room ID. No signups needed.

**Testing multi-user:**
- Open the deployed URL on **two different devices/browsers**
- Enter the **same Room ID** on both
- You'll get a live video call with chat

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `10000` | Server port (auto-set by most platforms) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express 5 |
| Real-time | Socket.IO 4 |
| Video | WebRTC (peer-to-peer) |
| TURN/STUN | Metered.ca relay servers |
| Design | Glassmorphism, CSS animations |

---

## 📄 License

ISC
