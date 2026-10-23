-- Update pending notification when message is delivered

create or replace function public.notify_cryptedmessage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_count integer;
begin
    if new.recipient_id is null or new.sender_id = new.recipient_id then
        return new;
    end if;

    update public.notification
    set title = 'Nouveau message',
        type = 'message',
        url = '/messages',
        read = false,
        created_at = now()
    where user_id = new.recipient_id
      and title = 'Message en attente';

    get diagnostics updated_count = row_count;
    if updated_count > 0 then
        return new;
    end if;

    insert into public.notification (user_id, title, type, url, read, created_at)
    values (
        new.recipient_id,
        'Nouveau message',
        'message',
        '/messages',
        false,
        now()
    );

    return new;
end;
$$;

drop trigger if exists cryptedmessage_notify on public.cryptedmessage;

create trigger cryptedmessage_notify
    after insert on public.cryptedmessage
    for each row
    execute function public.notify_cryptedmessage();
