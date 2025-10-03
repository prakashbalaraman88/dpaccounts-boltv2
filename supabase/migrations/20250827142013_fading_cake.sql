/*
  # Create transactions table

  1. New Tables
    - `transactions`
      - `id` (uuid, primary key)
      - `project_id` (uuid, not null, references projects)
      - `amount` (numeric, not null)
      - `type` (text, not null, 'income' or 'expense')
      - `category` (text, not null)
      - `subcategory` (text, nullable)
      - `description` (text, nullable)
      - `receipt_url` (text, nullable)
      - `payment_method` (text, nullable)
      - `vendor_name` (text, nullable)
      - `transaction_date` (date, not null, default today)
      - `is_verified` (boolean, default false)
      - `notes` (text, nullable)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      - `user_id` (uuid, not null, references auth.users)

  2. Security
    - Enable RLS on `transactions` table
    - Add policy for authenticated users to manage their own transactions
*/

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  subcategory text,
  description text,
  receipt_url text,
  payment_method text,
  vendor_name text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  is_verified boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions"
  ON transactions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);