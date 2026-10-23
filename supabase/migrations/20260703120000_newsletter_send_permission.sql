-- ============================================================
-- Permission 'stock.arrivage.newsletter.send' : déclencher l'envoi/renvoi
-- de la newsletter arrivages (par abonné ou à tous les abonnés actifs).
--
-- Remplace le contrôle ADMIN_USER_IDS côté service Go (newsletter-console)
-- pour les routes POST /subscribers/{user_id}/resend et POST /pipeline/trigger :
-- ce service vérifie désormais public.user_has_permission(uid, 'stock.arrivage.newsletter.send')
-- directement en base (connexion service_role, appel de fonction explicite —
-- ne dépend pas de auth.uid()/RLS), au lieu d'une liste d'UUID en variable
-- d'environnement qui nécessitait un redémarrage du service à chaque changement.
--
-- Cette migration :
--   1. CRÉE la permission si absente, afin qu'elle apparaisse dans l'UI de
--      gestion des rôles et reste assignable via le système existant ;
--   2. l'ATTRIBUE aux mêmes rôles/services qui ont déjà
--      'stock.arrivage.newsletter.admin', pour préserver l'accès actuel.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- 1. Créer la permission si elle n'existe pas encore.
INSERT INTO public.permissions (code, label, category)
SELECT 'stock.arrivage.newsletter.send', 'Envoyer/renvoyer la newsletter arrivages', 'stock'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'stock.arrivage.newsletter.send'
);

-- 2a. Attribuer aux rôles qui ont déjà 'stock.arrivage.newsletter.admin'.
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions admin_p ON admin_p.id = rp.permission_id
    AND admin_p.code = 'stock.arrivage.newsletter.admin'
JOIN public.permissions target ON target.code = 'stock.arrivage.newsletter.send'
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

-- 2b. Attribuer aux services qui ont déjà 'stock.arrivage.newsletter.admin'.
INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions admin_p ON admin_p.id = sp.permission_id
    AND admin_p.code = 'stock.arrivage.newsletter.admin'
JOIN public.permissions target ON target.code = 'stock.arrivage.newsletter.send'
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);
