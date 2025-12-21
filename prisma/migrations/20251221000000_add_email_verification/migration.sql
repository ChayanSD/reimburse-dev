-- Add email verification fields to auth_users table
ALTER TABLE auth_users 
ADD COLUMN is_verified BOOLEAN DEFAULT false,
ADD COLUMN email_verification_token TEXT UNIQUE;

-- Create index for email verification token lookup
CREATE INDEX IF NOT EXISTS idx_auth_users_email_verification_token 
ON auth_users(email_verification_token);