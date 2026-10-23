---
target: src/features/matomo
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:<repo>/src/features/matomo"
timestamp: 2026-10-02T11-04-42Z
slug: src-features-matomo
closed: true
---
# Critique — src/features/matomo (onglet Matomo de /analytics)
Méthode : dual-agent (A design · B détecteur). Navigateur indisponible (extension Chrome non connectée) — rendu mobile/sombre non vérifié visuellement.

## Score : 17/40 (Poor)
1 Visibilité 2 · 2 Monde réel 2 · 3 Contrôle 2 · 4 Cohérence 1 · 5 Prévention 2 · 6 Reconnaissance 2 · 7 Flexibilité 1 · 8 Minimalisme 2 · 9 Erreurs 2 · 10 Aide 1

## Spécificité : interchangeable
Dashboard Matomo générique ; rien sur NOKK_PROJECT/leads. Détecteur : 0 constat. Règles projet : couleurs green-* en dur (routes/Matomo.tsx:150), carte en bleu = 2e couleur d'identité (MatomoMap.tsx:21,247,381), arbitraires non commentés max-h-[85vh] (VisitorProfileModal.tsx:100), aspect-[225/190] (MatomoMap.tsx:300).

## Problèmes prioritaires
- [P1] Ne répond pas à « d'où viennent visiteurs et leads » : pas de référents nommés (idsubdatatable), pas de delta vs période précédente, pas de conversions, pas de pont vers l'onglet Leads. → shape
- [P1] Deux barres de filtres désynchronisées (VisitsLog.tsx:31-33 copie la période au montage ; options divergentes ; 2 Rafraîchir). Une barre, libellée, période dans l'URL. → distill
- [P1] Chargement/erreurs trompeurs + fetch direct dans la route (Matomo.tsx:72-99, pas de res.ok) : service + hooks TanStack Query, squelettes, erreur par bloc, horodatage. → harden
- [P1] Hiérarchie inversée / écarts Registre vert : bandeau temps réel vert gras, carte bleue, pays text-xl, StatCard centrée rounded-xl. → quieter + colorize
- [P2] Mobile/graphes : canaux sans repli carte, labels d'URL qui se chevauchent, séries non nommées (nb_visits), dates ISO, p-6 fixe. → adapt

## Personas
Alex : pas de lien profond, export, comparaison ; journal à refiltrer ; temps réel chargé une fois.
Sam : 5 select sans label ; modale sans focus trap/restitution ; carte keyboard={false} ; pas d'aria-live ; h1 puis h3.
Manager NOKK_PROJECT : site 71 par défaut en dur ; types de canaux sans sources ; leads dans un autre onglet ; référents seulement via le journal.

## Mineurs
Taux de rebond brut ; secondsToHMS ×2 incohérent, fmtInt ×3 ; VisitItem.tsx:41-42 « undefined • undefined () » ; percentage rankedCountries faux (inutilisé) ; GeoJSON depuis raw.githubusercontent.com ; liens externes sans indicateur.

## Questions
Supprimer la carte casserait quelle décision ? Pourquoi séparer trafic et leads ? Le temps réel sert-il au pilotage ?
