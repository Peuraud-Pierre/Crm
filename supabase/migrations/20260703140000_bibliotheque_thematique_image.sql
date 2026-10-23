-- Ajoute la colonne image_url à bibliotheque_thematiques.
-- Stocke le chemin vers l'image illustrant la thématique (ex : /bibliotheque/mon-image.jpg).
-- Valeur vide par défaut = pas d'image affichée.
ALTER TABLE bibliotheque_thematiques
    ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
