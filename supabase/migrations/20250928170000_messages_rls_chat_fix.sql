-- Harmonise la politique de lecture des messages pour les discussions directes et groupes

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'messages'
          and policyname = 'Users can view their messages'
    ) then
        drop policy "Users can view their messages" on public.messages;
    end if;
end;
$$;

create policy "Users can view their messages"
    on public.messages
    for select
    using (
        auth.uid() = sender_id
        or auth.uid() = recipient_id
        or (
            chat_id is not null
            and chat_id in (
                select id_chat
                from public.created_chat
                where created_by = auth.uid()
                   or with_id = auth.uid()
            )
        )
        or (
            coalesce(group_id, groupe_id) is not null
            and (
                coalesce(group_id, groupe_id) in (
                    select id
                    from public.groups
                    where created_by = auth.uid()
                )
                or coalesce(group_id, groupe_id) in (
                    select group_id
                    from public.groupe_participant
                    where participant = auth.uid()
                )
            )
        )
    );
