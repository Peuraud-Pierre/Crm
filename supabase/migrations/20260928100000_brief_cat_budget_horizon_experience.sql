-- ============================================================
-- brief_cat : budget, horizon et expérience deviennent éditables
-- ============================================================
-- Ces trois listes du brief (colonneBrief.tsx) étaient encore écrites en dur
-- dans le composant, contrairement aux six autres déjà dans brief_cat
-- (20260813120000_crm_brief_options.sql). Elles rejoignent la table sous les
-- catégories 'budgets', 'horizons' et 'experiences'.
--
-- Type d'activité et canal de vente restent en dur : des règles métier en
-- dépendent (E-shop ⇒ En ligne, Physique / Les deux ⇒ surface).
--
-- Valeurs seedées = libellés exacts actuels : les briefs déjà enregistrés et
-- la table de correspondance du bridge Amelia (brief_canonical.go, champs 8
-- et 9) les référencent par chaîne exacte — y compris "Immediat" sans accent.
-- L'ordre d'insertion est l'ordre d'affichage (listBriefOptions trie par id).
--
-- Idempotent : contrainte recréée à l'identique, compteur resynchronisé,
-- seed par catégorie absente.
-- ============================================================

BEGIN;

-- ── 1. Contrainte de catégorie élargie ─────────────────────────────────
-- brief_cat a été créée à la main : le nom de sa contrainte CHECK varie selon
-- l'environnement. On retire toute contrainte CHECK portant sur `categorie`
-- puis on la recrée sous un nom fixe.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conname
          FROM pg_constraint
         WHERE conrelid = 'public.brief_cat'::regclass
           AND contype = 'c'
           AND pg_get_constraintdef(oid) ILIKE '%categorie%'
    LOOP
        EXECUTE format('ALTER TABLE public.brief_cat DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE public.brief_cat
    ADD CONSTRAINT brief_cat_categorie_check CHECK (categorie IS NULL OR categorie IN (
        'plateformes', 'provenances', 'localisations',
        'produits', 'marques', 'styles', 'matieres',
        'budgets', 'horizons', 'experiences'
    ));

-- ── 2. Compteur d'id resynchronisé ─────────────────────────────────────
-- Des lignes ont été insérées avec un id explicite (table créée à la main) :
-- l'identité proposait un id déjà pris (« duplicate key brief_cat_pkey »),
-- ici comme à la création d'une option depuis l'admin CRM.
SELECT setval(
    pg_get_serial_sequence('public.brief_cat', 'id'),
    (SELECT COALESCE(max(id), 0) + 1 FROM public.brief_cat),
    false
);

-- ── 3. Seed : valeurs actuelles de colonneBrief.tsx, dans l'ordre d'affichage ──
INSERT INTO public.brief_cat (categorie, type)
SELECT seed.categorie, seed.type
  FROM (VALUES
    (1,  'budgets',     '500 - 1k'),
    (2,  'budgets',     '1k - 3k'),
    (3,  'budgets',     '3k - 5k'),
    (4,  'budgets',     '+5k'),

    (5,  'horizons',    'Immediat'),
    (6,  'horizons',    '1 mois'),
    (7,  'horizons',    '3 mois'),
    (8,  'horizons',    '6 mois'),

    (9,  'experiences', 'Nouveau'),
    (10, 'experiences', '0 - 1 ans'),
    (11, 'experiences', '1 - 3 ans'),
    (12, 'experiences', '+ 3 ans')
  ) AS seed(ord, categorie, type)
 WHERE NOT EXISTS (
    SELECT 1 FROM public.brief_cat b WHERE b.categorie = seed.categorie
 )
 ORDER BY seed.ord;

COMMIT;

-- ------------------------------------------------------------
-- Vérification après application
-- ------------------------------------------------------------
--   select categorie, type from public.brief_cat
--    where categorie in ('budgets', 'horizons', 'experiences')
--    order by categorie, id;
