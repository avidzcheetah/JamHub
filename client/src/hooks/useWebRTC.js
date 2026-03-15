import { useState, useRef, useCallback, useEffect } from 'react';
import { socket } from '../socket';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

// Default fallback STUN servers
const FALLBACK_ICE = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
];

async function fetchIceServers() {
    try {
        const res = await fetch(`${SIGNALING_URL}/api/ice-servers`);
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(`Server returned ${res.status}: ${errorData.message || errorData.error || 'Unknown error'}`);
        }
        const servers = await res.json();
        
        if (!Array.isArray(servers)) {
            console.error('[JamHub] ICE servers API did not return an array:', servers);
            return FALLBACK_ICE;
        }
        
        console.log('[JamHub] ICE servers loaded:', servers.length);
        return servers;
    } catch (err) {
        console.warn('[JamHub] Using fallback STUN servers. Reason:', err.message);
        return FALLBACK_ICE;
    }
}

export function useWebRTC() {
    const [localStream, setLocalStream] = useState(null);
    const [peers, setPeers] = useState({});
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [isInRoom, setIsInRoom] = useState(false);
    const [userName, setUserName] = useState('');
    const [roomId, setRoomId] = useState('');

    const peersRef = useRef({});
    const localStreamRef = useRef(null);
    const roomIdRef = useRef('');
    const isMutedRef = useRef(false);
    const isCameraOffRef = useRef(false);
    const iceConfigRef = useRef(null); // stores the actual array of servers
    
    // Global buffer for ICE candidates arriving BEFORE a peer object exists
    const candidateBuffer = useRef({}); // { socketId: [candidates] }

    // ── Get local media ──────────────────────────────────────
    const startLocalStream = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('HTTPS required for camera/mic.');
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            console.warn('[JamHub] Video denied, falling back to audio:', err);
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
        }
    }, []);

    const broadcastMediaState = useCallback((muted, cameraOff) => {
        if (roomIdRef.current) {
            socket.emit('media-state', { roomId: roomIdRef.current, isMuted: muted, isCameraOff: cameraOff });
        }
    }, []);

    const removePeer = useCallback((socketId) => {
        if (peersRef.current[socketId]) {
            peersRef.current[socketId].pc.close();
            delete peersRef.current[socketId];
        }
        delete candidateBuffer.current[socketId];
        setPeers((prev) => { const u = { ...prev }; delete u[socketId]; return u; });
    }, []);

    const drainPendingIceCandidates = useCallback(async (remoteId) => {
        const peer = peersRef.current[remoteId];
        if (!peer || !candidateBuffer.current[remoteId]) return;
        
        while (candidateBuffer.current[remoteId].length) {
            const cand = candidateBuffer.current[remoteId].shift();
            try {
                await peer.pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
                console.error(`[JamHub] Error adding buffered candidate for ${remoteId}:`, err);
            }
        }
    }, []);

    const startCall = useCallback(async (remoteId, remoteUserName) => {
        const peer = peersRef.current[remoteId];
        if (!peer) return;
        try {
            peer.isOfferer = true;
            const offer = await peer.pc.createOffer();
            await peer.pc.setLocalDescription(offer);
            socket.emit('offer', { to: remoteId, offer });
        } catch (err) {
            console.error(`[JamHub] Error creating offer for ${remoteId}:`, err);
        }
    }, []);

    // ── Create Peer Connection ───────────────────────────────
    const createPeerConnection = useCallback((remoteSocketId, remoteUserName) => {
        // DEFENSIVE: Ensure iceServers is always an array
        const servers = Array.isArray(iceConfigRef.current) ? iceConfigRef.current : FALLBACK_ICE;
        const pc = new RTCPeerConnection({ 
            iceServers: servers, 
            iceCandidatePoolSize: 10,
            iceTransportPolicy: 'all'
        });

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            setPeers((prev) => ({
                ...prev,
                [remoteSocketId]: { ...prev[remoteSocketId], stream: remoteStream, userName: remoteUserName },
            }));
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { to: remoteSocketId, candidate: event.candidate });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`ICE State (${remoteUserName}):`, pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                console.warn(`[JamHub] ICE failed for ${remoteUserName}, restarting...`);
                pc.restartIce();
                // If we were the offerer, we should re-negotiate
                const peer = peersRef.current[remoteSocketId];
                if (peer && peer.isOfferer) {
                    startCall(remoteSocketId, remoteUserName);
                }
            } else if (pc.iceConnectionState === 'closed') {
                removePeer(remoteSocketId);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`Connection State (${remoteUserName}):`, pc.connectionState);
            if (pc.connectionState === 'failed') {
                console.error(`[JamHub] Connection failed for ${remoteUserName}, retrying in 2s...`);
                setTimeout(() => {
                    removePeer(remoteSocketId);
                    // Re-initiate connection
                    const newPc = createPeerConnection(remoteSocketId, remoteUserName);
                    const peer = peersRef.current[remoteSocketId];
                    if (peer) startCall(remoteSocketId, remoteUserName);
                }, 2000);
            }
        };

        peersRef.current[remoteSocketId] = { pc, userName: remoteUserName, isOfferer: false };

        setPeers((prev) => ({
            ...prev,
            [remoteSocketId]: { stream: null, userName: remoteUserName, isMuted: false, isCameraOff: false, pc },
        }));

        return pc;
    }, [removePeer, startCall]);

    // ── Join Room ────────────────────────────────────────────
    const joinRoom = useCallback(async (name, room, opts = {}) => {
        setUserName(name);
        setRoomId(room);
        roomIdRef.current = room;

        // Fetch ICE configs
        iceConfigRef.current = await fetchIceServers();

        const stream = await startLocalStream();
        const { startMuted = false, startCameraOff = false } = opts;

        if (startMuted) {
            const t = stream.getAudioTracks()[0];
            if (t) t.enabled = false;
            setIsMuted(true); isMutedRef.current = true;
        }
        if (startCameraOff) {
            const t = stream.getVideoTracks()[0];
            if (t) t.enabled = false;
            setIsCameraOff(true); isCameraOffRef.current = true;
        }

        socket.connect();
        socket.emit('join-room', { roomId: room, userName: name });
        setIsInRoom(true);
        setTimeout(() => broadcastMediaState(startMuted, startCameraOff), 500);
    }, [startLocalStream, broadcastMediaState]);

    const leaveRoom = useCallback(() => {
        Object.keys(peersRef.current).forEach(id => peersRef.current[id].pc.close());
        peersRef.current = {};
        candidateBuffer.current = {};
        setPeers({});
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);
        socket.disconnect();
        roomIdRef.current = '';
        setIsInRoom(false);
        setChatMessages([]);
        setIsMuted(false); setIsCameraOff(false);
        isMutedRef.current = false; isCameraOffRef.current = false;
        iceConfigRef.current = null;
    }, []);

    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const t = localStreamRef.current.getAudioTracks()[0];
            if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); isMutedRef.current = !t.enabled; broadcastMediaState(!t.enabled, isCameraOffRef.current); }
        }
    }, [broadcastMediaState]);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const t = localStreamRef.current.getVideoTracks()[0];
            if (t) { t.enabled = !t.enabled; setIsCameraOff(!t.enabled); isCameraOffRef.current = !t.enabled; broadcastMediaState(isMutedRef.current, !t.enabled); }
        }
    }, [broadcastMediaState]);

    const sendMessage = useCallback((m) => {
        if (!m.trim()) return;
        socket.emit('chat-message', { roomId: roomIdRef.current, message: m, userName });
    }, [userName]);

    // ── Socket Events ────────────────────────────────────────
    useEffect(() => {
        socket.on('existing-peers', async (users) => {
            console.log(`[JamHub] Found ${users.length} existing peers`);
            for (const user of users) {
                createPeerConnection(user.id, user.userName);
                await startCall(user.id, user.userName);
            }
        });

        socket.on('offer', async ({ from, offer, userName: rName }) => {
            console.log(`[JamHub] Received offer from ${rName || from}`);
            let peer = peersRef.current[from];
            if (!peer) {
                peer = { pc: createPeerConnection(from, rName || 'Participant') };
            }
            try {
                await peer.pc.setRemoteDescription(new RTCSessionDescription(offer));
                await drainPendingIceCandidates(from);
                const answer = await peer.pc.createAnswer();
                await peer.pc.setLocalDescription(answer);
                socket.emit('answer', { to: from, answer });
            } catch (err) {
                console.error(`[JamHub] Error handling offer from ${from}:`, err);
            }
        });

        socket.on('answer', async ({ from, answer }) => {
            console.log(`[JamHub] Received answer from ${from}`);
            const peer = peersRef.current[from];
            if (peer) {
                try {
                    await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
                    await drainPendingIceCandidates(from);
                } catch (err) {
                    console.error(`[JamHub] Error handling answer from ${from}:`, err);
                }
            }
        });

        socket.on('ice-candidate', async ({ from, candidate }) => {
            if (!candidate) return;
            const peer = peersRef.current[from];
            if (peer && peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
                try {
                    await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error(`[JamHub] Error adding ICE candidate from ${from}:`, err);
                }
            } else {
                if (!candidateBuffer.current[from]) candidateBuffer.current[from] = [];
                candidateBuffer.current[from].push(candidate);
                
                // If peer doesn't exist yet, create it but wait for offer/existing-peers to initiate tracks
                if (!peer) {
                    createPeerConnection(from, 'Participant');
                }
            }
        });

        socket.on('user-joined', ({ id, userName: uName }) => {
            console.log(`[JamHub] User joined: ${uName} (${id})`);
            socket.emit('media-state', { roomId: roomIdRef.current, isMuted: isMutedRef.current, isCameraOff: isCameraOffRef.current });
        });

        socket.on('user-left', ({ id }) => {
            console.log(`[JamHub] User left: ${id}`);
            removePeer(id);
        });

        socket.on('chat-message', msg => setChatMessages(p => [...p, msg]));
        
        socket.on('media-state', ({ from, isMuted: m, isCameraOff: v }) => {
            setPeers(p => { 
                if (!p[from]) return p; 
                return { ...p, [from]: { ...p[from], isMuted: m, isCameraOff: v }}; 
            });
        });

        return () => {
            socket.off('existing-peers'); socket.off('offer'); socket.off('answer');
            socket.off('ice-candidate'); socket.off('user-joined'); socket.off('user-left');
            socket.off('chat-message'); socket.off('media-state');
        };
    }, [createPeerConnection, removePeer, startCall, drainPendingIceCandidates]);

    return {
        localStream, peers, isMuted, isCameraOff, isInRoom,
        chatMessages, userName, roomId,
        joinRoom, leaveRoom, toggleAudio, toggleVideo, sendMessage,
    };
}
