-- Add profile picture support to users table
-- Run this in Supabase SQL Editor

-- Add avatar_url column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add phone number (optional)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create storage bucket for avatars (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add comment
COMMENT ON COLUMN users.avatar_url IS 'URL to user profile picture in Supabase Storage';
COMMENT ON COLUMN users.phone IS 'User phone number (optional)';

