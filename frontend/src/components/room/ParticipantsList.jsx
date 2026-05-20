import styles from './ParticipantsList.module.css';

const ROLE_COLORS = { admin: '#ef4444', moderator: '#f59e0b', user: '#6366f1' };

/**
 * participants      — socket activeParticipants (who is currently connected)
 * allParticipants   — full room.participants list from REST (everyone assigned)
 * currentUser       — logged-in user
 * onMute / onKick   — moderator actions
 */
const ParticipantsList = ({ participants, allParticipants, currentUser, onMute, onKick }) => {
  const canModerate = ['admin', 'moderator'].includes(currentUser?.role);

  // Build a set of userIds who are currently online (in activeParticipants)
  const onlineIds = new Set(
    participants.map(p => (p.userId?._id || p.userId)?.toString()).filter(Boolean)
  );

  // Use allParticipants (full list) if available, otherwise fall back to socket list
  const displayList = allParticipants && allParticipants.length > 0
    ? allParticipants
    : participants.map(p => ({
        _id: (p.userId?._id || p.userId)?.toString(),
        username: p.userId?.username || p.username,
        role: p.userId?.role || 'user',
        isOnline: true,
        socketId: p.socketId
      }));

  // Deduplicate by _id
  const seen = new Set();
  const uniqueList = displayList.filter(p => {
    const id = p._id?.toString();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Participants</h3>
        <span className={styles.count}>{uniqueList.length}</span>
      </div>

      <div className={styles.list}>
        {uniqueList.length === 0 ? (
          <div className={styles.empty}>No participants in this room</div>
        ) : (
          uniqueList.map((p) => {
            const userId = p._id?.toString();
            const username = p.username;
            const role = p.role || 'user';
            const isOnline = onlineIds.has(userId) || p.isOnline === true;
            const isCurrentUser = userId === currentUser?._id?.toString();

            return (
              <div key={userId} className={styles.participant}>
                <div className={styles.avatar}>
                  {username?.[0]?.toUpperCase()}
                  <div className={`${styles.statusDot} ${isOnline ? styles.online : styles.offline}`} />
                </div>
                <div className={styles.info}>
                  <span className={styles.name}>
                    {username}
                    {isCurrentUser && <span className={styles.you}> (you)</span>}
                  </span>
                  <span className={styles.role} style={{ color: ROLE_COLORS[role] }}>
                    {role}
                  </span>
                </div>
                <span className={`${styles.onlineBadge} ${isOnline ? styles.onlineBadgeActive : styles.onlineBadgeOff}`}>
                  {isOnline ? '● online' : '○ offline'}
                </span>
                {canModerate && !isCurrentUser && isOnline && (
                  <div className={styles.actions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => onMute(userId)}
                      title="Mute user"
                    >
                      🔇
                    </button>
                    {/* Moderators cannot kick admins */}
                    {!(currentUser?.role === 'moderator' && role === 'admin') && (
                      <button
                        className={`${styles.actionBtn} ${styles.kickBtn}`}
                        onClick={() => onKick(userId)}
                        title="Remove from room"
                      >
                        🚫
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ParticipantsList;
