package main

import (
	"log"

	"real-time-forum/database"
	"real-time-forum/server"
	ws "real-time-forum/websocket"
)

func main() {
	// Initialize database
	if err := database.Init("forum.db"); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer database.Close()

	// Create and start WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Start HTTP server
	server.Start(hub, ":8080")
}
