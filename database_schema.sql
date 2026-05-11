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
  primary_crops TEXT[], -- Array of strings e.g. ['wheat', 'rice']
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.1 Farmer Crops
CREATE TABLE IF NOT EXISTS public.farmer_crops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_sowing DATE,
  location TEXT, -- Can be a description or coordinates
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was created in an older version
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farmer_crops' AND column_name='date_of_sowing') THEN
        ALTER TABLE public.farmer_crops ADD COLUMN date_of_sowing DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farmer_crops' AND column_name='location') THEN
        ALTER TABLE public.farmer_crops ADD COLUMN location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farmer_crops' AND column_name='latitude') THEN
        ALTER TABLE public.farmer_crops ADD COLUMN latitude DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='farmer_crops' AND column_name='longitude') THEN
        ALTER TABLE public.farmer_crops ADD COLUMN longitude DOUBLE PRECISION;
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

-- 4. Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  image_url TEXT, -- Supabase Storage URL for frontend
  gemini_file_uri TEXT, -- Gemini API file reference for AI context
  metadata JSONB, -- For citations, search results, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure gemini_file_uri exists if table was created in an older version
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='gemini_file_uri') THEN
        ALTER TABLE public.chat_messages ADD COLUMN gemini_file_uri TEXT;
    END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmer_crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Safely Create Policies (Checks if they exist first)
DO $$ 
BEGIN
    -- Profiles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
    END IF;

    -- Farmer Profiles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own farmer profile') THEN
        CREATE POLICY "Users can view own farmer profile" ON public.farmer_profiles FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own farmer profile') THEN
        CREATE POLICY "Users can insert own farmer profile" ON public.farmer_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Farmer Crops
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own crops') THEN
        CREATE POLICY "Users can view own crops" ON public.farmer_crops FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own crops') THEN
        CREATE POLICY "Users can insert own crops" ON public.farmer_crops FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own crops') THEN
        CREATE POLICY "Users can update own crops" ON public.farmer_crops FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own crops') THEN
        CREATE POLICY "Users can delete own crops" ON public.farmer_crops FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Chat Sessions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own chat sessions') THEN
        CREATE POLICY "Users can view own chat sessions" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own chat sessions') THEN
        CREATE POLICY "Users can insert own chat sessions" ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own chat sessions') THEN
        CREATE POLICY "Users can update own chat sessions" ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own chat sessions') THEN
        CREATE POLICY "Users can delete own chat sessions" ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Chat Messages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view messages of own sessions') THEN
        CREATE POLICY "Users can view messages of own sessions" ON public.chat_messages FOR SELECT USING (
          session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert messages to own sessions') THEN
        CREATE POLICY "Users can insert messages to own sessions" ON public.chat_messages FOR INSERT WITH CHECK (
          session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid())
        );
    END IF;
END $$;

-- 6. Setup Storage for Chat Media
-- Storage handling via SQL Editor (Requires manual check in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat_media', 'chat_media', true) ON CONFLICT DO NOTHING;
