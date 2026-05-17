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

type createPostRequest struct {
	Title      string `json:"title"`
	Content    string `json:"content"`
	Categories string `json:"categories"`
}

// GetPosts returns all posts, optionally filtered by category.
func GetPosts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	category := r.URL.Query().Get("category")
	posts, err := database.GetAllPosts(category)
	if err != nil {
		jsonError(w, "failed to fetch posts", http.StatusInternalServerError)
		return
	}

	if posts == nil {
		posts = []models.Post{}
	}

	jsonOK(w, posts)
}

// CreatePost creates a new post.
func CreatePost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := middleware.GetUserID(r)

	var req createPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Content = strings.TrimSpace(req.Content)
	req.Categories = strings.TrimSpace(req.Categories)

	if req.Title == "" || req.Content == "" {
		jsonError(w, "title and content are required", http.StatusBadRequest)
		return
	}

	if req.Categories == "" {
		req.Categories = "general"
	}

	postID, _ := uuid.NewV4()
	post := &models.Post{
		ID:         postID.String(),
		UserID:     userID,
		Title:      req.Title,
		Content:    req.Content,
		Categories: req.Categories,
		CreatedAt:  time.Now(),
	}

	if err := database.CreatePost(post); err != nil {
		jsonError(w, "failed to create post", http.StatusInternalServerError)
		return
	}

	// Get full post with author name
	fullPost, err := database.GetPostByID(post.ID)
	if err != nil {
		jsonError(w, "post created but failed to retrieve", http.StatusInternalServerError)
		return
	}

	jsonOK(w, fullPost)
}

// GetPost returns a single post by ID.
func GetPost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract ID from path: /api/posts/{id}
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		jsonError(w, "invalid post ID", http.StatusBadRequest)
		return
	}
	postID := parts[3]

	post, err := database.GetPostByID(postID)
	if err != nil {
		jsonError(w, "post not found", http.StatusNotFound)
		return
	}

	jsonOK(w, post)
}
