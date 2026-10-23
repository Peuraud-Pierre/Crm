-- ============================================================
-- Budget du brief : nouvelles tranches 800 - 1.5k et 1.5k - 3k
-- ============================================================
-- brief_cat est la seule référence des libellés de budget côté CRM (la copie
-- en dur budgetMap de CrmTab.ts est supprimée) :
--   500 - 1k → 800 - 1.5k
--   1k - 3k  → 1.5k - 3k
--
-- 1. brief_cat renommé EN PLACE (exception à la règle « désactiver + recréer »
--    de 20260813120000) : l'ordre d'affichage suit l'id, une nouvelle ligne
--    passerait après « +5k ».
-- 2. Les briefs clients qui portent une ancienne tranche sont convertis, sinon
--    aucun badge ne serait plus sélectionné sur ces fiches. Variantes
--    d'écriture acceptées (espaces, €, casse, 1000 = 1k) : « 500-1000 »,
--    « 500 - 1000 € », « 1000-3000 »… client_crm.brief
--    est un objet jsonb OU une chaîne jsonb contenant l'objet (écritures
--    historiques du front, cf. 20260915120000) : les deux formes sont lues et
--    réécrites en objet. Une chaîne illisible est ignorée, sans faire échouer
--    la migration. L'historique client_amelia_submissions n'est pas touché.
--    ⚠️ Le trigger log_client_crm_changes ajoute « Brief / fiche appro mis à
--    jour » dans l'activité de chaque fiche convertie.
--
-- À faire EN MÊME TEMPS dans Amelia (prod et preprod), champ 11 « Quel est
-- votre budget? » : renommer les deux mêmes options. Le bridge transmet la
-- valeur telle quelle (pas de correspondance dans brief_canonical.go).
--
-- Idempotent : relancée, elle ne trouve plus d'ancien libellé.
-- ============================================================

BEGIN;

-- ── 1. Libellés de référence ───────────────────────────────────────────
UPDATE public.brief_cat SET type = '800 - 1.5k'
 WHERE categorie = 'budgets' AND type = '500 - 1k';
UPDATE public.brief_cat SET type = '1.5k - 3k'
 WHERE categorie = 'budgets' AND type = '1k - 3k';

-- ── 2. Briefs clients ──────────────────────────────────────────────────
DO $$
DECLARE
    r       record;
    v_brief jsonb;
    v_key   text;
    v_new   text;
    v_count int := 0;
BEGIN
    FOR r IN
        SELECT id, brief FROM public.client_crm
         WHERE brief IS NOT NULL
           AND brief::text ~* 'budget'
    LOOP
        BEGIN
            v_brief := CASE WHEN jsonb_typeof(r.brief) = 'string'
                            THEN (r.brief #>> '{}')::jsonb
                            ELSE r.brief END;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Brief illisible ignoré (client %)', r.id;
            CONTINUE;
        END;

        -- Tranche normalisée : sans espaces ni €, en minuscules, 000 → k.
        v_key := replace(lower(regexp_replace(v_brief->>'budget', '[[:space:]€]', '', 'g')), '000', 'k');
        v_new := CASE v_key
                     WHEN '500-1k' THEN '800 - 1.5k'
                     WHEN '1k-3k'  THEN '1.5k - 3k'
                 END;
        CONTINUE WHEN v_new IS NULL OR jsonb_typeof(v_brief) <> 'object';

        UPDATE public.client_crm
           SET brief = jsonb_set(v_brief, '{budget}', to_jsonb(v_new))
         WHERE id = r.id;
        v_count := v_count + 1;
    END LOOP;
    RAISE NOTICE '% brief(s) converti(s)', v_count;
END $$;

COMMIT;

-- ------------------------------------------------------------
-- Avant d'appliquer : nombre de fiches qui seront converties
-- ------------------------------------------------------------
-- Budgets réellement présents en base (à relire : une écriture absente de la
-- conversion ci-dessus resterait telle quelle) :
--   select b, count(*) from (
--     select case when jsonb_typeof(brief) = 'string'
--                 then (brief #>> '{}')::jsonb->>'budget'
--                 else brief->>'budget' end as b
--       from public.client_crm where brief is not null
--   ) t group by b order by 2 desc;
