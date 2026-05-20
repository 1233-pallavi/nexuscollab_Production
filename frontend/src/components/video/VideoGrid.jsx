import { useRef, useEffect } from 'react';
import styles from './VideoGrid.module.css';

const VideoTile = ({ stream, label, muted = false, isLocal = false, isScreenShare = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={styles.tile}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted || isLocal}
        className={`${styles.video} ${isScreenShare ? styles.videoContain : ''}`}
      />
      <div className={styles.tileLabel}>{label}{isLocal ? ' (You)' : ''}</div>
    </div>
  );
};

const VideoGrid = ({
  localStream,
  remoteStreams,
  isInCall,
  isCameraOn,
  isMicOn,
  isScreenSharing,
  screenSharingEnabled,  // room-level permission
  participants,
  onStartCall,
  onEndCall,
  onToggleCamera,
  onToggleMic,
  onStartScreen,
  onStopScreen,
  currentUser
}) => {
  const remoteEntries = Object.entries(remoteStreams);
  const totalStreams = isInCall ? 1 + remoteEntries.length : 0;

  // Admin/moderator can always share; regular users need the room permission
  const canShareScreen = ['admin', 'moderator'].includes(currentUser?.role)
    || screenSharingEnabled !== false;

  // When screen sharing, use a spotlight layout: 1 big column
  const gridClass = isScreenSharing
    ? styles.gridScreen
    : styles[`grid${Math.min(totalStreams, 4)}`];

  const getParticipantName = (socketId) => {
    const p = participants.find((p) => p.socketId === socketId);
    return p?.username || 'Participant';
  };

  return (
    <div className={styles.container}>
      {!isInCall ? (
        <div className={styles.idle}>
          <div className={styles.idleIcon}>📹</div>
          <h3>No active call</h3>
          <p>Start a video call to connect with room participants</p>
          <button className={styles.joinCallBtn} onClick={onStartCall}>
            Start Video Call
          </button>
        </div>
      ) : (
        <>
          <div className={`${styles.grid} ${gridClass}`}>
            {localStream && (
              <VideoTile
                key={localStream.id}
                stream={localStream}
                label={currentUser?.username || 'You'}
                muted
                isLocal
                isScreenShare={isScreenSharing}
              />
            )}
            {remoteEntries.map(([socketId, stream]) => (
              <VideoTile
                key={socketId}
                stream={stream}
                label={getParticipantName(socketId)}
                isScreenShare={isScreenSharing}
              />
            ))}
            {remoteEntries.length === 0 && (
              <div className={styles.waiting}>
                <span>⏳</span>
                <p>Waiting for others to join the call...</p>
              </div>
            )}
          </div>

          <div className={styles.controls}>
            <button
              className={`${styles.ctrl} ${!isMicOn ? styles.ctrlOff : ''}`}
              onClick={onToggleMic}
              title={isMicOn ? 'Mute' : 'Unmute'}
            >
              {isMicOn ? '🎤' : '🔇'}
            </button>

            <button
              className={`${styles.ctrl} ${!isCameraOn ? styles.ctrlOff : ''}`}
              onClick={onToggleCamera}
              title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {isCameraOn ? '📷' : '📵'}
            </button>

            <button
              className={`${styles.ctrl} ${isScreenSharing ? styles.ctrlActive : ''} ${!canShareScreen ? styles.ctrlDisabled : ''}`}
              onClick={isScreenSharing ? onStopScreen : onStartScreen}
              title={
                !canShareScreen
                  ? 'Screen sharing is disabled by the moderator'
                  : isScreenSharing ? 'Stop sharing' : 'Share screen'
              }
              disabled={!canShareScreen && !isScreenSharing}
            >
              🖥
              {!canShareScreen && <span className={styles.ctrlBadge}>Off</span>}
            </button>

            <button className={styles.endBtn} onClick={onEndCall} title="End call">
              📵 End Call
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoGrid;
