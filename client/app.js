// ==================== JamHub — Client Logic ====================

// ——— Server URL ———
function getServerUrl() {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("server");
    if (override) return override.replace(/\/$/, "");
    if (window.location.origin && (window.location.origin.startsWith("http://") || window.location.origin.startsWith("https://")))
        return window.location.origin;
    return "http://localhost:10000";
}
const SERVER_URL = getServerUrl();
const socket = typeof io !== "undefined"
    ? io(SERVER_URL, { reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 2000, transports: ["polling", "websocket"] })
    : null;
if (!socket) {
    console.error("Socket.io not loaded. Open this page from the server URL (e.g. http://localhost:10000), not as a file.");
}

// ==================== PARTICLE CANVAS ====================
(function initParticles() {
    const canvas = document.getElementById("particleCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, particles = [], mouse = { x: -9999, y: -9999 };
    const PARTICLE_COUNT = 80;
    const CONNECTION_DIST = 150;
    const MOUSE_DIST = 200;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    document.addEventListener("mousemove", (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    class Particle {
        constructor() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.r = Math.random() * 2 + 1;
            this.alpha = Math.random() * 0.5 + 0.3;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > w) this.vx *= -1;
            if (this.y < 0 || this.y > h) this.vy *= -1;

            // Mouse interaction — gentle push
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_DIST && dist > 0) {
                const force = (MOUSE_DIST - dist) / MOUSE_DIST * 0.02;
                this.vx += (dx / dist) * force;
                this.vy += (dy / dist) * force;
            }

            // Speed limit
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > 1.2) {
                this.vx *= 0.98;
                this.vy *= 0.98;
            }
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168, 85, 247, ${this.alpha})`;
            ctx.fill();
        }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONNECTION_DIST) {
                    const alpha = (1 - dist / CONNECTION_DIST) * 0.2;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, w, h);
        particles.forEach(p => { p.update(); p.draw(); });
        drawConnections();
        requestAnimationFrame(animate);
    }
    animate();
})();

// ==================== DOM ELEMENTS ====================
// Pages
const lobbyPage = document.getElementById("lobbyPage");
const previewPage = document.getElementById("previewPage");
const conferencePage = document.getElementById("conferencePage");

// Lobby
const lobbyForm = document.getElementById("lobbyForm");
const nameInput = document.getElementById("nameInput");
const roomInput = document.getElementById("roomInput");
const randomRoomBtn = document.getElementById("randomRoomBtn");

// Preview
const previewVideo = document.getElementById("previewVideo");
const previewCameraOff = document.getElementById("previewCameraOff");
const previewRoomDisplay = document.getElementById("previewRoomDisplay");
const previewNameDisplay = document.getElementById("previewNameDisplay");
const previewMicBtn = document.getElementById("previewMicBtn");
const previewCamBtn = document.getElementById("previewCamBtn");
const previewMicLabel = document.getElementById("previewMicLabel");
const previewCamLabel = document.getElementById("previewCamLabel");
const backBtn = document.getElementById("backBtn");
const joinSessionBtn = document.getElementById("joinSessionBtn");

// Conference
const localVideo = document.getElementById("localVideo");
const cameraOffOverlay = document.getElementById("cameraOffOverlay");
const localDisplayNameEl = document.getElementById("localDisplayName");
const remoteVideosContainer = document.getElementById("remoteVideosContainer");
const participantCountEl = document.getElementById("participantCount");
const roomTagEl = document.getElementById("roomTag");
const muteBtn = document.getElementById("muteBtn");
const cameraBtn = document.getElementById("cameraBtn");
const endCallBtn = document.getElementById("endCallBtn");
const shareScreenBtn = document.getElementById("shareScreenBtn");
const chatToggleBtn = document.getElementById("chatToggleBtn");
const chatPanel = document.getElementById("chatPanel");
const chatCloseBtn = document.getElementById("chatCloseBtn");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatUnread = document.getElementById("chatUnread");

// ==================== STATE ====================
let localStream = null;
let screenStream = null;
let currentRoomId = null;
let myDisplayName = "Participant";
let amHost = false;
let isMicOn = true;
let isCamOn = true;
let isChatOpen = false;
let unreadCount = 0;

/** peerId -> displayName */
const peerNames = new Map();
/** peerId -> { pc, pendingCandidates, videoEl, statusEl, box } */
const peerMap = new Map();

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.relay.metered.ca:80" },
        {
            urls: "turn:global.relay.metered.ca:80",
            username: "0b68424087eca4949004b6aa",
            credential: "ox/368UgycEW2z9u",
        },
        {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "0b68424087eca4949004b6aa",
            credential: "ox/368UgycEW2z9u",
        },
        {
            urls: "turn:global.relay.metered.ca:443",
            username: "0b68424087eca4949004b6aa",
            credential: "ox/368UgycEW2z9u",
        },
        {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "0b68424087eca4949004b6aa",
            credential: "ox/368UgycEW2z9u",
        },
    ],
    iceTransportPolicy: "all",
};

// ==================== NAVIGATION ====================
function showPage(page) {
    [lobbyPage, previewPage, conferencePage].forEach(p => p.style.display = "none");
    page.style.display = page === conferencePage ? "flex" : "flex";
    // Show/hide particles
    const canvas = document.getElementById("particleCanvas");
    if (canvas) canvas.style.display = (page === conferencePage) ? "none" : "block";
}

function showLobby() { showPage(lobbyPage); }
function showPreview() { showPage(previewPage); }
function showConference() { showPage(conferencePage); }

// ==================== RANDOM ROOM ID ====================
const ADJECTIVES = ["bass", "neon", "echo", "funk", "chill", "drift", "nova", "pulse", "vibe", "glow", "cool", "deep", "wave", "hyper", "sonic"];
const NOUNS = ["rock", "jazz", "beat", "riff", "loop", "drop", "mix", "tune", "flow", "jam", "bass", "drum", "note", "tone", "groove"];

function generateRoomId() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${adj}-${noun}-${num}`;
}

if (randomRoomBtn) {
    randomRoomBtn.addEventListener("click", () => {
        roomInput.value = generateRoomId();
        // Flash animation
        randomRoomBtn.style.transform = "scale(1.3) rotate(20deg)";
        setTimeout(() => { randomRoomBtn.style.transform = ""; }, 200);
    });
}

// ==================== MEDIA ====================
function getSendStream() {
    return screenStream || localStream;
}

async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        return true;
    } catch (err) {
        console.error("getUserMedia error:", err);
        const name = err.name || "";
        let msg;
        if (name === "NotReadableError") {
            msg = "Camera/microphone is in use.\n\nClose other tabs or apps using the camera, then try again.";
        } else if (window.location.protocol === "http:" && !window.location.hostname.match(/^localhost|127\./)) {
            msg = "Camera blocked. Browsers require HTTPS for camera/mic on non-localhost.\n\nRun: npm run start:https";
        } else {
            msg = "Could not access camera/microphone. Check permissions in your browser settings.";
        }
        alert(msg);
        return false;
    }
}

// ==================== LOBBY → PREVIEW ====================
lobbyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const roomId = roomInput.value.trim();
    if (!name || !roomId) {
        alert("Please enter both your name and a room ID.");
        return;
    }

    myDisplayName = name.slice(0, 32);

    // Start camera for preview
    const ok = await getLocalStream();
    if (!ok) return;

    // Populate preview
    previewVideo.srcObject = localStream;
    previewRoomDisplay.innerHTML = `Room: <strong>#${escapeHtml(roomId)}</strong>`;
    previewNameDisplay.textContent = myDisplayName;

    // Reset toggle states
    isMicOn = true;
    isCamOn = true;
    updatePreviewToggles();

    showPreview();
});

// ==================== PREVIEW PAGE CONTROLS ====================
function updatePreviewToggles() {
    if (previewMicBtn) {
        previewMicBtn.classList.toggle("active", isMicOn);
        previewMicLabel.textContent = isMicOn ? "MIC ON" : "MIC OFF";
    }
    if (previewCamBtn) {
        previewCamBtn.classList.toggle("active", isCamOn);
        previewCamLabel.textContent = isCamOn ? "CAMERA ON" : "CAMERA OFF";
    }
    // Show/hide camera off overlay in preview
    if (previewCameraOff) previewCameraOff.style.display = isCamOn ? "none" : "flex";
}

if (previewMicBtn) {
    previewMicBtn.addEventListener("click", () => {
        if (!localStream) return;
        const audio = localStream.getAudioTracks()[0];
        if (!audio) return;
        isMicOn = !isMicOn;
        audio.enabled = isMicOn;
        updatePreviewToggles();
    });
}

if (previewCamBtn) {
    previewCamBtn.addEventListener("click", () => {
        if (!localStream) return;
        const video = localStream.getVideoTracks()[0];
        if (!video) return;
        isCamOn = !isCamOn;
        video.enabled = isCamOn;
        updatePreviewToggles();
    });
}

// Back button
if (backBtn) {
    backBtn.addEventListener("click", () => {
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
        previewVideo.srcObject = null;
        showLobby();
    });
}

// ==================== PREVIEW → CONFERENCE (Join) ====================
if (joinSessionBtn) {
    joinSessionBtn.addEventListener("click", () => {
        if (!socket || !localStream) return;

        const roomId = roomInput.value.trim();
        currentRoomId = roomId;

        // Set video source for conference
        localVideo.srcObject = localStream;
        localDisplayNameEl.textContent = `You (${myDisplayName})`;
        roomTagEl.textContent = `#${roomId}`;

        // Update camera off overlay
        updateCameraOverlay();

        // Join room via socket
        socket.emit("join-room", { roomId, displayName: myDisplayName });

        // Switch page
        showConference();

        // Update controls state
        updateMuteButton();
        updateCameraButton();
        updateShareScreenButton();
        updateParticipantCount();
    });
}

// ==================== CONFERENCE CONTROLS ====================
function updateMuteButton() {
    if (!muteBtn || !localStream) return;
    const audio = localStream.getAudioTracks()[0];
    isMicOn = audio && audio.enabled;
    const iconOn = muteBtn.querySelector(".icon-mic-on");
    const iconOff = muteBtn.querySelector(".icon-mic-off");
    if (iconOn) iconOn.style.display = isMicOn ? "block" : "none";
    if (iconOff) iconOff.style.display = isMicOn ? "none" : "block";
    muteBtn.classList.toggle("muted", !isMicOn);
}

function updateCameraButton() {
    if (!cameraBtn || !localStream) return;
    const video = localStream.getVideoTracks()[0];
    isCamOn = video && video.enabled;
    const iconOn = cameraBtn.querySelector(".icon-camera-on");
    const iconOff = cameraBtn.querySelector(".icon-camera-off");
    if (iconOn) iconOn.style.display = isCamOn ? "block" : "none";
    if (iconOff) iconOff.style.display = isCamOn ? "none" : "block";
    cameraBtn.classList.toggle("off", !isCamOn);
    updateCameraOverlay();
}

function updateCameraOverlay() {
    if (cameraOffOverlay) {
        const video = localStream && localStream.getVideoTracks()[0];
        const on = video && video.enabled;
        cameraOffOverlay.style.display = on ? "none" : "flex";
    }
}

function toggleMute() {
    if (!localStream) return;
    const audio = localStream.getAudioTracks()[0];
    if (!audio) return;
    audio.enabled = !audio.enabled;
    updateMuteButton();
}

function toggleCamera() {
    if (screenStream) return;
    if (!localStream) return;
    const video = localStream.getVideoTracks()[0];
    if (!video) return;
    video.enabled = !video.enabled;
    updateCameraButton();
}

function updateShareScreenButton() {
    if (!shareScreenBtn) return;
    shareScreenBtn.classList.toggle("active", !!screenStream);
}

function replaceVideoTrackOnAllPeers(newTrack) {
    peerMap.forEach((entry) => {
        const sender = entry.pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(newTrack);
    });
}

async function startScreenShare() {
    if (screenStream) return;
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenVideo = screenStream.getVideoTracks()[0];
        if (screenVideo) {
            localVideo.srcObject = screenStream;
            replaceVideoTrackOnAllPeers(screenVideo);
            screenVideo.onended = stopScreenShare;
        }
        updateShareScreenButton();
    } catch (err) {
        console.error("getDisplayMedia error:", err);
    }
}

function stopScreenShare() {
    if (!screenStream) return;
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
    if (localStream) {
        localVideo.srcObject = localStream;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) replaceVideoTrackOnAllPeers(videoTrack);
    }
    updateShareScreenButton();
}

function updateParticipantCount() {
    const count = peerMap.size + 1;
    if (participantCountEl) {
        participantCountEl.textContent = `${count} participant${count !== 1 ? "s" : ""}`;
    }
    if (remoteVideosContainer) {
        remoteVideosContainer.setAttribute("data-count", count.toString());
    }
}

// ==================== LEAVE ====================
function leaveRoom() {
    stopScreenShare();
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    localVideo.srcObject = null;
    peerMap.forEach((entry, id) => removePeer(id));
    peerNames.clear();
    if (socket && currentRoomId) {
        socket.emit("leave-room", currentRoomId);
        currentRoomId = null;
    }
    // Close chat
    isChatOpen = false;
    if (chatPanel) chatPanel.classList.remove("open");
    if (chatToggleBtn) chatToggleBtn.classList.remove("active");
    if (chatMessages) chatMessages.innerHTML = "";
    unreadCount = 0;
    if (chatUnread) chatUnread.style.display = "none";

    showLobby();
}

// ==================== CHAT ====================
function toggleChat() {
    isChatOpen = !isChatOpen;
    if (chatPanel) chatPanel.classList.toggle("open", isChatOpen);
    if (chatToggleBtn) chatToggleBtn.classList.toggle("active", isChatOpen);
    if (isChatOpen) {
        unreadCount = 0;
        if (chatUnread) chatUnread.style.display = "none";
        chatInput.focus();
    }
}

function sendChatMessage() {
    if (!socket) return;
    const text = chatInput.value.trim();
    if (!text || !currentRoomId) return;
    socket.emit("chat-message", { room: currentRoomId, message: text });
    chatInput.value = "";
}

function appendMessage(text, fromId, displayName, isSelf, isHost) {
    const div = document.createElement("div");
    div.className = "msg " + (isSelf ? "self" : "remote");
    const nameLine = document.createElement("div");
    nameLine.className = "msg-name";
    nameLine.textContent = isSelf ? "You" : (displayName + (isHost ? " (Host)" : ""));
    const textLine = document.createElement("div");
    textLine.className = "msg-text";
    textLine.textContent = text;
    const timeLine = document.createElement("div");
    timeLine.className = "msg-time";
    timeLine.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    div.appendChild(nameLine);
    div.appendChild(textLine);
    div.appendChild(timeLine);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Unread indicator if chat closed
    if (!isChatOpen && !isSelf) {
        unreadCount++;
        if (chatUnread) chatUnread.style.display = "block";
    }
}

// ==================== WEBRTC PEERS ====================
function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
}

function getPeerDisplayName(peerId) {
    return peerNames.get(peerId) || peerId.slice(0, 8);
}

function createRemoteVideoBox(peerId) {
    const name = getPeerDisplayName(peerId);
    const box = document.createElement("div");
    box.className = "video-box remote-peer";
    box.dataset.peerId = peerId;
    box.innerHTML = `
        <video autoplay playsinline></video>
        <h3 class="peer-name">${escapeHtml(name)}</h3>
        <p class="status">Connecting...</p>
    `;
    return box;
}

function updatePeerLabel(peerId) {
    const box = remoteVideosContainer.querySelector(`.video-box[data-peer-id="${peerId}"]`);
    if (box) {
        const h3 = box.querySelector(".peer-name");
        if (h3) h3.textContent = getPeerDisplayName(peerId);
    }
}

function getOrCreatePeer(remoteId) {
    let entry = peerMap.get(remoteId);
    if (entry) return entry;

    const box = createRemoteVideoBox(remoteId);
    remoteVideosContainer.appendChild(box);
    const videoEl = box.querySelector("video");
    const statusEl = box.querySelector(".status");

    const pendingCandidates = [];
    const pc = new RTCPeerConnection(rtcConfig);

    getSendStream().getTracks().forEach((track) => {
        pc.addTrack(track, getSendStream());
    });

    pc.ontrack = (e) => {
        if (videoEl.srcObject !== e.streams[0]) {
            videoEl.srcObject = e.streams[0];
            statusEl.textContent = "Connected";
        }
    };
    pc.onicecandidate = (e) => {
        if (e.candidate) {
            socket.emit("ice-candidate", { to: remoteId, room: currentRoomId, candidate: e.candidate });
        }
    };
    pc.oniceconnectionstatechange = () => {
        statusEl.textContent = pc.iceConnectionState;
        if (pc.iceConnectionState === "failed") {
            statusEl.textContent = "Reconnecting...";
            pc.restartIce();
        }
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
            statusEl.textContent = "Connected";
        }
    };
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
            statusEl.textContent = "Connected";
        } else if (pc.connectionState === "failed") {
            statusEl.textContent = "Failed - Retrying...";
            setTimeout(() => {
                removePeer(remoteId);
                startCall(remoteId);
            }, 2000);
        }
    };

    entry = { pc, pendingCandidates, videoEl, statusEl, box };
    peerMap.set(remoteId, entry);
    updateParticipantCount();
    return entry;
}

function removePeer(remoteId) {
    const entry = peerMap.get(remoteId);
    if (!entry) return;
    entry.pc.close();
    if (entry.box && entry.box.parentNode) entry.box.remove();
    peerMap.delete(remoteId);
    updateParticipantCount();
}

async function drainPendingIceCandidates(entry) {
    while (entry.pendingCandidates.length) {
        const ice = entry.pendingCandidates.shift();
        try { await entry.pc.addIceCandidate(ice); } catch (err) { console.error("drain addIceCandidate error:", err); }
    }
}

async function startCall(remoteId) {
    const entry = getOrCreatePeer(remoteId);
    try {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        socket.emit("offer", { room: currentRoomId, to: remoteId, offer });
    } catch (err) {
        console.error("createOffer error:", err);
    }
}

async function handleOffer(fromId, offer) {
    const entry = getOrCreatePeer(fromId);
    try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(offer));
        await drainPendingIceCandidates(entry);
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        socket.emit("answer", { to: fromId, room: currentRoomId, answer });
    } catch (err) {
        console.error("handleOffer error:", err);
    }
}

async function handleAnswer(fromId, answer) {
    const entry = peerMap.get(fromId);
    if (!entry) return;
    try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(answer));
        await drainPendingIceCandidates(entry);
    } catch (err) {
        console.error("handleAnswer error:", err);
    }
}

async function handleIceCandidate(fromId, candidate) {
    if (!candidate) return;
    const ice = new RTCIceCandidate(candidate);
    let entry = peerMap.get(fromId);
    if (!entry) {
        entry = getOrCreatePeer(fromId);
        entry.pendingCandidates.push(ice);
        return;
    }
    if (entry.pc.remoteDescription) {
        try { await entry.pc.addIceCandidate(ice); } catch (err) { console.error("addIceCandidate error:", err); }
    } else {
        entry.pendingCandidates.push(ice);
    }
}

// ==================== SOCKET EVENTS ====================
if (socket) {
    socket.on("connect", () => {
        console.log("Connected to signaling server at", SERVER_URL);
    });
    socket.on("connect_error", (err) => {
        console.error("Socket connect error:", err);
    });
    socket.on("room-joined", ({ isHost }) => {
        amHost = isHost;
    });
    socket.on("existing-peers", (peers) => {
        peers.forEach((p) => {
            peerNames.set(p.id, p.displayName);
            startCall(p.id);
        });
        updateParticipantCount();
    });
    socket.on("user-joined", (data) => {
        const id = typeof data === "string" ? data : data.id;
        const displayName = (typeof data === "object" && data.displayName) ? data.displayName : id.slice(0, 8);
        peerNames.set(id, displayName);
        updatePeerLabel(id); // Ensure the name tag updates if the video box was created early
    });
    socket.on("user-renamed", ({ id, displayName }) => {
        peerNames.set(id, displayName);
        updatePeerLabel(id);
    });
    socket.on("offer", async ({ from, offer }) => {
        if (!peerMap.has(from)) getOrCreatePeer(from);
        await handleOffer(from, offer);
    });
    socket.on("answer", ({ from, answer }) => {
        handleAnswer(from, answer);
    });
    socket.on("ice-candidate", ({ from, candidate }) => {
        handleIceCandidate(from, candidate);
    });
    socket.on("chat-message", ({ from, displayName, isHost, message }) => {
        appendMessage(message, from, displayName || from.slice(0, 8), from === socket.id, isHost);
    });
    socket.on("user-left", (data) => {
        const peerId = typeof data === "string" ? data : data.id;
        removePeer(peerId);
    });
    socket.on("host-changed", ({ hostId }) => {
        amHost = socket.id === hostId;
    });
}

// ==================== EVENT LISTENERS ====================
muteBtn.addEventListener("click", toggleMute);
cameraBtn.addEventListener("click", toggleCamera);
endCallBtn.addEventListener("click", leaveRoom);
if (shareScreenBtn) shareScreenBtn.addEventListener("click", () => (screenStream ? stopScreenShare() : startScreenShare()));
if (chatToggleBtn) chatToggleBtn.addEventListener("click", toggleChat);
if (chatCloseBtn) chatCloseBtn.addEventListener("click", toggleChat);
sendBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
});
