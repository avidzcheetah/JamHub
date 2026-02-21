import { useState } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import Lobby from './components/Lobby';
import VideoGrid from './components/VideoGrid';
import Controls from './components/Controls';
import Chat from './components/Chat';

export default function App() {
    const {
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
    } = useWebRTC();

    const [isChatOpen, setIsChatOpen] = useState(false);

    if (!isInRoom) {
        return <Lobby onJoin={joinRoom} />;
    }

    return (
        <div className="room">
            {/* Header */}
            <header className="room-header">
                <span className="logo">🎸 JamHub</span>
                <span
                    className="room-id"
                    title="Click to copy Room ID"
                    onClick={() => navigator.clipboard.writeText(roomId)}
                >
                    Room: {roomId}
                </span>
            </header>

            {/* Body */}
            <div className="room-body">
                {/* Video Area */}
                <div className="video-area">
                    <VideoGrid
                        localStream={localStream}
                        peers={peers}
                        isCameraOff={isCameraOff}
                        userName={userName}
                    />
                    <Controls
                        isMuted={isMuted}
                        isCameraOff={isCameraOff}
                        onToggleAudio={toggleAudio}
                        onToggleVideo={toggleVideo}
                        onLeave={leaveRoom}
                        onToggleChat={() => setIsChatOpen(!isChatOpen)}
                        isChatOpen={isChatOpen}
                    />
                </div>

                {/* Chat Panel */}
                {isChatOpen && (
                    <Chat
                        messages={chatMessages}
                        onSend={sendMessage}
                        userName={userName}
                        onClose={() => setIsChatOpen(false)}
                    />
                )}
            </div>
        </div>
    );
}
