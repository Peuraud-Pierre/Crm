-- Préférences par newsletter sur les abonnés newsletter arrivage
-- (public.newsletter_subscriptions) : deux interrupteurs par abonné,
-- éditables par l'admin depuis /arrivage-admin (onglet Abonnés) — `arrivage`
-- et `crm_stat`, séparés de `active` qui reste le flag global du service Go.
--
-- Portée volontairement réduite : pas de nouvelle table ni de flux
-- d'abonnement self-service — seuls les abonnés arrivage déjà présents
-- peuvent voir ces préférences basculées ici.

ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS arrivage boolean DEFAULT true;

ALTER TABLE public.newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS crm_stat boolean DEFAULT true;

-- La policy existante ("user_owns_own_subscription", FOR ALL) ne couvre que
-- le propriétaire de la ligne. Un admin doit pouvoir basculer les
-- préférences d'un AUTRE abonné depuis le panneau — même permission que le
-- reste de l'admin newsletter arrivage (accès à la route déjà gaté dessus).
CREATE POLICY "arrivage_admin_can_update_stats_preference"
    ON public.newsletter_subscriptions
    FOR UPDATE
    USING (has_permission('stock.arrivage.newsletter.admin'))
    WITH CHECK (has_permission('stock.arrivage.newsletter.admin'));
