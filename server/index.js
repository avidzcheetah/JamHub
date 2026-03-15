const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

console.log(`[JamHub] Node version: ${process.version}`);
console.log(`[JamHub] METERED_API_KEY set: ${!!process.env.METERED_API_KEY}`);
console.log(`[JamHub] METERED_APP_NAME set: ${!!process.env.METERED_APP_NAME}`);

app.use(cors({
  origin: ["https://jamhub-avidz.vercel.app", "http://localhost:5173"],
}));

const fetch = require('node-fetch');

const server = http.createServer(app);

// Get dynamic ICE servers from Metered.ca
app.get('/api/ice-servers', async (req, res) => {
  try {
    const apiKey = (process.env.METERED_API_KEY || '').trim();
    const appName = (process.env.METERED_APP_NAME || '').trim();

    if (!apiKey || !appName) {
      console.warn('⚠️ [JamHub] Metered API credentials missing (METERED_API_KEY/METERED_APP_NAME). Falling back to STUN.');
      return res.json([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
      ]);
    }

    const url = `https://${appName}.metered.live/api/v1/turn/credential?secretKey=${apiKey}`;
    console.log(`📡 [JamHub] Fetching TURN credentials from Metered.ca...`);
    
    const response = await fetch(url).catch(e => {
        console.error('❌ [JamHub] Network error fetching from Metered.ca:', e.message);
        throw e;
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [JamHub] Metered.ca API returned ${response.status}: ${errorText}`);
        return res.status(response.status).json({ error: 'Metered API error', details: errorText });
    }

    const iceServers = await response.json();

    if (!Array.isArray(iceServers)) {
        console.error('❌ [JamHub] Dynamic ICE servers response is not an array:', iceServers);
        return res.status(500).json({ error: 'Invalid response from Metered API' });
    }

    console.log(`✅ [JamHub] Successfully loaded ${iceServers.length} ICE servers`);
    res.json(iceServers);
  } catch (err) {
    console.error('❌ [JamHub] Internal server error in /api/ice-servers:', err.message);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

const io = new Server(server, {
  cors: {
    origin: ["https://jamhub-avidz.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Ensure websocket is tried first, consistent with client
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

// In-memory room state
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // ── Join a room ──────────────────────────────────────────
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    const room = rooms.get(roomId);
    room.set(socket.id, { userName, socketId: socket.id });

    // Tell the new user about everyone already in the room
    const existingUsers = [];
    room.forEach((user, id) => {
      if (id !== socket.id) existingUsers.push(user);
    });
    socket.emit("existing-users", existingUsers);

    // Tell everyone else about the new user
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      userName,
    });

    socket.roomId = roomId;
    socket.userName = userName;

    console.log(`👤 ${userName} joined room ${roomId}`);
  });

  // ── WebRTC Signaling ────────────────────────────────────
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer, userName: socket.userName });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  // ── Media state (muted / camera off) ────────────────────
  socket.on("media-state", ({ roomId, isMuted, isCameraOff }) => {
    socket.to(roomId).emit("media-state", {
      from: socket.id,
      isMuted,
      isCameraOff,
    });
  });

  // ── Chat ────────────────────────────────────────────────
  socket.on("chat-message", ({ roomId, message, userName }) => {
    io.to(roomId).emit("chat-message", {
      message,
      userName,
      senderId: socket.id,
      timestamp: Date.now(),
    });
  });

  // ── Disconnect ──────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.delete(socket.id);
      if (room.size === 0) {
        rooms.delete(socket.roomId);
      }
      socket.to(socket.roomId).emit("user-left", { socketId: socket.id });
    }
  });
});

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "JamHub signaling server is running 🎵" });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎵 JamHub signaling server listening on port ${PORT}`);
});
