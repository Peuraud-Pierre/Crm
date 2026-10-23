-- ============================================================
-- Publication Realtime de Event_calendar — requis par l'onglet
-- Monopoly CRM (pions + lancer de dés animé en direct quand un
-- setter crée un événement).
--
-- Trade-off assumé vs 20260624120000_realtime_disable_logs_kpis :
-- Event_calendar est une table à écriture soutenue, mais contrairement
-- aux logs elle a une vraie valeur collaborative temps réel (calendrier
-- partagé + plateau Monopoly). Un seul canal client écoute la table
-- (monopoly_events_realtime, refetch débouncé 500 ms) — pas de fan-out
-- par ligne côté client.
--
-- Idempotent : ré-exécutable sans erreur si la table est déjà publiée.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'Event_calendar'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public."Event_calendar";
    END IF;
END $$;
