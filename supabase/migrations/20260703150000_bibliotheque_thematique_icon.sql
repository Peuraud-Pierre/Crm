-- Ajoute la colonne icon_url à bibliotheque_thematiques.
-- Stocke le chemin vers l'icône SVG de la thématique (ex : /bibliotheque/icons/livraison.svg).
-- Distincte de image_url (illustration H2) : l'icône est affichée dans la sidebar.
ALTER TABLE bibliotheque_thematiques
    ADD COLUMN IF NOT EXISTS icon_url TEXT NOT NULL DEFAULT '';
