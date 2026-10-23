-- ============================================================
-- Alerte des admins newsletter sur erreur du service
-- ============================================================
-- Jusqu'ici, une erreur du service newsletter n'était visible que par un admin
-- ayant /arrivage-admin ouvert au bon moment (bandeau construit côté navigateur
-- par buildDashboardAlerts). Une panne nocturne n'alertait personne.
--
-- Cette migration branche une notification in-app (et, par ricochet, le push
-- web) sur les lignes de niveau ERROR de newsletter_api_logs.
--
-- Choix de conception importants :
--
-- 1. Ciblage par user_id RÉEL, pas par service_id.
--    public.notification.user_id est surchargé dans ce projet : les
--    notifications arrivage existantes y mettent un profiles.service_id pour
--    diffuser à tout un service (cf. 20260528_arrivage_activity.sql). On ne
--    reproduit pas ce pattern ici, pour deux raisons :
--      - le front ne re-fetche que `user_id = <son user_id>`
--        (notificationService.fetchNotificationsForUser) : une notification
--        service-level disparaît au premier rechargement de page ;
--      - le push web résout push_subscriptions.user_id — un service_id n'y
--        correspond à rien, donc aucun push ne part.
--
-- 2. ERROR seulement. Le middleware HTTP du service logue en WARN chaque
--    réponse 4xx (un simple 403 en fait partie) : alerter sur WARN noierait
--    les vraies pannes.
--
-- 3. La clause WHEN du trigger porte le filtre de niveau, pas le corps de la
--    fonction : sur une ligne INFO — l'écrasante majorité — rien ne s'exécute,
--    le chemin chaud du sink de logs ne paie rien.
--
-- Ce fichier est entièrement rejouable (CREATE OR REPLACE / IF NOT EXISTS /
-- DROP … IF EXISTS) : s'il a déjà été appliqué avant la passe d'optimisation,
-- le ré-exécuter suffit à récupérer l'insertion ensembliste, l'index de
-- déduplication et les REVOKE.
--
-- Limite assumée : l'alerte dépend de l'écriture dans newsletter_api_logs. Si
-- la base est injoignable ou les privilèges cassés, rien n'est écrit donc rien
-- n'est notifié ; le bandeau « API injoignable » du dashboard reste le seul
-- filet dans ce cas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Porteurs d'une permission
-- ------------------------------------------------------------
-- Le dépôt savait répondre à « cet utilisateur a-t-il la permission X ? »
-- (user_has_permission) mais pas à « qui détient X ? ». Le seul précédent
-- (notify_arrivage_invoice_reminders) contourne le manque avec
-- `WHERE user_has_permission(pr.user_id, ...)`, ce qui évalue trois EXISTS par
-- profil. On déplie ici les trois sources en UNION (qui dédoublonne au
-- passage) : role_id, service_id, et attribution individuelle.
--
-- Fonction générique, réutilisable hors newsletter.
CREATE OR REPLACE FUNCTION public.users_with_permission(p_code text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT pr.user_id
    FROM public.profiles pr
    JOIN public.roles_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE p.code = p_code AND pr.user_id IS NOT NULL

    UNION

    SELECT pr.user_id
    FROM public.profiles pr
    JOIN public.services_permissions sp ON sp.service_id = pr.service_id
    JOIN public.permissions p ON p.id = sp.permission_id
    WHERE p.code = p_code AND pr.user_id IS NOT NULL

    UNION

    SELECT up.user_id
    FROM public.users_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE p.code = p_code AND up.user_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.users_with_permission(text) IS
    'Utilisateurs détenant un code de permission, toutes sources confondues (rôle, service, attribution individuelle). Pendant « ensembliste » de user_has_permission.';

-- SECURITY DEFINER + droit d'exécution par défaut = n'importe quel compte
-- authentifié pourrait énumérer les détenteurs de n'importe quelle permission.
-- Seule la fonction trigger ci-dessous en a besoin, et elle s'exécute avec les
-- droits de son propriétaire.
REVOKE EXECUTE ON FUNCTION public.users_with_permission(text) FROM PUBLIC;

DO $$
DECLARE
    v_role text;
BEGIN
    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
            EXECUTE format(
                'REVOKE EXECUTE ON FUNCTION public.users_with_permission(text) FROM %I',
                v_role
            );
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 1b. Index de déduplication
-- ------------------------------------------------------------
-- public.notification préexiste au versionnement et n'a aucun index au-delà de
-- sa clé primaire. La garde anti-doublon ci-dessous filtre sur
-- (user_id, title, created_at) : sans index, chaque ligne ERROR provoquerait un
-- parcours séquentiel complet de la table, à l'intérieur de la transaction
-- d'écriture des logs.
CREATE INDEX IF NOT EXISTS idx_notification_user_title_created_at
    ON public.notification (user_id, title, created_at DESC);

-- ------------------------------------------------------------
-- 2. Notification d'erreur
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_newsletter_api_error()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    -- Fenêtre de regroupement : une même erreur répétée ne produit qu'une
    -- alerte. Une panne en rafale (des dizaines de lignes en quelques
    -- secondes) ne doit pas remplir la cloche.
    c_window   CONSTANT interval := INTERVAL '15 minutes';
    c_perm     CONSTANT text     := 'stock.arrivage.newsletter.admin';
    v_title    text;
BEGIN
    -- Le titre est la clé de déduplication : il doit être stable pour une même
    -- erreur, donc sans identifiant variable (req_id, timestamp, uuid).
    -- Le préfixe « Newsletter : » n'est pas cosmétique — NotificationCenter
    -- scinde le titre sur le premier « : » pour composer un libellé en gras
    -- suivi d'un détail (extractNotificationDetails).
    v_title := 'Newsletter : ' || left(NEW.msg, 120);

    -- Insertion ensembliste plutôt qu'une boucle avec un NOT EXISTS par
    -- destinataire : le trigger s'exécute dans la transaction d'écriture du lot
    -- de logs, et une rafale d'erreurs ne doit pas la ralentir. Une seule
    -- requête, un seul parcours de l'index de déduplication.
    INSERT INTO public.notification (user_id, type, title, url)
    SELECT u.user_id, 'system', v_title, '/arrivage-admin/logs'
    FROM public.users_with_permission(c_perm) u
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.notification n
        WHERE n.user_id = u.user_id
          AND n.title = v_title
          AND n.created_at > now() - c_window
    );

    -- Trigger AFTER : la valeur de retour est ignorée.
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.notify_newsletter_api_error() IS
    'Notifie les détenteurs de stock.arrivage.newsletter.admin sur une ligne ERROR du service newsletter, dédupliquée par titre sur 15 minutes.';

DROP TRIGGER IF EXISTS newsletter_api_error_notify ON public.newsletter_api_logs;

CREATE TRIGGER newsletter_api_error_notify
    AFTER INSERT ON public.newsletter_api_logs
    FOR EACH ROW
    WHEN (NEW.level = 'ERROR')
    EXECUTE FUNCTION public.notify_newsletter_api_error();
