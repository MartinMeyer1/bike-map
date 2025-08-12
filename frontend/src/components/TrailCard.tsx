import React, { memo } from 'react';
import { MVTTrail, User, TrailEngagement } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { Button, Badge } from './ui';
import styles from './TrailCard.module.css';

interface TrailCardProps {
  trail: MVTTrail;
  isSelected: boolean;
  user: User | null;
  engagement?: TrailEngagement;
  onTrailClick: (trail: MVTTrail) => void;
  onEditTrailClick: (trail: MVTTrail) => void;
  onDownloadGPX: (trail: MVTTrail) => void;
  onShowQRCode: (trail: MVTTrail) => void;
  onShowRatingsComments?: (trail: MVTTrail) => void;
}

export const TrailCard: React.FC<TrailCardProps> = memo(({
  trail,
  isSelected,
  user,
  engagement,
  onTrailClick,
  onEditTrailClick,
  onDownloadGPX,
  onShowQRCode,
  onShowRatingsComments
}) => {
  const ownerInfo = trail.ownerInfo;

  const handleClick = () => {
    onTrailClick(trail);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownloadGPX(trail);
  };

  const handleQRCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowQRCode(trail);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditTrailClick(trail);
  };

  const handleRatingsComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowRatingsComments?.(trail);
  };

  const canEdit = user && PocketBaseService.canEditTrail(trail, user);

  return (
    <div
      className={`${styles.trailCard} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      title="Click to center on map"
    >
      {/* Header section */}
      <div className={styles.header}>
        <h4 className={styles.title}>{trail.name}</h4>
        <div className={styles.badgeContainer}>
          <Badge level={trail.level} />
          {isSelected && <div className={styles.selectedIndicator} />}
        </div>
      </div>

      {/* Tags */}
      {trail.tags && trail.tags.length > 0 && (
        <div className={styles.tags}>
          {isSelected ? 
            trail.tags.map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            )) :
            (trail.tags.slice(0, 2).map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            )).concat(
              trail.tags.length > 2 ? [
                <span key="more" className={styles.moreTag}>
                  +{trail.tags.length - 2} more
                </span>
              ] : []
            ))
          }
        </div>
      )}

      {/* Trail stats */}
      <div className={`${styles.stats} ${isSelected ? styles.expanded : ''}`}>
        {trail.elevation ? (
          <>
            <div className={styles.elevationGain}>
              <span>▲</span>
              <span>{Math.round(trail.elevation.gain)}m</span>
            </div>
            <div className={styles.elevationLoss}>
              <span>▼</span>
              <span>{Math.round(trail.elevation.loss)}m</span>
            </div>
          </>
        ) : (
          <span className={styles.gpxAvailable}>📁 GPX available</span>
        )}
        
        {/* Ratings and Comments Button */}
        {engagement && onShowRatingsComments && (
          <button 
            className={styles.engagementButton}
            onClick={handleRatingsComments}
            title="View ratings and comments"
          >
            <div className={styles.engagementStats}>
              {engagement.ratingStats.count > 0 ? (
                <span className={styles.ratingDisplay}>
                  ⭐ {engagement.ratingStats.average.toFixed(1)} ({engagement.ratingStats.count})
                </span>
              ) : (
                <span className={styles.noRating}>⭐ No ratings</span>
              )}
              <span className={styles.commentDisplay}>
                💬 {engagement.commentCount}
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Expanded content when selected */}
      {isSelected && (
        <div className={styles.expandedContent}>
          {/* Metadata section */}
          <div className={styles.metadata}>
            <div className={styles.metadataItem}>
              <span className={styles.metadataLabel}>Created:</span>
              <span className={styles.metadataValue}>
                {new Date(trail.created).toLocaleDateString()}
              </span>
            </div>
            
            {ownerInfo && (
              <div className={styles.metadataItem}>
                <span className={styles.metadataLabel}>Author:</span>
                <span className={styles.metadataValue}>
                  {ownerInfo.name || ownerInfo.email || 'Unknown'}
                </span>
              </div>
            )}
          </div>
          
          {/* Description */}
          {trail.description && (
            <div className={styles.description}>
              <div className={styles.descriptionLabel}>Description</div>
              <div className={styles.descriptionText}>
                {trail.description}
              </div>
            </div>
          )}
          
          {/* Action buttons */}
          <div className={`${styles.actions} ${canEdit ? styles.threeColumns : styles.twoColumns}`}>
            <Button
              variant="success"
              size="small"
              onClick={handleDownload}
            >
              📥 GPX
            </Button>
            
            <Button
              variant="purple"
              size="small"
              onClick={handleQRCode}
            >
              📱 QR
            </Button>
            
            {canEdit && (
              <Button
                variant="warning"
                size="small"
                onClick={handleEdit}
                title="Edit trail"
              >
                ✏️ Edit
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

TrailCard.displayName = 'TrailCard';