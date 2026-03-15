import { useState, useRef, useCallback, useEffect } from 'react';
import { socket } from '../socket';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

// Fetch fresh TURN credentials from your server
async function fetchIceServers() {
    try {
        const res = await fetch(`${SIGNALING_URL}/api/ice-servers`);
        if (!res.ok) throw new Error('ice-servers fetch failed');
        const servers = await res.json();
        console.log('[JamHub] ICE servers loaded:', servers.length, 'entries');
        return { iceServers: servers, iceCandidatePoolSize: 10 };
    } catch (err) {
        console.warn('[JamHub] Could not load TURN credentials, falling back to STUN only:', err);
        return {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
            ],
            iceCandidatePoolSize: 4,
        };
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
    const iceConfigRef = useRef(null); // cache the fetched ICE config

    // ── Get local media ──────────────────────────────────────
    const startLocalStream = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera/mic require HTTPS. Access via https:// or localhost.');
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            console.error('[JamHub] Full media access failed, trying audio-only:', err);
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

    // ── Remove Peer ──────────────────────────────────────────
    const removePeer = useCallback((socketId) => {
        if (peersRef.current[socketId]) {
            peersRef.current[socketId].pc.close();
            delete peersRef.current[socketId];
        }
        setPeers((prev) => { const u = { ...prev }; delete u[socketId]; return u; });
    }, []);

    // ── Create Peer Connection ───────────────────────────────
    const createPeerConnection = useCallback((remoteSocketId, remoteUserName) => {
        const config = iceConfigRef.current || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        const pc = new RTCPeerConnection(config);

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
            const state = pc.iceConnectionState;
            console.log(`ICE State (${remoteUserName}):`, state);

            if (state === 'failed') {
                // Try ICE restart before giving up
                console.log(`[JamHub] ICE failed for ${remoteUserName}, attempting restart...`);
                const peer = peersRef.current[remoteSocketId];
                if (peer && peer.isOfferer) {
                    pc.restartIce();
                    pc.createOffer({ iceRestart: true })
                        .then((offer) => pc.setLocalDescription(offer))
                        .then(() => socket.emit('offer', { to: remoteSocketId, offer: pc.localDescription }))
                        .catch((e) => {
                            console.error('[JamHub] ICE restart failed:', e);
                            removePeer(remoteSocketId);
                        });
                } else {
                    removePeer(remoteSocketId);
                }
            } else if (state === 'closed') {
                removePeer(remoteSocketId);
            }
            // 'disconnected' is transient — WebRTC will try to recover on its own, do NOT remove peer here
        };

        peersRef.current[remoteSocketId] = { pc, userName: remoteUserName, candidatesQueue: [], isOfferer: false };
        setPeers((prev) => ({
            ...prev,
            [remoteSocketId]: { stream: null, userName: remoteUserName, isMuted: false, isCameraOff: false, pc },
        }));

        return pc;
    }, [removePeer]);

    // ── Join Room ────────────────────────────────────────────
    const joinRoom = useCallback(async (name, room, opts = {}) => {
        setUserName(name);
        setRoomId(room);
        roomIdRef.current = room;

        // Fetch ICE servers BEFORE creating any peer connections
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

    // ── Leave Room ───────────────────────────────────────────
    const leaveRoom = useCallback(() => {
        Object.keys(peersRef.current).forEach((id) => peersRef.current[id].pc.close());
        peersRef.current = {};
        setPeers({});
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
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

    // ── Toggle Audio / Video ─────────────────────────────────
    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                const newMuted = !track.enabled;
                setIsMuted(newMuted); isMutedRef.current = newMuted;
                broadcastMediaState(newMuted, isCameraOffRef.current);
            }
        }
    }, [broadcastMediaState]);

    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getVideoTracks()[0];
            if (track) {
                track.enabled = !track.enabled;
                const newOff = !track.enabled;
                setIsCameraOff(newOff); isCameraOffRef.current = newOff;
                broadcastMediaState(isMutedRef.current, newOff);
            }
        }
    }, [broadcastMediaState]);

    const sendMessage = useCallback((message) => {
        if (!message.trim()) return;
        socket.emit('chat-message', { roomId: roomIdRef.current, message, userName });
    }, [userName]);

    // ── Socket Event Listeners ───────────────────────────────
    useEffect(() => {
        socket.on('existing-users', async (users) => {
            for (const user of users) {
                const pc = createPeerConnection(user.socketId, user.userName);
                // Mark this side as the offerer so it can do ICE restarts
                if (peersRef.current[user.socketId]) {
                    peersRef.current[user.socketId].isOfferer = true;
                }
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', { to: user.socketId, offer });
            }
            setTimeout(() => broadcastMediaState(isMutedRef.current, isCameraOffRef.current), 800);
        });

        socket.on('user-joined', ({ socketId: _sid, userName: _uname }) => {
            socket.emit('media-state', {
                roomId: roomIdRef.current,
                isMuted: isMutedRef.current,
                isCameraOff: isCameraOffRef.current,
            });
        });

        socket.on('offer', async ({ from, offer, userName: remoteUserName }) => {
            const pc = createPeerConnection(from, remoteUserName);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));

            const peer = peersRef.current[from];
            if (peer && peer.candidatesQueue.length > 0) {
                while (peer.candidatesQueue.length > 0) {
                    await pc.addIceCandidate(new RTCIceCandidate(peer.candidatesQueue.shift())).catch(console.error);
                }
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { to: from, answer });
        });

        socket.on('answer', async ({ from, answer }) => {
            const peer = peersRef.current[from];
            if (peer) {
                await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
                while (peer.candidatesQueue.length > 0) {
                    await peer.pc.addIceCandidate(new RTCIceCandidate(peer.candidatesQueue.shift())).catch(console.error);
                }
            }
        });

        socket.on('ice-candidate', async ({ from, candidate }) => {
            const peer = peersRef.current[from];
            if (peer) {
                if (peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
                    await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
                } else {
                    peer.candidatesQueue.push(candidate);
                }
            }
        });

        socket.on('user-left', ({ socketId }) => removePeer(socketId));

        socket.on('chat-message', (msg) => setChatMessages((prev) => [...prev, msg]));

        socket.on('media-state', ({ from, isMuted: pMuted, isCameraOff: pCamOff }) => {
            setPeers((prev) => {
                if (!prev[from]) return prev;
                return { ...prev, [from]: { ...prev[from], isMuted: pMuted, isCameraOff: pCamOff } };
            });
        });

        return () => {
            socket.off('existing-users');
            socket.off('user-joined');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('user-left');
            socket.off('chat-message');
            socket.off('media-state');
        };
    }, [createPeerConnection, removePeer, broadcastMediaState]);

    return {
        localStream, peers, isMuted, isCameraOff, isInRoom,
        chatMessages, userName, roomId,
        joinRoom, leaveRoom, toggleAudio, toggleVideo, sendMessage,
    };
}
