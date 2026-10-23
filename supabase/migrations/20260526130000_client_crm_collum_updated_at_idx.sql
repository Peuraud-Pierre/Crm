-- ============================================================
-- Index composite pour la pagination Kanban par colonne
--
-- loadMoreInColumn exécute :
--   SELECT ... FROM client_crm
--   WHERE collum = X
--     AND updated_at < $cursor
--     AND (customer = $uid OR closers = $uid OR customer IS NULL)
--   ORDER BY updated_at DESC
--   LIMIT 100
--
-- L'index simple sur (collum) ajouté précédemment force Postgres à
-- scanner toutes les lignes de la colonne puis à trier en mémoire.
-- Un index composite (collum, updated_at DESC) permet à la fois le
-- filtre par colonne, la borne updated_at et le tri en un seul
-- parcours d'index (index range scan + ordering).
-- ============================================================

CREATE INDEX IF NOT EXISTS client_crm_collum_updated_at_idx
    ON public.client_crm (collum, updated_at DESC);

-- Index annexes utiles pour les variantes filtrées par utilisateur :
-- - le filtre `customer = uid` profite déjà de l'index composite
--   `client_crm_customer_collum_idx` (collum) ajouté précédemment ; on
--   ajoute la même chose côté `closers` avec updated_at pour les requêtes
--   du board avec un setter/closer actif.
CREATE INDEX IF NOT EXISTS client_crm_customer_collum_updated_at_idx
    ON public.client_crm (customer, collum, updated_at DESC);

CREATE INDEX IF NOT EXISTS client_crm_closers_collum_updated_at_idx
    ON public.client_crm (closers, collum, updated_at DESC);
