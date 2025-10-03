/*
  # Add spent column to projects table

  1. Changes
    - Add `spent` column to `projects` table
    - Column is a numeric field for storing total spent amount
    - Defaults to 0
  
  2. Notes
    - Uses IF NOT EXISTS to prevent errors if column already exists
    - Safe to run multiple times
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'spent'
  ) THEN
    ALTER TABLE projects ADD COLUMN spent numeric DEFAULT 0;
  END IF;
END $$;