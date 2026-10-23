-- Digest stats CRM envoyé par pg_cron au lieu du compte à rebours du front.
--
-- Jusqu'ici, l'envoi automatique (lundi 8h : semaine / tous les soirs 19h :
-- jour) n'avait lieu que si la page /crm-admin était ouverte et active au
-- moment de l'échéance (NewsletterSendCountdown). Le cron appelle désormais
-- l'Edge Function `crm-stats-newsletter`, qui reconstruit le même classeur et
-- l'envoie via `POST /newsletter/upload`, sans navigateur.
--
-- pg_cron tourne en UTC : chaque job est planifié sur les deux heures UTC
-- correspondant à l'heure de Paris (été / hiver) ; la fonction ignore l'appel
-- dont l'heure locale ne correspond pas à `hour`.
--
-- Prérequis (à faire une fois par projet, hors migration — valeurs secrètes) :
--   select vault.create_secret(
--       'https://<project-ref>.supabase.co/functions/v1/crm-stats-newsletter',
--       'crm_stats_newsletter_url');
--   select vault.create_secret('<secret aléatoire>',
--       'crm_stats_newsletter_cron_secret');
--   supabase secrets set CRM_STATS_CRON_SECRET=<même secret>
--   supabase secrets set NEWSLETTER_API_URL=<PUBLIC_NEWSLETTER_API_URL>

create extension if not exists pg_net;

create or replace function public.trigger_crm_stats_newsletter(
    p_period text,
    p_hour int
)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_url    text;
    v_secret text;
begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets
    where name = 'crm_stats_newsletter_url';

    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'crm_stats_newsletter_cron_secret';

    if v_url is null or v_secret is null then
        raise warning 'trigger_crm_stats_newsletter : secrets vault '
            'crm_stats_newsletter_url / crm_stats_newsletter_cron_secret absents';
        return null;
    end if;

    return net.http_post(
        url                  => v_url,
        body                 => pg_catalog.jsonb_build_object(
                                    'period', p_period,
                                    'hour',   p_hour
                                ),
        params               => '{}'::jsonb,
        headers              => pg_catalog.jsonb_build_object(
                                    'Content-Type',  'application/json',
                                    'x-cron-secret', v_secret
                                ),
        timeout_milliseconds => 120000
    );
end;
$function$;

revoke all on function public.trigger_crm_stats_newsletter(text, int)
    from public, anon, authenticated;

comment on function public.trigger_crm_stats_newsletter(text, int) is
    'Appelle l''Edge Function crm-stats-newsletter (digest stats CRM). '
    'Appelé par les crons crm-stats-newsletter-week / -day.';

do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        if exists (select 1 from cron.job where jobname = 'crm-stats-newsletter-week') then
            perform cron.unschedule('crm-stats-newsletter-week');
        end if;
        if exists (select 1 from cron.job where jobname = 'crm-stats-newsletter-day') then
            perform cron.unschedule('crm-stats-newsletter-day');
        end if;

        -- Lundi 8h Paris = 06:00 UTC (été) ou 07:00 UTC (hiver).
        perform cron.schedule(
            'crm-stats-newsletter-week',
            '0 6,7 * * 1',
            $cmd$ select public.trigger_crm_stats_newsletter('week', 8); $cmd$
        );
        -- Tous les soirs 19h Paris = 17:00 UTC (été) ou 18:00 UTC (hiver).
        perform cron.schedule(
            'crm-stats-newsletter-day',
            '0 17,18 * * *',
            $cmd$ select public.trigger_crm_stats_newsletter('day', 19); $cmd$
        );
    else
        raise notice 'pg_cron absent : planifier trigger_crm_stats_newsletter() autrement.';
    end if;
end $$;
