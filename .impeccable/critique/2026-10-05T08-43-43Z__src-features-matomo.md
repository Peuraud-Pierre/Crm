---
target: src/features/matomo
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:<repo>/src/features/matomo"
timestamp: 2026-10-05T08-43-43Z
slug: src-features-matomo
---
# Critique — src/features/matomo (onglet « Trafic du site »), 6e passage
Méthode : dual-agent (A design · B détecteur + données de prod en lecture). Navigateur indisponible.

## Score : 28/40 (Good) — précédents 17, 26, 25, 28, 28
1 Visibilité 3 · 2 Monde réel 3 · 3 Contrôle 3 · 4 Cohérence 3 · 5 Prévention 3 · 6 Reconnaissance 3 · 7 Flexibilité 2 · 8 Minimalisme 3 · 9 Erreurs 3 · 10 Aide 2
Aucun P0/P1. P1 précédents soldés (clé du journal, GeoJSON 174 Ko). Faux positif « uniques à 0 en range » écarté (prod : 12 787).
Détecteur 0 · lint 0 · tsc 0 · 27 tests front · Go ok · 0 arbitraire / couleur en dur / URL externe.
Pays non coloriés : 8/80, 149 visites (0,95 %) ; Taïwan codé CN-TW dans le GeoJSON (défaut du fichier). /log toujours 502.

## Problèmes restants
- [P2] Provenance éclatée (carte+classement vs canaux) ; classement sans % ni évolution ; « % du total » vs « % du canal » au même format. → layout + clarify
- [P2] Carte grise entre arrivée des contours et des pays (squelette sur geo seulement) ; libellé de squelette dupliqué ; top pages sans alternative textuelle. → harden
- [P2] Dates de référence en title seulement (invisibles au tactile/clavier). → clarify
- [P3] Journal : pas de rafraîchissement auto, plafond 100 non signalé, limite collée entre périodes, pas d'affordance vers le profil. → polish
- Petits : CN-TW→TW ; log et search-engines hors indicateur Rafraîchir ; commentaires périmés ; ADMIN/ISO_A3 morts dans getCountryData.

## Questions
Quelle phrase unique en tête ? La carte mérite-t-elle la place d'honneur ?
