import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare } from 'lucide-react';

export default function Controls({
    isMuted,
    isCameraOff,
    onToggleAudio,
    onToggleVideo,
    onLeave,
    onToggleChat,
    isChatOpen,
    unreadCount,
}) {
    return (
        <div className="controls-bar">
            <button id="toggle-audio" className={`ctrl-btn ${isMuted ? '' : 'active'}`} onClick={onToggleAudio} title={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <button id="toggle-video" className={`ctrl-btn ${isCameraOff ? '' : 'active'}`} onClick={onToggleVideo} title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}>
                {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            <button id="leave-call" className="ctrl-btn danger" onClick={onLeave} title="Leave Call">
                <PhoneOff size={22} />
            </button>

            {/* Chat button with unread dot */}
            <button id="toggle-chat" className={`ctrl-btn ${isChatOpen ? 'active' : ''}`} onClick={onToggleChat} title="Toggle Chat">
                <MessageSquare size={22} />
                {unreadCount > 0 && !isChatOpen && (
                    <span className="unread-dot" aria-label={`${unreadCount} unread messages`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
        </div>
    );
}
