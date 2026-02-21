import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

export default function Lobby({ onJoin }) {
    // Step 1: form
    const [name, setName] = useState('');
    const [room, setRoom] = useState('');
    const [step, setStep] = useState('form'); // 'form' | 'preview'

    // Step 2: preview
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [joining, setJoining] = useState(false);
    const [imgError, setImgError] = useState(false);

    const previewVideoRef = useRef(null);
    const previewStreamRef = useRef(null);
    const canvasRef = useRef(null);

    // ── Animated Network Canvas ──────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;
        const mouse = { x: null, y: null };

        const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
        resize();
        const onResize = () => resize();
        const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
        const onLeave = () => { mouse.x = null; mouse.y = null; };
        window.addEventListener('resize', onResize);
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseleave', onLeave);

        const NODE_COUNT = 70;
        const nodes = Array.from({ length: NODE_COUNT }, () => ({
            x: Math.random() * canvas.width, y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.55, vy: (Math.random() - 0.5) * 0.55,
            r: Math.random() * 2.5 + 1.2, alpha: Math.random() * 0.45 + 0.25,
            pulse: Math.random() * Math.PI * 2,
        }));

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            nodes.forEach(n => {
                n.pulse += 0.018;
                if (mouse.x !== null) {
                    const dx = mouse.x - n.x, dy = mouse.y - n.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < 190) { const f = ((190 - dist) / 190) * 0.014; n.vx += dx * f; n.vy += dy * f; }
                }
                n.vx *= 0.988; n.vy *= 0.988;
                const spd = Math.hypot(n.vx, n.vy);
                if (spd > 1.6) { n.vx = (n.vx / spd) * 1.6; n.vy = (n.vy / spd) * 1.6; }
                n.x = Math.max(0, Math.min(canvas.width, n.x + n.vx));
                n.y = Math.max(0, Math.min(canvas.height, n.y + n.vy));
                if (n.x <= 0 || n.x >= canvas.width) n.vx *= -1;
                if (n.y <= 0 || n.y >= canvas.height) n.vy *= -1;
            });
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
                    if (dist < 170) {
                        const a = (1 - dist / 170) * 0.38;
                        const g = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
                        g.addColorStop(0, `rgba(124,58,237,${a})`); g.addColorStop(1, `rgba(96,165,250,${a})`);
                        ctx.beginPath(); ctx.strokeStyle = g; ctx.lineWidth = 0.8;
                        ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
                    }
                }
            }
            nodes.forEach(n => {
                const p = n.r * (1 + 0.25 * Math.sin(n.pulse));
                const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, p * 4);
                grd.addColorStop(0, `rgba(167,139,250,${n.alpha * 0.4})`); grd.addColorStop(1, 'rgba(124,58,237,0)');
                ctx.beginPath(); ctx.arc(n.x, n.y, p * 4, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill();
                ctx.beginPath(); ctx.arc(n.x, n.y, p, 0, Math.PI * 2); ctx.fillStyle = `rgba(167,139,250,${n.alpha})`; ctx.fill();
            });
            animId = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave); };
    }, []);

    // ── Preview camera stream ────────────────────────────────
    const startPreview = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            previewStreamRef.current = stream;
            if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
        } catch {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                previewStreamRef.current = stream;
                setCamOn(false);
            } catch { setCamOn(false); }
        }
    }, []);

    const stopPreview = useCallback(() => {
        if (previewStreamRef.current) {
            previewStreamRef.current.getTracks().forEach(t => t.stop());
            previewStreamRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (step === 'preview') startPreview();
        return () => { if (step === 'preview') stopPreview(); };
    }, [step, startPreview, stopPreview]);

    // Keep preview video up-to-date when cam is toggled
    useEffect(() => {
        if (previewVideoRef.current && previewStreamRef.current) {
            previewVideoRef.current.srcObject = previewStreamRef.current;
        }
    }, [camOn]);

    // ── Handlers ─────────────────────────────────────────────
    const handleFormSubmit = (e) => { e.preventDefault(); if (name.trim() && room.trim()) setStep('preview'); };

    const togglePreviewMic = () => {
        setMicOn(prev => {
            const next = !prev;
            if (previewStreamRef.current) {
                const t = previewStreamRef.current.getAudioTracks()[0];
                if (t) t.enabled = next;
            }
            return next;
        });
    };

    const togglePreviewCam = () => {
        setCamOn(prev => {
            const next = !prev;
            if (previewStreamRef.current) {
                const t = previewStreamRef.current.getVideoTracks()[0];
                if (t) t.enabled = next;
            }
            return next;
        });
    };

    const handleJoin = async () => {
        setJoining(true);
        stopPreview();
        await new Promise(r => setTimeout(r, 300));
        onJoin(name.trim(), room.trim(), { startMuted: !micOn, startCameraOff: !camOn });
    };

    const generateRoom = () => {
        const adj = ['blue', 'jazz', 'rock', 'soul', 'funk', 'bass', 'vibe', 'beat', 'neon', 'echo'];
        const pick = a => a[Math.floor(Math.random() * a.length)];
        setRoom(`${pick(adj)}-${pick(adj)}-${Math.floor(Math.random() * 900) + 100}`);
    };

    return (
        <div className="lobby">
            <canvas ref={canvasRef} className="lobby-canvas" />
            <div className="lobby-overlay" />
            <div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" />

            <div className="lobby-center">
                {/* ── Step 1: Form ── */}
                {step === 'form' && (
                    <form className="lobby-card" onSubmit={handleFormSubmit} noValidate>
                        <div className="lobby-brand">
                            <div className="lobby-logo">🎸</div>
                            <div className="lobby-brand-text">
                                <h1 className="lobby-title">JamHub</h1>
                                <p className="lobby-tagline">Real-time collaboration. Zero latency.</p>
                            </div>
                        </div>

                        <div className="lobby-sep"><span>enter a session</span></div>

                        <div className="lobby-fields">
                            <div className="field-group">
                                <label htmlFor="user-name" className="field-label">Display Name</label>
                                <div className="field-wrap">
                                    <span className="field-icon">👤</span>
                                    <input id="user-name" type="text" placeholder="How should we call you?" value={name} onChange={e => setName(e.target.value)} required autoComplete="off" spellCheck="false" />
                                </div>
                            </div>
                            <div className="field-group">
                                <label htmlFor="room-id" className="field-label">Room ID</label>
                                <div className="field-wrap">
                                    <span className="field-icon">#</span>
                                    <input id="room-id" type="text" placeholder="e.g. blues-jam-42" value={room} onChange={e => setRoom(e.target.value)} required autoComplete="off" spellCheck="false" />
                                    <button type="button" className="field-gen-btn" onClick={generateRoom} title="Generate a random room ID">⚡</button>
                                </div>
                            </div>
                        </div>

                        <button type="submit" id="continue-btn" className="btn-join" disabled={!name.trim() || !room.trim()}>
                            <span>Continue</span><span className="btn-arr">→</span>
                        </button>
                    </form>
                )}

                {/* ── Step 2: Pre-join Preview ── */}
                {step === 'preview' && (
                    <div className="prejoin-card">
                        <h2 className="prejoin-title">Ready to join?</h2>
                        <p className="prejoin-sub">Room: <strong>#{room}</strong></p>

                        {/* Camera preview */}
                        <div className="prejoin-preview">
                            {camOn
                                ? <video ref={previewVideoRef} autoPlay playsInline muted className="prejoin-video" />
                                : <div className="prejoin-avatar">{name.charAt(0).toUpperCase()}</div>
                            }
                            <span className="prejoin-name-badge">{name}</span>
                        </div>

                        {/* Mic / Camera toggles */}
                        <div className="prejoin-toggles">
                            <div className="prejoin-toggle-group">
                                <button
                                    type="button"
                                    className={`prejoin-toggle-btn ${micOn ? 'on' : 'off'}`}
                                    onClick={togglePreviewMic}
                                    title={micOn ? 'Mute microphone' : 'Unmute microphone'}
                                >
                                    {micOn ? <Mic size={22} /> : <MicOff size={22} />}
                                </button>
                                <span className="prejoin-toggle-label">{micOn ? 'Mic On' : 'Mic Off'}</span>
                            </div>

                            <div className="prejoin-toggle-group">
                                <button
                                    type="button"
                                    className={`prejoin-toggle-btn ${camOn ? 'on' : 'off'}`}
                                    onClick={togglePreviewCam}
                                    title={camOn ? 'Turn off camera' : 'Turn on camera'}
                                >
                                    {camOn ? <Video size={22} /> : <VideoOff size={22} />}
                                </button>
                                <span className="prejoin-toggle-label">{camOn ? 'Camera On' : 'Camera Off'}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="prejoin-actions">
                            <button type="button" className="btn-back" onClick={() => setStep('form')}>← Back</button>
                            <button
                                type="button"
                                id="join-btn"
                                className={`btn-join prejoin-join${joining ? ' joining' : ''}`}
                                onClick={handleJoin}
                                disabled={joining}
                            >
                                {joining ? <span className="btn-spinner" /> : <><span>🎵</span><span>Join Session</span></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Developer credit */}
                <div className="lobby-credit">
                    <div className="credit-photo">
                        {!imgError
                            ? <img src="/profile.jpg" alt="Witharana A.D.S." onError={() => setImgError(true)} />
                            : <div className="credit-initials">W</div>
                        }
                    </div>
                    <div className="credit-info">
                        <span className="credit-role">Developer</span>
                        <span className="credit-name">Witharana A.D.S.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
