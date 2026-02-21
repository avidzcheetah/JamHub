import { useRef, useEffect } from 'react';
import { MicOff, VideoOff } from 'lucide-react';

export default function VideoGrid({ localStream, peers, isCameraOff, isMuted, userName }) {
    const localVideoRef = useRef(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isCameraOff]);

    const peerEntries = Object.entries(peers);
    const totalCount = 1 + peerEntries.length;

    return (
        <div className="video-grid" data-count={Math.min(totalCount, 6)}>
            {/* Local video */}
            <div className="video-tile local">
                {/* Video: always mounted for ref stability */}
                <video
                    ref={localVideoRef}
                    autoPlay playsInline muted
                    style={{ display: isCameraOff ? 'none' : 'block' }}
                />

                {/* Status overlay — replaces avatar entirely */}
                <StatusOverlay isCameraOff={isCameraOff} isMuted={isMuted} />

                <span className="label">You ({userName})</span>
            </div>

            {peerEntries.map(([socketId, peer]) => (
                <RemoteVideo key={socketId} peer={peer} />
            ))}
        </div>
    );
}

/** Renders the correct status icons based on mic/camera state.
 *
 * Rules:
 *   camera on + mic on   → nothing
 *   camera on + mic off  → small red MicOff badge (bottom-right corner)
 *   camera off (any mic) → centered VideoOff icon; if also mic off,
 *                          MicOff icon appears below it (centered, no corner badge)
 */
function StatusOverlay({ isCameraOff, isMuted }) {
    if (!isCameraOff && !isMuted) return null;

    if (isCameraOff) {
        return (
            <div className="tile-status-center">
                <VideoOff size={36} />
                <span>Camera Off</span>
                {isMuted && (
                    <div className="tile-centered-mic">
                        <MicOff size={20} />
                        <span>Muted</span>
                    </div>
                )}
            </div>
        );
    }

    // camera on, mic off only
    return (
        <div className="tile-mic-off"><MicOff size={14} /></div>
    );
}

function RemoteVideo({ peer }) {
    const videoRef = useRef(null);
    const cameraOff = peer.isCameraOff;
    const micOff = peer.isMuted;

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream, cameraOff]);

    return (
        <div className="video-tile">
            {/* Video: kept mounted to avoid re-enable bug */}
            <video
                ref={videoRef}
                autoPlay playsInline
                style={{ display: (peer.stream && !cameraOff) ? 'block' : 'none' }}
            />

            {/* Status overlay (same logic as local) */}
            <StatusOverlay isCameraOff={cameraOff} isMuted={micOff} />

            <span className="label">{peer.userName || 'Peer'}</span>
        </div>
    );
}
