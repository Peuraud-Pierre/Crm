-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-attachments', 'ticket-attachments', false);

-- Create storage policies for ticket attachments
CREATE POLICY "Users can upload their ticket attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'ticket-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view ticket attachments they have access to" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'ticket-attachments' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    -- Allow access if user created the ticket or is assigned to it
    EXISTS (
      SELECT 1 FROM public.tickets 
      WHERE id::text = (storage.foldername(name))[2] 
      AND (user_id = auth.uid() OR assigned_to = auth.uid())
    )
  )
);

CREATE POLICY "Users can delete their ticket attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'ticket-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);