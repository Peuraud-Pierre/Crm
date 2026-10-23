-- À la création d'un RDV (Event_calendar) lié à un client, on affecte
-- automatiquement le closer du client au "customer" du RDV, càd le commercial
-- propriétaire de l'événement (Event_calendar.customer = owner ?? creator).
--
-- Évite que le closer reste en "non-assigné" lorsque l'événement est créé sans
-- owner explicite, et garantit la cohérence indépendamment du frontend.

create or replace function public.assign_closer_on_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id_client is not null and new.customer is not null then
    update public.client_crm
    set closers = new.customer,
        updated_at = now()
    where id = new.id_client;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_closer_on_event_insert on public."Event_calendar";

create trigger trg_assign_closer_on_event_insert
after insert on public."Event_calendar"
for each row
execute function public.assign_closer_on_event_insert();
