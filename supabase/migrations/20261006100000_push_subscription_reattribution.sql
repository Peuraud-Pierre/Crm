-- Abonnement push : réattribuer l'endpoint au compte connecté.
--
-- L'endpoint push appartient au NAVIGATEUR, pas au compte. Quand un compte B
-- se connecte sur un navigateur déjà abonné par un compte A, l'upsert client
-- (ON CONFLICT (endpoint) DO UPDATE) touche la ligne de A : la policy UPDATE
-- (uid() = user_id) la refuse → 42501 « new row violates row-level security
-- policy », B ne reçoit rien et A reçoit ses push sur le navigateur de B.
--
-- Le compte connecté est celui qui utilise le navigateur : il reprend
-- l'endpoint. user_id vient toujours de auth.uid(), jamais du client.
-- Les policies existantes ne changent pas.

create or replace function public.save_push_subscription(
    p_endpoint text,
    p_subscription jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated' using errcode = '42501';
    end if;

    insert into public.push_subscriptions (user_id, endpoint, subscription)
    values (auth.uid(), p_endpoint, p_subscription)
    on conflict (endpoint) do update
        set user_id = excluded.user_id,
            subscription = excluded.subscription,
            updated_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, jsonb) from public, anon;
grant execute on function public.save_push_subscription(text, jsonb) to authenticated;
