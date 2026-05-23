package server

import (
	"log"
	"net/http"

	"real-time-forum/handlers"
	"real-time-forum/middleware"
	ws "real-time-forum/websocket"
)

// Start configures routes and starts the HTTP server.
func Start(hub *ws.Hub, port string) {
	mux := http.NewServeMux()

	// Auth routes (no auth middleware)
	mux.HandleFunc("/api/auth/register", handlers.Register)
	mux.HandleFunc("/api/auth/login", handlers.Login)
	mux.HandleFunc("/api/auth/logout", handlers.Logout)
	mux.HandleFunc("/api/auth/me", middleware.Auth(handlers.Me))

	// Posts routes
	mux.HandleFunc("/api/posts", middleware.Auth(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.GetPosts(w, r)
		case http.MethodPost:
			handlers.CreatePost(w, r)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))

	// Single post + comments
	mux.HandleFunc("/api/posts/", middleware.Auth(func(w http.ResponseWriter, r *http.Request) {
		// Determine if this is a post or comments request
		// /api/posts/{id} → get post
		// /api/posts/{id}/comments → get/create comments
		path := r.URL.Path
		if len(path) > len("/api/posts/") {
			// Check if path ends with /comments
			if len(path) > 10 && path[len(path)-9:] == "/comments" {
				switch r.Method {
				case http.MethodGet:
					handlers.GetComments(w, r)
				case http.MethodPost:
					handlers.CreateComment(w, r)
				default:
					http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
				}
				return
			}

			// Single post
			handlers.GetPost(w, r)
			return
		}
	}))

	// Users route
	mux.HandleFunc("/api/users", middleware.Auth(handlers.GetUsers(hub)))

	// Messages route
	mux.HandleFunc("/api/messages/", middleware.Auth(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handlers.GetMessages(w, r)
		case http.MethodPost:
			handlers.SendMessage(hub)(w, r)
		default:
			http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}))

	// WebSocket route
	mux.HandleFunc("/ws", ws.Handler(hub))

	// Serve static files
	fs := http.FileServer(http.Dir("static"))
	mux.Handle("/css/", fs)
	mux.Handle("/js/", fs)

	// SPA: serve index.html for all other routes
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "static/index.html")
	})

	log.Printf("Server starting on http://localhost%s", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatal("Server failed:", err)
	}
}
