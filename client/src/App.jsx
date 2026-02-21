import { useState, useEffect } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import Lobby from './components/Lobby';
import VideoGrid from './components/VideoGrid';
import Controls from './components/Controls';
import Chat from './components/Chat';

export default function App() {
    const {
        localStream, peers, isMuted, isCameraOff,
        isInRoom, chatMessages, userName, roomId,
        joinRoom, leaveRoom, toggleAudio, toggleVideo, sendMessage,
    } = useWebRTC();

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [roomIdCopied, setRoomIdCopied] = useState(false);

    // Track unread messages when chat is closed
    useEffect(() => {
        if (chatMessages.length === 0) return;
        if (!isChatOpen) setUnreadCount(prev => prev + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatMessages.length]);

    const openChat = () => { setIsChatOpen(true); setUnreadCount(0); };
    const closeChat = () => setIsChatOpen(false);
    const toggleChat = () => { if (isChatOpen) closeChat(); else openChat(); };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setRoomIdCopied(true);
        setTimeout(() => setRoomIdCopied(false), 1800);
    };

    const participantCount = 1 + Object.keys(peers).length;

    if (!isInRoom) return <Lobby onJoin={joinRoom} />;

    return (
        <div className="room">
            <header className="room-header">
                <span className="logo">🎸 JamHub</span>

                {/* Live participant count */}
                <div className="participant-badge">
                    <span className="dot" />
                    {participantCount} participant{participantCount !== 1 ? 's' : ''}
                </div>

                {/* Room ID — click to copy with visual feedback */}
                <span
                    className={`room-id${roomIdCopied ? ' copied' : ''}`}
                    title={roomIdCopied ? 'Copied!' : 'Click to copy Room ID'}
                    onClick={copyRoomId}
                >
                    {roomIdCopied ? '✓ Copied!' : `#${roomId}`}
                </span>
            </header>

            <div className="room-body">
                <div className="video-area">
                    <VideoGrid
                        localStream={localStream}
                        peers={peers}
                        isCameraOff={isCameraOff}
                        isMuted={isMuted}
                        userName={userName}
                    />
                    <Controls
                        isMuted={isMuted}
                        isCameraOff={isCameraOff}
                        onToggleAudio={toggleAudio}
                        onToggleVideo={toggleVideo}
                        onLeave={leaveRoom}
                        onToggleChat={toggleChat}
                        isChatOpen={isChatOpen}
                        unreadCount={unreadCount}
                    />
                </div>

                {isChatOpen && (
                    <Chat messages={chatMessages} onSend={sendMessage} userName={userName} onClose={closeChat} />
                )}
            </div>
        </div>
    );
}
