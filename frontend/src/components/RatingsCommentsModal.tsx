import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { MVTTrail, User, TrailCommentWithUser, RatingStats } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { useAppContext } from '../hooks/useAppContext';
import { Modal, Button } from './ui';
import styles from './RatingsCommentsModal.module.css';
import { formatDate } from '../utils/format';

interface RatingsCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trail: MVTTrail | null;
  user: User | null;
}

const STARS = [1, 2, 3, 4, 5];

export const RatingsCommentsModal: React.FC<RatingsCommentsModalProps> = ({
  isOpen,
  onClose,
  trail,
  user
}) => {
  const [comments, setComments] = useState<TrailCommentWithUser[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats>({ count: 0, average: 0 });

  // Access app context for MVT refresh
  const { refreshMVTLayer } = useAppContext();
  const [userRating, setUserRating] = useState<number>(0);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, startTransition] = useTransition();

  const loadData = useCallback(async (isInitialLoad = true) => {
    if (!trail) return;

    if (!isInitialLoad) {
      setRefreshing(true);
    }

    try {
      const [commentsData, statsData] = await Promise.all([
        PocketBaseService.getTrailComments(trail.id),
        PocketBaseService.getTrailRatingStats(trail.id, user?.id)
      ]);

      setComments(commentsData);
      setRatingStats(statsData);
      setUserRating(statsData.userRating || 0);
    } catch (error) {
      console.error('Failed to load ratings and comments:', error);
    } finally {
      if (!isInitialLoad) {
        setRefreshing(false);
      }
    }
  }, [trail, user]);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && trail) {
      startTransition(() => loadData());
    }
  }, [isOpen, trail, loadData]);

  const handleRatingClick = async (rating: number) => {
    if (!trail || !user || submitting) return;

    setSubmitting(true);
    try {
      await PocketBaseService.upsertTrailRating(trail.id, rating);
      await loadData(false); // Refresh data without loading state

      // Refresh MVT layer to update engagement data
      refreshMVTLayer();
    } catch (error) {
      console.error('Failed to update rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trail || !user || !newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      await PocketBaseService.createTrailComment(trail.id, newComment.trim());
      setNewComment('');
      await loadData(false); // Refresh data without loading state

      // Refresh MVT layer to update engagement data
      refreshMVTLayer();
    } catch (error) {
      console.error('Failed to create comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = (commentId: string, currentText: string) => {
    setEditingComment(commentId);
    setEditingCommentText(currentText);
  };

  const handleUpdateComment = async () => {
    if (!editingComment || !editingCommentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      await PocketBaseService.updateTrailComment(editingComment, editingCommentText.trim());
      setEditingComment(null);
      setEditingCommentText('');
      await loadData(false); // Refresh data without loading state

      // Refresh MVT layer to update engagement data
      refreshMVTLayer();
    } catch (error) {
      console.error('Failed to update comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!submitting && confirm('Are you sure you want to delete this comment?')) {
      setSubmitting(true);
      try {
        await PocketBaseService.deleteTrailComment(commentId);
        await loadData(false); // Refresh data without loading state

        // Refresh MVT layer to update engagement data
        refreshMVTLayer();
      } catch (error) {
        console.error('Failed to delete comment:', error);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const canEditComment = (comment: TrailCommentWithUser) => {
    return user && (user.id === comment.user || user.role === 'Admin');
  };

  if (!trail) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="medium"
      eyebrow="RATINGS & COMMENTS"
      title={trail.name}
    >
      {loading ? (
        <div className={styles.loading}>LOADING…</div>
      ) : (
        <div className={styles.sections}>
          {refreshing && <div className={styles.refreshing}>UPDATING…</div>}

          <section>
            <div className={styles.sectionLabel}>RATINGS</div>

            <div className={styles.ratings}>
              <div className={styles.average}>
                {ratingStats.count > 0 ? (
                  <>
                    <div className={styles.averageValue}>
                      <span className={styles.averageNumber}>
                        {ratingStats.average.toFixed(1)}
                      </span>
                      <span className={styles.averageOutOf}>/5</span>
                    </div>
                    <div className={styles.averageStars} aria-hidden="true">
                      {STARS.map((star) => (
                        <span
                          key={star}
                          className={
                            star <= Math.round(ratingStats.average) ? undefined : styles.starEmpty
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <div className={styles.averageCount}>
                      {ratingStats.count} RATING{ratingStats.count !== 1 ? 'S' : ''}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.averageValue}>
                      <span className={styles.averageNumber}>—</span>
                    </div>
                    <div className={styles.noRatings}>NO RATINGS YET</div>
                  </>
                )}
              </div>

              <div className={styles.own}>
                <div className={styles.sectionLabel}>YOUR RATING</div>

                {user ? (
                  <>
                    <div className={styles.stars}>
                      {STARS.map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`${styles.star} ${star <= userRating ? styles.starFilled : ''}`}
                          onClick={() => handleRatingClick(star)}
                          disabled={submitting}
                          aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                          aria-pressed={star <= userRating}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <div className={styles.ownNote}>
                      {userRating > 0
                        ? `You rated this trail ${userRating} star${userRating !== 1 ? 's' : ''}`
                        : 'Not rated yet'}
                    </div>
                  </>
                ) : (
                  <div className={styles.signInNote}>SIGN IN TO RATE THIS TRAIL</div>
                )}
              </div>
            </div>
          </section>

          <section>
            <div className={styles.sectionLabel}>COMMENTS ({comments.length})</div>

            {user ? (
              <form onSubmit={handleCommentSubmit} className={styles.commentForm}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts about this trail..."
                  className={styles.commentInput}
                  rows={2}
                  maxLength={1000}
                  disabled={submitting}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="small"
                  disabled={!newComment.trim() || submitting}
                >
                  {submitting ? 'Posting…' : 'Post comment'}
                </Button>
              </form>
            ) : (
              <div className={styles.signInNote}>SIGN IN TO COMMENT ON THIS TRAIL</div>
            )}

            <div className={styles.commentList}>
              {comments.length === 0 ? (
                <div className={styles.noComments}>
                  NO COMMENTS YET — BE THE FIRST TO SHARE YOUR EXPERIENCE
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className={styles.comment}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentAuthor}>
                        {comment.expand?.user?.name || comment.expand?.user?.email || 'Anonymous'}
                      </span>
                      <span className={styles.commentDate}>
                        {formatDate(comment.created)}
                      </span>
                      {canEditComment(comment) && (
                        <span className={styles.commentActions}>
                          <button
                            type="button"
                            onClick={() => handleEditComment(comment.id, comment.comment)}
                            className={styles.commentAction}
                            disabled={submitting}
                          >
                            EDIT
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(comment.id)}
                            className={`${styles.commentAction} ${styles.commentActionDanger}`}
                            disabled={submitting}
                          >
                            DELETE
                          </button>
                        </span>
                      )}
                    </div>

                    {editingComment === comment.id ? (
                      <div className={styles.editing}>
                        <textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className={styles.commentInput}
                          rows={2}
                          maxLength={1000}
                          disabled={submitting}
                        />
                        <div className={styles.editActions}>
                          <Button
                            onClick={handleUpdateComment}
                            variant="primary"
                            size="small"
                            disabled={!editingCommentText.trim() || submitting}
                          >
                            Save
                          </Button>
                          <Button
                            onClick={() => setEditingComment(null)}
                            variant="secondary"
                            size="small"
                            disabled={submitting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className={styles.commentText}>{comment.comment}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
};
