-- ====================================================================
-- ⚠️ WARNING: STAGING-ONLY DATABASE RESET SCRIPT
-- ====================================================================
-- THIS SCRIPT PERMANENTLY DROPS ALL KATHALU TABLES, VIEWS, FUNCTIONS,
-- TRIGGERS, STORAGE OBJECTS, AND ROW-LEVEL SECURITY POLICIES.
--
-- 🛑 DO NOT RUN THIS SCRIPT ON PRODUCTION!
-- THIS IS INTENDED STRICTLY FOR RE-INITIALIZING STAGING ENVIRONMENTS.
-- ====================================================================

-- 1. DROP TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS enforce_story_update ON public.stories;

-- 2. DROP VIEWS
DROP VIEW IF EXISTS public.public_profiles CASCADE;
DROP VIEW IF EXISTS public.reports CASCADE;

-- 3. REMOVE FROM REALTIME PUBLICATION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'stories') THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.stories;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'votes') THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.votes;
    END IF;
  END IF;
END $$;

-- 4. DROP FUNCTIONS (CASCADE removes dependent function permissions)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.check_story_update() CASCADE;
DROP FUNCTION IF EXISTS public.cast_vote(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.cast_vote(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment_play_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.create_story(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.grant_upload_credit(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.consume_upload_credit(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.tally_weekly_winners() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.current_week_start() CASCADE;

-- 5. DROP TABLES IN FOREIGN KEY DEPENDENCY ORDER
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.story_reports CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.weekly_winners CASCADE;
DROP TABLE IF EXISTS public.votes CASCADE;
DROP TABLE IF EXISTS public.stories CASCADE;
DROP TABLE IF EXISTS public.upload_credits CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 6. DROP STORAGE POLICIES & REMOVE KATHALU STORAGE BUCKETS (SAFE EXCEPTION HANDLING)
DO $$
BEGIN
  -- Safe removal of policies if storage schema exists
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    BEGIN
      DROP POLICY IF EXISTS "Users can upload to own audio folder" ON storage.objects;
      DROP POLICY IF EXISTS "Users can view own audio files" ON storage.objects;
      DROP POLICY IF EXISTS "Users can upload to own audio folder with credit" ON storage.objects;
      DROP POLICY IF EXISTS "Public can view story audio and covers" ON storage.objects;
    EXCEPTION WHEN OTHERS THEN
      -- Ignore policy drop errors
    END;

    BEGIN
      DELETE FROM storage.objects WHERE bucket_id IN ('story-audio', 'story-covers');
    EXCEPTION WHEN OTHERS THEN
      -- Ignore storage deletion errors (e.g. if objects table is protected)
    END;

    BEGIN
      DELETE FROM storage.buckets WHERE id IN ('story-audio', 'story-covers');
    EXCEPTION WHEN OTHERS THEN
      -- Ignore bucket deletion errors (e.g. foreign key or permission constraints)
    END;
  END IF;
END $$;

-- Reset complete notification
SELECT 'Kathalu staging database objects successfully reset.' AS status;

