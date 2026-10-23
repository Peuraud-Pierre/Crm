-- ============================================================
-- Stock handpick — éclatement d'une balle
-- ============================================================
-- Éclater une balle la retire définitivement du stock : ses pièces partent
-- en vente à l'unité, aucune sous-balle n'est créée. La ligne reste en base
-- pour les statistiques (combien, quoi, qui, quand).
--
--   · `is_eclatee`  : drapeau booléen, point d'entrée des requêtes de stats ;
--   · `eclatee_at`  : horodatage de l'éclatement ;
--   · `eclatee_by`  : auteur (NULL si le profil a été supprimé depuis) ;
--   · statut `'eclatee'` ajouté au CHECK de `status`.
--
-- Le booléen et le statut sont redondants à dessein (demande métier) : un
-- CHECK les garde alignés, ils ne peuvent pas se contredire.
--
-- L'écriture passe par `eclaterBalle` (services/balleHandpickService.ts),
-- qui vide aussi l'emplacement et l'emprunt : le trigger
-- log_balle_emplacement_handpick trace la sortie d'emplacement. `location`
-- est conservée (où la balle a été éclatée).
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

ALTER TABLE public.balles_handpick
    ADD COLUMN IF NOT EXISTS is_eclatee BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS eclatee_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS eclatee_by UUID NULL;

ALTER TABLE public.balles_handpick
    DROP CONSTRAINT IF EXISTS balles_handpick_eclatee_by_fkey;
ALTER TABLE public.balles_handpick
    ADD CONSTRAINT balles_handpick_eclatee_by_fkey
    FOREIGN KEY (eclatee_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.balles_handpick
    DROP CONSTRAINT IF EXISTS balles_handpick_status_valid;
ALTER TABLE public.balles_handpick
    ADD CONSTRAINT balles_handpick_status_valid CHECK (status IN (
        'stocked', 'used', 'exported', 'transfered',
        'imported', 'delivered', 'shipped', 'eclatee'
    ));

ALTER TABLE public.balles_handpick
    DROP CONSTRAINT IF EXISTS balles_handpick_eclatee_coherent;
ALTER TABLE public.balles_handpick
    ADD CONSTRAINT balles_handpick_eclatee_coherent CHECK (
        is_eclatee = (status = 'eclatee')
        AND is_eclatee = (eclatee_at IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_balles_handpick_eclatee
    ON public.balles_handpick (eclatee_at DESC)
    WHERE is_eclatee;

COMMENT ON COLUMN public.balles_handpick.is_eclatee IS
    'Vrai si la balle a été éclatée (retirée du stock, pièces vendues à '
    'l''unité). Toujours aligné sur status = ''eclatee'' et eclatee_at.';
