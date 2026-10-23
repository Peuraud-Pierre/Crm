-- Add missing columns to tickets table if they don't exist
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS close_reason TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;