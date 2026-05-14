-- Supabase Schema for AgriBud (Idempotent Version)
-- 1. Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    preferred_language TEXT DEFAULT 'en',
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. Farmer Profiles
CREATE TABLE IF NOT EXISTS public.farmer_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    region TEXT,
    primary_crops TEXT [],
    -- Array of strings e.g. ['wheat', 'rice']
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2.1 Farmer Crops
CREATE TABLE IF NOT EXISTS public.farmer_crops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date_of_sowing DATE,
    location TEXT,
    -- Can be a description or coordinates
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    village_sensor_data JSONB,
    cubesat_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Ensure columns exist if table was created in an older version
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'farmer_crops'
        AND column_name = 'date_of_sowing'
) THEN
ALTER TABLE public.farmer_crops
ADD COLUMN date_of_sowing DATE;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'farmer_crops'
        AND column_name = 'location'
) THEN
ALTER TABLE public.farmer_crops
ADD COLUMN location TEXT;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'farmer_crops'
        AND column_name = 'latitude'
) THEN
ALTER TABLE public.farmer_crops
ADD COLUMN latitude DOUBLE PRECISION;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'farmer_crops'
        AND column_name = 'longitude'
) THEN
ALTER TABLE public.farmer_crops
ADD COLUMN longitude DOUBLE PRECISION;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'farmer_crops'
        AND column_name = 'village_sensor_data'
) THEN
ALTER TABLE public.farmer_crops
ADD COLUMN village_sensor_data JSONB;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'farmer_crops'
        AND column_name = 'cubesat_ip'
) THEN
ALTER TABLE public.farmer_crops
ADD COLUMN cubesat_ip TEXT;
END IF;
END $$;
-- 3. Chat Sessions
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    crop_id UUID REFERENCES public.farmer_crops(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    summary TEXT
);
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chat_sessions'
        AND column_name = 'summary'
) THEN
ALTER TABLE public.chat_sessions
ADD COLUMN summary TEXT;
END IF;
END $$;
-- 4. Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    image_url TEXT,
    -- Supabase Storage URL for frontend
    gemini_file_uri TEXT,
    -- Gemini API file reference for AI context
    metadata JSONB,
    -- For citations, search results, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Ensure gemini_file_uri exists if table was created in an older version
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chat_messages'
        AND column_name = 'gemini_file_uri'
) THEN
ALTER TABLE public.chat_messages
ADD COLUMN gemini_file_uri TEXT;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'chat_messages'
        AND column_name = 'metadata'
) THEN
ALTER TABLE public.chat_messages
ADD COLUMN metadata JSONB;
END IF;
END $$;
-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
-- Safely Create Policies (Checks if they exist first)
DO $$ BEGIN -- Profiles
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can view own profile'
) THEN CREATE POLICY "Users can view own profile" ON public.profiles FOR
SELECT USING (auth.uid() = id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can update own profile'
) THEN CREATE POLICY "Users can update own profile" ON public.profiles FOR
UPDATE USING (auth.uid() = id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can insert own profile'
) THEN CREATE POLICY "Users can insert own profile" ON public.profiles FOR
INSERT WITH CHECK (auth.uid() = id);
END IF;
-- Farmer Profiles
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can view own farmer profile'
) THEN CREATE POLICY "Users can view own farmer profile" ON public.farmer_profiles FOR
SELECT USING (auth.uid() = user_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can insert own farmer profile'
) THEN CREATE POLICY "Users can insert own farmer profile" ON public.farmer_profiles FOR
INSERT WITH CHECK (auth.uid() = user_id);
END IF;
-- Farmer Crops
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can view own crops'
) THEN CREATE POLICY "Users can view own crops" ON public.farmer_crops FOR
SELECT USING (auth.uid() = user_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can insert own crops'
) THEN CREATE POLICY "Users can insert own crops" ON public.farmer_crops FOR
INSERT WITH CHECK (auth.uid() = user_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can update own crops'
) THEN CREATE POLICY "Users can update own crops" ON public.farmer_crops FOR
UPDATE USING (auth.uid() = user_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can delete own crops'
) THEN CREATE POLICY "Users can delete own crops" ON public.farmer_crops FOR DELETE USING (auth.uid() = user_id);
END IF;
-- Chat Sessions
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can view own chat sessions'
) THEN CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions FOR
SELECT USING (auth.uid() = user_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can insert own chat sessions'
) THEN CREATE POLICY "Users can insert own chat sessions" ON public.chat_sessions FOR
INSERT WITH CHECK (auth.uid() = user_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can update own chat sessions'
) THEN CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions FOR
UPDATE USING (auth.uid() = user_id);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can delete own chat sessions'
) THEN CREATE POLICY "Users can delete own chat sessions" ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);
END IF;
-- Chat Messages
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can view messages of own sessions'
) THEN CREATE POLICY "Users can view messages of own sessions" ON public.chat_messages FOR
SELECT USING (
        session_id IN (
            SELECT id
            FROM public.chat_sessions
            WHERE user_id = auth.uid()
        )
    );
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Users can insert messages to own sessions'
) THEN CREATE POLICY "Users can insert messages to own sessions" ON public.chat_messages FOR
INSERT WITH CHECK (
        session_id IN (
            SELECT id
            FROM public.chat_sessions
            WHERE user_id = auth.uid()
        )
    );
END IF;
END $$;
-- 6. Setup Storage for Chat Media
-- Run this in Supabase SQL Editor to create the storage bucket and policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat_media', 
  'chat_media', 
  true,
  52428800,  -- 50MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm']
) ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];

-- Storage RLS Policies
-- Allow authenticated users to upload media to their own folder
DO $$ BEGIN
IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload own media'
) THEN
CREATE POLICY "Users can upload own media" ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'chat_media' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
END IF;

IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own media'
) THEN
CREATE POLICY "Users can view own media" ON storage.objects FOR SELECT
USING (
    bucket_id = 'chat_media' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
END IF;

-- Allow public read access since bucket is public (for displaying in chat)
IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view chat media'
) THEN
CREATE POLICY "Public can view chat media" ON storage.objects FOR SELECT
USING (bucket_id = 'chat_media');
END IF;
END $$;