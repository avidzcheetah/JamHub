import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { socket } from '../socket';

export default function Chat({ messages, onSend, userName, onClose }) {
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        onSend(input.trim());
        setInput('');
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <span>💬 Chat</span>
                <button onClick={onClose} title="Close Chat">
                    <X size={18} />
                </button>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <span className="chat-empty-icon">💬</span>
                        <p className="chat-empty-title">No messages yet</p>
                        <p className="chat-empty-sub">Start the conversation — say hi! 👋</p>
                    </div>
                )}
                {messages.map((msg, i) => {
                    const isOwn = msg.senderId === socket.id;
                    return (
                        <div key={i} className={`chat-msg ${isOwn ? 'own' : ''}`}>
                            {!isOwn && <span className="sender">{msg.userName}</span>}
                            <div className="bubble">{msg.message}</div>
                            <span className="timestamp">{formatTime(msg.timestamp)}</span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSubmit}>
                <input
                    id="chat-input"
                    type="text"
                    placeholder="Type a message…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoComplete="off"
                />
                <button type="submit" title="Send">
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}
