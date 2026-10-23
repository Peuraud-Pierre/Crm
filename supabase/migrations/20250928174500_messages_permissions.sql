-- Authorisation updates for messages (update/delete/read sync)

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'messages'
          and policyname = 'Users can update messages'
    ) then
        drop policy "Users can update messages" on public.messages;
    end if;

    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'messages'
          and policyname = 'Users can delete messages'
    ) then
        drop policy "Users can delete messages" on public.messages;
    end if;
end;
$$;

create policy "Users can update messages"
    on public.messages
    for update
    using (
        auth.uid() = sender_id
        or auth.uid() = recipient_id
        or (
            coalesce(group_id, groupe_id) in (
                select id from public.groups where created_by = auth.uid()
            )
        )
    )
    with check (
        auth.uid() = sender_id
        or auth.uid() = recipient_id
        or (
            coalesce(group_id, groupe_id) in (
                select id from public.groups where created_by = auth.uid()
            )
        )
    );

create policy "Users can delete messages"
    on public.messages
    for delete
    using (
        auth.uid() = sender_id
        or (
            coalesce(group_id, groupe_id) in (
                select id from public.groups where created_by = auth.uid()
            )
        )
    );

-- Ensure recipient_id is populated for direct messages
update public.messages m
set recipient_id = case
        when cc.created_by = m.sender_id then cc.with_id
        else cc.created_by
    end
from public.created_chat cc
where m.chat_id = cc.id_chat
  and m.recipient_id is null;
