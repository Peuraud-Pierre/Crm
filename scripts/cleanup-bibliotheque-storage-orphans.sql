-- Nettoyage ponctuel (pas une migration) — à exécuter APRÈS avoir réuploadé
-- les images/icônes cassées via l'UI et vérifié qu'elles s'affichent.
--
-- Supprime uniquement les lignes storage.objects dont le NOM correspond aux
-- anciens chemins connus comme cassés (500 sur GET malgré une métadonnée DB
-- saine) — PAS les nouveaux chemins créés par l'anti-collision (ex:
-- transitions-2.svg), qui ne sont jamais concernés par cette liste.
--
-- Vérifier le résultat du SELECT avant de lancer le DELETE juste en dessous.

-- 1. Aperçu de ce qui va être supprimé
SELECT name, created_at
FROM storage.objects
WHERE bucket_id = 'bibliotheque'
  AND name IN (
    'transitions.png', 'icons/transitions.svg',
    'gestion-des-incidents.png', 'icons/gestion-des-incidents.svg',
    'demandes-combinees.png', 'icons/demandes-combinees.svg',
    'livraison.png', 'icons/livraison.svg',
    'process-commande.png', 'icons/process-commande.svg',
    'cas-speciaux.png', 'icons/cas-speciaux.svg',
    'profil-positionnement-presentation.png', 'icons/profil-positionnement-presentation.svg',
    'lancement-d-activite.png', 'icons/lancement-d-activite.svg',
    'stock-categories.png', 'icons/stock-categories.svg',
    'conditionnement-qualite.png', 'icons/conditionnement-qualite.svg'
  );

-- 2. Suppression effective — à décommenter une fois le SELECT ci-dessus vérifié
-- DELETE FROM storage.objects
-- WHERE bucket_id = 'bibliotheque'
--   AND name IN (
--     'transitions.png', 'icons/transitions.svg',
--     'gestion-des-incidents.png', 'icons/gestion-des-incidents.svg',
--     'demandes-combinees.png', 'icons/demandes-combinees.svg',
--     'livraison.png', 'icons/livraison.svg',
--     'process-commande.png', 'icons/process-commande.svg',
--     'cas-speciaux.png', 'icons/cas-speciaux.svg',
--     'profil-positionnement-presentation.png', 'icons/profil-positionnement-presentation.svg',
--     'lancement-d-activite.png', 'icons/lancement-d-activite.svg',
--     'stock-categories.png', 'icons/stock-categories.svg',
--     'conditionnement-qualite.png', 'icons/conditionnement-qualite.svg'
--   );
