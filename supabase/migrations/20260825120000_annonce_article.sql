-- ============================================================
-- Annonces : passage de la notification au petit article.
-- Date: 2026-08-25
--
-- Contexte
-- --------
-- Une annonce se réduit aujourd'hui à un titre, un type et un bloc de
-- texte brut. L'intention, elle, est un journal interne : les
-- anniversaires, la vie de l'entreprise, les mises à jour du produit.
-- Un article de journal a un auteur, une date, un chapô et un corps
-- mis en forme. Aucun de ces quatre éléments n'existait.
--
-- Ce qui est ajouté
-- -----------------
--   author_id      la signature. Sans elle, une annonce n'est de
--                  personne, et une félicitation anonyme n'en est pas une.
--   excerpt        le chapô. C'est ce que lit le bandeau ; jusqu'ici il
--                  y affichait le début du corps, ce qui oblige à écrire
--                  un corps dont les premiers mots servent d'accroche.
--   body_markdown  le corps mis en forme. `description` reste la source
--                  des annonces existantes et n'est pas réécrite.
--   event_date     la date AFFICHÉE. Distincte de start_date, qui est la
--                  fenêtre de publication : on annonce le 20 un pot qui
--                  a lieu le 25.
--
-- Rubriques
-- ---------
-- `type` passe de trois à cinq valeurs. `celebration` et `release`
-- étaient jusqu'ici forcées dans `event` et `news`, ce qui les rendait
-- indistinguables — or ce sont précisément les deux rubriques que le
-- journal interne doit porter.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Colonnes ────────────────────────────────────────────────────────

ALTER TABLE public.annonce
    ADD COLUMN IF NOT EXISTS author_id     uuid,
    ADD COLUMN IF NOT EXISTS excerpt       text,
    ADD COLUMN IF NOT EXISTS body_markdown text,
    ADD COLUMN IF NOT EXISTS event_date    date;

COMMENT ON COLUMN public.annonce.author_id IS
    'Auteur de l''annonce (profiles.user_id). NULL pour les annonces antérieures à la signature.';
COMMENT ON COLUMN public.annonce.excerpt IS
    'Chapô : l''accroche affichée dans le bandeau et en tête d''article.';
COMMENT ON COLUMN public.annonce.body_markdown IS
    'Corps de l''article, en markdown restreint. Remplace `description` quand il est renseigné.';
COMMENT ON COLUMN public.annonce.event_date IS
    'Date affichée au lecteur — distincte de start_date, qui est la fenêtre de publication.';

-- La signature ne doit pas empêcher la suppression d'un compte : une
-- annonce publiée reste publiée, elle perd seulement son auteur.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'annonce_author_id_fkey'
          AND conrelid = 'public.annonce'::regclass
    ) THEN
        ALTER TABLE public.annonce
            ADD CONSTRAINT annonce_author_id_fkey
            FOREIGN KEY (author_id)
            REFERENCES public.profiles (user_id)
            ON DELETE SET NULL;
    END IF;
END
$$;

-- Bornes de longueur : la colonne alimente une carte et un bandeau, pas
-- un entrepôt. Elles valent pour les écritures futures uniquement, d'où
-- le NOT VALID — mais aucune ligne existante ne peut les violer,
-- puisque les deux colonnes viennent d'être créées vides.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'annonce_excerpt_len_check'
          AND conrelid = 'public.annonce'::regclass
    ) THEN
        ALTER TABLE public.annonce
            ADD CONSTRAINT annonce_excerpt_len_check
            CHECK (excerpt IS NULL OR char_length(excerpt) <= 280);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'annonce_body_len_check'
          AND conrelid = 'public.annonce'::regclass
    ) THEN
        ALTER TABLE public.annonce
            ADD CONSTRAINT annonce_body_len_check
            CHECK (body_markdown IS NULL OR char_length(body_markdown) <= 20000);
    END IF;
END
$$;

-- ─── 2. Rubriques : trois valeurs deviennent cinq ───────────────────────
-- La contrainte de 20260824102000 est remplacée. Elle reste NOT VALID
-- pour la même raison qu'alors : d'éventuelles lignes historiques hors
-- énumération ne doivent pas faire échouer la migration, et surtout pas
-- être réécrites en silence.
--
-- ⚠️ Après avoir traité les lignes signalées, valider la contrainte :
--      ALTER TABLE public.annonce VALIDATE CONSTRAINT annonce_type_check;

DO $$
DECLARE
    bad_count integer;
BEGIN
    SELECT count(*) INTO bad_count
    FROM public.annonce
    WHERE type IS NULL
       OR type NOT IN ('news', 'event', 'message', 'celebration', 'release');

    IF bad_count > 0 THEN
        RAISE WARNING
            'annonce.type : % ligne(s) hors des cinq rubriques. '
            'Les corriger puis exécuter '
            'ALTER TABLE public.annonce VALIDATE CONSTRAINT annonce_type_check;',
            bad_count;
    END IF;
END
$$;

ALTER TABLE public.annonce
    DROP CONSTRAINT IF EXISTS annonce_type_check;

ALTER TABLE public.annonce
    ADD CONSTRAINT annonce_type_check
    CHECK (type IN ('news', 'event', 'message', 'celebration', 'release'))
    NOT VALID;

COMMENT ON COLUMN public.annonce.type IS
    'Rubrique : news | event | message | celebration | release.';

-- ─── 3. Index ───────────────────────────────────────────────────────────
-- Inchangé : épinglées d'abord, puis les plus récemment ouvertes.
--
-- La tentation était d'indexer `coalesce(event_date, start_date::date)`,
-- pour coller au tri d'affichage. PostgreSQL le refuse (42P17) : le cast
-- de `timestamptz` vers `date` dépend du fuseau de la session, il est
-- donc STABLE et non IMMUTABLE, et une expression d'index doit être
-- immuable — sinon l'index deviendrait faux pour une session réglée sur
-- un autre fuseau.
--
-- L'index reste donc sur `start_date`, ce qui est sans conséquence :
-- `event_date` est une date d'affichage, pas un critère de sélection.
-- L'ordre final est de toute façon rétabli côté client par
-- `compareForDisplay`, sur un ensemble déjà réduit aux annonces en
-- ligne.

DROP INDEX IF EXISTS public.annonce_active_idx;
CREATE INDEX IF NOT EXISTS annonce_active_idx
    ON public.annonce (pinned DESC, start_date DESC)
    WHERE archived_at IS NULL;

-- ─── 4. RLS ─────────────────────────────────────────────────────────────
-- Rien à changer : la policy SELECT de 20260824102000 porte le ciblage
-- et les conditions temporelles, et aucune des colonnes ajoutées n'entre
-- dans une décision de visibilité.
