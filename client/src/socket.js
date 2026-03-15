import { io } from 'socket.io-client';

// VITE_SIGNALING_URL must be set as a build-time environment variable in your
// deployment platform (e.g. Vercel → Project Settings → Environment Variables).
// If it is missing the bundle will fall back to localhost, which never works
// for remote users.
let rawUrl = import.meta.env.VITE_SIGNALING_URL || '';

if (!rawUrl) {
    if (import.meta.env.PROD) {
        console.error(
            '[JamHub] VITE_SIGNALING_URL is not set. ' +
            'Add it to your Vercel environment variables and redeploy. ' +
            'Camera and microphone will NOT work until this is fixed.'
        );
    }
    rawUrl = 'http://localhost:3001';
}

// Browsers block ws:// (plain WebSocket) connections from https:// pages
// (mixed-content policy). Force the URL to use https/wss in production.
const SIGNALING_SERVER =
    import.meta.env.PROD && rawUrl.startsWith('http://')
        ? rawUrl.replace(/^http:\/\//, 'https://')
        : rawUrl;

export const socket = io(SIGNALING_SERVER, {
    autoConnect: false,
    // websocket first for lowest latency; polling as fallback for Render's
    // proxy which may delay the WebSocket upgrade on cold starts.
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
});
