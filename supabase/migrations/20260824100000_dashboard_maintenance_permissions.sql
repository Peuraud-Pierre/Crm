-- ============================================================
-- Permissions du portail modulaire : maintenance.bypass et
-- dashboard.templates.manage.
-- Date: 2026-08-24
--
-- Contexte
-- --------
-- 1. maintenance.bypass
--    Le contournement du mode maintenance est aujourd'hui codé en
--    dur dans le front sous la forme d'une comparaison de libellé
--    de rôle :
--
--        if (maintenance?.Active && user.role !== "Super Admin")
--            → src/app/routes/layouts/AuthGuardLayout.tsx
--
--    C'est le seul endroit de l'application qui gate sur une chaîne
--    de rôle plutôt que sur un code de permission. Conséquences :
--    renommer le rôle « Super Admin » ouvre la maintenance à tout le
--    monde, et on ne peut pas autoriser un intervenant ponctuel à
--    travailler pendant une maintenance sans lui donner le rôle le
--    plus élevé de l'application. Ce code rend le contournement
--    attribuable depuis /administration comme n'importe quel autre.
--
--    Backfill : accordé aux rôles/services/utilisateurs détenant
--    déjà manager.maintenance — ceux qui déclenchent la maintenance
--    sont ceux qui doivent pouvoir travailler pendant.
--
-- 2. dashboard.templates.manage
--    Le dashboard devient un portail modulaire dont la disposition
--    par défaut est configurable par rôle/service (table
--    public.dashboard_layout_templates, migration 20260824104000).
--    Ce code gate l'écriture de ces gabarits.
--
--    Volontairement accordé à PERSONNE : c'est un geste
--    d'administration qui se donne au cas par cas depuis
--    /administration (même parti pris que les permissions d'écriture
--    de 20260818120000_stock_settings_permissions).
--
-- Rappel : un code absent de public.permissions ne peut être détenu
-- par personne — le catalogue de /administration est lu depuis cette
-- table — et has_permission() renvoie alors systématiquement false.
--
-- Idempotent : INSERT ... WHERE NOT EXISTS, ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Créer les permissions ───────────────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, v.category
FROM (VALUES
    ('maintenance.bypass',
     'Accéder à l''application pendant une maintenance',
     'manager'),
    ('dashboard.templates.manage',
     'Gérer les dispositions de dashboard par rôle',
     'dashboard')
) AS v(code, label, category)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

-- ─── 2. Backfill de maintenance.bypass ──────────────────────────────────
-- Les trois sources comptent (user_has_permission est un OU de
-- roles_permissions / services_permissions / users_permissions) :
-- omettre l'une d'elles priverait du contournement un utilisateur
-- dont manager.maintenance a été accordée à la main.

INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions src ON src.id = rp.permission_id
    AND src.code = 'manager.maintenance'
JOIN public.permissions target ON target.code = 'maintenance.bypass'
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions src ON src.id = sp.permission_id
    AND src.code = 'manager.maintenance'
JOIN public.permissions target ON target.code = 'maintenance.bypass'
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);

INSERT INTO public.users_permissions (user_id, permission_id)
SELECT up.user_id, target.id
FROM public.users_permissions up
JOIN public.permissions src ON src.id = up.permission_id
    AND src.code = 'manager.maintenance'
JOIN public.permissions target ON target.code = 'maintenance.bypass'
WHERE NOT EXISTS (
    SELECT 1 FROM public.users_permissions x
    WHERE x.user_id = up.user_id AND x.permission_id = target.id
);

-- ─── 3. Filet de sécurité : le rôle « Super Admin » ─────────────────────
-- Le comportement actuel (rôle « Super Admin » = contournement) doit
-- rester vrai après la bascule du front sur maintenance.bypass, même
-- si ce rôle ne détient pas manager.maintenance. C'est le seul point
-- de cette migration qui référence le rôle par son libellé, et
-- justement pour ne plus jamais avoir à le faire ensuite.
-- Sans effet si aucun rôle ne porte ce nom.

INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.nom = 'Super Admin'
  AND p.code = 'maintenance.bypass'
  AND NOT EXISTS (
      SELECT 1 FROM public.roles_permissions x
      WHERE x.role_id = r.id AND x.permission_id = p.id
  );
