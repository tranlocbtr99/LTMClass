ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'teacher' CHECK(account_type IN('teacher','student','guardian'));
CREATE TABLE account_recovery (user_id TEXT PRIMARY KEY REFERENCES users(id),token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
