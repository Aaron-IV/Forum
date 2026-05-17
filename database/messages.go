package database

import (
	"real-time-forum/models"
	"time"
)

// SaveMessage inserts a new private message.
func SaveMessage(m *models.Message) error {
	_, err := DB.Exec(
		`INSERT INTO messages (id, sender_id, receiver_id, content, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		m.ID, m.SenderID, m.ReceiverID, m.Content, m.CreatedAt,
	)
	return err
}

// GetMessages retrieves paginated messages between two users.
// Returns messages in ascending order (oldest first within the page).
func GetMessages(userA, userB string, limit, offset int) ([]models.Message, error) {
	rows, err := DB.Query(
		`SELECT m.id, m.sender_id, u.nickname, m.receiver_id, m.content, m.created_at
		 FROM messages m
		 JOIN users u ON m.sender_id = u.id
		 WHERE (m.sender_id = ? AND m.receiver_id = ?)
		    OR (m.sender_id = ? AND m.receiver_id = ?)
		 ORDER BY m.created_at DESC
		 LIMIT ? OFFSET ?`,
		userA, userB, userB, userA, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.SenderID, &m.SenderName,
			&m.ReceiverID, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Reverse to get ascending order (oldest first)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}

// GetLastMessagePerUser returns the most recent message between the given user
// and every other user they have communicated with.
// Returns a map of otherUserID → Message.
func GetLastMessagePerUser(userID string) (map[string]models.Message, error) {
	rows, err := DB.Query(
		`SELECT m.id, m.sender_id, u.nickname, m.receiver_id, m.content, m.created_at,
		        CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_id
		 FROM messages m
		 JOIN users u ON m.sender_id = u.id
		 WHERE m.sender_id = ? OR m.receiver_id = ?
		 ORDER BY m.created_at DESC`, userID, userID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]models.Message)
	for rows.Next() {
		var m models.Message
		var otherID string
		var createdAt time.Time
		if err := rows.Scan(&m.ID, &m.SenderID, &m.SenderName,
			&m.ReceiverID, &m.Content, &createdAt, &otherID); err != nil {
			return nil, err
		}
		m.CreatedAt = createdAt
		// Only keep the first (most recent) message per other user
		if _, exists := result[otherID]; !exists {
			result[otherID] = m
		}
	}
	return result, rows.Err()
}
