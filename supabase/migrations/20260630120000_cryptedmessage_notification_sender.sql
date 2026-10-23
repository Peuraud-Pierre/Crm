-- Notifications push de message : afficher l'EXPÉDITEUR (nom + avatar) au lieu
-- du générique "Nouveau message". Le titre = nom de l'expéditeur, et on ajoute
-- une colonne `icon` (URL avatar) propagée jusqu'au service worker.

alter table public.notification add column if not exists icon text;

create or replace function public.notify_cryptedmessage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name   text;
    v_avatar text;
begin
    if new.recipient_id is null or new.sender_id = new.recipient_id then
        return new;
    end if;

    -- Expéditeur : nom + avatar (cryptedmessage.sender_id = profiles.user_id).
    -- security definer → accès profiles garanti malgré la RLS.
    select coalesce(nullif(p.full_name, ''), 'Nouveau message'), p.avatar_url
      into v_name, v_avatar
      from public.profiles p
     where p.user_id = new.sender_id;

    insert into public.notification (user_id, title, type, url, icon, read, created_at)
    values (
        new.recipient_id,
        coalesce(v_name, 'Nouveau message'),
        'message',
        -- Deep-link : ouvre directement la conversation avec l'expéditeur.
        '/messages?user=' || new.sender_id::text,
        v_avatar,
        false,
        now()
    );

    return new;
end;
$$;

-- Le trigger cryptedmessage_notify existe déjà et reste lié à cette fonction.
