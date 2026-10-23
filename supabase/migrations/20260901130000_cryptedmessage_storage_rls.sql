-- Resserrement des policies Storage du bucket `cryptedmessage`.
--
-- ÉTAT CORRIGÉ (20251020140000_cryptedmessage_storage.sql) : les trois policies
-- select / insert / delete n'exigeaient que `auth.uid() is not null`. Autrement
-- dit, tout compte authentifié pouvait lister et télécharger les pièces jointes
-- de TOUTES les conversations, et surtout en SUPPRIMER n'importe laquelle.
--
-- Le chiffrement de bout en bout protégeait la confidentialité du contenu (les
-- blobs sont inexploitables sans les `key_wraps` du message), mais ni son
-- intégrité ni sa disponibilité : un seul compte suffisait à vider le bucket.
--
-- Le chemin de chaque objet porte l'identité de la conversation, ce qui permet
-- une vérification exacte :
--   groupe   : `group_<uuid>/<horodatage>-<alea>-<nom>`
--   1-à-1    : `<uuidA>__<uuidB>/<horodatage>-<alea>-<nom>`
-- (côté client, `chatId.replace(/[^a-zA-Z0-9_-]/g, "_")` — donc `group:<uuid>`
--  devient `group_<uuid>` et `<a>::<b>` devient `<a>__<b>`.)

-- ============================================================
-- Fonction d'autorisation, partagée par les trois policies
-- ============================================================

CREATE OR REPLACE FUNCTION public.cm_can_access_chat_folder(p_folder text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_group_id uuid;
    v_parts text[];
BEGIN
    IF v_uid IS NULL OR p_folder IS NULL THEN
        RETURN false;
    END IF;

    -- Conversation de groupe. Comparaison littérale plutôt qu'un LIKE : dans
    -- un motif LIKE, `_` est un joker qui accepterait n'importe quel
    -- caractère à cette position, et son échappement dépend du contexte.
    IF left(p_folder, 6) = 'group_' THEN
        BEGIN
            v_group_id := substring(p_folder FROM 7)::uuid;
        EXCEPTION WHEN others THEN
            -- Dossier malformé : on refuse plutôt que de laisser passer.
            RETURN false;
        END;
        RETURN cmg_is_member(v_group_id, v_uid);
    END IF;

    -- Conversation 1-à-1 : les deux identifiants sont dans le nom du dossier.
    -- Un UUID ne contient jamais `_`, donc le séparateur `__` est sans
    -- ambiguïté.
    v_parts := string_to_array(p_folder, '__');
    IF array_length(v_parts, 1) = 2 THEN
        RETURN v_uid::text = v_parts[1] OR v_uid::text = v_parts[2];
    END IF;

    RETURN false;
END;
$$;

COMMENT ON FUNCTION public.cm_can_access_chat_folder(text) IS
    'Vrai si l''utilisateur courant participe à la conversation dont le dossier Storage est passé en argument (bucket cryptedmessage).';

REVOKE ALL ON FUNCTION public.cm_can_access_chat_folder(text) FROM public;
GRANT EXECUTE ON FUNCTION public.cm_can_access_chat_folder(text) TO authenticated;

-- ============================================================
-- Remplacement des policies
-- ============================================================

DROP POLICY IF EXISTS "cryptedmessage uploads" ON storage.objects;
DROP POLICY IF EXISTS "cryptedmessage downloads" ON storage.objects;
DROP POLICY IF EXISTS "cryptedmessage deletes" ON storage.objects;

-- Écriture : uniquement dans le dossier d'une conversation dont on fait
-- partie. Sans cette borne, n'importe qui pouvait déposer un fichier dans la
-- conversation d'autrui — le message correspondant aurait été refusé par la
-- RLS de `cryptedmessage`, mais l'objet, lui, restait stocké.
CREATE POLICY "cryptedmessage uploads"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'cryptedmessage'
        AND public.cm_can_access_chat_folder((storage.foldername(name))[1])
    );

CREATE POLICY "cryptedmessage downloads"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'cryptedmessage'
        AND public.cm_can_access_chat_folder((storage.foldername(name))[1])
    );

-- Suppression : participer ne suffit pas, il faut avoir déposé l'objet.
-- L'application ne supprime une pièce jointe que via `deleteMessage`, qui est
-- déjà réservé à l'auteur du message (`softDeleteMessage` filtre sur
-- `sender_id`). `owner IS NULL` couvre les objets téléversés avant que
-- Storage ne renseigne systématiquement cette colonne : pour eux on retombe
-- sur la participation, ce qui reste très au-dessus de l'état précédent.
CREATE POLICY "cryptedmessage deletes"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'cryptedmessage'
        AND public.cm_can_access_chat_folder((storage.foldername(name))[1])
        AND (owner IS NULL OR owner = auth.uid())
    );

-- Aucune policy UPDATE : le client téléverse toujours avec `upsert: false`,
-- donc un remplacement d'objet n'a jamais lieu. En ajouter une ouvrirait la
-- possibilité d'écraser une pièce jointe existante.

-- ============================================================
-- Vérification (à exécuter après application, en tant qu'utilisateur connecté)
-- ============================================================
--
--   -- doit renvoyer true pour une conversation dont on est membre :
--   select public.cm_can_access_chat_folder('group_' || '<uuid_du_groupe>');
--   -- doit renvoyer false pour un groupe dont on n'est pas membre :
--   select public.cm_can_access_chat_folder('group_' || '<autre_uuid>');
--   -- doit renvoyer false sur un dossier inexistant ou malformé :
--   select public.cm_can_access_chat_folder('nimporte-quoi');
--
--   -- les trois policies attendues, et elles seules :
--   select policyname, cmd from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname like 'cryptedmessage%';
--
-- Retour arrière : rejouer les trois CREATE POLICY de
-- 20251020140000_cryptedmessage_storage.sql après un DROP POLICY IF EXISTS,
-- puis DROP FUNCTION public.cm_can_access_chat_folder(text).
