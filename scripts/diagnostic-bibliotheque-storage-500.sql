-- Diagnostic ponctuel (pas une migration) — à exécuter dans le SQL Editor
-- Supabase du projet apidev pour comprendre pourquoi la LECTURE des fichiers
-- réels du bucket 'bibliotheque' renvoie 500, malgré une configuration de
-- bucket désormais identique à 'wiki' (qui fonctionne).
--
-- Objectif : comparer la structure réelle des lignes storage.objects entre
-- un bucket qui fonctionne (wiki) et celui qui casse (bibliotheque) — en
-- particulier la colonne `metadata` (jsonb), que storage-api lit pour
-- construire les en-têtes Content-Type/Content-Length de la réponse. Une
-- valeur NULL ou mal formée dans `metadata` peut faire planter la lecture
-- sans jamais remonter d'erreur explicite au client.

-- 1. Config du bucket lui-même
SELECT id, name, public, file_size_limit, allowed_mime_types, owner, created_at, updated_at
FROM storage.buckets
WHERE id IN ('bibliotheque', 'wiki');

-- 2. Quelques objets réels du bucket cassé, avec leur métadonnée complète
SELECT id, name, bucket_id, owner, owner_id, metadata, path_tokens,
       created_at, updated_at, last_accessed_at, version
FROM storage.objects
WHERE bucket_id = 'bibliotheque'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Pour comparaison : la même chose sur un bucket qui fonctionne
SELECT id, name, bucket_id, owner, owner_id, metadata, path_tokens,
       created_at, updated_at, last_accessed_at, version
FROM storage.objects
WHERE bucket_id = 'wiki'
ORDER BY created_at DESC
LIMIT 3;
