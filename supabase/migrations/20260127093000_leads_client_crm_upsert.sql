-- Ensure lead insertions append to existing client messages instead of duplicating clients.
DROP TRIGGER IF EXISTS leads_client_crm_sync ON public.leads;
DROP FUNCTION IF EXISTS public.leads_client_crm_sync() CASCADE;

CREATE OR REPLACE FUNCTION public.leads_client_crm_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  matched_client uuid;
  previous_message text;
  formatted_message text;
  history_entry text;
BEGIN
  formatted_message := concat_ws(
    ' | ',
    NEW.message,
    'Budget: ' || COALESCE(NEW.budget::text, ''),
    'Arrivance: ' || COALESCE(NEW.arrivance, ''),
    'Type: ' || COALESCE(NEW.activity, '')
  );

  history_entry := concat('[', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), '] ', formatted_message);

  SELECT id, message
  INTO matched_client, previous_message
  FROM public.client_crm
  WHERE mail = NEW.email
  LIMIT 1;

  IF matched_client IS NOT NULL THEN
    UPDATE public.client_crm
    SET
      nom = NEW.name,
      telephone = NEW.phone,
      localisation = NEW.location,
      message = concat_ws(
        E'\n',
        NULLIF(previous_message, ''),
        history_entry
      ),
      updated_at = now(),
      collum = 0
    WHERE id = matched_client;
  ELSE
    INSERT INTO public.client_crm (
      nom, mail, telephone, localisation, message, updated_at, collum
    ) VALUES (
      NEW.name,
      NEW.email,
      NEW.phone,
      NEW.location,
      history_entry,
      now(),
      0
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_client_crm_sync
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_client_crm_sync();
