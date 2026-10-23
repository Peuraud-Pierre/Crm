# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Outil interne de NOKK_PROJECT, utilisé par toute l'entreprise :

- **Commerciaux terrain** : CRM, rendez-vous, devis, tournées. Ils travaillent souvent sur mobile, en déplacement.
- **Équipe entrepôt / tri** : balles, arrivages de conteneurs, tri, handpick. Sur poste fixe ou tablette, en atelier.
- **Direction / managers** : analytics, supervision, pilotage. Principalement sur desktop.
- **Admin / équipe tech** : utilisateurs, permissions, console d'erreurs, maintenance.

## Product Purpose

« La Console NOKK_PROJECT » (dépôt `Nokk_project`) est la console interne de pilotage et d'assistance de l'entreprise. NOKK_PROJECT fait du négoce et du tri de vêtements de seconde main (fripe, vintage ; marque Nokk_project Handpick). La Console remplace les tableurs Excel, les échanges par e-mail et les notes éparses par un seul système partagé, en temps réel. Elle est réussie quand l'information est portée par le système plutôt que par les individus. Exemple : savoir sans demander à personne quels conteneurs sont en transit ou quelle facture fournisseur manque.

## Positioning

C'est un tout-en-un interne : un seul outil pour toute l'entreprise, au lieu d'un ERP, d'un CRM, d'une messagerie et d'un drive séparés. Les modules partagent la même authentification, les mêmes permissions et le même shell. Ils couvrent le CRM, le stock et les arrivages, la messagerie chiffrée de bout en bout, le drive, le wiki, les tickets, les analytics et l'administration.

## Operating Context

- PWA installable (`display: standalone`), en français (`fr-FR`), utilisée sur desktop, tablette et téléphone.
- Flux métier spécifiques : balles tracées par BIN, livraisons par DIN, conteneurs import (arrivée au Havre, numéro BIC, facture fournisseur), tri, handpick, tournées.
- Les données arrivent aussi par import Excel (flux arrivages/départs).
- Les modules sont des features verticales (`src/features/*`), avec des onglets et du deep-linking dont l'URL est la source de vérité (`docs/ROUTING.md`).

## Capabilities and Constraints

- Stack existante : React 19, TypeScript, Rsbuild, Tailwind CSS 4 (CSS-first, tokens `@theme` dans `src/index.css`), shadcn/Radix, Supabase (auth, MFA, realtime), TanStack Query.
- Design system partagé limité à `src/shared/ui` et `src/shared/components` (`docs/DESIGN_SYSTEM.md`). Les features restent organisées par domaine métier.
- **Le mobile est indispensable** : chaque écran doit fonctionner au téléphone, pas seulement être toléré.
- **Les thèmes clair et sombre sont tous deux obligatoires**, au même niveau de qualité.
- Les permissions par rôle déterminent ce que chaque utilisateur voit. Une permission absente de prod signifie que la fonctionnalité n'est pas déployée.
- Pas de valeurs Tailwind arbitraires sans justification documentée.

## Brand Commitments

- Nom affiché : « La Console » / « La Console NOKK_PROJECT ». Logo : `public/nokk_project_logo.svg`. Marque commerciale associée : Nokk_project Handpick.
- Langue de l'interface : français.

## Evidence on Hand

- Documentation métier : `docs/note-direction-arrivages.md`, `docs/crm.md`, `docs/stock.md`, `docs/flow-limited-user-guide.html`, les guides PDF dans `docs/`.
- Aucun témoignage, chiffre d'usage ni benchmark utilisateur n'a été fourni. Ne pas en inventer.

## Product Principles

1. **Le système détient l'information, pas les personnes.** Rendre visible ce qu'il fallait auparavant demander à quelqu'un (statuts, alertes, éléments manquants).
2. **Un seul outil, une seule logique.** Un module doit se comporter comme ses voisins, avec les mêmes patterns, la même navigation et les mêmes permissions.
3. **Le terrain compte autant que le bureau.** Un commercial au téléphone et un manager sur grand écran doivent pouvoir accomplir leur tâche.
4. **Alerter sur ce qui bloque.** Une facture manquante ou un conteneur en retard doit se voir, sans fouiller.

## Accessibility & Inclusion

Exigence formelle : RGAA / WCAG 2.x niveau AA (contrastes, navigation clavier, libellés, cibles tactiles), dans les deux thèmes.
