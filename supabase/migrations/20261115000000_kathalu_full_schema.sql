-- ====================================================================
-- Kathalu (కథలు) - Hardened Production Database Schema Migration
-- Migration: 20261115000000_kathalu_full_schema.sql
-- Idempotent, Backwards-Compatible & Zero-Trust Hardened
-- ====================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Default privileges: prevent new functions from automatically being executable by anon/authenticated/PUBLIC
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ====================================================================
-- 1. PROFILES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Ensure all columns exist regardless of draft schema versions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Storyteller';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_age_city BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_relationship TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_consent BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'listener';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

-- Backfill / normalize existing roles before applying check constraint
UPDATE public.profiles
SET role = 'listener'
WHERE role = 'user' OR role NOT IN ('listener', 'narrator', 'admin') OR role IS NULL;

-- Drop and recreate CHECK constraint on role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('listener', 'narrator', 'admin'));

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Safe Public View for profiles (strictly omits phone, email, and guardian details)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  display_name,
  username,
  avatar_url,
  bio,
  CASE WHEN show_age_city THEN age ELSE NULL END AS age,
  CASE WHEN show_age_city THEN city ELSE NULL END AS city,
  show_age_city,
  is_minor,
  role,
  created_at
FROM public.profiles;

-- ====================================================================
-- 2. PAYMENTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 2000; -- 2000 paise = ₹20 INR
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'created';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Drop and recreate CHECK constraint on status
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK (status IN ('created', 'paid', 'failed'));

-- Unique indexes / constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_payment_id ON public.payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);

-- ====================================================================
-- 3. UPLOAD CREDITS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.upload_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE public.upload_credits ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.upload_credits ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;
ALTER TABLE public.upload_credits ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available';
ALTER TABLE public.upload_credits ADD COLUMN IF NOT EXISTS used_for_story_id UUID;
ALTER TABLE public.upload_credits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
ALTER TABLE public.upload_credits ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Drop and recreate CHECK constraint on status
ALTER TABLE public.upload_credits DROP CONSTRAINT IF EXISTS upload_credits_status_check;
ALTER TABLE public.upload_credits ADD CONSTRAINT upload_credits_status_check CHECK (status IN ('available', 'used', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_credits_user_status ON public.upload_credits(user_id, status);

-- ====================================================================
-- 4. STORIES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS narrator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS title_telugu TEXT NOT NULL DEFAULT '';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS title_english TEXT NOT NULL DEFAULT '';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS genre TEXT NOT NULL DEFAULT 'Folk Tales';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT 'placeholders/default-cover.webp';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS audio_url TEXT NOT NULL DEFAULT '';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS vote_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reject_notes TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS is_weekly_winner BOOLEAN DEFAULT false;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

-- Backfill rejection_reason from older schema columns if present
UPDATE public.stories
SET rejection_reason = COALESCE(rejection_reason, reject_reason, reject_notes)
WHERE rejection_reason IS NULL AND (reject_reason IS NOT NULL OR reject_notes IS NOT NULL);

-- Drop and recreate CHECK constraints
ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_genre_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_genre_check CHECK (genre IN ('Folk Tales', 'Moral Stories', 'Mythology', 'Panchatantra', 'Tenali Rama', 'Bedtime', 'All'));

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_status_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_status_check CHECK (status IN ('pending', 'live', 'rejected'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stories_status_created ON public.stories(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_genre_status ON public.stories(genre, status);
CREATE INDEX IF NOT EXISTS idx_stories_narrator_status ON public.stories(narrator_id, status);
CREATE INDEX IF NOT EXISTS idx_stories_winner ON public.stories(is_weekly_winner);

-- ====================================================================
-- 5. VOTES TABLE (1 Vote Per User Per Story Per Week)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS week_start DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

-- Drop old unique constraint if present from earlier draft and re-add canonical constraint
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS unique_vote_user_story_week;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_user_story_week_unique;
ALTER TABLE public.votes ADD CONSTRAINT votes_user_story_week_unique UNIQUE (user_id, story_id, week_start);

CREATE INDEX IF NOT EXISTS idx_votes_story_week ON public.votes(story_id, week_start);
CREATE INDEX IF NOT EXISTS idx_votes_user_week ON public.votes(user_id, week_start);

-- ====================================================================
-- 6. WEEKLY WINNERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.weekly_winners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE;
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS narrator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS week_start DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS week_end DATE NOT NULL DEFAULT (CURRENT_DATE + 6);
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS vote_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS rank INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS reward_amount INTEGER NOT NULL DEFAULT 0; -- Exactly ONE winner (Rank 1: ₹1,000; Others: ₹0)
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS reward_currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'shortlisted'; -- 'shortlisted' (by cron) or 'confirmed' (by admin)
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
ALTER TABLE public.weekly_winners ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

-- Drop and recreate unique constraint for week_start + rank
ALTER TABLE public.weekly_winners DROP CONSTRAINT IF EXISTS weekly_winners_week_rank_unique;
ALTER TABLE public.weekly_winners ADD CONSTRAINT weekly_winners_week_rank_unique UNIQUE (week_start, rank);

CREATE INDEX IF NOT EXISTS idx_weekly_winners_week ON public.weekly_winners(week_start DESC);

-- ====================================================================
-- 7. STORY REPORTS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.story_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE;
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'other';
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.story_reports ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id);

-- Drop and recreate CHECK constraints
ALTER TABLE public.story_reports DROP CONSTRAINT IF EXISTS story_reports_reason_check;
ALTER TABLE public.story_reports ADD CONSTRAINT story_reports_reason_check CHECK (reason IN ('inappropriate_content', 'child_safety', 'copyright_music', 'audio_quality', 'other'));

ALTER TABLE public.story_reports DROP CONSTRAINT IF EXISTS story_reports_status_check;
ALTER TABLE public.story_reports ADD CONSTRAINT story_reports_status_check CHECK (status IN ('pending', 'reviewed', 'dismissed'));

CREATE INDEX IF NOT EXISTS idx_story_reports_status ON public.story_reports(status);

-- Compatibility view for queries referencing 'reports'
CREATE OR REPLACE VIEW public.reports AS
SELECT
  id,
  story_id,
  reporter_id AS user_id,
  reason,
  details,
  status,
  created_at,
  reviewed_at,
  reviewed_by
FROM public.story_reports;

-- ====================================================================
-- 8. NOTIFICATIONS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

-- Drop and recreate CHECK constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('story_approved', 'story_rejected', 'weekly_winner', 'credit_received', 'new_vote', 'info', 'editorial_shortlist'));

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- ====================================================================
-- 9. DYNAMIC CLEANUP OF ALL LEFTOVER POLICIES (ZERO TRACE GUARANTEE)
-- ====================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Drop ALL existing policies on our public tables
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'payments', 'upload_credits', 'stories', 'votes', 'weekly_winners', 'story_reports', 'notifications')
  ) LOOP
    EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;

  -- 2. Drop storage.objects policies for kathalu
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    FOR r IN (
      SELECT schemaname, tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname IN (
          'Users can upload to own audio folder',
          'Users can view own audio files',
          'Users can upload to own audio folder with credit',
          'Public can view story audio and covers'
        )
    ) LOOP
      EXECUTE pg_catalog.format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
  END IF;
END $$;

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: Is current user an admin? (SECURITY DEFINER with safe search_path, handles NULL auth.uid())
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_uid;

  RETURN v_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- ====================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES - RECREATED STRICT & MINIMAL
-- ====================================================================

-- --- PROFILES POLICIES ---
-- Read: Users can view their own full profile; Admins view all.
-- Public/anon and other users must view public fields via public_profiles view.
CREATE POLICY "Users can view own profile, Admins view all"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_admin()
  );

-- Update: Users can update their own profile EXCEPT role
CREATE POLICY "Users can update own profile except role"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      OR public.is_admin()
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- DEFENSE IN DEPTH: PROFILES UPDATE TRIGGER & PRIVILEGES ---
CREATE OR REPLACE FUNCTION public.check_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Service role and admins can update all columns
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot alter their role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: only administrators can modify user roles (code: 42501)';
  END IF;

  -- User ID is immutable
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Unauthorized: user ID is immutable (code: 42501)';
  END IF;

  -- Child Safety Protection: Once marked as minor or guardian consent recorded, non-admins cannot disable or revoke
  IF OLD.is_minor = true AND NEW.is_minor IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Unauthorized: child safety is_minor protection cannot be disabled once established (code: 42501)';
  END IF;

  IF OLD.guardian_consent = true AND NEW.guardian_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Unauthorized: guardian consent cannot be revoked by client (code: 42501)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_update ON public.profiles;
CREATE TRIGGER enforce_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_update();

-- Revoke column-level update on role and grant only user-editable profile fields
REVOKE UPDATE ON public.profiles FROM anon, authenticated, PUBLIC;
GRANT UPDATE (
  display_name,
  avatar_url,
  bio,
  age,
  city,
  show_age_city,
  is_minor,
  guardian_name,
  guardian_phone,
  guardian_relationship,
  guardian_consent,
  updated_at
) ON public.profiles TO authenticated;

-- --- PAYMENTS POLICIES ---
-- Zero trust: users cannot insert or update payments directly. Only service_role can write.
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Explicitly revoke INSERT/UPDATE from non-service roles
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated, PUBLIC;

-- --- UPLOAD CREDITS POLICIES ---
-- Zero trust: users cannot insert or update credits directly. Only service_role can write.
CREATE POLICY "Users can view own credits"
  ON public.upload_credits FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.upload_credits FROM anon, authenticated, PUBLIC;

-- --- STORIES POLICIES ---
-- Read: Public can view live stories; narrators can view their own; admins view all
CREATE POLICY "Public can view live stories"
  ON public.stories FOR SELECT
  USING (
    status = 'live'
    OR auth.uid() = narrator_id
    OR public.is_admin()
  );

-- Direct INSERT by users is REMOVED. Stories must be created via public.create_story() RPC.
REVOKE INSERT ON public.stories FROM anon, authenticated, PUBLIC;

-- Narrators can edit their own pending or rejected stories
CREATE POLICY "Narrators can update own pending or rejected stories"
  ON public.stories FOR UPDATE
  USING (
    (auth.uid() = narrator_id AND status IN ('pending', 'rejected'))
    OR public.is_admin()
  )
  WITH CHECK (
    (auth.uid() = narrator_id AND status IN ('pending', 'rejected'))
    OR public.is_admin()
  );

-- --- VOTES POLICIES ---
-- Direct INSERT/DELETE by clients is REMOVED. Voting happens exclusively via public.cast_vote() RPC.
CREATE POLICY "Users can view own votes"
  ON public.votes FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.votes FROM anon, authenticated, PUBLIC;

-- --- WEEKLY WINNERS POLICIES ---
CREATE POLICY "Public can view weekly winners"
  ON public.weekly_winners FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage weekly winners"
  ON public.weekly_winners FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- STORY REPORTS POLICIES ---
CREATE POLICY "Authenticated users can create reports"
  ON public.story_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports, Admins view all"
  ON public.story_reports FOR SELECT
  USING (auth.uid() = reporter_id OR public.is_admin());

CREATE POLICY "Admins can update report status"
  ON public.story_reports FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- --- NOTIFICATIONS POLICIES ---
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications as read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ====================================================================
-- BUSINESS LOGIC FUNCTIONS & PROCEDURES
-- ====================================================================

-- Helper: Calculate current Monday week start in Asia/Kolkata timezone (supports app.test_clock session override)
DROP FUNCTION IF EXISTS public.current_week_start() CASCADE;
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(pg_catalog.current_setting('app.test_clock', true), '')::DATE,
    (pg_catalog.date_trunc('week', NOW() AT TIME ZONE 'Asia/Kolkata'))::DATE
  );
$$;

-- 1. ATOMIC VOTE TOGGLING (SECURITY DEFINER, caller user derived strictly from auth.uid())
DROP FUNCTION IF EXISTS public.cast_vote(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.cast_vote(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.cast_vote(
  p_story_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_week_start DATE;
  v_story_status TEXT;
  v_vote_id UUID;
  v_new_count INTEGER;
  v_deleted_count INTEGER := 0;
  v_inserted_count INTEGER := 0;
BEGIN
  -- 1. Authenticate caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to cast a vote';
  END IF;

  -- 2. Advisory transaction lock per user + story to serialize concurrent toggles
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    pg_catalog.hashtext(p_story_id::text)
  );

  -- 3. Verify story exists and is 'live'
  SELECT status INTO v_story_status
  FROM public.stories
  WHERE id = p_story_id;

  IF v_story_status IS NULL THEN
    RAISE EXCEPTION 'Story % not found', p_story_id;
  END IF;

  IF v_story_status <> 'live' THEN
    RAISE EXCEPTION 'Voting is only permitted on live stories (current status: %)', v_story_status;
  END IF;

  -- 4. Calculate week start on server (Asia/Kolkata, Monday start, respecting app.test_clock if set)
  v_week_start := public.current_week_start();

  -- 5. Set transaction-local trusted flag so check_story_update trigger allows vote_count update
  PERFORM pg_catalog.set_config('app.trusted_internal_update', 'true', true);

  -- 6. Check if vote already exists for this story + user + week
  SELECT id INTO v_vote_id
  FROM public.votes
  WHERE user_id = v_user_id
    AND story_id = p_story_id
    AND week_start = v_week_start;

  IF v_vote_id IS NOT NULL THEN
    -- Toggle OFF: delete vote and decrement count only if a row was actually deleted
    DELETE FROM public.votes WHERE id = v_vote_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_deleted_count > 0 THEN
      UPDATE public.stories
      SET vote_count = CASE WHEN vote_count > 0 THEN vote_count - 1 ELSE 0 END,
          updated_at = pg_catalog.timezone('utc', NOW())
      WHERE id = p_story_id
      RETURNING vote_count INTO v_new_count;
    ELSE
      SELECT vote_count INTO v_new_count FROM public.stories WHERE id = p_story_id;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'action', 'unvoted',
      'story_id', p_story_id,
      'vote_count', v_new_count,
      'week_start', v_week_start
    );
  ELSE
    -- Toggle ON: insert vote and increment count only if inserted
    INSERT INTO public.votes (story_id, user_id, week_start)
    VALUES (p_story_id, v_user_id, v_week_start)
    ON CONFLICT (story_id, user_id, week_start) DO NOTHING;
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    IF v_inserted_count > 0 THEN
      UPDATE public.stories
      SET vote_count = vote_count + 1,
          updated_at = pg_catalog.timezone('utc', NOW())
      WHERE id = p_story_id
      RETURNING vote_count INTO v_new_count;
    ELSE
      SELECT vote_count INTO v_new_count FROM public.stories WHERE id = p_story_id;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'action', 'voted',
      'story_id', p_story_id,
      'vote_count', v_new_count,
      'week_start', v_week_start
    );
  END IF;
END;
$$;

-- 2. INCREMENT PLAY COUNT (SECURITY DEFINER, trusted internal path)
DROP FUNCTION IF EXISTS public.increment_play_count(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.increment_play_count(
  p_story_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller UUID;
  v_story_status TEXT;
  v_new_play_count INTEGER;
BEGIN
  -- Authenticate caller
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required to increment play count';
  END IF;

  SELECT status INTO v_story_status
  FROM public.stories
  WHERE id = p_story_id;

  IF v_story_status IS NULL THEN
    RAISE EXCEPTION 'Story % not found', p_story_id;
  END IF;

  IF v_story_status <> 'live' THEN
    RAISE EXCEPTION 'Plays can only be incremented for live stories';
  END IF;

  -- Set transaction-local trusted setting
  PERFORM pg_catalog.set_config('app.trusted_internal_update', 'true', true);

  UPDATE public.stories
  SET play_count = play_count + 1,
      updated_at = pg_catalog.timezone('utc', NOW())
  WHERE id = p_story_id
  RETURNING play_count INTO v_new_play_count;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'story_id', p_story_id,
    'play_count', v_new_play_count
  );
END;
$$;

-- 3. GRANT UPLOAD CREDIT (SERVICE ROLE ONLY)
DROP FUNCTION IF EXISTS public.grant_upload_credit(UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.grant_upload_credit(
  p_user_id UUID,
  p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment_user_id UUID;
  v_payment_status TEXT;
  v_credit_id UUID;
BEGIN
  -- Verify payment exists, belongs to user, and is status 'paid'
  SELECT user_id, status INTO v_payment_user_id, v_payment_status
  FROM public.payments
  WHERE id = p_payment_id;

  IF v_payment_user_id IS NULL THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;

  IF v_payment_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Payment % does not belong to user %', p_payment_id, p_user_id;
  END IF;

  IF v_payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Payment % status is % (must be paid)', p_payment_id, v_payment_status;
  END IF;

  -- Insert 1 available upload credit
  INSERT INTO public.upload_credits (user_id, payment_id, status)
  VALUES (p_user_id, p_payment_id, 'available')
  RETURNING id INTO v_credit_id;

  -- Upgrade profile role to narrator if currently listener
  UPDATE public.profiles
  SET role = 'narrator',
      updated_at = pg_catalog.timezone('utc', NOW())
  WHERE id = p_user_id AND role = 'listener';

  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    p_user_id,
    'credit_received',
    'Upload credit available!',
    'Your ₹20 fee payment was verified. You can now record and submit 1 story.',
    pg_catalog.jsonb_build_object('credit_id', v_credit_id, 'payment_id', p_payment_id)
  );

  RETURN pg_catalog.jsonb_build_object('success', true, 'credit_id', v_credit_id);
END;
$$;

-- 4. CONSUME UPLOAD CREDIT (SERVICE ROLE ONLY)
DROP FUNCTION IF EXISTS public.consume_upload_credit(UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.consume_upload_credit(
  p_user_id UUID,
  p_story_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_credit_id UUID;
BEGIN
  -- Lock 1 available credit for this user
  SELECT id INTO v_credit_id
  FROM public.upload_credits
  WHERE user_id = p_user_id AND status = 'available'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit_id IS NULL THEN
    RAISE EXCEPTION 'No available upload credits found for user %', p_user_id;
  END IF;

  -- Mark credit as used
  UPDATE public.upload_credits
  SET status = 'used',
      used_for_story_id = p_story_id,
      used_at = pg_catalog.timezone('utc', NOW())
  WHERE id = v_credit_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'consumed_credit_id', v_credit_id);
END;
$$;

-- 5. ATOMIC STORY CREATION WITH STORAGE URL VALIDATION (Consumes 1 Credit)
DROP FUNCTION IF EXISTS public.create_story(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) CASCADE;
CREATE OR REPLACE FUNCTION public.create_story(
  p_title_telugu TEXT,
  p_title_english TEXT,
  p_genre TEXT,
  p_audio_url TEXT,
  p_cover_url TEXT DEFAULT 'placeholders/default-cover.webp',
  p_duration_seconds INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_credit_id UUID;
  v_story_id UUID;
  v_effective_cover TEXT;
BEGIN
  -- Caller is authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a story (code: 42501)';
  END IF;

  -- Storage isolation: audio_url must be inside the caller's own folder
  IF p_audio_url IS NULL OR NOT (p_audio_url LIKE (v_user_id::text || '/%')) THEN
    RAISE EXCEPTION 'audio_url must be inside your own user folder (%/...) (code: 42501)', v_user_id;
  END IF;

  -- Cover isolation: must be in user folder or internal placeholder path; default to placeholders/default-cover.webp
  IF p_cover_url IS NULL OR pg_catalog.length(pg_catalog.btrim(p_cover_url)) = 0 THEN
    v_effective_cover := 'placeholders/default-cover.webp';
  ELSIF p_cover_url LIKE (v_user_id::text || '/%') OR p_cover_url LIKE 'placeholders/%' THEN
    v_effective_cover := p_cover_url;
  ELSE
    RAISE EXCEPTION 'cover_url must be inside your user folder (%) or a valid placeholder path (placeholders/*) (code: 42501)', v_user_id;
  END IF;

  -- Lock 1 available credit for this user
  SELECT id INTO v_credit_id
  FROM public.upload_credits
  WHERE user_id = v_user_id AND status = 'available'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit_id IS NULL THEN
    RAISE EXCEPTION 'No available upload credits found. Pay ₹20 fee before submitting.';
  END IF;

  -- Insert story in 'pending' status, forcing zero counts and is_weekly_winner = false
  INSERT INTO public.stories (
    narrator_id,
    title_telugu,
    title_english,
    genre,
    cover_url,
    audio_url,
    duration_seconds,
    status,
    vote_count,
    play_count,
    is_weekly_winner
  ) VALUES (
    v_user_id,
    p_title_telugu,
    p_title_english,
    p_genre,
    v_effective_cover,
    p_audio_url,
    p_duration_seconds,
    'pending',
    0,
    0,
    false
  )
  RETURNING id INTO v_story_id;

  -- Mark credit used
  UPDATE public.upload_credits
  SET status = 'used',
      used_for_story_id = v_story_id,
      used_at = pg_catalog.timezone('utc', NOW())
  WHERE id = v_credit_id;

  -- Notification
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_user_id,
    'info',
    'Story submitted for review',
    'Your story "' || p_title_english || '" is under review by the moderation desk.',
    pg_catalog.jsonb_build_object('story_id', v_story_id)
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'story_id', v_story_id,
    'consumed_credit_id', v_credit_id,
    'status', 'pending'
  );
END;
$$;

-- 6. STORY UPDATE ENFORCEMENT TRIGGER (BLOCKS METRIC TAMPERING & UNAUTHORIZED PUBLISHING)
DROP FUNCTION IF EXISTS public.check_story_update() CASCADE;
CREATE OR REPLACE FUNCTION public.check_story_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_uid UUID;
  v_is_trusted BOOLEAN;
  v_admin BOOLEAN;
BEGIN
  -- 1. Allow trusted internal code paths (e.g. cast_vote, increment_play_count)
  v_is_trusted := COALESCE(pg_catalog.current_setting('app.trusted_internal_update', true), '') = 'true';
  IF v_is_trusted THEN
    RETURN NEW;
  END IF;

  -- 2. Allow service_role
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_current_uid := auth.uid();
  v_admin := public.is_admin();

  -- 3. Admins have full editing rights
  IF v_admin THEN
    IF OLD.status <> 'live' AND NEW.status = 'live' AND NEW.published_at IS NULL THEN
      NEW.published_at := pg_catalog.timezone('utc', NOW());
    END IF;
    RETURN NEW;
  END IF;

  -- 4. Non-admins cannot alter metrics, winner flags, reviews, or narrator
  IF NEW.vote_count IS DISTINCT FROM OLD.vote_count THEN
    RAISE EXCEPTION 'Unauthorized: vote_count can only be modified through cast_vote() (code: 42501)';
  END IF;

  IF NEW.play_count IS DISTINCT FROM OLD.play_count THEN
    RAISE EXCEPTION 'Unauthorized: play_count can only be modified through increment_play_count() (code: 42501)';
  END IF;

  IF NEW.is_weekly_winner IS DISTINCT FROM OLD.is_weekly_winner THEN
    RAISE EXCEPTION 'Unauthorized: is_weekly_winner is managed exclusively by weekly tally jobs (code: 42501)';
  END IF;

  IF NEW.narrator_id IS DISTINCT FROM OLD.narrator_id THEN
    RAISE EXCEPTION 'Unauthorized: narrator_id is immutable (code: 42501)';
  END IF;

  IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
    RAISE EXCEPTION 'Unauthorized: review metadata can only be set by admins (code: 42501)';
  END IF;

  -- 5. Non-admins cannot publish directly to 'live'
  IF NEW.status = 'live' AND OLD.status <> 'live' THEN
    RAISE EXCEPTION 'Unauthorized: only moderators can approve a story to live status (code: 42501)';
  END IF;

  -- 6. Narrators can modify their own pending or rejected stories (content/metadata only)
  IF v_current_uid = OLD.narrator_id THEN
    IF OLD.status IN ('pending', 'rejected') AND NEW.status IN ('pending', 'rejected') THEN
      IF OLD.status = 'rejected' AND NEW.status = 'pending' THEN
        -- Narrator resubmitting rejected story: reset rejection notes
        NEW.rejection_reason := NULL;
        NEW.reject_reason := NULL;
        NEW.reject_notes := NULL;
      END IF;
      NEW.updated_at := pg_catalog.timezone('utc', NOW());
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Narrators can only modify pending or rejected stories (code: 42501)';
    END IF;
  END IF;

  RAISE EXCEPTION 'Unauthorized operation on story % (code: 42501)', OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS enforce_story_update ON public.stories;
CREATE TRIGGER enforce_story_update
  BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.check_story_update();

-- 7. WEEKLY WINNER TALLY (SERVICE ROLE / ADMIN TRIGGERED)
DROP FUNCTION IF EXISTS public.tally_weekly_winners(DATE) CASCADE;
DROP FUNCTION IF EXISTS public.tally_weekly_winners() CASCADE;
CREATE OR REPLACE FUNCTION public.tally_weekly_winners(
  p_target_week DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_count INTEGER := 0;
  v_total_votes INTEGER := 0;
  v_winner RECORD;
  v_top_story_title TEXT;
BEGIN
  -- Determine target completed week (defaults to prior Monday)
  IF p_target_week IS NOT NULL THEN
    v_week_start := p_target_week;
  ELSE
    v_week_start := public.current_week_start() - 7;
  END IF;
  v_week_end := v_week_start + 6;

  -- 1. Check if there are ANY votes cast for this week
  SELECT COUNT(id) INTO v_total_votes
  FROM public.votes
  WHERE week_start = v_week_start;

  -- If zero votes cast across all stories, complete cleanly with no shortlist
  IF v_total_votes = 0 THEN
    -- Still reset active week stories.vote_count to active week tallies
    PERFORM pg_catalog.set_config('app.trusted_internal_update', 'true', true);
    UPDATE public.stories s
    SET vote_count = COALESCE(
      (
        SELECT COUNT(v.id)::INTEGER
        FROM public.votes v
        WHERE v.story_id = s.id
          AND v.week_start = public.current_week_start()
      ),
      0
    )
    WHERE s.status = 'live';

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'week_start', v_week_start,
      'week_end', v_week_end,
      'total_votes', 0,
      'winners_count', 0,
      'message', 'Zero votes cast for this week. No shortlist generated.'
    );
  END IF;

  -- 2. Select top 3 stories by votes specifically cast during target week
  -- TIE HANDLING: Ordered by COUNT(v.id) DESC, then earliest upload (s.created_at ASC) as tie-breaker
  FOR v_winner IN (
    SELECT
      s.id AS story_id,
      s.title_telugu,
      s.narrator_id,
      COUNT(v.id)::INTEGER AS week_votes,
      pg_catalog.row_number() OVER (
        ORDER BY COUNT(v.id) DESC, s.created_at ASC
      ) AS winner_rank
    FROM public.stories s
    INNER JOIN public.votes v ON v.story_id = s.id AND v.week_start = v_week_start
    WHERE s.status = 'live'
    GROUP BY s.id, s.title_telugu, s.narrator_id, s.created_at
    HAVING COUNT(v.id) > 0
    ORDER BY COUNT(v.id) DESC, s.created_at ASC
    LIMIT 3
  ) LOOP
    -- EXACTLY ONE REWARD WINNER:
    -- Rank 1 receives ₹1,000 upon admin confirmation; ranks 2 and 3 carry ₹0 reward.
    INSERT INTO public.weekly_winners (
      story_id,
      narrator_id,
      week_start,
      week_end,
      vote_count,
      rank,
      reward_amount,
      reward_currency,
      status
    ) VALUES (
      v_winner.story_id,
      v_winner.narrator_id,
      v_week_start,
      v_week_end,
      v_winner.week_votes,
      v_winner.winner_rank,
      CASE WHEN v_winner.winner_rank = 1 THEN 1000 ELSE 0 END,
      'INR',
      'shortlisted' -- Pending admin confirmation
    )
    ON CONFLICT (week_start, rank) DO UPDATE SET
      story_id = EXCLUDED.story_id,
      narrator_id = EXCLUDED.narrator_id,
      vote_count = EXCLUDED.vote_count,
      reward_amount = EXCLUDED.reward_amount;

    IF v_winner.winner_rank = 1 THEN
      v_top_story_title := v_winner.title_telugu;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- 3. Notify Admins that weekly shortlist is ready for review
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'editorial_shortlist',
    '📋 Weekly Shortlist Ready for Review',
    'Week ' || v_week_start::text || ' shortlist generated. Leader: "' || COALESCE(v_top_story_title, 'Story') || '". Please review and confirm the winner.',
    pg_catalog.jsonb_build_object('week_start', v_week_start, 'top_story_title', v_top_story_title, 'candidates', v_count)
  FROM public.profiles p
  WHERE p.role = 'admin';

  -- 4. Reset stories.vote_count for the new active competition week (Monday start)
  PERFORM pg_catalog.set_config('app.trusted_internal_update', 'true', true);
  UPDATE public.stories s
  SET vote_count = COALESCE(
    (
      SELECT COUNT(v.id)::INTEGER
      FROM public.votes v
      WHERE v.story_id = s.id
        AND v.week_start = public.current_week_start()
    ),
    0
  )
  WHERE s.status = 'live';

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'week_start', v_week_start,
    'week_end', v_week_end,
    'total_votes', v_total_votes,
    'winners_count', v_count,
    'status', 'shortlist_created_pending_admin_confirmation'
  );
END;
$$;

-- 8. CONFIRM WEEKLY WINNER (ADMIN ONLY)
DROP FUNCTION IF EXISTS public.confirm_weekly_winner(UUID, DATE) CASCADE;
CREATE OR REPLACE FUNCTION public.confirm_weekly_winner(
  p_story_id UUID,
  p_week_start DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller UUID;
  v_week_start DATE;
  v_winner RECORD;
BEGIN
  -- 1. Verify admin privilege
  v_caller := auth.uid();
  IF v_caller IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can confirm weekly winners';
  END IF;

  -- 2. Target week
  IF p_week_start IS NOT NULL THEN
    v_week_start := p_week_start;
  ELSE
    SELECT week_start INTO v_week_start
    FROM public.weekly_winners
    WHERE story_id = p_story_id
    ORDER BY week_start DESC
    LIMIT 1;

    IF v_week_start IS NULL THEN
      v_week_start := public.current_week_start() - 7;
    END IF;
  END IF;

  -- 3. Confirm winner entry
  UPDATE public.weekly_winners
  SET
    status = 'confirmed',
    confirmed_by = v_caller,
    confirmed_at = NOW(),
    announced_at = NOW()
  WHERE story_id = p_story_id
    AND week_start = v_week_start
    AND rank = 1
  RETURNING * INTO v_winner;

  IF v_winner.id IS NULL THEN
    RAISE EXCEPTION 'Story % is not shortlisted as Rank 1 for week %', p_story_id, v_week_start;
  END IF;

  -- 4. Mark story as weekly winner using trusted internal update
  PERFORM pg_catalog.set_config('app.trusted_internal_update', 'true', true);
  UPDATE public.stories
  SET is_weekly_winner = true
  WHERE id = p_story_id;

  -- 5. Send notification to winning narrator
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_winner.narrator_id,
    'weekly_winner',
    '🎉 Congratulations! Your story won Story of the Week!',
    'Your story placed #1 with ' || v_winner.vote_count || ' votes. ₹1,000 cash reward confirmed by editorial desk!',
    pg_catalog.jsonb_build_object(
      'story_id', v_winner.story_id,
      'rank', 1,
      'reward_amount', 1000,
      'week_start', v_week_start
    )
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'winner_id', v_winner.id,
    'story_id', v_winner.story_id,
    'narrator_id', v_winner.narrator_id,
    'reward_amount', v_winner.reward_amount,
    'week_start', v_winner.week_start,
    'status', 'confirmed'
  );
END;
$$;

-- 8. AUTH USER CREATION TRIGGER (STRICT ZERO-TRUST ROLE ASSIGNMENT)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
-- ====================================================================
-- AUTH ERRORS AUDIT TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.auth_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  error_message TEXT NOT NULL,
  error_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_errors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_errors FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.auth_errors TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_display_name TEXT;
  v_username TEXT;
  v_phone TEXT;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    pg_catalog.split_part(COALESCE(NEW.email, 'storyteller@kathalu.app'), '@', 1)
  );

  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    'user_' || pg_catalog.replace(NEW.id::text, '-', '')
  );

  -- Ensure empty string phones are treated as NULL so unique constraints are never tripped
  v_phone := CASE
    WHEN NEW.phone IS NULL OR pg_catalog.length(pg_catalog.btrim(NEW.phone)) = 0 THEN NULL
    ELSE pg_catalog.btrim(NEW.phone)
  END;

  -- STRICT ZERO-TRUST: Role is always 'listener'. Client cannot pass 'admin' or 'narrator'
  INSERT INTO public.profiles (
    id,
    email,
    phone,
    display_name,
    username,
    avatar_url,
    role
  ) VALUES (
    NEW.id,
    NEW.email,
    v_phone,
    v_display_name,
    v_username,
    NEW.raw_user_meta_data->>'avatar_url',
    'listener'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user error for user %: % (SQLSTATE %)', NEW.id, SQLERRM, SQLSTATE;
    BEGIN
      INSERT INTO public.auth_errors (user_id, error_message, error_state)
      VALUES (NEW.id, SQLERRM, SQLSTATE);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Emergency fallback: attempt bare minimum profile creation so user is never orphaned
    BEGIN
      INSERT INTO public.profiles (id, email, display_name, username, role)
      VALUES (
        NEW.id,
        NEW.email,
        'కథకుడు (Storyteller)',
        'user_' || pg_catalog.substr(pg_catalog.replace(NEW.id::text, '-', ''), 1, 12),
        'listener'
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    EXCEPTION WHEN OTHERS THEN
      -- If emergency profile creation also fails, FAIL VISIBLY so sign-up rolls back
      RAISE EXCEPTION 'User signup failed: could not create profile for %: %', NEW.id, SQLERRM;
    END;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- FUNCTION PERMISSIONS: STRICT PRINCIPLE OF LEAST PRIVILEGE
-- ====================================================================

-- 1. Revoke execute on all public functions from PUBLIC, anon, and authenticated
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 2. Explicitly grant only what is required
-- Trigger functions must be executable by the roles invoking operations on the underlying tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_story_update() TO postgres, service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_profile_update() TO postgres, service_role, authenticated, anon;

-- Public and user-facing business logic
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_week_start() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cast_vote(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_play_count(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_story(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tally_weekly_winners(DATE) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_weekly_winner(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_upload_credit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_upload_credit(UUID, UUID) TO service_role;

-- Safe views permissions
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;
GRANT SELECT ON public.reports TO authenticated, service_role;

-- ====================================================================
-- SCHEMA DRIFT & POLICIES INSPECTION VIEWS (SERVICE ROLE & AUDIT)
-- ====================================================================
CREATE OR REPLACE VIEW public.storage_policies_view AS
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

CREATE OR REPLACE VIEW public.schema_inspection_view AS
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public';

CREATE OR REPLACE VIEW public.policies_inspection_view AS
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname IN ('public', 'storage');

CREATE OR REPLACE VIEW public.routines_inspection_view AS
SELECT 
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public';

CREATE OR REPLACE VIEW public.triggers_inspection_view AS
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public' OR event_object_schema IN ('public', 'auth');

GRANT SELECT ON public.storage_policies_view TO service_role, authenticated;
GRANT SELECT ON public.schema_inspection_view TO service_role;
GRANT SELECT ON public.policies_inspection_view TO service_role;
GRANT SELECT ON public.routines_inspection_view TO service_role;
GRANT SELECT ON public.triggers_inspection_view TO service_role;

-- ====================================================================
-- PRIVATE STORAGE BUCKETS (AUDIO & COVERS)
-- Requires Available Upload Credit to Upload
-- ====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES
      ('story-audio', 'story-audio', false, 26214400, ARRAY['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav']),
      ('story-covers', 'story-covers', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET
      public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    -- Storage upload policy: Authenticated users can only upload to {auth.uid()}/* AND must have an available upload credit
    DROP POLICY IF EXISTS "Users can upload to own audio folder" ON storage.objects;
    CREATE POLICY "Users can upload to own audio folder"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id IN ('story-audio', 'story-covers')
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.upload_credits
          WHERE user_id = auth.uid() AND status = 'available'
        )
      );

    DROP POLICY IF EXISTS "Users can view own audio files" ON storage.objects;
    CREATE POLICY "Users can view own audio files"
      ON storage.objects FOR SELECT
      USING (
        bucket_id IN ('story-audio', 'story-covers')
        AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR public.is_admin()
        )
      );
  END IF;
END $$;

-- ====================================================================
-- REALTIME PUBLICATION (ONLY STORIES AND NOTIFICATIONS; VOTES EXCLUDED)
-- ====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'stories'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    -- Ensure votes is NOT in realtime publication
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'votes'
    ) THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.votes;
    END IF;
  END IF;
END $$;
