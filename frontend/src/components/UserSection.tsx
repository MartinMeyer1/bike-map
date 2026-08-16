import { useState } from 'react';
import { User } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { getErrorMessage } from '../utils/errorHandling';
import UsernameEditModal from './UsernameEditModal';
import { Button } from './ui';
import styles from './UserSection.module.css';

interface UserSectionProps {
  user: User | null;
}

const roleClass: Record<string, string> = {
  Admin: styles.roleAdmin,
  Editor: styles.roleEditor,
};

export default function UserSection({ user }: UserSectionProps) {
  const { login, logout, updateUser, setError } = useAppContext();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  if (!user) {
    return (
      <div className={`${styles.card} ${styles.guestCard}`}>
        <div className={styles.guestHeader}>
          <div className={styles.guestTitle}>Welcome to BikeMap!</div>
          <div className={styles.guestSubtitle}>Sign in to upload and manage trails</div>
        </div>

        <div className={styles.guestBody}>
          <button className={styles.googleButton} onClick={handleLogin}>
            🔐 Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const role = user.role || 'Viewer';

  return (
    <>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.identity}>
            <div className={styles.onlineDot}></div>
            <strong className={styles.name}>{user.name || user.email}</strong>
          </div>

          <button
            className={styles.collapseButton}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand user section' : 'Collapse user section'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>

        {!isCollapsed && (
          <div className={styles.body}>
            <div className={styles.usernameRow}>
              <div className={styles.username}>{user.name || user.email}</div>
              <Button
                variant="warning"
                size="small"
                className={styles.editButton}
                onClick={() => setShowUsernameEdit(true)}
                title="Edit username"
              >
                ✏️ Edit
              </Button>
            </div>

            <div className={styles.roleRow}>
              <span className={styles.roleLabel}>Role</span>
              <span className={`${styles.roleBadge} ${roleClass[role] || ''}`}>{role}</span>
            </div>

            <Button
              variant="secondary"
              className={styles.signOutButton}
              onClick={logout}
            >
              🚪 Sign Out
            </Button>
          </div>
        )}
      </div>

      <UsernameEditModal
        isVisible={showUsernameEdit}
        user={user}
        onClose={() => setShowUsernameEdit(false)}
        onUserUpdated={updateUser}
      />
    </>
  );
}
