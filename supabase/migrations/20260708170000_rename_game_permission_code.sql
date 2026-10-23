-- ============================================================
-- Rebranding (suite) : le code de permission 'crm.monopoly' devient
-- 'crm.tournee' pour achever la disparition du nom de marque.
--
-- Sans risque pour les attributions existantes : roles_permissions et
-- services_permissions référencent la permission par son id (FK), pas
-- par son code — on ne fait que renommer la colonne code de la ligne.
--
-- ⚠️ À déployer EN MÊME TEMPS que le front qui vérifie désormais
-- hasPermission('crm.tournee') (SinglePageCRM.tsx) : si le front part
-- avant la migration, l'onglet disparaît pour tout le monde jusqu'à
-- son application.
--
-- Idempotent : ne fait rien si le rename a déjà eu lieu.
-- ============================================================

UPDATE public.permissions
SET code = 'crm.tournee'
WHERE code = 'crm.monopoly'
  AND NOT EXISTS (
      SELECT 1 FROM public.permissions WHERE code = 'crm.tournee'
  );
