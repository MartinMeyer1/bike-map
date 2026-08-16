import React, { memo } from "react";
import { MVTTrail, User, TrailEngagement, Trail } from "../types";
import { PocketBaseService } from "../services/pocketbase";
import { useTrailDetails } from "../hooks";
import { Button, Badge } from "./ui";
import { TrailElevation, TrailEngagementButton, TrailMetadata } from "./TrailDetails";
import styles from "./TrailCard.module.css";

interface TrailCardProps {
  trail: MVTTrail;
  isSelected: boolean;
  user: User | null;
  engagement?: TrailEngagement;
  onTrailClick: (trail: MVTTrail) => void;
  onEditTrailClick: (trail: MVTTrail) => void;
  onDownloadGPX: (trail: Trail) => void;
  onShowQRCode: (trail: Trail) => void;
  onShowRatingsComments?: (trail: MVTTrail) => void;
}

const COLLAPSED_TAG_LIMIT = 2;

export const TrailCard: React.FC<TrailCardProps> = memo(
  ({
    trail,
    isSelected,
    user,
    engagement,
    onTrailClick,
    onEditTrailClick,
    onDownloadGPX,
    onShowQRCode,
    onShowRatingsComments,
  }) => {
    // Fetch detailed trail information when selected
    const {
      trail: detailedTrail,
      loading: trailLoading,
      error: trailError,
    } = useTrailDetails(isSelected ? trail.id : null);

    // Card-level clicks select the trail, so the buttons inside must not bubble.
    const stopPropagation =
      (action: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        action();
      };

    const canEdit = user && PocketBaseService.canEditTrail(trail, user);
    const visibleTags = isSelected ? trail.tags : trail.tags.slice(0, COLLAPSED_TAG_LIMIT);
    const hiddenTagCount = trail.tags.length - visibleTags.length;

    return (
      <div
        className={`${styles.trailCard} ${isSelected ? styles.selected : ""}`}
        onClick={() => onTrailClick(trail)}
        title="Click to center on map"
      >
        <div className={styles.header}>
          <h4 className={styles.title}>{trail.name}</h4>
          <div className={styles.badgeContainer}>
            <Badge level={trail.level} outlined={!trail.ridden} />
            {isSelected && <div className={styles.selectedIndicator} />}
          </div>
        </div>

        {trail.tags && trail.tags.length > 0 && (
          <div className={styles.tags}>
            {visibleTags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
            {hiddenTagCount > 0 && (
              <span className={styles.moreTag}>+{hiddenTagCount} more</span>
            )}
          </div>
        )}

        <div className={`${styles.stats} ${isSelected ? styles.expanded : ""}`}>
          <div className={styles.elevationStats}>
            <TrailElevation elevation={trail.elevation} />
          </div>

          {engagement && onShowRatingsComments && (
            <TrailEngagementButton
              ratingAverage={engagement.ratingStats.average}
              ratingCount={engagement.ratingStats.count}
              commentCount={engagement.commentCount}
              onClick={() => onShowRatingsComments(trail)}
            />
          )}
        </div>

        {isSelected && (
          <div className={styles.expandedContent}>
            {trailLoading ? (
              <div className={styles.loadingState}>Loading trail details...</div>
            ) : trailError ? (
              <div className={styles.errorState}>Failed to load trail details</div>
            ) : detailedTrail ? (
              <TrailMetadata trail={detailedTrail} />
            ) : null}

            <div
              className={`${styles.actions} ${canEdit ? styles.threeColumns : styles.twoColumns}`}
            >
              <Button
                variant="success"
                size="small"
                onClick={stopPropagation(
                  () => detailedTrail && onDownloadGPX(detailedTrail),
                )}
              >
                📥 GPX
              </Button>

              <Button
                variant="purple"
                size="small"
                onClick={stopPropagation(
                  () => detailedTrail && onShowQRCode(detailedTrail),
                )}
              >
                📱 QR
              </Button>

              {canEdit && (
                <Button
                  variant="warning"
                  size="small"
                  onClick={stopPropagation(() => onEditTrailClick(trail))}
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
  },
);

TrailCard.displayName = "TrailCard";
