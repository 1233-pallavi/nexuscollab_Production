import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import styles from './AdminUsers.module.css';

const ROLE_COLORS = { admin: '#ef4444', moderator: '#f59e0b', user: '#6366f1' };

const EMPTY_FORM = { username: '', email: '', password: '', role: 'user' };

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user: currentUser, logout } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Deactivate confirm modal
  const [deactivateTarget, setDeactivateTarget] = useState(null); // { _id, username }
  const [deactivating, setDeactivating] = useState(false);

  // Delete confirm modal
  const [deleteTarget, setDeleteTarget] = useState(null); // { _id, username }
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    usersAPI.getAll().then(({ data }) => {
      setUsers(data.users);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Create user ────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      return setFormError('All fields are required');
    }
    if (form.password.length < 6) {
      return setFormError('Password must be at least 6 characters');
    }
    setCreating(true);
    try {
      const { data } = await usersAPI.create(form);
      setUsers((prev) => [data.user, ...prev]);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      showToast(`User "${data.user.username}" created successfully`);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // ── Role change ────────────────────────────────────────────────────────────
  const handleRoleChange = async (userId, newRole) => {
    try {
      await usersAPI.updateRole(userId, newRole);
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, role: newRole } : u));
      showToast('Role updated');
    } catch {
      showToast('Failed to update role');
    }
  };

  // ── Deactivate (via custom modal) ──────────────────────────────────────────
  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await usersAPI.deactivate(deactivateTarget._id);
      setUsers((prev) => prev.map((u) =>
        u._id === deactivateTarget._id ? { ...u, isActive: false } : u
      ));
      showToast(`${deactivateTarget.username} deactivated`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to deactivate user');
    } finally {
      setDeactivating(false);
      setDeactivateTarget(null);
    }
  };

  // ── Hard Delete ────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersAPI.deleteUser(deleteTarget._id);
      setUsers((prev) => prev.filter((u) => u._id !== deleteTarget._id));
      showToast(`User "${deleteTarget.username}" permanently deleted`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── Activate ───────────────────────────────────────────────────────────────
  const handleActivate = async (userId, username) => {
    try {
      await usersAPI.activate(userId);
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isActive: true } : u));
      showToast(`${username} activated`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to activate user');
    }
  };

  const filtered = users.filter(
    (u) =>
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.layout}>
      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      <aside className={styles.sidebar}>
        <div className={styles.logo}>⚡ NexusCollab</div>
        <nav className={styles.nav}>
          <button className={styles.navItem} onClick={() => navigate('/dashboard')}>🏠 Rooms</button>
          <button className={styles.navItem} onClick={() => navigate('/admin')}>📊 Dashboard</button>
          <button className={`${styles.navItem} ${styles.active}`}>👥 Users</button>
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.footerUser}>
            <span className={styles.footerUsername}>{currentUser?.username}</span>
            <span className={styles.footerRole} style={{
              color: currentUser?.role === 'admin' ? '#ef4444' : currentUser?.role === 'moderator' ? '#f59e0b' : '#6366f1'
            }}>{currentUser?.role}</span>
          </div>
          <button className={styles.logoutBtn} onClick={logout}>⏻</button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>User Management</h1>
            <p>{users.length} total · {users.filter(u => u.isActive).length} active · {users.filter(u => !u.isActive).length} inactive</p>
          </div>
          <div className={styles.headerActions}>
            <input
              className={styles.search}
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className={styles.createBtn} onClick={() => { setShowCreate(true); setFormError(''); setForm(EMPTY_FORM); }}>
              + New User
            </button>
          </div>
        </header>

        {loading ? (
          <div className={styles.loading}>Loading users...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u._id}
                    className={`${u._id === currentUser?._id ? styles.selfRow : ''} ${!u.isActive ? styles.inactiveRow : ''}`}
                  >
                    <td>
                      <div className={styles.userCell}>
                        <div className={`${styles.avatar} ${!u.isActive ? styles.avatarInactive : ''}`}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div>
                          <span>{u.username}</span>
                          {!u.isActive && <span className={styles.inactiveBadge}>Inactive</span>}
                        </div>
                      </div>
                    </td>
                    <td className={styles.email}>{u.email}</td>
                    <td>
                      <select
                        className={styles.roleSelect}
                        value={u.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        disabled={u._id === currentUser?._id || !u.isActive}
                        style={{ color: ROLE_COLORS[u.role] }}
                      >
                        <option value="user">user</option>
                        <option value="moderator">moderator</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${u.isOnline && u.isActive ? styles.online : styles.offline}`}>
                        {u.isOnline && u.isActive ? '● Online' : '○ Offline'}
                      </span>
                    </td>
                    <td className={styles.date}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      {u._id !== currentUser?._id && (
                        <div className={styles.actionBtns}>
                          {u.isActive ? (
                            <button
                              className={styles.deactivateBtn}
                              onClick={() => setDeactivateTarget({ _id: u._id, username: u.username })}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className={styles.activateBtn}
                              onClick={() => handleActivate(u._id, u.username)}
                            >
                              Activate
                            </button>
                          )}
                          <button
                            className={styles.deleteUserBtn}
                            onClick={() => setDeleteTarget({ _id: u._id, username: u.username })}
                            title="Permanently delete user"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className={styles.empty}>No users found</div>
            )}
          </div>
        )}
      </main>

      {/* ── Deactivate Confirm Modal ─────────────────────────────────────────── */}
      {deactivateTarget && (
        <div className={styles.overlay} onClick={() => !deactivating && setDeactivateTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🚫</div>
            <h2 className={styles.confirmTitle}>Deactivate User</h2>
            <p className={styles.confirmMsg}>
              Are you sure you want to deactivate{' '}
              <strong>{deactivateTarget.username}</strong>?
              <br />
              They will not be able to log in until reactivated.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setDeactivateTarget(null)}
                disabled={deactivating}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={confirmDeactivate}
                disabled={deactivating}
              >
                {deactivating ? 'Deactivating...' : 'Yes, Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className={styles.overlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}>🗑️</div>
            <h2 className={styles.confirmTitle}>Permanently Delete User</h2>
            <p className={styles.confirmMsg}>
              Are you sure you want to permanently delete{' '}
              <strong>{deleteTarget.username}</strong>?
              <br />
              This action <strong>cannot be undone</strong>. The user and all their
              room assignments will be removed forever.
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
                className={styles.deleteConfirmBtn}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create User Modal ────────────────────────────────────────────────── */}
      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Create New User</h2>
            {formError && <div className={styles.formError}>{formError}</div>}
            <form onSubmit={handleCreate}>
              <div className={styles.field}>
                <label>Username *</label>
                <input
                  type="text"
                  placeholder="e.g. johndoe"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  minLength={3}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Email *</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Password *</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={6}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Role</label>
                <select
                  className={styles.roleSelect}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  style={{ color: ROLE_COLORS[form.role], width: '100%', padding: '0.65rem 0.75rem' }}
                >
                  <option value="user">user</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.confirmBtn} disabled={creating}>
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
