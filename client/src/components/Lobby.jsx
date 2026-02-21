import { useState, useRef, useEffect } from 'react';

export default function Lobby({ onJoin }) {
    const [name, setName] = useState('');
    const [room, setRoom] = useState('');
    const [joining, setJoining] = useState(false);
    const canvasRef = useRef(null);
    const [imgError, setImgError] = useState(false);

    // ── Animated Network Canvas ──────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;
        const mouse = { x: null, y: null };

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();

        const onResize = () => resize();
        const onMove = (e) => {
            const r = canvas.getBoundingClientRect();
            mouse.x = e.clientX - r.left;
            mouse.y = e.clientY - r.top;
        };
        const onLeave = () => { mouse.x = null; mouse.y = null; };

        window.addEventListener('resize', onResize);
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseleave', onLeave);

        const NODE_COUNT = 70;
        const CONNECT_DIST = 170;
        const MOUSE_ATTRACT = 190;

        const nodes = Array.from({ length: NODE_COUNT }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.55,
            vy: (Math.random() - 0.5) * 0.55,
            r: Math.random() * 2.5 + 1.2,
            alpha: Math.random() * 0.45 + 0.25,
            pulse: Math.random() * Math.PI * 2,
        }));

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            nodes.forEach(n => {
                n.pulse += 0.018;

                // Mouse attraction
                if (mouse.x !== null) {
                    const dx = mouse.x - n.x;
                    const dy = mouse.y - n.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MOUSE_ATTRACT) {
                        const f = ((MOUSE_ATTRACT - dist) / MOUSE_ATTRACT) * 0.014;
                        n.vx += dx * f;
                        n.vy += dy * f;
                    }
                }

                // Damping + speed cap
                n.vx *= 0.988;
                n.vy *= 0.988;
                const spd = Math.hypot(n.vx, n.vy);
                if (spd > 1.6) { n.vx = (n.vx / spd) * 1.6; n.vy = (n.vy / spd) * 1.6; }

                n.x += n.vx;
                n.y += n.vy;
                if (n.x < 0) { n.x = 0; n.vx *= -1; }
                if (n.x > canvas.width) { n.x = canvas.width; n.vx *= -1; }
                if (n.y < 0) { n.y = 0; n.vy *= -1; }
                if (n.y > canvas.height) { n.y = canvas.height; n.vy *= -1; }
            });

            // Connections
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < CONNECT_DIST) {
                        const a = (1 - dist / CONNECT_DIST) * 0.38;
                        const grad = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
                        grad.addColorStop(0, `rgba(124,58,237,${a})`);
                        grad.addColorStop(1, `rgba(96,165,250,${a})`);
                        ctx.beginPath();
                        ctx.strokeStyle = grad;
                        ctx.lineWidth = 0.8;
                        ctx.moveTo(nodes[i].x, nodes[i].y);
                        ctx.lineTo(nodes[j].x, nodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            // Nodes
            nodes.forEach(n => {
                const pulsed = n.r * (1 + 0.25 * Math.sin(n.pulse));
                // Outer glow
                const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, pulsed * 4);
                grd.addColorStop(0, `rgba(167,139,250,${n.alpha * 0.4})`);
                grd.addColorStop(1, 'rgba(124,58,237,0)');
                ctx.beginPath();
                ctx.arc(n.x, n.y, pulsed * 4, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();
                // Core
                ctx.beginPath();
                ctx.arc(n.x, n.y, pulsed, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(167,139,250,${n.alpha})`;
                ctx.fill();
            });

            animId = requestAnimationFrame(draw);
        };

        draw();
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', onResize);
            canvas.removeEventListener('mousemove', onMove);
            canvas.removeEventListener('mouseleave', onLeave);
        };
    }, []);

    // ── Join Handler ─────────────────────────────────────────────
    const handleJoin = async (e) => {
        e.preventDefault();
        if (!name.trim() || !room.trim()) return;
        setJoining(true);
        await new Promise(r => setTimeout(r, 550));
        onJoin(name.trim(), room.trim());
    };

    // ── Random Room ID Generator ─────────────────────────────────
    const generateRoom = () => {
        const adj = ['blue', 'jazz', 'rock', 'soul', 'funk', 'bass', 'vibe', 'beat', 'neon', 'echo'];
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        setRoom(`${pick(adj)}-${pick(adj)}-${Math.floor(Math.random() * 900) + 100}`);
    };

    return (
        <div className="lobby">
            {/* Animated canvas */}
            <canvas ref={canvasRef} className="lobby-canvas" />

            {/* Dark gradient overlays */}
            <div className="lobby-overlay" />

            {/* Floating blobs for depth */}
            <div className="blob blob-1" />
            <div className="blob blob-2" />
            <div className="blob blob-3" />

            {/* Content */}
            <div className="lobby-center">
                <form className="lobby-card" onSubmit={handleJoin} noValidate>
                    {/* Brand section */}
                    <div className="lobby-brand">
                        <div className="lobby-logo">🎸</div>
                        <div className="lobby-brand-text">
                            <h1 className="lobby-title">JamHub</h1>
                            <p className="lobby-tagline">Real-time collaboration. Zero latency.</p>
                        </div>
                    </div>


                    {/* Separator */}
                    <div className="lobby-sep"><span>enter a session</span></div>

                    {/* Inputs */}
                    <div className="lobby-fields">
                        <div className="field-group">
                            <label htmlFor="user-name" className="field-label">Display Name</label>
                            <div className="field-wrap">
                                <span className="field-icon">👤</span>
                                <input
                                    id="user-name"
                                    type="text"
                                    placeholder="How should we call you?"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                            </div>
                        </div>

                        <div className="field-group">
                            <label htmlFor="room-id" className="field-label">Room ID</label>
                            <div className="field-wrap">
                                <span className="field-icon">#</span>
                                <input
                                    id="room-id"
                                    type="text"
                                    placeholder="e.g. blues-jam-42"
                                    value={room}
                                    onChange={e => setRoom(e.target.value)}
                                    required
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                                <button
                                    type="button"
                                    className="field-gen-btn"
                                    onClick={generateRoom}
                                    title="Generate a random room ID"
                                >⚡</button>
                            </div>
                        </div>
                    </div>

                    {/* Join button */}
                    <button
                        type="submit"
                        id="join-btn"
                        className={`btn-join${joining ? ' joining' : ''}`}
                        disabled={!name.trim() || !room.trim() || joining}
                    >
                        {joining
                            ? <span className="btn-spinner" />
                            : <><span>🎵</span><span>Join Session</span><span className="btn-arr">→</span></>
                        }
                    </button>
                </form>

                {/* Developer credit strip */}
                <div className="lobby-credit">
                    <div className="credit-photo">
                        {/* ↓ Add your photo at client/public/profile.jpg to display it here */}
                        {!imgError ? (
                            <img
                                src="/profile.jpg"
                                alt="Witharana A.D.S."
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="credit-initials">W</div>
                        )}
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
