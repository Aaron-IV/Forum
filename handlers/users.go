package handlers

import (
	"net/http"

	"real-time-forum/database"
	"real-time-forum/middleware"

	ws "real-time-forum/websocket"
)

// GetUsers returns all users with their online/offline status.
// Requires a reference to the WebSocket hub to check who's online.
func GetUsers(hub *ws.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		currentUserID := middleware.GetUserID(r)

		users, err := database.GetAllUsers()
		if err != nil {
			jsonError(w, "failed to fetch users", http.StatusInternalServerError)
			return
		}

		// Get last messages for sorting
		lastMessages, _ := database.GetLastMessagePerUser(currentUserID)

		onlineIDs := hub.GetOnlineUserIDs()
		onlineSet := make(map[string]bool)
		for _, id := range onlineIDs {
			onlineSet[id] = true
		}

		type userResponse struct {
			ID        string `json:"id"`
			Nickname  string `json:"nickname"`
			Online    bool   `json:"online"`
			LastMsgAt string `json:"lastMsgAt,omitempty"`
		}

		var result []userResponse
		for _, u := range users {
			if u.ID == currentUserID {
				continue // don't include self
			}

			resp := userResponse{
				ID:       u.ID,
				Nickname: u.Nickname,
				Online:   onlineSet[u.ID],
			}

			if msg, ok := lastMessages[u.ID]; ok {
				resp.LastMsgAt = msg.CreatedAt.Format("2006-01-02T15:04:05Z")
			}

			result = append(result, resp)
		}

		if result == nil {
			result = []userResponse{}
		}

		jsonOK(w, result)
	}
}
