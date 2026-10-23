---
target: src/features/matomo
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:<repo>/src/features/matomo"
timestamp: 2026-10-05T07-59-38Z
slug: src-features-matomo
closed: true
---
# Critique — src/features/matomo (onglet « Trafic du site »), 4e passage
Méthode : dual-agent (A design · B détecteur + données de prod en lecture). Navigateur indisponible.

## Score : 28/40 (Good, bas de bande) — précédents 17, 26, 25
1 Visibilité 3 · 2 Monde réel 3 · 3 Contrôle 3 · 4 Cohérence 3 · 5 Prévention 3 · 6 Reconnaissance 3 · 7 Flexibilité 2 · 8 Minimalisme 3 · 9 Erreurs 3 · 10 Aide 2

## Données de prod (lecture seule)
Proxy redéployé (nb_visits sur 58 pays) ; canaux en range : 6 lignes uniques ; uniques KPI dédupliqués (12 787). /log toujours 502.
Faux positif écarté : « uniques à 0 en range » réfuté par la prod.
Détecteur 0 · lint 0 · tsc 0 · 24 tests front + Go verts · aucun fichier > 400 lignes.

## Problèmes prioritaires
- [P1] Vue par défaut sans aujourd'hui, journal compris (contredit le compteur en ligne). Journal sur plage glissante incluant aujourd'hui. → clarify
- [P1] Canaux limités au type : référents (idsubdatatable, referrer_name) inexploités. Ligne dépliable vers les principaux référents. → shape
- [P2] Carte probablement rognée sur mobile (zoom 2 fixe, gestes coupés). fitBounds ou masquer sous sm. → adapt
- [P2] « Visites du journal » loin du journal ; TabButton sans focus-visible, cibles ~28px. → layout + harden
- [P2] Top pages choisi par visites mais barres en nb_hits : filter_sort_column=nb_hits. → harden

## Personas
Alex : pas de plage libre, export, lien Matomo ; journal plafonné sans pagination.
Sam : <main> imbriqué, pas de h1, bascule sans focus visible, InfoTooltip tabIndex=-1.
Manager : pays OK ; sources au seul type de canal ; aucun pont vers les leads.

## Mineurs
Rafraîchir sans nocache=1 ; rebond « 0 % » sans visite ; total sr-only des uniques gonflé ; compteur en ligne disparaît au changement de site ; garde {result:"error"} morte ; clés React possiblement dupliquées dans la modale.

## Questions
« Et alors » plutôt que « combien » ? La carte après détail des sources ?
