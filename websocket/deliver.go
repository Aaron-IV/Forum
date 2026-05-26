package websocket

import (
	"encoding/json"
	"time"

	"real-time-forum/database"
	"real-time-forum/models"

	"github.com/gofrs/uuid"
)

// DeliverPrivateMessage saves a private message and pushes it to online users via WebSocket.
func (h *Hub) DeliverPrivateMessage(senderID, receiverID, content string) (map[string]interface{}, error) {
	msgID, _ := uuid.NewV4()
	now := time.Now()

	sender, _ := database.GetUserByID(senderID)
	senderName := ""
	if sender != nil {
		senderName = sender.Nickname
	}

	dbMsg := &models.Message{
		ID:         msgID.String(),
		SenderID:   senderID,
		ReceiverID: receiverID,
		Content:    content,
		CreatedAt:  now,
	}

	if err := database.SaveMessage(dbMsg); err != nil {
		return nil, err
	}

	payload := map[string]interface{}{
		"id":         dbMsg.ID,
		"senderId":   senderID,
		"senderName": senderName,
		"receiverId": receiverID,
		"content":    content,
		"createdAt":  now.Format(time.RFC3339),
	}

	response := map[string]interface{}{
		"type":    "message",
		"payload": payload,
	}
	responseBytes, _ := json.Marshal(response)

	h.SendToUser(receiverID, responseBytes)

	return payload, nil
}
