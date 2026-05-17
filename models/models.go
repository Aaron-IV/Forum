package models

import "time"

// User represents a registered forum user.
type User struct {
	ID        string    `json:"id"`
	Nickname  string    `json:"nickname"`
	Age       int       `json:"age"`
	Gender    string    `json:"gender"`
	FirstName string    `json:"firstName"`
	LastName  string    `json:"lastName"`
	Email     string    `json:"email"`
	Password  string    `json:"-"` // never exposed to client
	CreatedAt time.Time `json:"createdAt"`
}

// Post represents a forum post.
type Post struct {
	ID           string    `json:"id"`
	UserID       string    `json:"userId"`
	Author       string    `json:"author"` // joined from users.nickname
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	Categories   string    `json:"categories"` // comma-separated
	CommentCount int       `json:"commentCount"`
	CreatedAt    time.Time `json:"createdAt"`
}

// Comment represents a comment on a post.
type Comment struct {
	ID        string    `json:"id"`
	PostID    string    `json:"postId"`
	UserID    string    `json:"userId"`
	Author    string    `json:"author"` // joined from users.nickname
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt"`
}

// Message represents a private message between two users.
type Message struct {
	ID         string    `json:"id"`
	SenderID   string    `json:"senderId"`
	SenderName string    `json:"senderName"` // joined from users.nickname
	ReceiverID string    `json:"receiverId"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"createdAt"`
}

// Session represents an active user session.
type Session struct {
	Token     string    `json:"token"`
	UserID    string    `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// WSMessage is the envelope for all WebSocket messages.
type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}
