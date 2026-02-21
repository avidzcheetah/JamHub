import { useRef, useEffect } from 'react';

export default function VideoGrid({ localStream, peers, isCameraOff, userName }) {
    const localVideoRef = useRef(null);

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isCameraOff]); // re-assign srcObject when camera comes back on

    const peerEntries = Object.entries(peers);
    const totalCount = 1 + peerEntries.length;

    return (
        <div
            className="video-grid"
            data-count={Math.min(totalCount, 6)}
        >
            {/* Local video */}
            <div className="video-tile local">
                {isCameraOff && (
                    <div className="avatar-placeholder">{userName?.charAt(0) || '?'}</div>
                )}
                {/* Always mounted so ref stays valid; hidden by CSS when camera is off */}
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ display: isCameraOff ? 'none' : 'block' }}
                />
                <span className="label">You ({userName})</span>
            </div>

            {/* Remote peers */}
            {peerEntries.map(([socketId, peer]) => (
                <RemoteVideo key={socketId} peer={peer} />
            ))}
        </div>
    );
}

function RemoteVideo({ peer }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream]);

    return (
        <div className="video-tile">
            {peer.stream ? (
                <video ref={videoRef} autoPlay playsInline />
            ) : (
                <div className="avatar-placeholder">{peer.userName?.charAt(0) || '?'}</div>
            )}
            <span className="label">{peer.userName || 'Peer'}</span>
        </div>
    );
}
