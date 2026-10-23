-- ============================================================
-- Versions des soumissions Amelia par client
--
-- Chaque prise de RDV via Amelia enregistre ici un snapshot des infos
-- remplies par le formulaire (brief + contact). Permet au commercial de
-- comparer / restaurer ces versions depuis la fiche client, sans perdre
-- l'historique même si la fiche courante est écrasée par une nouvelle
-- soumission (cas typique : email réutilisé / usurpé).
--
-- Alimentée par le bridge Amelia (amelia-bridge-crm) en connexion directe
-- (service role) -> aucune policy d'écriture pour les utilisateurs.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_amelia_submissions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    uuid NOT NULL REFERENCES public.client_crm (id) ON DELETE CASCADE,
    event_id     uuid REFERENCES public."Event_calendar" (id) ON DELETE SET NULL,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    full_name    text,
    societe      text,
    telephone    text,
    mail         text,
    brief        jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_amelia_submissions_client_idx
    ON public.client_amelia_submissions (client_id, submitted_at DESC);

ALTER TABLE public.client_amelia_submissions ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié (même périmètre que la lecture des
-- fiches client_crm côté CRM ; le filtrage par client se fait déjà côté appli).
-- Aucune policy INSERT/UPDATE/DELETE : seules les écritures en service role
-- (le bridge) passent, les utilisateurs ne peuvent pas falsifier l'historique.
DROP POLICY IF EXISTS "Authenticated can read amelia submissions" ON public.client_amelia_submissions;
CREATE POLICY "Authenticated can read amelia submissions"
    ON public.client_amelia_submissions FOR SELECT
    TO authenticated
    USING (true);
