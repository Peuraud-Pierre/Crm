-- Diagnostic ponctuel — liste toutes les thématiques et leurs chemins
-- image_url/icon_url actuellement enregistrés en base, pour servir de
-- checklist de réupload maintenant que le bucket 'bibliotheque' est vide.
-- Tous ces chemins pointent vers du vide tant qu'ils ne sont pas réuploadés.

SELECT
    label,
    label_en,
    NULLIF(image_url, '') AS image_a_reuploader,
    NULLIF(icon_url, '')  AS icone_a_reuploader
FROM public.bibliotheque_thematiques
ORDER BY position;
