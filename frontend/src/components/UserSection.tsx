import { useState } from 'react';
import { User } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { getErrorMessage } from '../utils/errorHandling';
import UsernameEditModal from './UsernameEditModal';
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
      <div className={styles.card}>
        <div className={styles.guestHeader}>
          <div className={styles.guestTitle}>Welcome to BikeMap!</div>
          <div className={styles.guestSubtitle}>Sign in to upload and manage trails</div>
        </div>

        <div className={styles.guestBody}>
          <button type="button" className={styles.signInButton} onClick={handleLogin}>
            SIGN IN WITH GOOGLE
          </button>
        </div>
      </div>
    );
  }

  const role = user.role || 'Viewer';

  return (
    <>
      <div className={styles.card}>
        <button
          type="button"
          className={styles.summary}
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
        >
          <span className={styles.identity}>
            <span className={styles.onlineDot} aria-hidden="true"></span>
            <span className={styles.name}>{user.name || user.email}</span>
          </span>
          <span className={styles.caret} aria-hidden="true">
            {isCollapsed ? '▼' : '▲'}
          </span>
        </button>

        {!isCollapsed && (
          <div className={styles.body}>
            <div className={styles.roleRow}>
              <span className={styles.roleLabel}>ROLE</span>
              <span className={`${styles.roleBadge} ${roleClass[role] || ''}`}>
                {role.toUpperCase()}
              </span>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                onClick={() => setShowUsernameEdit(true)}
                title="Edit username"
              >
                EDIT NAME
              </button>
              <button type="button" className={styles.action} onClick={logout}>
                SIGN OUT
              </button>
            </div>
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
