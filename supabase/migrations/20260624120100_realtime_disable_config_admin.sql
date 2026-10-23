-- Retrait des tables de configuration / admin quasi statiques de la publication
-- Realtime `supabase_realtime` (vague 🟠).
--
-- Pourquoi : ces tables ne changent que très rarement (config admin, contenu
-- édité ponctuellement). Le Realtime n'y apporte aucune valeur collaborative ;
-- les écrans concernés se rechargent au montage et les mutations locales
-- gardent l'affichage à jour (voir hooks useRoles / useServices / useType /
-- useProduct / useChangelog / useMaintenance / useAnnonce). Les retirer de la
-- publication réduit le nombre de tables dont le WAL est décodé en continu.
--
-- Idempotent : DROP conditionnel (ne casse pas si la table n'est pas publiée).

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'roles',                 -- rôles (config admin)
        'services',              -- services + permissions (config admin)
        'Type_product_CRM',      -- types de produits CRM (config quasi statique)
        'changelog_versions',    -- changelog (édité ponctuellement par admin)
        'changelog_items',
        'changelog_categories',
        'Maintenance',           -- bandeau de maintenance (rare)
        'annonce'                -- annonces système (rare)
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t
            );
            RAISE NOTICE 'Realtime désactivé pour public.%', t;
        END IF;
    END LOOP;
END;
$$;
