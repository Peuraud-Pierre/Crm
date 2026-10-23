-- Enable realtime for tickets table
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Create tickets table for internal ticket system
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  assigned_to uuid,
  service text NOT NULL CHECK (service IN ('Tech', 'Commerce', 'Informatique', 'RH')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'Envoyé' CHECK (status IN ('Envoyé', 'Reçu', 'Traité', 'Terminé')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Users can create tickets
CREATE POLICY "Users can create tickets" 
ON public.tickets 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can view their own tickets and assigned tickets
CREATE POLICY "Users can view relevant tickets" 
ON public.tickets 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = assigned_to);

-- Users can update tickets they created or are assigned to
CREATE POLICY "Users can update relevant tickets" 
ON public.tickets 
FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = assigned_to);

-- Create trigger for automatic timestamp updates on tickets
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add tickets table to realtime
ALTER TABLE public.tickets REPLICA IDENTITY FULL;