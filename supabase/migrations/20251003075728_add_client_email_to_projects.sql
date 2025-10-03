/*
  # Add client_email column to projects table

  1. Changes
    - Add `client_email` column to `projects` table
    - Column is nullable text field for storing client email addresses
  
  2. Notes
    - Uses IF NOT EXISTS to prevent errors if column already exists
    - Safe to run multiple times
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'client_email'
  ) THEN
    ALTER TABLE projects ADD COLUMN client_email text;
  END IF;
END $$;