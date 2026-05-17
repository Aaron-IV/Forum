package database

import (
	"real-time-forum/models"
	"time"
)

// CreateSession inserts a new session.
func CreateSession(s *models.Session) error {
	_, err := DB.Exec(
		`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
		s.Token, s.UserID, s.ExpiresAt,
	)
	return err
}

// GetSession retrieves a session by token if it hasn't expired.
func GetSession(token string) (*models.Session, error) {
	s := &models.Session{}
	err := DB.QueryRow(
		`SELECT token, user_id, expires_at FROM sessions WHERE token = ? AND expires_at > ?`,
		token, time.Now(),
	).Scan(&s.Token, &s.UserID, &s.ExpiresAt)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// DeleteSession removes a session by token.
func DeleteSession(token string) error {
	_, err := DB.Exec(`DELETE FROM sessions WHERE token = ?`, token)
	return err
}

// DeleteSessionsByUser removes all sessions for a given user.
func DeleteSessionsByUser(userID string) error {
	_, err := DB.Exec(`DELETE FROM sessions WHERE user_id = ?`, userID)
	return err
}

// CleanExpiredSessions removes all expired sessions.
func CleanExpiredSessions() error {
	_, err := DB.Exec(`DELETE FROM sessions WHERE expires_at <= ?`, time.Now())
	return err
}
