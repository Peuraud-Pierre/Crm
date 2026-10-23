-- ============================================================
-- Repointage des FK bloquantes auth.users → profiles
--
-- Suite de 20260831100000 (archivage des profils). Supprimer le compte auth
-- échouait encore : des tables référencent auth.users(id) directement, sans
-- ON DELETE (app_logs.user_id, code 23503). Les corriger une par une serait
-- sans fin — app_logs n'est même définie dans aucune migration du repo, et
-- rien n'empêche d'en créer d'autres à la main.
--
-- Traitement générique : toute FK public.* → auth.users(id) en NO ACTION /
-- RESTRICT (celles qui bloquent) est repointée vers profiles(user_id), dont
-- la colonne est UNIQUE. Le stub archivé survivant, la trace de l'auteur est
-- conservée intégralement — contrairement à un ON DELETE SET NULL qui aurait
-- anonymisé les journaux.
--
-- Les FK en CASCADE / SET NULL ne sont PAS touchées : elles ne bloquent pas et
-- expriment un choix voulu (user_preferences, dashboard_layout... = données du
-- compte, qui doivent bien disparaître avec lui).
--
-- NOT VALID : pas de scan des lignes existantes, donc pas d'échec sur les
-- éventuels orphelins historiques. Les écritures futures sont bien vérifiées.
-- ============================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.conname,
               t.relname  AS table_name,
               a.attname  AS column_name
        FROM pg_constraint c
        JOIN pg_class      t  ON t.oid  = c.conrelid
        JOIN pg_namespace  n  ON n.oid  = t.relnamespace
        JOIN pg_class      rt ON rt.oid = c.confrelid
        JOIN pg_namespace  rn ON rn.oid = rt.relnamespace
        JOIN pg_attribute  a  ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f'
          AND n.nspname  = 'public'
          AND rn.nspname = 'auth'
          AND rt.relname = 'users'
          AND c.confdeltype IN ('a', 'r')      -- NO ACTION / RESTRICT
          AND cardinality(c.conkey) = 1        -- FK simple colonne uniquement
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',
                       r.table_name, r.conname);
        EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I '
            'FOREIGN KEY (%I) REFERENCES public.profiles(user_id) NOT VALID',
            r.table_name, r.conname, r.column_name);
        RAISE NOTICE 'FK % (public.%.%) repointée vers profiles(user_id)',
                     r.conname, r.table_name, r.column_name;
    END LOOP;
END $$;

-- Garde-fou : la migration a échoué si une FK bloquante subsiste — sinon la
-- suppression d'utilisateur repartirait en 500 à la prochaine table oubliée.
DO $$
DECLARE
    v_left TEXT;
BEGIN
    SELECT string_agg(c.conname, ', ')
      INTO v_left
      FROM pg_constraint c
      JOIN pg_class     t  ON t.oid  = c.conrelid
      JOIN pg_namespace n  ON n.oid  = t.relnamespace
      JOIN pg_class     rt ON rt.oid = c.confrelid
      JOIN pg_namespace rn ON rn.oid = rt.relnamespace
     WHERE c.contype = 'f'
       AND n.nspname  = 'public'
       AND rn.nspname = 'auth'
       AND rt.relname = 'users'
       AND c.confdeltype IN ('a', 'r');

    IF v_left IS NOT NULL THEN
        RAISE EXCEPTION 'FK bloquantes vers auth.users encore présentes : %', v_left;
    END IF;
END $$;
