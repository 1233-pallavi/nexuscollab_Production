import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import styles from './AdminDashboard.module.css';

const ROLE_COLORS = { admin: '#ef4444', moderator: '#f59e0b', user: '#6366f1' };

const StatCard = ({ icon, label, value, color }) => (
  <div className={styles.statCard} style={{ '--accent': color }}>
    <div className={styles.statIcon}>{icon}</div>
    <div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  </div>
);

const formatTime = (ts) => new Date(ts).toLocaleString();
const timeAgo = (ts) => {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

const TYPE_ICONS = {
  login: '🔐', logout: '🚪', join_room: '➡️', leave_room: '⬅️',
  call_start: '📞', call_end: '📵', user_kicked: '🚫',
  user_muted: '🔇', room_created: '🏠', room_deleted: '🗑', screen_share: '🖥',
  user_created: '👤', user_deactivated: '🚫', user_activated: '✅', role_change: '🔄'
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [expandedRoom, setExpandedRoom] = useState(null);

  // Delete room modal
  const [deleteTarget, setDeleteTarget] = useState(null); // { _id, name }
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const { data: res } = await adminAPI.getDashboard();
      setData(res);
      setError('');
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncRooms = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const { data: res } = await adminAPI.syncRooms();
      setSyncMsg(res.message || 'Sync complete');
      load();
    } catch {
      setSyncMsg('Sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  };

  const confirmDeleteRoom = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminAPI.deleteRoom(deleteTarget._id);
      setData(prev => ({
        ...prev,
        allRooms: prev.allRooms.filter(r => r._id !== deleteTarget._id),
        stats: { ...prev.stats, totalRooms: prev.stats.totalRooms - 1 }
      }));
    } catch {
      // reload to get fresh state
      load();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>⚡ NexusCollab</div>
        <nav className={styles.nav}>
          <button className={styles.navItem} onClick={() => navigate('/dashboard')}>🏠 Rooms</button>
          <button className={`${styles.navItem} ${styles.active}`}>📊 Dashboard</button>
          <button className={styles.navItem} onClick={() => navigate('/admin/users')}>👥 Users</button>
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.footerUser}>
            <span className={styles.footerUsername}>{user?.username}</span>
            <span className={styles.footerRole} style={{ color: ROLE_COLORS[user?.role] }}>
              {user?.role}
            </span>
          </div>
          <button className={styles.logoutBtn} onClick={logout} title="Logout">⏻</button>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Admin Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={handleSyncRooms} disabled={syncing} className={styles.syncBtn}>
              {syncing ? 'Syncing...' : '🔄 Sync Rooms'}
            </button>
            {syncMsg && <span className={styles.syncMsg}>{syncMsg}</span>}
            <span className={styles.refreshNote}>Auto-refreshes every 15s</span>
          </div>
        </header>

        {loading ? (
          <div className={styles.loading}>Loading dashboard...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <>
            {/* Stats */}
            <div className={styles.stats}>
              <StatCard icon="👥" label="Total Users"  value={data.stats.totalUsers}  color="#6366f1" />
              <StatCard icon="🌐" label="Online Now"   value={data.stats.onlineUsers}  color="#22c55e" />
              <StatCard icon="🏠" label="Total Rooms"  value={data.stats.totalRooms}   color="#f59e0b" />
              <StatCard icon="🔴" label="Active Rooms" value={data.stats.activeRooms}  color="#ef4444" />
              <StatCard icon="📞" label="Active Calls" value={data.stats.activeCalls}  color="#a855f7" />
            </div>

            {/* ── Rooms Management Table ─────────────────────────────────── */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>🏠 Room Management</h2>
                <button className={styles.newRoomBtn} onClick={() => navigate('/dashboard')}>
                  + New Room
                </button>
              </div>
              {!data.allRooms || data.allRooms.length === 0 ? (
                <p className={styles.tableEmpty}>No rooms yet</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Owner</th>
                        <th>Members</th>
                        <th>Flags</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.allRooms.map((room) => (
                        <tr key={room._id}>
                          <td>
                            <div className={styles.roomCell}>
                              <span className={styles.roomCellIcon}>#</span>
                              <div>
                                <span className={styles.roomCellName}>{room.name}</span>
                                {room.description && (
                                  <span className={styles.roomCellDesc}>{room.description}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={styles.ownerCell}>
                            {room.createdBy?.username || '—'}
                          </td>
                          <td className={styles.memberCell}>
                            {room.participants?.length || 0}
                          </td>
                          <td>
                            <div className={styles.flagsCell}>
                              {room.isPrivate && <span className={styles.flagBadge} style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>Private</span>}
                              {room.isLocked && <span className={styles.flagBadge} style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>Locked</span>}
                              {!room.isPrivate && !room.isLocked && <span className={styles.flagBadge} style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>Open</span>}
                            </div>
                          </td>
                          <td className={styles.dateCell}>
                            {new Date(room.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <button
                              className={styles.tableDeleteBtn}
                              onClick={() => setDeleteTarget({ _id: room._id, name: room.name })}
                              title="Delete room"
                            >
                              🗑 Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Three-column grid */}
            <div className={styles.columns3}>

              {/* Active Sessions */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>👥 All Sessions</h2>
                {!data.onlineSessions || data.onlineSessions.length === 0 ? (
                  <p className={styles.empty}>No users found</p>
                ) : (
                  <div className={styles.sessionList}>
                    {data.onlineSessions.map((s) => (
                      <div key={s._id} className={styles.sessionRow}>
                        <div className={styles.sessionAvatar}
                          style={{ background: s.isOnline ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#1e2330' }}>
                          {s.username[0].toUpperCase()}
                        </div>
                        <div className={styles.sessionInfo}>
                          <span className={styles.sessionName}>{s.username}</span>
                          <span className={styles.sessionRole} style={{ color: ROLE_COLORS[s.role] }}>{s.role}</span>
                        </div>
                        <div className={styles.sessionMeta}>
                          {s.isOnline ? (
                            s.currentRoom
                              ? <span className={styles.inRoomBadge}>📍 {s.currentRoom}</span>
                              : <span className={styles.inRoomBadge} style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>● online</span>
                          ) : (
                            <span className={styles.idleBadge}>○ offline</span>
                          )}
                          <span className={styles.sessionTime}>{timeAgo(s.lastSeen)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Rooms (expandable) */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>🔴 Active Rooms</h2>
                {data.activeRooms.length === 0 ? (
                  <p className={styles.empty}>No active rooms</p>
                ) : (
                  <div className={styles.roomList}>
                    {data.activeRooms.map((room) => (
                      <div key={room._id} className={styles.roomItem}>
                        <div
                          className={styles.roomItemHeader}
                          onClick={() => setExpandedRoom(expandedRoom === room._id ? null : room._id)}
                        >
                          <div>
                            <strong>{room.name}</strong>
                            <span className={styles.roomMeta}>{room.activeParticipants?.length || 0} in room</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {room.activeCall?.isActive && <span className={styles.callBadge}>📞 Call</span>}
                            <span className={styles.expandIcon}>{expandedRoom === room._id ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {expandedRoom === room._id && (
                          <div className={styles.roomParticipants}>
                            {room.activeParticipants.map((ap, i) => (
                              <div key={i} className={styles.apRow}>
                                <span className={styles.apDot}>●</span>
                                <span className={styles.apName}>{ap.userId?.username || ap.username || 'Unknown'}</span>
                                <span className={styles.apRole} style={{ color: ROLE_COLORS[ap.userId?.role || 'user'] }}>
                                  {ap.userId?.role || 'user'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>📋 Recent Activity</h2>
                {data.recentActivity.length === 0 ? (
                  <p className={styles.empty}>No recent activity</p>
                ) : (
                  <div className={styles.activityList}>
                    {data.recentActivity.map((log, i) => (
                      <div key={i} className={styles.activityItem}>
                        <span className={styles.activityIcon}>{TYPE_ICONS[log.type] || '•'}</span>
                        <div className={styles.activityContent}>
                          <span className={styles.activityUser}>{log.username}</span>
                          <span className={styles.activityType}>{log.type.replace(/_/g, ' ')}</span>
                          {log.roomName && <span className={styles.activityRoom}>in {log.roomName}</span>}
                          {log.details && <span className={styles.activityDetails}>{log.details}</span>}
                        </div>
                        <span className={styles.activityTime}>{formatTime(log.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </main>

      {/* ── Delete Room Confirm Modal ──────────────────────────────────────── */}
      {deleteTarget && (
        <div className={styles.overlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🗑️</div>
            <h2 className={styles.confirmTitle}>Delete Room</h2>
            <p className={styles.confirmMsg}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              <br />
              All messages and history will be permanently removed.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </button>
              <button className={styles.dangerBtn} onClick={confirmDeleteRoom} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
