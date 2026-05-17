package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"real-time-forum/database"
	"real-time-forum/middleware"
	"real-time-forum/models"
)

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
