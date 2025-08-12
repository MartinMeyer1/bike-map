import React, { useState, useEffect } from 'react';
import { MVTTrail, User, TrailCommentWithUser, RatingStats } from '../types';
import { PocketBaseService } from '../services/pocketbase';
import { Modal, Button } from './ui';
import styles from './RatingsCommentsModal.module.css';

interface RatingsCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trail: MVTTrail | null;
  user: User | null;
}

export const RatingsCommentsModal: React.FC<RatingsCommentsModalProps> = ({
  isOpen,
  onClose,
  trail,
  user
}) => {
  // const [ratings, setRatings] = useState<TrailRatingWithUser[]>([]);
  const [comments, setComments] = useState<TrailCommentWithUser[]>([]);
  const [ratingStats, setRatingStats] = useState<RatingStats>({ count: 0, average: 0 });
  const [userRating, setUserRating] = useState<number>(0);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && trail) {
      loadData();
    }
  }, [isOpen, trail]);

  const loadData = async (isInitialLoad = true) => {
    if (!trail) return;
    
    if (isInitialLoad) {
      setLoading(true);
    } else {
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
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  const handleRatingClick = async (rating: number) => {
    if (!trail || !user || submitting) return;

    setSubmitting(true);
    try {
      await PocketBaseService.upsertTrailRating(trail.id, rating);
      await loadData(false); // Refresh data without loading state
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

  const renderStars = (rating: number, interactive = false, onStarClick?: (rating: number) => void) => {
    return (
      <div className={`${styles.stars} ${interactive ? styles.interactive : ''}`}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= rating;
          
          return (
            <span
              key={star}
              className={`${styles.star} ${isFilled ? styles.filled : styles.empty}`}
              onClick={interactive && onStarClick ? () => onStarClick(star) : undefined}
            >
              {isFilled ? '★' : '☆'}
            </span>
          );
        })}
      </div>
    );
  };

  if (!trail) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${trail.name} - Ratings & Comments`}>
      <div className={styles.modalContent}>
        {refreshing && (
          <div className={styles.refreshingIndicator}>Updating...</div>
        )}
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            {/* Ratings Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Ratings</h3>
              
              {/* Overall Rating Stats */}
              <div className={styles.ratingOverview}>
                {ratingStats.count > 0 ? (
                  <div className={styles.ratingStats}>
                    <div className={styles.averageRating}>
                      {renderStars(ratingStats.average)}
                      <span className={styles.averageText}>
                        {ratingStats.average.toFixed(1)} ({ratingStats.count} rating{ratingStats.count !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className={styles.noRatings}>No ratings yet</p>
                )}
              </div>

              {/* User Rating */}
              {user ? (
                <div className={styles.userRating}>
                  <h4 className={styles.userRatingTitle}>Your Rating:</h4>
                  {renderStars(userRating, true, handleRatingClick)}
                  {userRating > 0 && (
                    <span className={styles.userRatingText}>You rated this trail {userRating} star{userRating !== 1 ? 's' : ''}</span>
                  )}
                </div>
              ) : (
                <p className={styles.loginPrompt}>Login to rate this trail</p>
              )}
            </div>

            {/* Comments Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Comments ({comments.length})</h3>

              {/* Add Comment */}
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
                    variant="success"
                    size="small"
                    disabled={!newComment.trim() || submitting}
                  >
                    {submitting ? 'Posting...' : 'Post Comment'}
                  </Button>
                </form>
              ) : (
                <p className={styles.loginPrompt}>Login to comment on this trail</p>
              )}

              {/* Comments List */}
              <div className={styles.commentsList}>
                {comments.length === 0 ? (
                  <p className={styles.noComments}>No comments yet. Be the first to share your experience!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className={styles.comment}>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentAuthor}>
                          {comment.expand?.user?.name || comment.expand?.user?.email || 'Anonymous'}
                        </span>
                        <span className={styles.commentDate}>
                          {new Date(comment.created).toLocaleDateString()}
                        </span>
                        {canEditComment(comment) && (
                          <div className={styles.commentActions}>
                            <button
                              onClick={() => handleEditComment(comment.id, comment.comment)}
                              className={styles.editButton}
                              disabled={submitting}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className={styles.deleteButton}
                              disabled={submitting}
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {editingComment === comment.id ? (
                        <div className={styles.editingComment}>
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
                              variant="success"
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
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};