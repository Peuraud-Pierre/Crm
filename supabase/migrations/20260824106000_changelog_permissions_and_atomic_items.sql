-- ============================================================
-- Changelog : permissions manquantes, RLS cohérente sur les items,
-- et remplacement atomique des éléments d'une version.
-- Date: 2026-08-24
--
-- ─── 1. Des codes utilisés partout, créés nulle part ────────────────────
--
-- `20260225_fix_changelog_rls.sql` gate l'écriture des versions sur
-- changelogs.create / changelogs.edit / changelogs.delete, et
-- `Manager.tsx` affiche son bouton « Créer un changelog » sur
-- hasPermission('changelogs.create'). Or AUCUNE migration n'insère ces
-- trois codes dans public.permissions : ils ne peuvent être détenus par
-- personne, `user_has_permission` renvoie false, et le catalogue de
-- /administration — lu depuis cette table — ne permet pas de les
-- accorder.
--
-- Exactement le défaut corrigé pour stock.settings.* par
-- 20260818120000. Ils sont créés ici et rattachés aux détenteurs de
-- manager.changelog, qui administrent déjà le changelog : le
-- comportement observé aujourd'hui (quel qu'il soit selon ce qui a pu
-- être créé à la main dans le projet distant) est ainsi rendu explicite
-- et reproductible depuis le dépôt.
--
-- ─── 2. Une incohérence d'autorisation ─────────────────────────────────
--
-- Les mêmes policies exigent changelogs.edit pour modifier une VERSION,
-- mais seulement manager.changelog pour écrire ses ITEMS. Or
-- manager.changelog est la permission de LECTURE étendue (voir les
-- brouillons), accordée à Chef de Service, Manager et Supervision.
-- Conséquence : qui peut voir les brouillons peut réécrire le contenu
-- d'une version publiée sans détenir changelogs.edit. Le contenu est
-- pourtant ce que la version porte — les deux doivent demander le même
-- niveau.
--
-- ─── 3. Une édition non atomique ───────────────────────────────────────
--
-- `useChangelog.editVersion` supprime tous les items de la version puis
-- les réinsère, en deux requêtes séparées. Un échec entre les deux (perte
-- réseau, refus RLS sur l'insert) laisse la version VIDE, et le contenu
-- est perdu sans que rien ne le signale. La fonction ci-dessous fait les
-- deux dans une seule transaction.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Créer les permissions manquantes ────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'manager'
FROM (VALUES
    ('changelogs.create', 'Créer une version de changelog'),
    ('changelogs.edit',   'Modifier une version de changelog'),
    ('changelogs.delete', 'Supprimer une version de changelog')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

-- Backfill depuis manager.changelog, sur les trois sources (rôle,
-- service, individuel) : `user_has_permission` en est un OU, en omettre
-- une priverait un utilisateur dont le code a été accordé à la main.

INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions src ON src.id = rp.permission_id
    AND src.code = 'manager.changelog'
JOIN public.permissions target
    ON target.code IN ('changelogs.create', 'changelogs.edit', 'changelogs.delete')
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions src ON src.id = sp.permission_id
    AND src.code = 'manager.changelog'
JOIN public.permissions target
    ON target.code IN ('changelogs.create', 'changelogs.edit', 'changelogs.delete')
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);

INSERT INTO public.users_permissions (user_id, permission_id)
SELECT up.user_id, target.id
FROM public.users_permissions up
JOIN public.permissions src ON src.id = up.permission_id
    AND src.code = 'manager.changelog'
JOIN public.permissions target
    ON target.code IN ('changelogs.create', 'changelogs.edit', 'changelogs.delete')
WHERE NOT EXISTS (
    SELECT 1 FROM public.users_permissions x
    WHERE x.user_id = up.user_id AND x.permission_id = target.id
);

-- ─── 2. Aligner l'écriture des items sur celle de leur version ──────────
-- La lecture reste inchangée (items d'une version visible).

DROP POLICY IF EXISTS "Users with manager.changelog can insert changelog items"
    ON public.changelog_items;
DROP POLICY IF EXISTS "Users with manager.changelog can update changelog items"
    ON public.changelog_items;
DROP POLICY IF EXISTS "Users with manager.changelog can delete changelog items"
    ON public.changelog_items;

-- Insertion : à la création d'une version (changelogs.create) comme à sa
-- modification, qui réinsère ses items (changelogs.edit).
CREATE POLICY "changelog_items_insert"
    ON public.changelog_items FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT has_permission('changelogs.create'::text))
        OR (SELECT has_permission('changelogs.edit'::text))
    );

CREATE POLICY "changelog_items_update"
    ON public.changelog_items FOR UPDATE
    TO authenticated
    USING ((SELECT has_permission('changelogs.edit'::text)))
    WITH CHECK ((SELECT has_permission('changelogs.edit'::text)));

-- Suppression explicite = modification du contenu d'une version. La
-- suppression d'une version entière passe, elle, par le ON DELETE CASCADE
-- de la clé étrangère, qui ne consulte pas la RLS de la table fille.
CREATE POLICY "changelog_items_delete"
    ON public.changelog_items FOR DELETE
    TO authenticated
    USING (
        (SELECT has_permission('changelogs.edit'::text))
        OR (SELECT has_permission('changelogs.delete'::text))
    );

-- ─── 3. Remplacement atomique des items d'une version ───────────────────
-- SECURITY INVOKER (le défaut) : la RLS de l'appelant s'applique
-- normalement aux deux opérations. Le gain n'est pas un contournement de
-- droits, c'est l'atomicité — le corps d'une fonction plpgsql s'exécute
-- dans une seule transaction, là où deux appels PostgREST successifs sont
-- deux transactions distinctes.

CREATE OR REPLACE FUNCTION public.changelog_replace_items(
    p_version_id uuid,
    p_items      jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
    IF jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'p_items doit être un tableau JSON, reçu %',
            jsonb_typeof(p_items);
    END IF;

    DELETE FROM public.changelog_items WHERE version_id = p_version_id;

    INSERT INTO public.changelog_items
        (version_id, category_id, title, description, position)
    SELECT
        p_version_id,
        (item ->> 'category_id')::uuid,
        item ->> 'title',
        nullif(item ->> 'description', ''),
        coalesce((item ->> 'position')::int, ordinality::int - 1)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(item, ordinality);
END;
$function$;

REVOKE ALL ON FUNCTION public.changelog_replace_items(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.changelog_replace_items(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.changelog_replace_items(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.changelog_replace_items(uuid, jsonb) IS
    'Remplace en une transaction tous les éléments d''une version de '
    'changelog. SECURITY INVOKER : la RLS de l''appelant s''applique.';
