import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRoomStore from '../store/roomStore';
import useAuthStore from '../store/authStore';
import { getSocket } from '../services/socket';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { rooms, fetchRooms, createRoom, deleteRoom, isLoading, unreadCounts, clearUnread } = useRoomStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [newRoom, setNewRoom] = useState({ name: '', description: '', isPrivate: false });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // { _id, name }
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRooms();
    const socket = getSocket();
    if (socket) {
      socket.on('user-status', ({ userId, isOnline }) => {
        setOnlineUsers((prev) => ({ ...prev, [userId]: isOnline }));
      });
      return () => socket.off('user-status');
    }
  }, []);

  const getRoomOnlineCount = (room) => {
    if (!room.participants || room.participants.length === 0) return 0;
    return room.participants.filter((p) => {
      const id = p._id?.toString();
      if (id && id in onlineUsers) return onlineUsers[id];
      return p.isOnline === true;
    }).length;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newRoom.name.trim()) return;
    setCreating(true);
    setCreateError('');
    const result = await createRoom(newRoom);
    setCreating(false);
    if (result.success) {
      setShowCreate(false);
      setNewRoom({ name: '', description: '', isPrivate: false });
    } else {
      setCreateError(result.error || 'Failed to create room');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteRoom(deleteTarget._id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleEnterRoom = (roomId) => {
    clearUnread(roomId);
    navigate(`/room/${roomId}`);
  };

  const getRoleBadge = (role) => {
    const colors = { admin: '#ef4444', moderator: '#f59e0b', user: '#6366f1' };
    return (
      <span className={styles.roleBadge} style={{ background: colors[role] + '22', color: colors[role] }}>
        {role}
      </span>
    );
  };

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span>⚡</span> NexusCollab
        </div>

        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${styles.active}`}>
            <span>🏠</span> Rooms
          </button>
          {user?.role === 'admin' && (
            <button className={styles.navItem} onClick={() => navigate('/admin')}>
              <span>📊</span> Dashboard
            </button>
          )}
          {user?.role === 'admin' && (
            <button className={styles.navItem} onClick={() => navigate('/admin/users')}>
              <span>👥</span> Users
            </button>
          )}
        </nav>

        <div className={styles.sidebarUser}>
          <div className={styles.userAvatar}>{user?.username?.[0]?.toUpperCase()}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.username}</span>
            {getRoleBadge(user?.role)}
          </div>
          <button className={styles.logoutBtn} onClick={logout} title="Logout">⏻</button>
        </div>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Rooms</h1>
            <p>{rooms.length} workspace{rooms.length !== 1 ? 's' : ''} available</p>
          </div>
          {['admin', 'moderator'].includes(user?.role) && (
            <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
              + New Room
            </button>
          )}
        </header>

        {isLoading ? (
          <div className={styles.loading}>Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className={styles.empty}>
            <span>🏠</span>
            <p>No rooms yet. {['admin', 'moderator'].includes(user?.role) ? 'Create the first one!' : 'Ask an admin to create a room.'}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {rooms.map((room) => {
              const unread = unreadCounts[room._id] || 0;
              return (
                <div
                  key={room._id}
                  className={styles.roomCard}
                  onClick={() => handleEnterRoom(room._id)}
                >
                  <div className={styles.roomHeader}>
                    <div className={styles.roomIcon}>#</div>
                    <div className={styles.roomMeta}>
                      {room.isLocked && <span className={styles.lockBadge}>🔒 Locked</span>}
                      {room.isPrivate && <span className={styles.privateBadge}>🔐 Private</span>}
                      {unread > 0 && (
                        <span className={styles.unreadBadge}>{unread > 99 ? '99+' : unread}</span>
                      )}
                    </div>
                  </div>
                  <h3 className={styles.roomName}>{room.name}</h3>
                  {room.description && <p className={styles.roomDesc}>{room.description}</p>}
                  {room.createdBy?.username && (
                    <p className={styles.roomOwner}>👤 {room.createdBy.username}</p>
                  )}
                  <div className={styles.roomFooter}>
                    <span className={styles.participants}>
                      👥 {getRoomOnlineCount(room)} online
                    </span>
                    {['admin', 'moderator'].includes(user?.role) && (
                      <button
                        className={styles.deleteBtn}
                        title="Delete room"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ _id: room._id, name: room.name });
                        }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Delete Room Confirm Modal ──────────────────────────────────────── */}
      {deleteTarget && (
        <div className={styles.overlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🗑️</div>
            <h2 className={styles.confirmTitle}>Delete Room</h2>
            <p className={styles.confirmMsg}>
              Are you sure you want to delete{' '}
              <strong>{deleteTarget.name}</strong>?
              <br />
              All messages and history will be permanently removed.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Room Modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Create Room</h2>
            {createError && <div className={styles.modalError}>{createError}</div>}
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label>Room Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Design Team"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Description</label>
                <input
                  type="text"
                  placeholder="What's this room for?"
                  value={newRoom.description}
                  onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                />
              </div>
              <div className={styles.checkField}>
                <input
                  type="checkbox"
                  id="private"
                  checked={newRoom.isPrivate}
                  onChange={(e) => setNewRoom({ ...newRoom, isPrivate: e.target.checked })}
                />
                <label htmlFor="private">Private room</label>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.confirmBtn} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
