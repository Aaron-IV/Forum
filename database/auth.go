package database

import (
	"real-time-forum/models"
	"time"
)

// CreateUser inserts a new user into the database.
func CreateUser(user *models.User) error {
	_, err := DB.Exec(
		`INSERT INTO users (id, nickname, age, gender, first_name, last_name, email, password, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Nickname, user.Age, user.Gender,
		user.FirstName, user.LastName, user.Email, user.Password, user.CreatedAt,
	)
	return err
}

// GetUserByEmail retrieves a user by their email.
func GetUserByEmail(email string) (*models.User, error) {
	u := &models.User{}
	err := DB.QueryRow(
		`SELECT id, nickname, age, gender, first_name, last_name, email, password, created_at
		 FROM users WHERE email = ?`, email,
	).Scan(&u.ID, &u.Nickname, &u.Age, &u.Gender,
		&u.FirstName, &u.LastName, &u.Email, &u.Password, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// GetUserByNickname retrieves a user by their nickname.
func GetUserByNickname(nickname string) (*models.User, error) {
	u := &models.User{}
	err := DB.QueryRow(
		`SELECT id, nickname, age, gender, first_name, last_name, email, password, created_at
		 FROM users WHERE nickname = ?`, nickname,
	).Scan(&u.ID, &u.Nickname, &u.Age, &u.Gender,
		&u.FirstName, &u.LastName, &u.Email, &u.Password, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// GetUserByID retrieves a user by their ID.
func GetUserByID(id string) (*models.User, error) {
	u := &models.User{}
	err := DB.QueryRow(
		`SELECT id, nickname, age, gender, first_name, last_name, email, password, created_at
		 FROM users WHERE id = ?`, id,
	).Scan(&u.ID, &u.Nickname, &u.Age, &u.Gender,
		&u.FirstName, &u.LastName, &u.Email, &u.Password, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// GetAllUsers retrieves all users ordered by nickname.
func GetAllUsers() ([]models.User, error) {
	rows, err := DB.Query(
		`SELECT id, nickname, age, gender, first_name, last_name, email, created_at
		 FROM users ORDER BY nickname`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		var createdAt time.Time
		if err := rows.Scan(&u.ID, &u.Nickname, &u.Age, &u.Gender,
			&u.FirstName, &u.LastName, &u.Email, &createdAt); err != nil {
			return nil, err
		}
		u.CreatedAt = createdAt
		users = append(users, u)
	}
	return users, rows.Err()
}
