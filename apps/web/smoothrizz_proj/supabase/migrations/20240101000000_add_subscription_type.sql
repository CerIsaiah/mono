-- Add subscription_type column to users table
ALTER TABLE users ADD COLUMN subscription_type TEXT NOT NULL DEFAULT 'standard';

-- Add constraint to ensure subscription_type is either 'standard' or 'premium'
ALTER TABLE users ADD CONSTRAINT valid_subscription_type 
  CHECK (subscription_type IN ('standard', 'premium')); 