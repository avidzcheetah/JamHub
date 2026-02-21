import { useState } from 'react';
import { Music } from 'lucide-react';

export default function Lobby({ onJoin }) {
    const [name, setName] = useState('');
    const [room, setRoom] = useState('');

    const handleJoin = (e) => {
        e.preventDefault();
        if (name.trim() && room.trim()) {
            onJoin(name.trim(), room.trim());
        }
    };

    return (
        <div className="lobby">
            <form className="lobby-card" onSubmit={handleJoin}>
                <div style={{ fontSize: '3rem' }}>🎸</div>
                <h1>JamHub</h1>
                <p>
                    Join a room to start a real-time music jam session with video, audio, and chat.
                </p>

                <input
                    id="user-name"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />

                <input
                    id="room-id"
                    type="text"
                    placeholder="Room ID (e.g. blues-jam)"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    required
                />

                <button
                    type="submit"
                    className="btn-primary"
                    disabled={!name.trim() || !room.trim()}
                >
                    🎵 Join Session
                </button>
            </form>
        </div>
    );
}
