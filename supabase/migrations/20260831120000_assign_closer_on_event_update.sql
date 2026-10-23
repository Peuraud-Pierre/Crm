-- Le trigger `trg_assign_closer_on_event_insert` (20260619120000) ne
-- s'exécutait que sur INSERT. Or réassigner le "Commercial" d'un RDV
-- existant (Event_calendar.customer) passe par un UPDATE
-- (use_calendar.tsx#update_Event), jamais par un INSERT : le closer du
-- client ne se mettait donc jamais à jour dans ce cas.
--
-- On étend la même fonction pour qu'elle se déclenche aussi sur UPDATE de
-- `customer`/`id_client`, en ne réécrivant `closers` que si l'une des deux
-- colonnes a effectivement changé (évite un UPDATE inutile sur client_crm
-- à chaque édition de RDV qui ne touche ni l'un ni l'autre).

create or replace function public.assign_closer_on_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id_client is not null and new.customer is not null then
    if tg_op = 'INSERT'
       or new.customer is distinct from old.customer
       or new.id_client is distinct from old.id_client
    then
      update public.client_crm
      set closers = new.customer,
          updated_at = now()
      where id = new.id_client;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_closer_on_event_insert on public."Event_calendar";

create trigger trg_assign_closer_on_event_insert
after insert or update of customer, id_client on public."Event_calendar"
for each row
execute function public.assign_closer_on_event_insert();
