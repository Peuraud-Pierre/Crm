---
target: src/features/matomo
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:<repo>/src/features/matomo"
timestamp: 2026-10-05T07-19-31Z
slug: src-features-matomo
closed: true
---
# Critique — src/features/matomo (onglet « Trafic du site »), 2e passage
Méthode : dual-agent (A design · B détecteur). Navigateur indisponible (extension Chrome non connectée).

## Score : 26/40 (Acceptable) — précédent 17/40
1 Visibilité 3 · 2 Monde réel 3 · 3 Contrôle 3 · 4 Cohérence 2 · 5 Prévention 2 · 6 Reconnaissance 3 · 7 Flexibilité 2 · 8 Minimalisme 3 · 9 Erreurs 3 · 10 Aide 2

## Spécificité : exécution fidèle au Registre vert, contenu interchangeable
Détecteur : 0 constat. Lint 0, 17 tests matomo verts. Écarts : fetch GeoJSON direct MatomoMap.tsx:147 (hors service), MatomoMap.tsx 479 lignes (> 400), `as any` non justifié VisitorProfileModal.tsx:30.

## Problèmes prioritaires
- [P1] Rafraîchir passe en spinner chaque minute : useIsFetching(["matomo"]) compte live (60 s) et profile (useMatomo.ts:72). → harden
- [P1] Vue par défaut vide : periode day:today (matomoFilters.ts:30) → tendance « pas assez de données ». Défaut day:last30. → harden
- [P1] Chiffres sans repère : aucune variation vs période précédente (principe 4 PRODUCT.md). → shape
- [P2] Données trompeuses : mergeCountriesByDay somme les uniques, limite tronque les pays, séries absentes forcées à 0, limite sans effet sur top 5 pages. → harden
- [P2] Carte disproportionnée et fragile : ~700px, GeoJSON GitHub sans message d'échec, légende linéaire vs rampe log, hover sur lignes non cliquables, pas de % au classement, fichier 479 lignes. → layout

## Personas
Alex : pas de plage libre, comparaison, export, drill-down ; squelettes à chaque filtre (pas de keepPreviousData).
Sam : InfoTooltip tabIndex=-1 (définitions KPI inatteignables au clavier), graphiques sans alternative, <main> imbriqué, --chart-5 jaune < 3:1 probable.
Manager : réponse provenance à 2-3 écrans, canaux génériques, pas de % pays, pas de comparaison.

## Mineurs
Changement d'onglet perd la query ; journal sans date ; profil redondant ; pluriels manuels ; visitIp typé (RGPD) ; clé c.label non unique ; fenêtre « en ligne » non précisée.

## Questions
Une seule question du manager ? Carte vs classement ? Profil individuel : décision ou curiosité ?
