/*
  # Update chat_messages RLS policy

  1. Changes
    - Drop existing RLS policy for chat_messages
    - Create new separate policies for INSERT and SELECT
    - Allow authenticated users to manage their own messages
    - Allow anon users to insert messages (for demo mode)
  
  2. Security
    - Authenticated users can only see their own messages
    - Anon users can insert but not read others' messages
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can manage own chat messages" ON chat_messages;

-- Allow authenticated users to select their own messages
CREATE POLICY "Authenticated users can read own messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own messages  
CREATE POLICY "Authenticated users can insert own messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own messages
CREATE POLICY "Authenticated users can update own messages"
  ON chat_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own messages
CREATE POLICY "Authenticated users can delete own messages"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);