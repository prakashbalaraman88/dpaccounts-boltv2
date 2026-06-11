-- ============================================
-- LEDGE APP - Supabase Database Schema
-- Run this ENTIRE file in Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste > Run
-- ============================================

-- ============================================
-- STEP 1: CREATE ALL TABLES (no policies yet)
-- ============================================

-- 1a. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1b. Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id BIGSERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  budget NUMERIC DEFAULT 0,
  total_incoming NUMERIC DEFAULT 0,
  total_expense NUMERIC DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1c. Project Members (user <-> project junction)
CREATE TABLE IF NOT EXISTS public.project_members (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 1d. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT DEFAULT '',
  image_uri TEXT DEFAULT NULL,
  sender TEXT NOT NULL DEFAULT 'user',
  sender_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1e. Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  message_id BIGINT REFERENCES public.messages(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('incoming', 'expense')),
  amount NUMERIC NOT NULL,
  category_id TEXT NOT NULL,
  category_label TEXT NOT NULL,
  description TEXT DEFAULT '',
  vendor TEXT DEFAULT '',
  payment_method TEXT DEFAULT '',
  transaction_date TIMESTAMPTZ DEFAULT NULL,
  notes TEXT DEFAULT '',
  receipt_uri TEXT DEFAULT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1f. App Settings (global key-value store)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- STEP 2: AUTO-CREATE PROFILE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, must_change_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 3: ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: RLS POLICIES (all tables exist now)
-- ============================================

-- --- Profiles Policies ---
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- --- Projects Policies ---
CREATE POLICY "Admins full access on projects"
  ON public.projects FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view assigned projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update assigned projects"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
  );

-- --- Project Members Policies ---
CREATE POLICY "Admins full access on project_members"
  ON public.project_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view own memberships"
  ON public.project_members FOR SELECT
  USING (user_id = auth.uid());

-- --- Messages Policies ---
CREATE POLICY "Admins full access on messages"
  ON public.messages FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view messages of assigned projects"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = messages.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add messages to assigned projects"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = messages.project_id AND user_id = auth.uid()
    )
  );

-- --- Transactions Policies ---
CREATE POLICY "Admins full access on transactions"
  ON public.transactions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view transactions of assigned projects"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = transactions.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add transactions to assigned projects"
  ON public.transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = transactions.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE
  USING (created_by = auth.uid());

-- --- App Settings Policies ---
CREATE POLICY "Authenticated users can read settings"
  ON public.app_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage settings"
  ON public.app_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- STEP 5: HELPER FUNCTIONS
-- ============================================

-- Recalculate project totals after transaction changes
CREATE OR REPLACE FUNCTION public.recalculate_project_totals(p_project_id BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.projects SET
    total_incoming = COALESCE((
      SELECT SUM(amount) FROM public.transactions
      WHERE project_id = p_project_id AND type = 'incoming'
    ), 0),
    total_expense = COALESCE((
      SELECT SUM(amount) FROM public.transactions
      WHERE project_id = p_project_id AND type = 'expense'
    ), 0),
    updated_at = now()
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Category breakdown for dashboard (respects admin/user roles)
CREATE OR REPLACE FUNCTION public.get_category_breakdown()
RETURNS TABLE(category_id TEXT, category_label TEXT, type TEXT, count BIGINT, total NUMERIC)
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    -- Admin sees all projects
    RETURN QUERY SELECT t.category_id, t.category_label, t.type,
      COUNT(*)::BIGINT, SUM(t.amount)
    FROM public.transactions t
    GROUP BY t.category_id, t.category_label, t.type
    ORDER BY SUM(t.amount) DESC;
  ELSE
    -- User sees only assigned projects
    RETURN QUERY SELECT t.category_id, t.category_label, t.type,
      COUNT(*)::BIGINT, SUM(t.amount)
    FROM public.transactions t
    JOIN public.project_members pm ON pm.project_id = t.project_id
    WHERE pm.user_id = auth.uid()
    GROUP BY t.category_id, t.category_label, t.type
    ORDER BY SUM(t.amount) DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: STORAGE BUCKET FOR RECEIPTS
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies first (safe re-run)
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own receipts" ON storage.objects;

CREATE POLICY "Authenticated users can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'receipts');

CREATE POLICY "Anyone can view receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can delete own receipts"
  ON storage.objects FOR DELETE
  USING (auth.role() = 'authenticated' AND bucket_id = 'receipts');

-- ============================================
-- DONE! Now go to Authentication > Users and
-- create your admin user. Then run:
--
-- UPDATE public.profiles
-- SET role = 'admin', must_change_password = false
-- WHERE email = 'your-admin@email.com';
-- ============================================
