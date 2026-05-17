package websocket

import (
	"log"
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages.
type Hub struct {
	// Registered clients mapped by user ID.
	clients map[string]*Client

	// Register requests from clients.
	register chan *Client

	// Unregister requests from clients.
	unregister chan *Client

	// Broadcast sends a message to all connected clients.
	broadcast chan []byte

	mu sync.RWMutex
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte, 256),
	}
}

// Run starts the hub's main event loop. Should be called as a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// If user already has a connection, close the old one
			if old, ok := h.clients[client.UserID]; ok {
				old.replaced = true
				close(old.send)
			}
			h.clients[client.UserID] = client
			h.mu.Unlock()
			log.Printf("User %s connected (total: %d)", client.UserID, len(h.clients))

			// Broadcast user online status
			h.BroadcastUserStatus(client.UserID, true)

		case client := <-h.unregister:
			h.mu.Lock()
			removed := false
			if existing, ok := h.clients[client.UserID]; ok && existing == client {
				close(client.send)
				delete(h.clients, client.UserID)
				removed = true
				log.Printf("User %s disconnected (total: %d)", client.UserID, len(h.clients))
			}
			h.mu.Unlock()

			// Only broadcast offline if we actually removed the current client
			// (not if this was a stale connection replaced by a new one)
			if removed {
				h.BroadcastUserStatus(client.UserID, false)
			}

		case message := <-h.broadcast:
			h.mu.RLock()
			for _, client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client send buffer full, skip
				}
			}
			h.mu.RUnlock()
		}
	}
}

// SendToUser sends a message to a specific user if they are online.
func (h *Hub) SendToUser(userID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if client, ok := h.clients[userID]; ok {
		select {
		case client.send <- message:
		default:
			// Buffer full
		}
	}
}

// BroadcastMessage sends a message to all connected clients.
func (h *Hub) BroadcastMessage(message []byte) {
	h.broadcast <- message
}

// BroadcastUserStatus notifies all clients about a user's online/offline status.
func (h *Hub) BroadcastUserStatus(userID string, online bool) {
	msg := `{"type":"user_status","payload":{"userId":"` + userID + `","online":` +
		boolStr(online) + `}}`
	h.BroadcastMessage([]byte(msg))
}

// IsOnline checks if a user is currently connected.
func (h *Hub) IsOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	_, ok := h.clients[userID]
	return ok
}

// GetOnlineUserIDs returns a list of all online user IDs.
func (h *Hub) GetOnlineUserIDs() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	ids := make([]string, 0, len(h.clients))
	for id := range h.clients {
		ids = append(ids, id)
	}
	return ids
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
