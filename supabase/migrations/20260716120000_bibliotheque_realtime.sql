-- ============================================================
-- Publication Realtime de la Bibliothèque de réponses.
--
-- Bug corrigé : useBiblioRealtime.ts souscrit depuis sa création aux
-- 4 tables bibliotheque_* via `postgres_changes`, mais aucune migration
-- n'avait jamais ajouté ces tables à la publication `supabase_realtime`.
-- Résultat : aucun événement n'était jamais reçu par les clients — la
-- synchronisation temps réel entre utilisateurs était silencieusement
-- inopérante (les updates optimistes locales masquaient le problème
-- pour l'auteur de l'action, mais un second utilisateur ne recevait
-- jamais la mise à jour sans recharger la page).
--
-- REPLICA IDENTITY FULL sur bibliotheque_format_reponses : en identité
-- par défaut (DEFAULT = clé primaire uniquement), un événement DELETE
-- ne fournit dans `payload.old` que la colonne `id`. Or le code client
-- (useBiblioRealtime.ts) indexe son dictionnaire local par `quest_rep_id`
-- (la Q&R associée), pas par `id` de la ligne de formats. FULL fait en
-- sorte que Postgres inclue toutes les colonnes de l'ancienne ligne dans
-- `payload.old`, y compris `quest_rep_id`, ce qui est nécessaire pour
-- retirer la bonne entrée du state local à la suppression.
-- Les 3 autres tables n'ont pas besoin de FULL : leurs handlers DELETE
-- ne lisent que `id`, déjà présent en identité par défaut (clé primaire).
--
-- Idempotent : ré-exécutable sans erreur si déjà appliqué.
-- ============================================================

ALTER TABLE public.bibliotheque_format_reponses REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'bibliotheque_thematiques'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bibliotheque_thematiques;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'bibliotheque_questions_reponses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bibliotheque_questions_reponses;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'bibliotheque_format_reponses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bibliotheque_format_reponses;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'bibliotheque_brief'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bibliotheque_brief;
    END IF;
END $$;
