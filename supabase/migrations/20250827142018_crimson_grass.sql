/*
  # Create chat messages table

  1. New Tables
    - `chat_messages`
      - `id` (uuid, primary key)
      - `project_id` (uuid, not null, references projects)
      - `content` (text, not null)
      - `role` (text, not null, 'user', 'assistant', or 'system')
      - `message_type` (text, not null, default 'text')
      - `image_url` (text, nullable)
      - `transaction_id` (uuid, nullable, references transactions)
      - `ai_analysis` (jsonb, nullable)
      - `created_at` (timestamptz, default now())
      - `user_id` (uuid, not null, references auth.users)

  2. Security
    - Enable RLS on `chat_messages` table
    - Add policy for authenticated users to manage their own messages
*/

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'transaction', 'followup')),
  image_url text,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  ai_analysis jsonb,
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat messages"
  ON chat_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);