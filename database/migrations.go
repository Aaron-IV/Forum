package database

import "log"

// RunMigrations creates all tables if they don't exist.
func RunMigrations() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id         TEXT PRIMARY KEY,
			nickname   TEXT UNIQUE NOT NULL,
			age        INTEGER NOT NULL,
			gender     TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name  TEXT NOT NULL,
			email      TEXT UNIQUE NOT NULL,
			password   TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token      TEXT PRIMARY KEY,
			user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS posts (
			id         TEXT PRIMARY KEY,
			user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title      TEXT NOT NULL,
			content    TEXT NOT NULL,
			categories TEXT NOT NULL DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS comments (
			id         TEXT PRIMARY KEY,
			post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			content    TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS messages (
			id          TEXT PRIMARY KEY,
			sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			content     TEXT NOT NULL,
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		// Indexes
		`CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_messages_pair_rev ON messages(receiver_id, sender_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
	}

	for _, stmt := range statements {
		if _, err := DB.Exec(stmt); err != nil {
			log.Printf("Migration failed: %s\nError: %v", stmt, err)
			return err
		}
	}

	return nil
}
