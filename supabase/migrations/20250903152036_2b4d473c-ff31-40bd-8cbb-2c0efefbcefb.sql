-- Fix function search paths for security
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'Employé')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_elo_on_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  k_factor integer := 32;
  r1 float;
  r2 float;
  e1 float;
  e2 float;
  s1 float;
  s2 float;
  new_r1 integer;
  new_r2 integer;
  p1 record;
  p2 record;
  winner uuid;
BEGIN
  -- only run when setting to completed and not applied yet
  IF NEW.status <> 'completed' OR NEW.elo_applied = true THEN
    RETURN NEW;
  END IF;

  -- decide winner if not provided
  IF NEW.winner_id IS NULL THEN
    IF COALESCE(NEW.player1_score,0) > COALESCE(NEW.player2_score,0) THEN
      winner := NEW.player1_id;
    ELSE
      winner := NEW.player2_id;
    END IF;
    NEW.winner_id := winner;
  ELSE
    winner := NEW.winner_id;
  END IF;

  -- fetch players
  SELECT * INTO p1 FROM public.ping_pong_players WHERE user_id = NEW.player1_id LIMIT 1;
  SELECT * INTO p2 FROM public.ping_pong_players WHERE user_id = NEW.player2_id LIMIT 1;

  -- if profiles don't exist, create them with default ELO
  IF p1 IS NULL THEN
    INSERT INTO public.ping_pong_players(user_id) VALUES (NEW.player1_id) RETURNING * INTO p1;
  END IF;
  IF p2 IS NULL THEN
    INSERT INTO public.ping_pong_players(user_id) VALUES (NEW.player2_id) RETURNING * INTO p2;
  END IF;

  -- compute expected scores
  r1 := POWER(10, p1.elo_rating / 400.0);
  r2 := POWER(10, p2.elo_rating / 400.0);
  e1 := r1 / (r1 + r2);
  e2 := r2 / (r1 + r2);

  -- actual scores
  s1 := CASE WHEN winner = NEW.player1_id THEN 1 ELSE 0 END;
  s2 := CASE WHEN winner = NEW.player2_id THEN 1 ELSE 0 END;

  -- new ratings
  new_r1 := ROUND(p1.elo_rating + k_factor * (s1 - e1));
  new_r2 := ROUND(p2.elo_rating + k_factor * (s2 - e2));

  -- update players
  UPDATE public.ping_pong_players
    SET elo_rating = new_r1,
        wins = wins + (CASE WHEN s1 = 1 THEN 1 ELSE 0 END),
        losses = losses + (CASE WHEN s1 = 0 THEN 1 ELSE 0 END),
        updated_at = now()
    WHERE id = p1.id;

  UPDATE public.ping_pong_players
    SET elo_rating = new_r2,
        wins = wins + (CASE WHEN s2 = 1 THEN 1 ELSE 0 END),
        losses = losses + (CASE WHEN s2 = 0 THEN 1 ELSE 0 END),
        updated_at = now()
    WHERE id = p2.id;

  NEW.elo_applied := true;
  NEW.played_at := COALESCE(NEW.played_at, now());
  RETURN NEW;
END;
$function$;

-- Add RLS policy for results table (if it doesn't have any)
CREATE POLICY "Allow all operations on results" ON public.results FOR ALL USING (true);