package websocket

import (
	"encoding/json"
	"log"
	"time"

	"real-time-forum/database"
	"real-time-forum/models"

	"github.com/gofrs/uuid"
	gorilla "github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 4096
)

// Client represents a single WebSocket connection.
type Client struct {
	hub      *Hub
	conn     *gorilla.Conn
	send     chan []byte
	UserID   string
	replaced bool // true if this client was replaced by a newer connection
}

// incomingMessage represents a message received from the client.
type incomingMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// chatPayload is the payload for a private message.
type chatPayload struct {
	To      string `json:"to"`
	Content string `json:"content"`
}

// typingPayload is the payload for a typing indicator.
type typingPayload struct {
	To string `json:"to"`
}

// readPump pumps messages from the WebSocket connection to the hub.
func (c *Client) readPump() {
	defer func() {
		// Only unregister if this client wasn't replaced by a newer connection
		if !c.replaced {
			c.hub.unregister <- c
		}
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, rawMessage, err := c.conn.ReadMessage()
		if err != nil {
			if gorilla.IsUnexpectedCloseError(err, gorilla.CloseGoingAway, gorilla.CloseNormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var msg incomingMessage
		if err := json.Unmarshal(rawMessage, &msg); err != nil {
			log.Printf("Invalid message format: %v", err)
			continue
		}

		c.handleMessage(msg)
	}
}

// handleMessage routes incoming messages by type.
func (c *Client) handleMessage(msg incomingMessage) {
	switch msg.Type {
	case "message":
		c.handleChatMessage(msg.Payload)
	case "typing":
		c.handleTyping(msg.Payload)
	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

// handleChatMessage saves a private message and forwards it to the recipient.
func (c *Client) handleChatMessage(payload json.RawMessage) {
	var chat chatPayload
	if err := json.Unmarshal(payload, &chat); err != nil {
		log.Printf("Invalid chat payload: %v", err)
		return
	}

	if chat.To == "" || chat.Content == "" {
		return
	}

	msgID, _ := uuid.NewV4()
	now := time.Now()

	// Get sender name
	sender, _ := database.GetUserByID(c.UserID)
	senderName := ""
	if sender != nil {
		senderName = sender.Nickname
	}

	// Save to database
	dbMsg := &models.Message{
		ID:         msgID.String(),
		SenderID:   c.UserID,
		ReceiverID: chat.To,
		Content:    chat.Content,
		CreatedAt:  now,
	}

	if err := database.SaveMessage(dbMsg); err != nil {
		log.Printf("Failed to save message: %v", err)
		return
	}

	// Build response message
	response := map[string]interface{}{
		"type": "message",
		"payload": map[string]interface{}{
			"id":         dbMsg.ID,
			"senderId":   c.UserID,
			"senderName": senderName,
			"receiverId": chat.To,
			"content":    chat.Content,
			"createdAt":  now.Format(time.RFC3339),
		},
	}

	responseBytes, _ := json.Marshal(response)

	// Send to recipient
	c.hub.SendToUser(chat.To, responseBytes)

	// Send confirmation back to sender
	c.hub.SendToUser(c.UserID, responseBytes)
}

// handleTyping forwards a typing indicator to the target user.
func (c *Client) handleTyping(payload json.RawMessage) {
	var tp typingPayload
	if err := json.Unmarshal(payload, &tp); err != nil {
		return
	}

	if tp.To == "" {
		return
	}

	response := map[string]interface{}{
		"type": "typing",
		"payload": map[string]interface{}{
			"userId": c.UserID,
		},
	}

	responseBytes, _ := json.Marshal(response)
	c.hub.SendToUser(tp.To, responseBytes)
}

// writePump pumps messages from the hub to the WebSocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel.
				c.conn.WriteMessage(gorilla.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(gorilla.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(gorilla.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
