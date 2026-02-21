const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["jamhub-avidz.vercel.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
  },
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
