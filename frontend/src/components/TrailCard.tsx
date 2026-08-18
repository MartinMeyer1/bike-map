import React, { memo } from "react";
import { MVTTrail, User, TrailEngagement, Trail } from "../types";
import { PocketBaseService } from "../services/pocketbase";
import { useTrailDetails, useTrailElevation } from "../hooks";
import { Badge } from "./ui";
import {
  TrailElevation,
  TrailEngagementButton,
  TrailMetadata,
  TrailProfile,
  TrailTagLine,
  UnconfirmedMark,
} from "./TrailDetails";
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

/**
 * One line of the register. Collapsed it shows grade, name, tags and the
 * numbers; selected it opens to the elevation silhouette, provenance,
 * description and actions.
 */
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

    // Derived from the GPX, so it only starts loading once the record above has
    // arrived with the file name.
    const elevationSamples = useTrailElevation(detailedTrail);

    // Row-level clicks select the trail, so the buttons inside must not bubble.
    const stopPropagation =
      (action: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        action();
      };

    const canEdit = user && PocketBaseService.canEditTrail(trail, user);

    return (
      <div
        className={`${styles.row} ${isSelected ? styles.selected : ""}`}
        onClick={() => onTrailClick(trail)}
        title="Click to centre on map"
      >
        <div className={styles.header}>
          <Badge level={trail.level} outlined={!trail.ridden} />

          <div className={styles.identity}>
            <h4 className={styles.title}>{trail.name}</h4>
            <TrailTagLine tags={trail.tags} />
          </div>

          {!trail.ridden && <UnconfirmedMark />}
        </div>

        <div className={styles.stats}>
          <TrailElevation elevation={trail.elevation} />

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
          <div className={styles.expanded}>
            {trailLoading ? (
              <div className={styles.loadingState}>Loading trail details…</div>
            ) : trailError ? (
              <div className={styles.errorState}>Failed to load trail details</div>
            ) : detailedTrail ? (
              <>
                <TrailProfile samples={elevationSamples} />
                <TrailMetadata trail={detailedTrail} distance={trail.distance} />
              </>
            ) : null}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                disabled={!detailedTrail}
                onClick={stopPropagation(
                  () => detailedTrail && onDownloadGPX(detailedTrail),
                )}
              >
                GPX
              </button>

              <button
                type="button"
                className={styles.action}
                disabled={!detailedTrail}
                onClick={stopPropagation(
                  () => detailedTrail && onShowQRCode(detailedTrail),
                )}
              >
                QR
              </button>

              {canEdit && (
                <button
                  type="button"
                  className={`${styles.action} ${styles.actionPrimary}`}
                  onClick={stopPropagation(() => onEditTrailClick(trail))}
                  title="Edit trail"
                >
                  EDIT
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

TrailCard.displayName = "TrailCard";
