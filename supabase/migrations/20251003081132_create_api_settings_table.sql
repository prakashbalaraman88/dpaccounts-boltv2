/*
  # Create API Settings Table

  1. New Tables
    - `api_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `provider` (text) - 'gemini' or 'claude'
      - `api_key` (text) - encrypted API key
      - `is_active` (boolean) - whether this provider is enabled
      - `priority` (integer) - lower number = higher priority (1 = primary, 2 = fallback)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `api_settings` table
    - Users can only read/write their own API settings
    - API keys are stored encrypted (application-level encryption recommended)
  
  3. Indexes
    - Index on user_id for fast lookups
    - Unique constraint on (user_id, provider) to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS api_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gemini', 'claude')),
  api_key text NOT NULL,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 1 CHECK (priority > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE api_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own API settings"
  ON api_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API settings"
  ON api_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API settings"
  ON api_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API settings"
  ON api_settings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_api_settings_user_id ON api_settings(user_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_api_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_settings_updated_at
  BEFORE UPDATE ON api_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_api_settings_updated_at();