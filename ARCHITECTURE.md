# Architecture — Nokk_project

Ce fichier est un point d'entrée court. Les documents de référence détaillés vivent dans `docs/` :

- **[`docs/Architecture_Feature.pdf`](docs/Architecture_Feature.pdf)** — doctrine Vertical Slice / Feature-First pour `src/features/*` : structure d'une feature, conventions de nommage, hooks/context/services, checklist de revue, anti-patterns.
- **[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)** — conventions Atomic Design pour le socle UI partagé (`src/shared/ui`, `src/shared/components`).
- **[`docs/PLAN_ASSAINISSEMENT.md`](docs/PLAN_ASSAINISSEMENT.md)** — plan de remédiation technique en cours, avec tableau de suivi.
- **[`docs/CI_CD.md`](docs/CI_CD.md)** — pipeline CI/CD (webhook Go + Docker sur le VPS). *Anciennement `ARCHITECTURE.md` — renommé car ce fichier ne décrivait pas l'architecture applicative.*
- **[`CLAUDE.md`](CLAUDE.md)** — règles condensées pour tout travail assisté par IA sur ce repo.

## Vue d'ensemble rapide

- **Stack** : React 19, TypeScript, Rsbuild/Rspack, Tailwind CSS 4 (CSS-first, pas de `tailwind.config`), shadcn/Radix, Supabase (auth + DB + realtime), TanStack Query, rstest.
- **Organisation `src/`** :
  - `src/features/*` — un dossier par domaine métier (CRM, Stock, Messages, Projects, Tickets...), voir `Architecture_Feature.pdf`.
  - `src/shared/ui`, `src/shared/components` — design system partagé, voir `DESIGN_SYSTEM.md`.
  - `src/app/` — providers globaux et déclaration des routes (`src/app/routes/router.tsx`).
  - `src/integrations/supabase/client.ts` — point d'entrée unique du client Supabase (généré, ne pas éditer).
- **Auth** : entièrement via Supabase Auth (session, MFA/AAL). `AUTH0_SETUP.md` a été retiré — il décrivait une intégration Auth0 jamais implémentée dans le code.

Pour toute question d'architecture non couverte ici, se référer à `Architecture_Feature.pdf` avant d'improviser une nouvelle convention.
