---
target: src/features/matomo
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:<repo>/src/features/matomo"
timestamp: 2026-10-05T08-26-16Z
slug: src-features-matomo
---
# Critique — src/features/matomo (onglet « Trafic du site »), 5e passage
Méthode : dual-agent (A design · B détecteur + données de prod en lecture). Navigateur indisponible.

## Score : 28/40 (Good) — précédents 17, 26, 25, 28
1 Visibilité 3 · 2 Monde réel 3 · 3 Contrôle 3 · 4 Cohérence 3 · 5 Prévention 3 · 6 Reconnaissance 3 · 7 Flexibilité 2 · 8 Minimalisme 3 · 9 Erreurs 3 · 10 Aide 2

## Prod (lecture seule)
/search-engines déployé (Google 8405, Bing 90…) ; canaux 6 uniques avec sous-tables ; détecteur 0, lint 0, tsc 0, 27 tests front, Go ok ; 0 valeur arbitraire, 0 <main> ; /log toujours 502.

## Problèmes prioritaires
- [P1] filterLimit dans MatomoQuery → dans la clé de cache de tous les blocs : « Voir plus » relance 7 requêtes et atténue toute la page. Le sortir de la requête commune. → harden
- [P1] Fond de carte 14,6 Mo (raw.githubusercontent, HEAD mesuré), remappé à chaque filtre/thème, sans squelette. Contours 110m dans public/, expression match, squelette. → optimize + harden
- [P2] Top pages non décroissant : le proxy (sortRowsByVisits) retrie par visites. Retrier par nb_hits côté front. → harden
- [P2] Anglais de Matomo (pays, journal, profil) : language=fr dans le proxy, retirer les tables de traduction. → clarify
- [P2] Deux « % » de sens différent (total vs canal) au même format ; 0,4 % affiché « 0 % ». → clarify

## Personas
Alex : Voir plus recharge tout ; plafond 100 non signalé ; changement d'onglet perd les filtres.
Sam : top pages sans alternative textuelle ; 6 role=alert simultanés si proxy tombe ; bouton de dépliage ~20px.
Manager : provenance éclatée et sous la courbe ; pays en anglais.

## Mineurs
cursor pointer sur la carte sans action ; légende vs RAMP_FLOOR ; LoadMore sans état de chargement ; « Hier » + journal jusqu'à aujourd'hui.

## Questions
Ouvrir sur la provenance ? 14,6 Mo de contours pour ~40 pays ?
