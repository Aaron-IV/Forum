package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"real-time-forum/database"
	"real-time-forum/middleware"
	"real-time-forum/models"
	ws "real-time-forum/websocket"
)

type sendMessageRequest struct {
	Content string `json:"content"`
}

// GetMessages returns paginated message history between the current user and another user.
func GetMessages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUserID := middleware.GetUserID(r)

	// Extract target user ID from path: /api/messages/{userId}
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		jsonError(w, "invalid user ID", http.StatusBadRequest)
		return
	}
	targetUserID := parts[3]

	// Parse offset
	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	messages, err := database.GetMessages(currentUserID, targetUserID, 10, offset)
	if err != nil {
		jsonError(w, "failed to fetch messages", http.StatusInternalServerError)
		return
	}

	if messages == nil {
		messages = []models.Message{}
	}

	jsonOK(w, messages)
}

// SendMessage saves a private message and notifies participants via WebSocket.
func SendMessage(hub *ws.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		currentUserID := middleware.GetUserID(r)

		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 4 || parts[3] == "" {
			jsonError(w, "invalid user ID", http.StatusBadRequest)
			return
		}
		targetUserID := parts[3]

		if targetUserID == currentUserID {
			jsonError(w, "cannot message yourself", http.StatusBadRequest)
			return
		}

		var req sendMessageRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "invalid request body", http.StatusBadRequest)
			return
		}

		content := strings.TrimSpace(req.Content)
		if content == "" {
			jsonError(w, "message cannot be empty", http.StatusBadRequest)
			return
		}

		if _, err := database.GetUserByID(targetUserID); err != nil {
			jsonError(w, "user not found", http.StatusNotFound)
			return
		}

		payload, err := hub.DeliverPrivateMessage(currentUserID, targetUserID, content)
		if err != nil {
			jsonError(w, "failed to send message", http.StatusInternalServerError)
			return
		}

		jsonOK(w, payload)
	}
}
