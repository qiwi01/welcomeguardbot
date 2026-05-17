-- WelcomeGuardBot Database Schema
-- PostgreSQL

-- Users table (core)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'banned')),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  registered_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT NOW()
);

-- Verification logs (audit trail)
CREATE TABLE IF NOT EXISTS verification_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'requested', 'approved', 'rejected', 'banned', 'unbanned'
  performed_by BIGINT, -- telegram_id of admin who acted
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Broadcasts history
CREATE TABLE IF NOT EXISTS broadcasts (
  id SERIAL PRIMARY KEY,
  admin_id BIGINT NOT NULL,
  message_text TEXT NOT NULL,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance at 100k+ scale
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_registered_at ON users(registered_at);
CREATE INDEX IF NOT EXISTS idx_verification_logs_user_id ON verification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_created_at ON verification_logs(created_at);