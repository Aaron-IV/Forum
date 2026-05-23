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
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
	Nickname  string `json:"nickname"`
	Age       int    `json:"age"`
	Gender    string `json:"gender"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

type loginRequest struct {
	Login    string `json:"login"` // nickname or email
	Password string `json:"password"`
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// Register handles user registration.
func Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	req.Nickname = strings.TrimSpace(req.Nickname)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Email = strings.TrimSpace(req.Email)

	if req.Nickname == "" || req.FirstName == "" || req.LastName == "" ||
		req.Email == "" || req.Password == "" || req.Age < 1 || req.Gender == "" {
		jsonError(w, "all fields are required", http.StatusBadRequest)
		return
	}

	if !strings.Contains(req.Email, "@") {
		jsonError(w, "invalid email format", http.StatusBadRequest)
		return
	}

	if len(req.Password) < 6 {
		jsonError(w, "password must be at least 6 characters", http.StatusBadRequest)
		return
	}

	// Check if nickname or email already exists
	if u, _ := database.GetUserByNickname(req.Nickname); u != nil {
		jsonError(w, "nickname already taken", http.StatusConflict)
		return
	}
	if u, _ := database.GetUserByEmail(req.Email); u != nil {
		jsonError(w, "email already registered", http.StatusConflict)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "internal server error", http.StatusInternalServerError)
		return
	}

	userID, _ := uuid.NewV4()
	user := &models.User{
		ID:        userID.String(),
		Nickname:  req.Nickname,
		Age:       req.Age,
		Gender:    req.Gender,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		CreatedAt: time.Now(),
	}

	if err := database.CreateUser(user); err != nil {
		jsonError(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	// Create session
	token, err := createSession(user.ID)
	if err != nil {
		jsonError(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]interface{}{
		"id":        user.ID,
		"nickname":  user.Nickname,
		"firstName": user.FirstName,
		"lastName":  user.LastName,
		"token":     token,
	})
}

// Login handles user authentication.
func Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Login = strings.TrimSpace(req.Login)
	if req.Login == "" || req.Password == "" {
		jsonError(w, "login and password are required", http.StatusBadRequest)
		return
	}

	// Try to find user by email or nickname
	var user *models.User
	var err error

	if strings.Contains(req.Login, "@") {
		user, err = database.GetUserByEmail(req.Login)
	} else {
		user, err = database.GetUserByNickname(req.Login)
	}

	if err != nil || user == nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	// Create new session (each tab gets its own independent session)
	token, err := createSession(user.ID)
	if err != nil {
		jsonError(w, "failed to create session", http.StatusInternalServerError)
		return
	}

	jsonOK(w, map[string]interface{}{
		"id":        user.ID,
		"nickname":  user.Nickname,
		"firstName": user.FirstName,
		"lastName":  user.LastName,
		"token":     token,
	})
}

// Logout handles user logout.
func Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read token from Authorization header
	token := extractBearerToken(r)
	if token != "" {
		database.DeleteSession(token)
	}

	jsonOK(w, map[string]string{"message": "logged out"})
}

// Me returns the current authenticated user's info.
func Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	user, err := database.GetUserByID(userID)
	if err != nil {
		jsonError(w, "user not found", http.StatusNotFound)
		return
	}

	jsonOK(w, map[string]interface{}{
		"id":        user.ID,
		"nickname":  user.Nickname,
		"age":       user.Age,
		"gender":    user.Gender,
		"firstName": user.FirstName,
		"lastName":  user.LastName,
		"email":     user.Email,
	})
}

// createSession generates a session token and saves it to the database.
// Returns the token string so it can be sent in the response body.
func createSession(userID string) (string, error) {
	token, _ := uuid.NewV4()
	session := &models.Session{
		Token:     token.String(),
		UserID:    userID,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}

	if err := database.CreateSession(session); err != nil {
		return "", err
	}

	return session.Token, nil
}

// extractBearerToken extracts a token from the Authorization: Bearer <token> header.
func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	return ""
}
