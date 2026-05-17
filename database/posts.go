package database

import (
	"real-time-forum/models"
)

// CreatePost inserts a new post.
func CreatePost(p *models.Post) error {
	_, err := DB.Exec(
		`INSERT INTO posts (id, user_id, title, content, categories, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		p.ID, p.UserID, p.Title, p.Content, p.Categories, p.CreatedAt,
	)
	return err
}

// GetAllPosts retrieves all posts with author name and comment count.
// Optional category filter (empty string = no filter).
func GetAllPosts(category string) ([]models.Post, error) {
	query := `SELECT p.id, p.user_id, u.nickname, p.title, p.content, p.categories, 
			  COUNT(c.id) as comment_count, p.created_at
			  FROM posts p
			  JOIN users u ON p.user_id = u.id
			  LEFT JOIN comments c ON c.post_id = p.id`

	var args []interface{}
	if category != "" {
		query += ` WHERE p.categories LIKE ?`
		args = append(args, "%"+category+"%")
	}

	query += ` GROUP BY p.id ORDER BY p.created_at DESC`

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var p models.Post
		if err := rows.Scan(&p.ID, &p.UserID, &p.Author, &p.Title,
			&p.Content, &p.Categories, &p.CommentCount, &p.CreatedAt); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, rows.Err()
}

// GetPostByID retrieves a single post with author name and comment count.
func GetPostByID(id string) (*models.Post, error) {
	p := &models.Post{}
	err := DB.QueryRow(
		`SELECT p.id, p.user_id, u.nickname, p.title, p.content, p.categories,
		 COUNT(c.id) as comment_count, p.created_at
		 FROM posts p
		 JOIN users u ON p.user_id = u.id
		 LEFT JOIN comments c ON c.post_id = p.id
		 WHERE p.id = ?
		 GROUP BY p.id`, id,
	).Scan(&p.ID, &p.UserID, &p.Author, &p.Title,
		&p.Content, &p.Categories, &p.CommentCount, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}
