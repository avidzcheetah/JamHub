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
            {/* Mic: active (on) = purple, ctrl-off (muted) = red tint */}
            <button
                id="toggle-audio"
                className={`ctrl-btn ${isMuted ? 'ctrl-off' : 'active'}`}
                onClick={onToggleAudio}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <button
                id="toggle-video"
                className={`ctrl-btn ${isCameraOff ? 'ctrl-off' : 'active'}`}
                onClick={onToggleVideo}
                title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            >
                {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            <button
                id="leave-call"
                className="ctrl-btn danger"
                onClick={onLeave}
                title="Leave call"
            >
                <PhoneOff size={22} />
            </button>

            {/* Chat with unread badge */}
            <button
                id="toggle-chat"
                className={`ctrl-btn ${isChatOpen ? 'active' : ''}`}
                onClick={onToggleChat}
                title="Toggle chat"
            >
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
