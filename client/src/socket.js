import { io } from 'socket.io-client';

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

export const socket = io(SIGNALING_SERVER, {
    autoConnect: false,
});
