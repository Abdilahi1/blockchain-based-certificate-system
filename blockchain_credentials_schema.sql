-- Blockchain Credential Management System Database Schema
-- MySQL Database Setup

-- Create the database
CREATE DATABASE IF NOT EXISTS blockchain_credentials;
USE blockchain_credentials;

-- 1. USERS TABLE
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    blockchain_address VARCHAR(42) UNIQUE NOT NULL,
    private_key VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_blockchain_address (blockchain_address),
    INDEX idx_created_at (created_at)
);

-- 2. CREDENTIALS TABLE
CREATE TABLE credentials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    credential_id VARCHAR(66) UNIQUE NOT NULL, -- Blockchain hex ID (0x...)
    issuer_user_id INT NOT NULL,
    owner_identifier VARCHAR(100) NOT NULL, -- Email or blockchain address
    owner_type ENUM('email', 'address') NOT NULL,
    ipfs_hash VARCHAR(100) NOT NULL,
    credential_type VARCHAR(100) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    status ENUM('active', 'revoked', 'expired') DEFAULT 'active',
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    metadata JSON, -- For additional credential data
    
    -- Foreign key constraints
    FOREIGN KEY (issuer_user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes for better performance
    INDEX idx_credential_id (credential_id),
    INDEX idx_issuer_user_id (issuer_user_id),
    INDEX idx_owner_identifier (owner_identifier),
    INDEX idx_transaction_hash (transaction_hash),
    INDEX idx_status (status),
    INDEX idx_issued_at (issued_at)
);

-- 3. CREDENTIAL_HISTORY TABLE
CREATE TABLE credential_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    credential_id VARCHAR(66) NOT NULL,
    action_type ENUM('issued', 'verified', 'revoked', 'viewed') NOT NULL,
    performed_by_user_id INT NULL, -- NULL if verified by non-user
    performed_by_ip VARCHAR(45), -- IPv4 or IPv6
    verification_result BOOLEAN NULL, -- For verification actions
    notes TEXT,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (performed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_credential_id (credential_id),
    INDEX idx_action_type (action_type),
    INDEX idx_performed_at (performed_at),
    INDEX idx_performed_by_user_id (performed_by_user_id)
);

-- 4. USER_SESSIONS TABLE (Optional - for session management)
CREATE TABLE user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id VARCHAR(128) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

-- 5. EMAIL_NOTIFICATIONS TABLE (Track sent emails)
CREATE TABLE email_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    credential_id VARCHAR(66) NOT NULL,
    recipient_email VARCHAR(100) NOT NULL,
    email_type ENUM('credential_issued', 'credential_received', 'credential_verified') NOT NULL,
    subject VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
    error_message TEXT NULL,
    
    -- Indexes
    INDEX idx_credential_id (credential_id),
    INDEX idx_recipient_email (recipient_email),
    INDEX idx_sent_at (sent_at),
    INDEX idx_status (status)
);