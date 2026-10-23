-- Add new status 'Refusé' to tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS close_reason TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Update RLS policies to fix visibility issues
-- Allow users to view unassigned tickets from their services
DROP POLICY IF EXISTS "Users can view relevant tickets" ON public.tickets;

CREATE POLICY "Users can view relevant tickets" 
ON public.tickets 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (auth.uid() = assigned_to) OR 
  (assigned_to IS NULL)
);

-- Update claim policy to be more specific
DROP POLICY IF EXISTS "Users can claim unassigned tickets" ON public.tickets;

CREATE POLICY "Users can claim unassigned tickets" 
ON public.tickets 
FOR UPDATE 
USING (assigned_to IS NULL AND auth.uid() != user_id)
WITH CHECK (assigned_to = auth.uid());

-- Allow users to delete their own completed tickets
CREATE POLICY "Users can delete their completed tickets" 
ON public.tickets 
FOR DELETE 
USING (auth.uid() = user_id AND status = 'Terminé');