-- Allow users to delete their direct conversations

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'direct_conversations'
          and policyname = 'Users can delete direct conversations'
    ) then
        drop policy "Users can delete direct conversations" on public.direct_conversations;
    end if;
end;
$$;

create policy "Users can delete direct conversations"
    on public.direct_conversations
    for delete
    using (auth.uid() = user_a or auth.uid() = user_b);
