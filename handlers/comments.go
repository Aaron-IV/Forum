package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"real-time-forum/database"
	"real-time-forum/middleware"
	"real-time-forum/models"

	"github.com/gofrs/uuid"
)

type createCommentRequest struct {
	Content string `json:"content"`
}

// CreateComment creates a new comment on a post.
func CreateComment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := middleware.GetUserID(r)

	// Extract post ID from path: /api/posts/{id}/comments
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		jsonError(w, "invalid path", http.StatusBadRequest)
		return
	}
	postID := parts[3]

	// Verify post exists
	if _, err := database.GetPostByID(postID); err != nil {
		jsonError(w, "post not found", http.StatusNotFound)
		return
	}

	var req createCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		jsonError(w, "content is required", http.StatusBadRequest)
		return
	}

	commentID, _ := uuid.NewV4()
	comment := &models.Comment{
		ID:        commentID.String(),
		PostID:    postID,
		UserID:    userID,
		Content:   req.Content,
		CreatedAt: time.Now(),
	}

	if err := database.CreateComment(comment); err != nil {
		jsonError(w, "failed to create comment", http.StatusInternalServerError)
		return
	}

	// Get author name
	user, _ := database.GetUserByID(userID)
	if user != nil {
		comment.Author = user.Nickname
	}

	jsonOK(w, comment)
}

// GetComments returns all comments for a post.
func GetComments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract post ID from path: /api/posts/{id}/comments
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 5 {
		jsonError(w, "invalid path", http.StatusBadRequest)
		return
	}
	postID := parts[3]

	comments, err := database.GetCommentsByPostID(postID)
	if err != nil {
		jsonError(w, "failed to fetch comments", http.StatusInternalServerError)
		return
	}

	if comments == nil {
		comments = []models.Comment{}
	}

	jsonOK(w, comments)
}
