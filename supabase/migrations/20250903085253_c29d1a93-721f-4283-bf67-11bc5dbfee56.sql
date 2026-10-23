-- Allow claiming unassigned tickets
CREATE POLICY "Users can claim unassigned tickets"
ON public.tickets
FOR UPDATE
USING (assigned_to IS NULL)
WITH CHECK (assigned_to = auth.uid());