-- Enable real-time for tickets table
ALTER TABLE public.tickets REPLICA IDENTITY FULL;

-- Add tickets table to realtime publication
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
  public.content_generation,
  public.groups,
  public.kpis,
  public.matches,
  public.messages,
  public.ping_pong_players,
  public.profiles,
  public.tickets,
  public.tournaments;