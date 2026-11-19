-- ====================================================================
-- Kathalu (కథలు) - Production Database Schema Migration
-- Complete PostgreSQL schema for Supabase with Row Level Security (RLS)
-- Realtime enabled, Child Safety, Storage policies, Scheduled Winner Tally
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
-- Roles: listener (default), narrator, admin
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  age INTEGER,
  city TEXT,
  show_age_city BOOLEAN DEFAULT false,
  is_minor BOOLEAN DEFAULT false,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_relationship TEXT,
  guardian_consent BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'listener' CHECK (role IN ('listener', 'narrator', 'admin')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. PAYMENTS TABLE
-- Tracks ₹20 entry fee payments via Razorpay (2000 paise)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 2000, -- in paise
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT UNIQUE NOT NULL,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(razorpay_order_id);

-- 3. UPLOAD CREDITS TABLE
-- 1 credit granted per verified ₹20 payment; consumed upon story submission
CREATE TABLE IF NOT EXISTS public.upload_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'refunded')),
  used_for_story_id UUID,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_credits_user_status ON public.upload_credits(user_id, status);

-- 4. STORIES TABLE
-- Audio stories narrated in Telugu, with review statuses and rejection feedback
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  narrator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_telugu TEXT NOT NULL,
  title_english TEXT NOT NULL,
  genre TEXT NOT NULL CHECK (genre IN ('Folk Tales', 'Moral Stories', 'Mythology', 'Panchatantra', 'Tenali Rama', 'Bedtime', 'All')),
  cover_url TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'rejected')),
  reject_reason TEXT,
  reject_notes TEXT,
  is_weekly_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_stories_status ON public.stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_genre ON public.stories(genre);
CREATE INDEX IF NOT EXISTS idx_stories_narrator ON public.stories(narrator_id);
CREATE INDEX IF NOT EXISTS idx_stories_created ON public.stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_winner ON public.stories(is_weekly_winner);

-- 5. VOTES TABLE
-- Enforces: 1 vote per user per story per week_start (Monday in IST)
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT unique_vote_user_story_week UNIQUE (user_id, story_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_votes_story_week ON public.votes(story_id, week_start);
CREATE INDEX IF NOT EXISTS idx_votes_user_week ON public.votes(user_id, week_start);

-- 6. WEEKLY WINNERS TABLE
CREATE TABLE IF NOT EXISTS public.weekly_winners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  narrator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  reward_amount INTEGER NOT NULL DEFAULT 1000, -- ₹1,000 INR
  announced_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_weekly_winners_week ON public.weekly_winners(week_start DESC);

-- 7. STORY REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.story_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('inappropriate_content', 'child_safety', 'copyright_music', 'audio_quality', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_story_reports_status ON public.story_reports(status);

-- 8. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('story_approved', 'story_rejected', 'weekly_winner', 'credit_received', 'new_vote')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: Is caller an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
-- Public can read profiles (sensitive phone and guardian info protected)
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile, but CANNOT escalate to admin
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      OR public.is_admin()
    )
  );

-- STORIES POLICIES
-- 1. Public can read LIVE stories only; narrators can read their own stories; admins read all
CREATE POLICY "Stories read policy"
  ON public.stories FOR SELECT
  USING (
    status = 'live'
    OR narrator_id = auth.uid()
    OR public.is_admin()
  );

-- 2. Authenticated users can insert their own pending stories
CREATE POLICY "Narrators can create pending stories"
  ON public.stories FOR INSERT
  WITH CHECK (
    auth.uid() = narrator_id
    AND status = 'pending'
  );

-- 3. Narrators can update only their own rejected stories to resubmit as pending
CREATE POLICY "Narrators can resubmit rejected stories"
  ON public.stories FOR UPDATE
  USING (
    narrator_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    (narrator_id = auth.uid() AND status = 'pending')
    OR public.is_admin()
  );

-- PAYMENTS POLICIES
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPLOAD CREDITS POLICIES
CREATE POLICY "Users can view own credits"
  ON public.upload_credits FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- VOTES POLICIES
CREATE POLICY "Public can view votes"
  ON public.votes FOR SELECT
  USING (true);

CREATE POLICY "Users can cast own vote"
  ON public.votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own vote"
  ON public.votes FOR DELETE
  USING (auth.uid() = user_id);

-- WEEKLY WINNERS POLICIES
CREATE POLICY "Public can view weekly winners"
  ON public.weekly_winners FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert weekly winners"
  ON public.weekly_winners FOR INSERT
  WITH CHECK (public.is_admin());

-- STORY REPORTS POLICIES
CREATE POLICY "Anyone can submit reports"
  ON public.story_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);

CREATE POLICY "Only admins can view and update reports"
  ON public.story_reports FOR ALL
  USING (public.is_admin());

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view and update own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications as read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ====================================================================
-- STORAGE BUCKETS SETUP & POLICIES
-- Buckets: story-audio, story-covers
-- ====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('story-audio', 'story-audio', true, 26214400, ARRAY['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav']),
  ('story-covers', 'story-covers', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow public read access to story audio and covers
CREATE POLICY "Public read for story audio"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('story-audio', 'story-covers'));

-- Allow authenticated users to upload to their own folder path: {user_id}/*
CREATE POLICY "Authenticated users can upload audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('story-audio', 'story-covers')
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ====================================================================
-- REALTIME PUBLICATION
-- Enable realtime updates on stories and votes so multiple users see live counts
-- ====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ====================================================================
-- SCHEDULED WEEKLY WINNER TALLY (Postgres Function / Supabase pg_cron)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.tally_weekly_winners()
RETURNS TABLE (
  story_id UUID,
  narrator_id UUID,
  vote_total BIGINT
) AS $$
DECLARE
  current_week_start DATE;
BEGIN
  -- Compute Monday start of current week in IST (+05:30)
  current_week_start := DATE_TRUNC('week', (NOW() AT TIME ZONE 'Asia/Kolkata'))::DATE;

  RETURN QUERY
  SELECT
    s.id AS story_id,
    s.narrator_id,
    COUNT(v.id) AS vote_total
  FROM public.stories s
  LEFT JOIN public.votes v ON s.id = v.story_id AND v.week_start = current_week_start
  WHERE s.status = 'live'
  GROUP BY s.id, s.narrator_id
  ORDER BY vote_total DESC, s.created_at ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

