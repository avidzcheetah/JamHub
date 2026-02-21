import { useState, useRef, useCallback, useEffect } from 'react';
import { socket } from '../socket';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        // Free TURN relay — needed for peers behind NAT in production
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp',
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
};

export function useWebRTC() {
    const [localStream, setLocalStream] = useState(null);
    const [peers, setPeers] = useState({}); // { socketId: { stream, userName, isMuted, isCameraOff, pc } }
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

    // ── Get local media ──────────────────────────────────────
    const startLocalStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            console.error('Error accessing media devices:', err);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: true,
                });
                setLocalStream(stream);
                localStreamRef.current = stream;
                return stream;
            } catch (e) {
                console.error('Cannot access any media device:', e);
                return null;
            }
        }
    }, []);

    // ── Broadcast our media state to everyone in the room ────
    const broadcastMediaState = useCallback((muted, cameraOff) => {
        if (roomIdRef.current) {
            socket.emit('media-state', {
                roomId: roomIdRef.current,
                isMuted: muted,
                isCameraOff: cameraOff,
            });
        }
    }, []);

    // ── Create Peer Connection ───────────────────────────────
    const createPeerConnection = useCallback((remoteSocketId, remoteUserName) => {
        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        // Handle incoming tracks from remote peer
        pc.ontrack = (event) => {
            const [remoteStream] = event.streams;
            setPeers((prev) => ({
                ...prev,
                [remoteSocketId]: {
                    ...prev[remoteSocketId],
                    stream: remoteStream,
                    userName: remoteUserName,
                },
            }));
        };

        // Send ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', {
                    to: remoteSocketId,
                    candidate: event.candidate,
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                removePeer(remoteSocketId);
            }
        };

        peersRef.current[remoteSocketId] = { pc, userName: remoteUserName };
        setPeers((prev) => ({
            ...prev,
            [remoteSocketId]: {
                stream: null,
                userName: remoteUserName,
                isMuted: false,
                isCameraOff: false,
                pc,
            },
        }));

        return pc;
    }, []);

    // ── Remove Peer ──────────────────────────────────────────
    const removePeer = useCallback((socketId) => {
        if (peersRef.current[socketId]) {
            peersRef.current[socketId].pc.close();
            delete peersRef.current[socketId];
        }
        setPeers((prev) => {
            const updated = { ...prev };
            delete updated[socketId];
            return updated;
        });
    }, []);

    // ── Join Room ────────────────────────────────────────────
    // opts: { startMuted: bool, startCameraOff: bool }
    const joinRoom = useCallback(async (name, room, opts = {}) => {
        setUserName(name);
        setRoomId(room);
        roomIdRef.current = room;

        const stream = await startLocalStream();
        if (!stream) return;

        // Apply initial muted / camera-off preferences
        const { startMuted = false, startCameraOff = false } = opts;

        if (startMuted) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = false;
            setIsMuted(true);
            isMutedRef.current = true;
        }
        if (startCameraOff) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = false;
            setIsCameraOff(true);
            isCameraOffRef.current = true;
        }

        socket.connect();
        socket.emit('join-room', { roomId: room, userName: name });
        setIsInRoom(true);

        // Broadcast our initial state after a brief moment (let signaling settle)
        setTimeout(() => {
            broadcastMediaState(startMuted, startCameraOff);
        }, 500);
    }, [startLocalStream, broadcastMediaState]);

    // ── Leave Room ───────────────────────────────────────────
    const leaveRoom = useCallback(() => {
        Object.keys(peersRef.current).forEach((id) => {
            peersRef.current[id].pc.close();
        });
        peersRef.current = {};
        setPeers({});

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);

        socket.disconnect();
        roomIdRef.current = '';
        setIsInRoom(false);
        setChatMessages([]);
        setIsMuted(false);
        setIsCameraOff(false);
        isMutedRef.current = false;
        isCameraOffRef.current = false;
    }, []);

    // ── Toggle Audio ─────────────────────────────────────────
    const toggleAudio = useCallback(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const newMuted = !audioTrack.enabled;
                setIsMuted(newMuted);
                isMutedRef.current = newMuted;
                broadcastMediaState(newMuted, isCameraOffRef.current);
            }
        }
    }, [broadcastMediaState]);

    // ── Toggle Video ─────────────────────────────────────────
    const toggleVideo = useCallback(() => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const newCameraOff = !videoTrack.enabled;
                setIsCameraOff(newCameraOff);
                isCameraOffRef.current = newCameraOff;
                broadcastMediaState(isMutedRef.current, newCameraOff);
            }
        }
    }, [broadcastMediaState]);

    // ── Send Chat Message ────────────────────────────────────
    const sendMessage = useCallback((message) => {
        if (!message.trim()) return;
        socket.emit('chat-message', { roomId: roomIdRef.current, message, userName });
    }, [userName]);

    // ── Socket Event Listeners ───────────────────────────────
    useEffect(() => {
        socket.on('existing-users', async (users) => {
            for (const user of users) {
                const pc = createPeerConnection(user.socketId, user.userName);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', { to: user.socketId, offer });
            }
            // Tell existing users our current state
            setTimeout(() => {
                broadcastMediaState(isMutedRef.current, isCameraOffRef.current);
            }, 800);
        });

        socket.on('user-joined', ({ socketId, userName: remoteUserName }) => {
            console.log(`👤 ${remoteUserName} joined`);
            // Send our current state to the new user so they see our correct status
            socket.emit('media-state', {
                roomId: roomIdRef.current,
                isMuted: isMutedRef.current,
                isCameraOff: isCameraOffRef.current,
            });
        });

        socket.on('offer', async ({ from, offer, userName: remoteUserName }) => {
            const pc = createPeerConnection(from, remoteUserName);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { to: from, answer });
        });

        socket.on('answer', async ({ from, answer }) => {
            const peer = peersRef.current[from];
            if (peer) {
                await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
        });

        socket.on('ice-candidate', async ({ from, candidate }) => {
            const peer = peersRef.current[from];
            if (peer) {
                try {
                    await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('Error adding ICE candidate:', e);
                }
            }
        });

        socket.on('user-left', ({ socketId }) => {
            removePeer(socketId);
        });

        socket.on('chat-message', (msg) => {
            setChatMessages((prev) => [...prev, msg]);
        });

        // Remote peer media state changed
        socket.on('media-state', ({ from, isMuted: peerMuted, isCameraOff: peerCameraOff }) => {
            setPeers((prev) => {
                if (!prev[from]) return prev;
                return {
                    ...prev,
                    [from]: {
                        ...prev[from],
                        isMuted: peerMuted,
                        isCameraOff: peerCameraOff,
                    },
                };
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
        localStream,
        peers,
        isMuted,
        isCameraOff,
        isInRoom,
        chatMessages,
        userName,
        roomId,
        joinRoom,
        leaveRoom,
        toggleAudio,
        toggleVideo,
        sendMessage,
    };
}
