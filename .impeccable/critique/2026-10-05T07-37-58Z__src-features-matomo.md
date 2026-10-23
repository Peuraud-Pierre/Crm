---
target: src/features/matomo
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:<repo>/src/features/matomo"
timestamp: 2026-10-05T07-37-58Z
slug: src-features-matomo
closed: true
---
# Critique — src/features/matomo (onglet « Trafic du site »), 3e passage
Méthode : dual-agent (A design · B détecteur). Navigateur indisponible. Proxy Go ~/nokk_project/matomo lu.

## Score : 25/40 (Acceptable) — précédents 17, 26
1 Visibilité 3 · 2 Monde réel 2 · 3 Contrôle 3 · 4 Cohérence 3 · 5 Prévention 2 · 6 Reconnaissance 2 · 7 Flexibilité 2 · 8 Minimalisme 3 · 9 Erreurs 3 · 10 Aide 2
Les 3 P1 du passage 2 sont soldés ; la stagnation vient de défauts de données préexistants dans le proxy, découverts en le lisant, et d'un biais de la comparaison ajoutée.

## Spécificité : tableau de bord générique bien exécuté
Détecteur 0 · lint 0 · tsc 0 · 21/21 tests · aucun fichier > 400 lignes · aucune violation des règles projet.

## Problèmes prioritaires
- [P0] Canaux et pages dupliqués sur toute période multi-jours : proxy flattenRows (handlers.go) aplatit {date:[lignes]} sans fusion par label ; parts fausses, top 5 pages répété. Agréger par label comme aggregateCountries ; flat=1 pour getPageUrls. → harden (proxy)
- [P1] « Visiteurs uniques » = somme des uniques journaliers (aggregateVisits, aggregateCountries) ; contredit l'infobulle. period=range ou renommer. → harden + clarify
- [P1] Comparaison biaisée vers la baisse : lastN inclut aujourd'hui partiel, la période précédente est complète (~−25 % le matin sur 2 j, ~−14 % sur 7 j). Comparer des jours complets des deux côtés. → harden
- [P2] Aucune date absolue (période, référence, journal sans jour). → clarify
- [P2] Courbe : Actions écrase les autres séries, axe Y non formaté. → layout

## Personas
Alex : pas de plage libre, drill-down, export ; limite sans effet sur top pages.
Sam : InfoTooltip tabIndex=-1, graphiques sans alternative, fin de rechargement non annoncée.
Manager : canaux faux sur 30 j, uniques gonflés, libellés de canaux peut-être en anglais.

## Mineurs
Plage de comparaison figée après minuit ; rebond arrondi à l'entier par le proxy ; « aucune visite avant » sur Actions/Temps ; mergeCountriesByDay mort ; légende sans mention log.

## Questions
Masquer uniques et deltas tant que l'agrégation est fausse ? Quelle phrase unique en tête ?
