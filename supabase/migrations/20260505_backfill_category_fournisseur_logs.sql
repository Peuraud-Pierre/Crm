-- Backfill des entrées activity_log pour les catégories et fournisseurs
-- qui existaient avant l'activation des triggers (20260428_stock_history).
-- Crée une entrée 'create' par entité qui n'a encore aucun log.
-- user_id est NULL car l'auteur original est inconnu.

INSERT INTO public.activity_log (created_at, user_id, entity_type, entity_id, entity_label, action, description)
SELECT
    COALESCE(c.created_at, NOW()),
    NULL,
    'category',
    c.id::TEXT,
    c.name,
    'create',
    'Catégorie enregistrée : ' || COALESCE(c.name, c.id::TEXT)
FROM public.categories_gestion c
WHERE NOT EXISTS (
    SELECT 1
    FROM   public.activity_log al
    WHERE  al.entity_type = 'category'
    AND    al.entity_id   = c.id::TEXT
);

INSERT INTO public.activity_log (created_at, user_id, entity_type, entity_id, entity_label, action, description)
SELECT
    COALESCE(f.created_at, NOW()),
    NULL,
    'fournisseur',
    f.id::TEXT,
    f.name,
    'create',
    'Fournisseur enregistré : ' || COALESCE(f.name, f.id::TEXT)
FROM public.fournisseur_gestion f
WHERE NOT EXISTS (
    SELECT 1
    FROM   public.activity_log al
    WHERE  al.entity_type = 'fournisseur'
    AND    al.entity_id   = f.id::TEXT
);
