import React, { useState, useCallback } from 'react';
import { User } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { getErrorMessage } from '../utils/errorHandling';
import UsernameEditModal from './UsernameEditModal';
import { InfoModal } from './InfoModal';
import { Button, Badge } from './ui';
import styles from './MobileHeader.module.css';

interface MobileHeaderProps {
  user: User | null;
  onAddTrailClick: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  user,
  onAddTrailClick
}) => {
  const { login, logout, updateUser, setError } = useAppContext();
  const [showMenu, setShowMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);

  const handleMenuToggle = useCallback(() => {
    setShowMenu(prev => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  const handleToggleInfoModal = useCallback(() => {
    setShowInfoModal(prev => !prev);
  }, []);

  const handleAddTrailClick = useCallback(() => {
    onAddTrailClick();
    setShowMenu(false); // Close menu after action
  }, [onAddTrailClick]);

  const handleUserUpdated = (updatedUser: User) => {
    updateUser(updatedUser);
  };

  return (
    <>
      {/* Header Bar */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          <img src="/rock.svg" alt="BikeMap" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '6px' }} />
          BikeMap
        </h1>
        <button
          className={styles.menuButton}
          onClick={handleMenuToggle}
          aria-label="Open menu"
        >
          <span className={styles.hamburger}></span>
          <span className={styles.hamburger}></span>
          <span className={styles.hamburger}></span>
        </button>
      </div>

      {/* Menu Overlay and Drawer */}
      {showMenu && (
        <>
          <div className={styles.overlay} onClick={handleCloseMenu} />
          <div className={styles.menuDrawer}>
            {/* Menu Header */}
            <div className={styles.menuHeader}>
              <h2 className={styles.menuTitle}>
                <img src="/rock.svg" alt="BikeMap" style={{ width: '24px', height: '24px', verticalAlign: 'middle', marginRight: '6px' }} />
                BikeMap
              </h2>
              <button
                className={styles.closeButton}
                onClick={handleCloseMenu}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            {/* Menu Content */}
            <div className={styles.menuContent}>
              {/* User Section - Expanded by default */}
              <div className={styles.userSection}>
                {!user ? (
                  // Guest user - show login button
                  <div className={styles.guestSection}>
                    <div className={styles.guestHeader}>
                      <div className={styles.guestTitle}>Welcome to BikeMap!</div>
                      <div className={styles.guestSubtitle}>Sign in to upload and manage trails</div>
                    </div>
                    
                    <button 
                      onClick={async () => {
                        try {
                          await login();
                          setShowMenu(false);
                        } catch (error) {
                          console.error('Login failed:', error);
                          setError(getErrorMessage(error));
                        }
                      }}
                      className={styles.loginButton}
                    >
                      🔐 Sign in with Google
                    </button>
                  </div>
                ) : (
                  // Authenticated user - show expanded info
                  <div className={styles.userInfo}>
                    <div className={styles.userHeader}>
                      <div className={styles.userStatus}></div>
                      <strong className={styles.userName}>{user.name || user.email}</strong>
                    </div>
                    
                    <div className={styles.userDetails}>
                      <div className={styles.userNameRow}>
                        <div className={styles.userNameDisplay}>{user.name || user.email}</div>
                        <button
                          onClick={() => setShowUsernameEdit(true)}
                          className={styles.editButton}
                          title="Edit username"
                        >
                          ✏️ Edit
                        </button>
                      </div>

                      <div className={styles.roleRow}>
                        <span className={styles.roleLabel}>Role</span>
                        <span className={`${styles.roleBadge} ${styles[`role${user.role}`]}`}>
                          {user.role || 'Viewer'}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => {
                          logout();
                          setShowMenu(false);
                        }}
                        className={styles.signOutButton}
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Spacer to push content to bottom */}
              <div className={styles.spacer}></div>

              {/* Action Buttons Row - Right above difficulty legend */}
              <div className={styles.actionRow}>
                {user && (user.role === 'Editor' || user.role === 'Admin') && (
                  <Button 
                    variant="success"
                    size="medium"
                    onClick={handleAddTrailClick}
                    title="Add new trail"
                  >
                    ➕ Add Trail
                  </Button>
                )}
                
                <button
                  onClick={handleToggleInfoModal}
                  className={styles.infoButton}
                  title="App Information"
                >
                  ℹ️ App Info
                </button>
              </div>

              {/* Difficulty Legend */}
              <div className={styles.legend}>
                <div className={styles.legendTitle}>
                  <strong>Difficulty Legend:</strong>
                </div>
                <div className={styles.legendBadges}>
                  <Badge level="S0" />
                  <Badge level="S1" />
                  <Badge level="S2" />
                  <Badge level="S3" />
                  <Badge level="S4" />
                  <Badge level="S5" />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Information Modal */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={handleToggleInfoModal}
      />

      {/* Username Edit Modal */}
      {user && (
        <UsernameEditModal
          isVisible={showUsernameEdit}
          user={user}
          onClose={() => setShowUsernameEdit(false)}
          onUserUpdated={handleUserUpdated}
        />
      )}
    </>
  );
};