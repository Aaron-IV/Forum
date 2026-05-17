package database

import (
	"real-time-forum/models"
)

// CreateComment inserts a new comment.
func CreateComment(c *models.Comment) error {
	_, err := DB.Exec(
		`INSERT INTO comments (id, post_id, user_id, content, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		c.ID, c.PostID, c.UserID, c.Content, c.CreatedAt,
	)
	return err
}

// GetCommentsByPostID retrieves all comments for a given post.
func GetCommentsByPostID(postID string) ([]models.Comment, error) {
	rows, err := DB.Query(
		`SELECT c.id, c.post_id, c.user_id, u.nickname, c.content, c.created_at
		 FROM comments c
		 JOIN users u ON c.user_id = u.id
		 WHERE c.post_id = ?
		 ORDER BY c.created_at ASC`, postID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []models.Comment
	for rows.Next() {
		var c models.Comment
		if err := rows.Scan(&c.ID, &c.PostID, &c.UserID, &c.Author,
			&c.Content, &c.CreatedAt); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, rows.Err()
}
