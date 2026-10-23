-- Create ping pong players table with ELO rating
CREATE TABLE public.ping_pong_players (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  elo_rating integer NOT NULL DEFAULT 500,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create tournaments table
CREATE TABLE public.tournaments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid,
  player1_id uuid NOT NULL,
  player2_id uuid NOT NULL,
  player1_score integer DEFAULT 0,
  player2_score integer DEFAULT 0,
  winner_id uuid,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  played_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all ping pong tables
ALTER TABLE public.ping_pong_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ping_pong_players
CREATE POLICY "Everyone can view ping pong players" 
ON public.ping_pong_players 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create their own ping pong profile" 
ON public.ping_pong_players 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ping pong profile" 
ON public.ping_pong_players 
FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for tournaments
CREATE POLICY "Everyone can view tournaments" 
ON public.tournaments 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create tournaments" 
ON public.tournaments 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Tournament creators can update their tournaments" 
ON public.tournaments 
FOR UPDATE 
USING (auth.uid() = created_by);

-- RLS Policies for matches
CREATE POLICY "Everyone can view matches" 
ON public.matches 
FOR SELECT 
USING (true);

CREATE POLICY "Players can create matches" 
ON public.matches 
FOR INSERT 
WITH CHECK (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Players can update their matches" 
ON public.matches 
FOR UPDATE 
USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_ping_pong_players_updated_at
  BEFORE UPDATE ON public.ping_pong_players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add tables to realtime
ALTER TABLE public.ping_pong_players REPLICA IDENTITY FULL;
ALTER TABLE public.tournaments REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;