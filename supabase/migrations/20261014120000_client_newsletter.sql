-- ============================================================
-- Newsletter clients (spec 2026-10-14-newsletter-clients-design.md)
--
-- 1. Opt-in par client : client_crm.newsletter (false pour tous au départ,
--    le commercial coche client par client) + date de dernière bascule
--    (trace du consentement, aussi écrite par la désinscription en un clic).
-- 2. Journal des envois : client_newsletter_sends, écrit uniquement par le
--    service Go newsletter-console (connexion service_role), lu par le front
--    sous la permission newsletter_clients.send.
-- 3. Permission newsletter_clients.send, créée SANS octroi automatique :
--    elle s'attribue via l'UI rôles/services, pour qu'aucun rôle ne puisse
--    écrire à toute la base clients par défaut.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ── 1. Opt-in client ──────────────────────────────────────────
ALTER TABLE public.client_crm
    ADD COLUMN IF NOT EXISTS newsletter boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS newsletter_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS client_crm_newsletter_idx
    ON public.client_crm (id) WHERE newsletter;

-- ── 2. Journal des envois ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_newsletter_sends (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject         text NOT NULL,
    message         text NOT NULL,
    sent_by         uuid NOT NULL,
    status          text NOT NULL CHECK (status IN ('sending', 'done', 'failed')),
    recipient_count integer NOT NULL DEFAULT 0,
    sent_count      integer NOT NULL DEFAULT 0,
    failed_count    integer NOT NULL DEFAULT 0,
    error           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz
);

-- Un seul envoi en cours à la fois : le service Go traduit la violation
-- (23505) en 409.
CREATE UNIQUE INDEX IF NOT EXISTS client_newsletter_sends_one_sending_idx
    ON public.client_newsletter_sends (status) WHERE status = 'sending';

CREATE INDEX IF NOT EXISTS client_newsletter_sends_created_at_idx
    ON public.client_newsletter_sends (created_at DESC);

ALTER TABLE public.client_newsletter_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_clients.send can read sends" ON public.client_newsletter_sends;
CREATE POLICY "newsletter_clients.send can read sends"
    ON public.client_newsletter_sends FOR SELECT TO authenticated
    USING (public.user_has_permission(auth.uid(), 'newsletter_clients.send'));
-- Pas de policy d'écriture : seul le service_role écrit.

-- ── 3. Permission ─────────────────────────────────────────────
INSERT INTO public.permissions (code, label, category)
SELECT 'newsletter_clients.send', 'Envoyer la newsletter clients', 'crm'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'newsletter_clients.send'
);
