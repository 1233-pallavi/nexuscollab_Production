import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useRoomStore from '../store/roomStore';
import useAuthStore from '../store/authStore';
import useSocket from '../hooks/useSocket';
import useWebRTC from '../hooks/useWebRTC';
import { getSocket } from '../services/socket';
import { roomsAPI, usersAPI } from '../services/api';
import VideoGrid from '../components/video/VideoGrid';
import ChatPanel from '../components/chat/ChatPanel';
import ParticipantsList from '../components/room/ParticipantsList';
import styles from './Room.module.css';

const Room = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentRoom, fetchRoom, participants, messages, clearRoom } = useRoomStore();
  const { joinRoom, leaveRoom, sendMessage, sendTyping, muteUser, kickUser, toggleRoomLock } = useSocket({ roomId });
  const {
    localStream, remoteStreams, isInCall, isCameraOn, isMicOn, isScreenSharing, callError,
    startCall, endCall, toggleCamera, toggleMic, startScreenShare, stopScreenShare
  } = useWebRTC({ roomId, userId: user?._id, username: user?.username });

  const [activeTab, setActiveTab] = useState('chat');
  const [roomLocked, setRoomLocked] = useState(false);
  const [screenSharingEnabled, setScreenSharingEnabled] = useState(true);
  const [togglingScreen, setTogglingScreen] = useState(false);
  const [notification, setNotification] = useState('');

  // Manage participants state (admin/moderator)
  const [allUsers, setAllUsers] = useState([]);
  const [roomParticipants, setRoomParticipants] = useState([]);
  const [addingUser, setAddingUser] = useState(null);
  const [removingUser, setRemovingUser] = useState(null);

  const isModOrAdmin = ['admin', 'moderator'].includes(user?.role);
  const isRoomOwner = currentRoom?.createdBy?._id?.toString() === user?._id?.toString() ||
                      currentRoom?.createdBy?.toString() === user?._id?.toString();
  const canManage = isModOrAdmin || isRoomOwner;

  useEffect(() => {
    fetchRoom(roomId);
    joinRoom();

    const socket = getSocket();
    if (socket) {
      socket.on('you-are-kicked', ({ roomId: kickedRoom }) => {
        if (kickedRoom === roomId) {
          showNotification('You have been removed from this room');
          setTimeout(() => navigate('/dashboard'), 2000);
        }
      });
      socket.on('you-are-muted', () => showNotification('You have been muted by a moderator'));
      socket.on('room-locked', ({ isLocked, by }) => {
        setRoomLocked(isLocked);
        showNotification(`Room ${isLocked ? 'locked' : 'unlocked'} by ${by}`);
      });
      socket.on('call-started', ({ initiator }) => {
        if (initiator.userId !== user?._id) showNotification(`${initiator.username} started a call`);
      });
      socket.on('screen-share-started', ({ username }) => showNotification(`${username} is sharing their screen`));
      socket.on('screen-share-stopped', () => showNotification('Screen sharing ended'));
      socket.on('screen-sharing-toggled', ({ enabled, by }) => {
        setScreenSharingEnabled(enabled);
        showNotification(`Screen sharing ${enabled ? 'enabled' : 'disabled'} by ${by}`);
      });
    }

    return () => {
      leaveRoom();
      if (isInCall) endCall();
      clearRoom();
      if (socket) {
        socket.off('you-are-kicked');
        socket.off('you-are-muted');
        socket.off('room-locked');
        socket.off('call-started');
        socket.off('screen-share-started');
        socket.off('screen-share-stopped');
        socket.off('screen-sharing-toggled');
      }
    };
  }, [roomId]);

  // Sync room settings from REST data when room loads
  useEffect(() => {
    if (currentRoom) {
      setRoomLocked(currentRoom.isLocked || false);
      setScreenSharingEnabled(currentRoom.screenSharingEnabled !== false);
    }
  }, [currentRoom?._id]);
  useEffect(() => {
    if (activeTab === 'manage' && canManage) {
      // Admin/moderator get full user list; room owners get active-only list
      const fetchUsers = isModOrAdmin ? usersAPI.getAll() : usersAPI.getActive();
      fetchUsers.then(({ data }) => {
        const list = data.users.filter(u => u.isActive !== false);
        setAllUsers(list);
      }).catch(() => {});

      // Load current room participants from REST (fresh)
      roomsAPI.getOne(roomId).then(({ data }) => {
        setRoomParticipants(data.room.participants || []);
      }).catch(() => {});
    }
  }, [activeTab, roomId, canManage, isModOrAdmin]);

  const handleAddParticipant = async (userId) => {
    setAddingUser(userId);
    try {
      const { data } = await roomsAPI.addParticipant(roomId, userId);
      setRoomParticipants(data.room.participants || []);
      showNotification('User added to room');
    } catch {
      showNotification('Failed to add user');
    } finally {
      setAddingUser(null);
    }
  };

  const handleRemoveParticipant = async (userId) => {
    setRemovingUser(userId);
    try {
      const { data } = await roomsAPI.removeParticipant(roomId, userId);
      setRoomParticipants(data.room.participants || []);
      showNotification('User removed from room');
    } catch {
      showNotification('Failed to remove user');
    } finally {
      setRemovingUser(null);
    }
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const handleLockToggle = () => {
    const newLocked = !roomLocked;
    setRoomLocked(newLocked);
    toggleRoomLock(newLocked);
  };

  const handleScreenSharingToggle = async () => {
    setTogglingScreen(true);
    const newVal = !screenSharingEnabled;
    try {
      await roomsAPI.toggleScreenSharing(roomId, newVal);
      setScreenSharingEnabled(newVal);
      // Notify all room members via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('toggle-screen-sharing', { roomId, enabled: newVal });
      }
      showNotification(`Screen sharing ${newVal ? 'enabled' : 'disabled'}`);
    } catch {
      showNotification('Failed to update screen sharing setting');
    } finally {
      setTogglingScreen(false);
    }
  };

  const participantIds = new Set(roomParticipants.map(p => p._id || p));

  return (
    <div className={styles.layout}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>←</button>
          <div>
            <h1 className={styles.roomName}>#{currentRoom?.name || 'Loading...'}</h1>
            {currentRoom?.description && (
              <p className={styles.roomDesc}>{currentRoom.description}</p>
            )}
            {currentRoom?.createdBy?.username && (
              <p className={styles.roomOwner}>👤 {currentRoom.createdBy.username}</p>
            )}
          </div>
          {roomLocked && <span className={styles.lockedBadge}>🔒 Locked</span>}
        </div>

        <div className={styles.headerActions}>
          {isModOrAdmin && (
            <button className={styles.iconBtn} onClick={handleLockToggle} title={roomLocked ? 'Unlock' : 'Lock'}>
              {roomLocked ? '🔓' : '🔒'}
            </button>
          )}
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${activeTab === 'chat' ? styles.activeTab : ''}`} onClick={() => setActiveTab('chat')}>
              💬 Chat
            </button>
            <button className={`${styles.tab} ${activeTab === 'video' ? styles.activeTab : ''}`} onClick={() => setActiveTab('video')}>
              📹 Call {isInCall && <span className={styles.liveDot} />}
            </button>
            <button className={`${styles.tab} ${activeTab === 'people' ? styles.activeTab : ''}`} onClick={() => setActiveTab('people')}>
              👥 People ({currentRoom?.participants?.length || participants.length})
            </button>
            {canManage && (
              <button className={`${styles.tab} ${activeTab === 'manage' ? styles.activeTab : ''}`} onClick={() => setActiveTab('manage')}>
                ⚙️ Manage
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Notification bar */}
      {notification && <div className={styles.notification}>{notification}</div>}

      {/* Content */}
      <div className={styles.content}>
        {/* Chat */}
        <div className={`${styles.panel} ${activeTab === 'chat' ? styles.active : ''}`}>
          <ChatPanel onSend={sendMessage} onTyping={sendTyping} />
        </div>

        {/* Video */}
        <div className={`${styles.panel} ${activeTab === 'video' ? styles.active : ''}`}>
          {callError && <div className={styles.callError}>⚠️ {callError}</div>}
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            isInCall={isInCall}
            isCameraOn={isCameraOn}
            isMicOn={isMicOn}
            isScreenSharing={isScreenSharing}
            screenSharingEnabled={screenSharingEnabled}
            participants={participants}
            onStartCall={startCall}
            onEndCall={endCall}
            onToggleCamera={toggleCamera}
            onToggleMic={toggleMic}
            onStartScreen={startScreenShare}
            onStopScreen={stopScreenShare}
            currentUser={user}
          />
        </div>

        {/* People */}
        <div className={`${styles.panel} ${activeTab === 'people' ? styles.active : ''}`}>
          <ParticipantsList
            participants={participants}
            allParticipants={currentRoom?.participants || []}
            currentUser={user}
            onMute={muteUser}
            onKick={kickUser}
          />
        </div>

        {/* Manage (admin/moderator/room owner) */}
        {canManage && (
          <div className={`${styles.panel} ${activeTab === 'manage' ? styles.active : ''}`}>
            <div className={styles.managePanel}>

              {/* ── Room Settings ─────────────────────────────────────── */}
              <div className={styles.settingsSection}>
                <h3 className={styles.manageTitle}>⚙️ Room Settings</h3>
                <p className={styles.manageSubtitle}>Control room behaviour for all participants</p>

                <div className={styles.settingsList}>
                  {/* Lock / Unlock room */}
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingLabel}>🔒 Room Lock</span>
                      <span className={styles.settingDesc}>
                        {roomLocked
                          ? 'Room is locked — new users cannot join'
                          : 'Room is open — assigned users can join freely'}
                      </span>
                    </div>
                    <button
                      className={`${styles.toggleBtn} ${roomLocked ? styles.toggleOn : styles.toggleOff}`}
                      onClick={handleLockToggle}
                    >
                      {roomLocked ? 'Locked' : 'Unlocked'}
                    </button>
                  </div>

                  {/* Screen sharing */}
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingLabel}>🖥 Screen Sharing</span>
                      <span className={styles.settingDesc}>
                        {screenSharingEnabled
                          ? 'All participants can share their screen'
                          : 'Screen sharing is disabled — only admin/moderator can share'}
                      </span>
                    </div>
                    <button
                      className={`${styles.toggleBtn} ${screenSharingEnabled ? styles.toggleOn : styles.toggleOff}`}
                      onClick={handleScreenSharingToggle}
                      disabled={togglingScreen}
                    >
                      {togglingScreen ? '...' : screenSharingEnabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Participants ──────────────────────────────────────── */}
              <div className={styles.participantsSection}>
                <h3 className={styles.manageTitle}>👥 Manage Participants</h3>
                <p className={styles.manageSubtitle}>Add or remove users who can access this room</p>
                <div className={styles.userList}>
                  {allUsers.length === 0 ? (
                    <div className={styles.manageEmpty}>Loading users...</div>
                  ) : (
                    allUsers.map((u) => {
                      const isAdded = participantIds.has(u._id);
                      const isSelf = u._id === user?._id;
                      return (
                        <div key={u._id} className={styles.userRow}>
                          <div className={styles.userRowAvatar}>{u.username[0].toUpperCase()}</div>
                          <div className={styles.userRowInfo}>
                            <span className={styles.userRowName}>{u.username}</span>
                            <span className={styles.userRowRole} style={{
                              color: u.role === 'admin' ? '#ef4444' : u.role === 'moderator' ? '#f59e0b' : '#6366f1'
                            }}>{u.role}</span>
                          </div>
                          {isAdded && <span className={styles.addedBadge}>✓ Added</span>}
                          {!isSelf && (
                            isAdded ? (
                              <button
                                className={styles.removeBtn}
                                onClick={() => handleRemoveParticipant(u._id)}
                                disabled={removingUser === u._id || (user?.role === 'moderator' && u.role === 'admin')}
                                title={user?.role === 'moderator' && u.role === 'admin' ? 'Moderators cannot remove admins' : 'Remove from room'}
                              >
                                {removingUser === u._id ? '...' : 'Remove'}
                              </button>
                            ) : (
                              <button
                                className={styles.addBtn}
                                onClick={() => handleAddParticipant(u._id)}
                                disabled={addingUser === u._id}
                              >
                                {addingUser === u._id ? '...' : '+ Add'}
                              </button>
                            )
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;
