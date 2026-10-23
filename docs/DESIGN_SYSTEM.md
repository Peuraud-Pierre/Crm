# Design System — Atomic Design du socle UI partagé

Note de procédure interne · Complète `Architecture_Feature.pdf` sur l'axe UI partagée · Voir aussi `docs/PLAN_ASSAINISSEMENT.md`

---

## Sommaire

1. Philosophie et périmètre
2. Pourquoi ce document ne contredit pas `Architecture_Feature.pdf`
3. Structure cible
4. Critères de classification atom / molecule / organism / template / hors-scope
5. Conventions de nommage
6. Quand créer un sous-dossier ? (seuil anti sur-structuration)
7. Inventaire actuel et proposition de classification
8. Anti-patterns à bannir
9. Checklist de revue
10. Arbre de décision
11. Plan de migration
12. Theming — tokens et couleurs
13. Motion — durées, easings et accessibilité

---

## 1. Philosophie et périmètre

Le socle UI partagé (`src/shared/ui`, `src/shared/components`) suit une organisation **Atomic Design** (Brad Frost) : Atoms → Molecules → Organisms → Templates. Cette organisation est **strictement limitée à ce qui est réutilisable indépendamment du domaine métier**. Dès qu'un composant connaît une entité métier (Shipment, Balle, Client, Devis, Ticket...), il **sort du design system** et vit dans `features/<domaine>/components/{sous-domaine}/`, selon `Architecture_Feature.pdf` §4.1.

**Règle d'or** : le design system ne sait rien du métier. Il fournit des briques et des gabarits ; les features savent ce qu'elles en font.

## 2. Pourquoi ce document ne contredit pas `Architecture_Feature.pdf`

`Architecture_Feature.pdf` §4.1 préconise un découpage des `components/` d'une feature **par domaine métier**, et argumente explicitement contre un découpage transverse par nature UI (`components/forms/` par exemple) au niveau d'une feature — parce que le formulaire d'une entité, son board et ses filtres évoluent ensemble.

Ce raisonnement s'applique **à l'intérieur d'une feature**, pas au socle partagé. Les deux axes coexistent sans se contredire :

| Axe | Où | Principe |
|---|---|---|
| Vertical Slice (Architecture_Feature.pdf) | `src/features/*/components/` | Cohésion par domaine métier |
| Atomic Design (ce document) | `src/shared/ui/`, `src/shared/components/` | Cohésion par niveau de composition, domaine-agnostique |

Un composant ne peut pas être aux deux endroits à la fois : soit il est générique et vit dans le design system, soit il connaît le métier et vit dans sa feature. Le test décisif est au §4.

**Précédent à ne pas répéter** : un dossier `src/shared/components/layout/organisms/` contenant seulement `Header.tsx` et `MobileMenu.tsx` a été créé puis supprimé/aplati par le passé. Ce n'est pas la preuve que l'Atomic Design ne fonctionne pas ici — c'est l'illustration de l'anti-pattern « sous-dossier orphelin » déjà documenté dans `Architecture_Feature.pdf` §15 : créer un tier avant d'avoir la masse critique de fichiers qui le justifie. Ce document reprend explicitement le seuil déjà en vigueur dans le projet (§6 ci-dessous) pour éviter de reproduire l'erreur.

## 3. Structure cible

```
src/shared/ui/
  atoms/          # primitives shadcn/radix : button, input, dialog, badge, checkbox...
  molecules/       # combinaisons de 2-3 atoms, logique locale, toujours domaine-agnostique
                    # ex: form.tsx (react-hook-form wrapper), input-otp.tsx, command.tsx
  organisms/        # blocs autonomes complexes, réutilisables cross-feature, domaine-agnostique
                    # ex: table.tsx + logique de tri/filtre générique, chart.tsx, sidebar.tsx (primitive shadcn)

src/shared/components/
  # ce qui n'est PAS une primitive shadcn mais reste transverse à l'app (pas à une feature)
  # se classe aussi en molecules/organisms selon les mêmes critères (§4),
  # SAUF le sous-ensemble "app-shell" (§3.1) qui a son propre statut.

src/app/routes/layouts/
  # templates : gabarits de page (MainLayout, AuthGuardLayout, PublicLayout, PublicOnlyLayout)
  # déjà au bon endroit — ce document les reconnaît comme le tier "templates",
  # sans les déplacer.
```

### 3.1 Cas particulier : l'« app-shell »

`Header.tsx`, `Sidebar.tsx` (celui de `shared/components/layout`, pas la primitive shadcn `ui/sidebar.tsx`), `MainLayout.tsx`, `menuItems.ts` connaissent la structure de navigation et le système de permissions **de cette application précise** (via `permissionCode`, `menuItems.ts`). Ils sont transverses aux features (aucune feature ne les possède) mais **ne sont pas génériques au sens Atomic Design** (ils ne seraient pas réutilisables tels quels dans un autre projet).

Ce sous-ensemble reste dans `src/shared/components/layout/` sous une étiquette **app-shell**, distincte des tiers atoms/molecules/organisms/templates. Ne pas forcer son classement dans `organisms/` — c'est précisément ce type de confusion qui a produit le dossier `organisms/` à 2 fichiers abandonné par le passé.

## 4. Critères de classification atom / molecule / organism / template / hors-scope

Test à appliquer dans l'ordre :

1. **Le composant connaît-il une entité métier** (nom de champ, statut, route spécifique à un domaine) ? → **Hors-scope**, retourne dans `features/<domaine>/components/`.
2. **Le composant est-il un gabarit de page entier** (structure de layout, pas de contenu) ? → **Template** (`src/app/routes/layouts/`).
3. **Le composant compose-t-il d'autres organisms/molecules en un bloc autonome complexe**, réutilisable tel quel dans n'importe quel projet React (indépendant de la navigation/permissions de cette app) ? → **Organism**.
4. **Le composant compose-t-il 2-3 atoms avec un peu de logique locale** (validation, état UI, formatage), sans connaître de domaine métier ? → **Molecule**.
5. **Le composant est-il une primitive sans composition ni logique** (juste du style + des props) ? → **Atom**.
6. **Le composant connaît-il la navigation/permissions propres à cette app** (menuItems, permissionCode) sans être un template de page ? → **App-shell** (§3.1), reste dans `shared/components/layout/`, pas classé dans les tiers Atomic Design.

**Critère de réutilisation avéré, pas anticipé** (aligné sur `Architecture_Feature.pdf` §11.2) : un composant ne migre vers `molecules/`/`organisms/` que s'il est **déjà** utilisé dans ≥ 2 features différentes, ou s'il s'agit d'une primitive shadcn/radix pure. Ne jamais faire remonter un composant « parce qu'il pourrait servir ailleurs » — c'est un anti-pattern (§8).

## 5. Conventions de nommage

Reprend `Architecture_Feature.pdf` §3.1 sans changement : composants en `PascalCase.tsx`, hooks en `useXxx.ts`, un seul suffixe utils/helpers par projet. Spécifique au design system :

| Élément | Convention | Exemple |
|---|---|---|
| Primitive shadcn (atom) | kebab-case (convention shadcn CLI, ne pas renommer) | `button.tsx`, `dropdown-menu.tsx` |
| Molecule/organism custom | PascalCase | `DataTable.tsx`, `SearchBar.tsx` |
| Fichier de variantes (cva) | colocalisé avec le composant, suffixe `.variants.ts` si extrait | `button.variants.ts` |

## 6. Quand créer un sous-dossier ? (seuil anti sur-structuration)

Reprend le seuil déjà en vigueur dans le projet (`Architecture_Feature.pdf` §4.2), appliqué à l'axe Atomic Design :

| Situation | Action |
|---|---|
| < 4 fichiers dans un tier | Rester à plat dans `ui/` (pas de sous-dossier `atoms/`, `molecules/` séparé tant que le volume ne le justifie pas) |
| 4–10 fichiers | Sous-dossier `ui/{tier}/` |
| > 10 fichiers | Sous-sous-dossiers thématiques si nécessaire (ex. `ui/atoms/form/`, `ui/atoms/overlay/`) |

Vu l'inventaire actuel (§7 : ~50 fichiers dans `ui/`, largement majoritaires en atoms), la création des dossiers `atoms/`, `molecules/`, `organisms/` est justifiée dès le lancement de la migration (Phase 2) — la règle du seuil s'applique surtout pour éviter de créer un tier à 1-2 fichiers dans `shared/components/`.

## 7. Inventaire actuel et proposition de classification

Classification indicative établie à la date de rédaction. **Migration exécutée depuis — voir §11 pour le résultat final et les écarts** (`table.tsx` classé atom et non organism, `toast-improvements.tsx` ajouté aux molecules, `use-toast.ts` co-localisé avec `toaster.tsx` en organism, `ImageExplorer.tsx` découvert comme code mort).

### `src/shared/ui/` (candidats atoms, sauf exceptions notées)

`accordion`, `alert-dialog`, `alert`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `carousel`, `checkbox`, `collapsible`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `hover-card`, `input`, `label`, `menubar`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `slider`, `switch`, `tabs`, `textarea`, `toggle-group`, `toggle`, `tooltip` → **atoms** (primitives shadcn/radix pures, sans logique métier).

Exceptions à traiter à part :
- `form.tsx` (wrapper react-hook-form + validation) → **molecule** (compose label + input + gestion d'erreur, logique locale).
- `input-otp.tsx` → **molecule** (compose plusieurs inputs avec logique de focus/navigation).
- `command.tsx` (command palette) → **organism** (bloc autonome complexe : recherche + liste + raccourcis clavier).
- `chart.tsx` → **organism** (compose recharts + légende + tooltip, logique de rendu non triviale).
- `table.tsx` → **atom** si c'est juste les primitives HTML stylées (`<table>`, `<thead>`...) ; si une logique de tri/pagination générique y est mêlée, alors **organism** — à vérifier au moment de la migration.
- `sidebar.tsx` (primitive shadcn générique, pas la Sidebar applicative) → **organism** (structure complexe avec état collapse/expand), à ne pas confondre avec `shared/components/layout/Sidebar.tsx` (app-shell, §3.1).
- `toast.tsx`, `toaster.tsx`, `sonner.tsx`, `toast-improvements.tsx`, `use-toast.ts` → **molecule/organism** selon rôle (primitive vs orchestration) — quatre fichiers pour un même système de notification suggère aussi une possible consolidation à évaluer en Phase 2 (hors scope Atomic Design strict). *(Consolidation faite depuis, voir la note en fin de §11 : il ne reste que `sonner.tsx`.)*
- `loading-screen.tsx`, `loading-spinner.tsx` → **atoms**.
- `ImageExplorer.tsx` → à vérifier : si générique (galerie d'images sans notion métier), **organism** ; si couplé à une feature (gallery), **hors-scope**, à redescendre dans `features/gallery/`.

### `src/shared/components/`

- `layout/Header.tsx`, `layout/Sidebar.tsx`, `layout/MainLayout.tsx`, `layout/menuItems.ts` → **app-shell** (§3.1), ne rejoint pas les tiers Atomic Design.
- `layout/PageHelpBubble.tsx` → à évaluer : si domaine-agnostique, **molecule** ; sinon app-shell.
- `sidebar/CollapsibleSection.tsx`, `sidebar/SidebarGroup.tsx`, `sidebar/SidebarProps.tsx` → dépendent de `menuItems`/permissions → **app-shell**, regroupés avec `layout/`.
- `legal/PrivacyConsentDialog.tsx`, `legal/legalContent.tsx` → domaine-agnostique (RGPD, pas lié à une feature métier), réutilisé potentiellement ailleurs → candidats **organism**, mais seulement 2 fichiers : sous le seuil de sous-dossier (§6), reste à plat pour l'instant.
- `misc/AppErrorBoundary.tsx`, `misc/Unauthorized.tsx` → **organism** (blocs autonomes génériques d'état d'erreur).
- `misc/Permission.tsx` → connaît le système de permissions de l'app → **app-shell**.
- `pwa/InstallPrompt.tsx`, `pwa/PushPermissionPrompt.tsx` → domaine-agnostique (PWA générique) → candidats **organism**, 2 fichiers seulement : sous le seuil (§6), reste à plat.

**Constat** : la majorité de `shared/components/` (layout, sidebar, misc/Permission) est en réalité de l'**app-shell**, pas du design system générique. Seuls `legal/`, `misc/AppErrorBoundary.tsx`, `misc/Unauthorized.tsx` et `pwa/` sont de vrais candidats Atomic Design, et aucun groupe n'atteint le seuil de 4 fichiers — ils restent à plat dans `shared/components/` tant que le volume ne justifie pas un sous-dossier `organisms/`.

## 8. Anti-patterns à bannir

| Anti-pattern | Symptôme | Correction |
|---|---|---|
| Sous-dossier orphelin | Un tier créé pour 1-2 fichiers (précédent : `organisms/` à 2 fichiers) | Rester à plat tant que le seuil (§6) n'est pas atteint |
| Remontée anticipée | Un composant de feature déplacé vers le design system « parce qu'il pourrait resservir » | Attendre une réutilisation avérée (≥ 2 features) avant de migrer |
| App-shell classé organism | `Header`/`Sidebar` rangés dans `organisms/` parce qu'ils sont transverses | Les traiter comme app-shell (§3.1), pas comme Atomic Design |
| Fuite de domaine métier | Une molecule/organism qui référence un champ ou un statut métier (ex: `status: 'pending' \| 'shipped'`) | Redescendre le composant dans la feature concernée |
| Duplication silencieuse | Une feature recrée sa propre variante d'un atom existant au lieu de le réutiliser | Vérifier `ui/atoms/` avant d'écrire un nouveau composant de base |

## 9. Checklist de revue

Avant de merger un déplacement ou un nouveau composant dans le design system :

- Le composant ne référence aucune entité métier (pas de nom de champ/statut spécifique à une feature).
- Le composant est déjà utilisé (ou immédiatement destiné à l'être) dans ≥ 2 features, ou c'est une primitive shadcn/radix.
- Le tier choisi (atom/molecule/organism/template/app-shell) correspond aux critères du §4.
- Le sous-dossier créé contient au moins 4 fichiers (§6), sinon le composant reste à plat.
- `tsc --noEmit` reste vert après mise à jour de tous les imports concernés.
- Le nommage suit §5.

## 10. Arbre de décision

```
Je regarde un composant du dossier shared/... : où le classer ?

├─ Connaît une entité métier (Shipment, Client, Devis...) ?
│   └─ Oui → HORS-SCOPE : redescendre dans features/<domaine>/components/
│
├─ Est un gabarit de page entier (pas de contenu, juste la structure) ?
│   └─ Oui → TEMPLATE (src/app/routes/layouts/)
│
├─ Connaît la navigation/permissions propres à CETTE app (menuItems, permissionCode) ?
│   └─ Oui → APP-SHELL (src/shared/components/layout/), pas de tier Atomic Design
│
├─ Compose plusieurs molecules/atoms en bloc autonome complexe, générique ?
│   └─ Oui → ORGANISM
│
├─ Compose 2-3 atoms avec logique locale, générique ?
│   └─ Oui → MOLECULE
│
└─ Primitive sans composition ni logique ?
    └─ Oui → ATOM
```

## 11. Plan de migration — EXÉCUTÉ

Chaque étape a été faite comme un déplacement mécanique (git mv + mise à jour des imports), sans refonte de logique. Résultat final et écarts par rapport au plan initial :

1. **`src/shared/ui/atoms/`** créé, **44 fichiers** déplacés (un peu plus que l'estimation initiale de ~40 — `table.tsx` classé ici après vérification : primitives HTML pures, aucune logique de tri/pagination, donc atom et non organism comme envisagé). 911 références d'import corrigées sur 353 fichiers consommateurs, via script (pas de renommage manuel fichier par fichier).
2. **`src/shared/ui/molecules/`** créé, **3 fichiers** : `form.tsx`, `input-otp.tsx`, et `toast-improvements.tsx` (ajouté après inspection — wrapper `sonner` avec logique/défauts de style, donc molecule et non un simple atom).
3. **`src/shared/ui/organisms/`** créé, **6 fichiers** : `command.tsx`, `chart.tsx`, `sidebar.tsx` (primitive shadcn), `toaster.tsx` (orchestration complexe : mappe la liste des toasts actifs sur les primitives `Toast`/`ToastTitle`/etc.), `use-toast.ts` (hook consommé uniquement par `toaster.tsx`, co-localisé avec lui plutôt que classé séparément — l'Atomic Design ne prévoit pas de tier pour les hooks, mais l'isoler aurait cassé la cohésion), et `ImageExplorer.tsx`.
4. **Consolidation toast/toaster/sonner/toast-improvements toujours NON faite** — confirmé hors scope de cette migration, à traiter séparément. **Nouvelle duplication découverte pendant la migration** : `src/shared/ui/organisms/use-toast.ts` n'est qu'un ré-export de `src/shared/hooks/use-toast.ts` (l'implémentation réelle), encore utilisé directement par 8 fichiers au lieu du hook canonique. Ajouté à la dette de suivi (§10 de `docs/PLAN_ASSAINISSEMENT.md`), pas corrigé ici pour ne pas mélanger réorganisation et changement de logique.

> **Périmé depuis le 2026-08-20.** Les quatre systèmes de toast ont été ramenés à Sonner seul : `toast.tsx`, `toaster.tsx`, `toast-improvements.tsx`, `shared/hooks/use-toast.ts` et son ré-export `organisms/use-toast.ts` sont supprimés, `@radix-ui/react-toast` est sorti des dépendances. `molecules/` contient désormais `form`, `input-otp`, `empty-state`, `skeleton-presets`, `route-fallback`, `liquid-tabs-indicator` et `tab-button-group` ; `organisms/` n'a plus que `command`, `chart`, `sidebar` et `ImageExplorer`. Voir §13.8.

5. `shared/components/layout/`, `sidebar/`, `misc/Permission.tsx` laissés tels quels (app-shell) — confirmé, aucun déplacement.
6. Aucun sous-dossier `organisms/` créé dans `shared/components/` — toujours sous le seuil de 4 fichiers.
7. **`components.json`** : alias `"ui"` changé de `@/shared/ui` vers `@/shared/ui/atoms` (la grande majorité des ajouts futurs via `npx shadcn add` sont des primitives/atoms ; un composant plus complexe ajouté par le CLI devra être re-classé manuellement en molecule/organism selon les critères du §4 après ajout).
8. **Vérification effectuée** (au-delà du plan initial) : `tsc --noEmit` (223 erreurs, identique à la baseline — aucune nouvelle erreur, aucune référence cassée), `npm run lint` (167, identique), `npm run build` (CSS/JS compilés sans erreur), `npm run test:front` (378 tests, 0 échec).
9. **`ImageExplorer.tsx` : découvert sans aucun consommateur nulle part dans `src/` (pas même `features/gallery/`)** — code mort confirmé, distinct du sujet de cette migration. Une tentative de suppression a été bloquée par le système de permissions (action de suppression non pré-autorisée, contrairement aux 6 pages placeholder de la Phase 1 qui avaient reçu une validation explicite). Classé provisoirement en `organisms/` par défaut de prudence — **décision à prendre par le mainteneur** : supprimer (comme la crypto morte / les pages placeholder en Phase 1) ou conserver s'il y a un usage prévu.

## 12. Theming — tokens et couleurs

Axe distinct de l'Atomic Design (§1-11 ci-dessus, qui traite de la structure des composants) : cette section couvre la couche **visuelle** du design system — les tokens de couleur et le mécanisme clair/sombre. Les deux axes coexistent dans ce document car tous deux constituent « le design system » au sens de `CLAUDE.md`.

### 12.1 Architecture des tokens

Toutes les couleurs de l'app sont des variables CSS HSL définies dans `src/index.css`, exposées comme utilitaires Tailwind via le bloc `@theme` (Tailwind v4 CSS-first config, `index.css` lignes 29-114 : `--color-background`, `--color-primary`, etc. → `bg-background`, `text-primary`...).

Trois couches se superposent sur `<html>`, chacune redéfinissant les mêmes variables :
- **`:root`** (lignes 155-264) — thème clair, valeur par défaut sans classe.
- **`.dark`** (lignes 269-342) — thème sombre, actif quand `<html>` porte la classe `dark`.
- **`.bio-mode`** / **`.dark.bio-mode`** — thème easter-egg indépendant (« vintage friperie »), orthogonal au clair/sombre, activé via `localStorage["bioMode"]` (§12.3). Non concerné par les règles ci-dessous au-delà du fait qu'il définit lui aussi ses tokens correctement.

#### `brand` vs `accent` — ne jamais confondre les deux

| Token | Rôle | Exemples d'usage |
|---|---|---|
| `--brand` / `-foreground` / `-light` | **Identité visuelle** (le vert Nokk_project). Choisi délibérément pour marquer quelque chose. | `text-brand`, `bg-brand` (icônes `MaskIcon` de `bibliotheque`), `border-brand` |
| `--accent` / `-foreground` | **Surface de survol / sélection neutre.** C'est le contrat que les primitives shadcn attendent — elles l'utilisent sans qu'on le leur demande. | `hover:bg-accent hover:text-accent-foreground` (`button` ghost/outline), `focus:bg-accent` (`select`, `dropdown-menu`), `aria-selected:bg-accent` (`calendar`) |

Ces deux rôles ont longtemps partagé `--accent`, qui portait le vert de marque. Conséquence : **tout bouton ghost/outline virait au vert plein au survol**, l'item survolé d'un `Select` aussi, et deux composants devenaient illisibles (`dropdown-menu` `SubTrigger` : texte sombre sur vert ; `calendar` : jours hors mois en `text-muted-foreground` sur vert). Le mode `bio-mode`, lui, définissait déjà `--accent` comme une surface neutre — c'est ce qui a permis d'identifier l'anomalie.

**Le piège est structurel, pas historique** : tout composant ajouté via le CLI shadcn utilisera `accent` pour ses états de survol. Si on y remet une couleur saturée, la régression revient sur l'ensemble de l'app d'un coup. Pour un aplat de marque, utiliser `brand` — jamais `accent`.

**Pattern préféré pour toute nouvelle couleur dérivée** (« cascade automatique ») : les tokens `--event-*` (ex. `--event-rdv-bg: hsl(var(--success) / 0.1)`, `index.css` lignes 241-263) référencent d'autres tokens via une fonction `hsl(var(--x) / alpha)` non résolue au moment de la définition. Résultat : ils héritent automatiquement de `.dark` sans avoir besoin d'y être redéfinis, puisque `var(--success)` change de valeur selon la classe active sur `<html>`. Préférer ce pattern à la duplication d'une valeur fixe dans les deux blocs quand c'est possible.

Le même principe s'applique en dehors du CSS : une chaîne `"hsl(var(--chart-1))"` utilisée directement comme valeur `stroke`/`fill` (SVG, recharts...) est résolue dynamiquement par le navigateur à chaque changement de classe `.dark` — aucun re-render React n'est nécessaire pour que la couleur s'adapte au thème (voir `src/features/stock/theme.ts`, `chart.lineColors`).

### 12.2 Setup next-themes et le script anti-FOUC pre-paint

Le thème est piloté par [`next-themes`](https://github.com/pacocoursey/next-themes) via `src/app/providers/ThemeProvider.tsx` :
```tsx
<NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="darkMode" disableTransitionOnChange>
```
`attribute="class"` correspond au `@custom-variant dark (&:is(.dark *));` déclaré en tête de `index.css` (Tailwind v4, pas de `tailwind.config.js` — dark mode piloté par classe, pas par `prefers-color-scheme` media query, précisément pour que `next-themes` puisse imposer `"system"` de façon cohérente).

**Pourquoi un script inline existe dans `rsbuild.config.ts`** : `next-themes` fournit normalement son propre anti-FOUC en injectant un `<script>` qui s'exécute avant le premier paint — mais ce mécanisme ne fonctionne que dans les frameworks SSR (Next.js), où ce script est sérialisé dans le HTML généré côté serveur. Cette app est une **SPA CSR pure** (Rsbuild, aucun SSR) : le script de `next-themes` est un nœud React, donc il n'existe qu'*après* que le bundle JS ait été téléchargé/exécuté et que `createRoot().render()` (`src/main.tsx`) ait tourné — à ce moment le navigateur a déjà peint `#root` avec les variables `:root` (claires) par défaut, d'où un flash visible pour tout utilisateur en dark mode (explicite ou via `"system"` + OS en sombre).

La solution : `src/theme/noFlash.ts` exporte `NO_FLASH_SCRIPT`, une chaîne JS vanilla (sans import, sans JSX) important directement dans `rsbuild.config.ts` — qui tourne côté Node/CLI, pas dans le bundle navigateur — et injectée telle quelle comme `children` d'un tag `<script id="theme-no-flash">` via `html.tags`. Ce script lit `localStorage["darkMode"]`, retombe sur `matchMedia("(prefers-color-scheme: dark)")` si absent/`"system"`, et pose la classe `dark` sur `<html>` de façon synchrone — avant que les bundles JS (chargés en `defer`) ne s'exécutent, donc avant `next-themes` et avant le premier paint.

**Contrainte critique** : la logique de résolution de `noFlash.ts` doit rester **identique valeur-pour-valeur** à celle de `next-themes` (même clé de storage, même fallback `matchMedia`, même traitement de `"system"`). Si les deux divergent, `next-themes` corrigera la classe au montage — pas de bug fonctionnel (React reste source de vérité après montage) mais un flash visible réapparaîtrait à cet instant précis. Ne pas modifier l'un sans l'autre. `disableTransitionOnChange` sur `NextThemesProvider` reste nécessaire pour que toute correction résiduelle de ce type ne s'anime pas.

### 12.3 Clés localStorage

| Clé | Valeurs | Rôle |
|---|---|---|
| `darkMode` | `"light"` \| `"dark"` \| `"system"` (legacy : `"true"`/`"false"`, convertis une seule fois au démarrage par `main.tsx`) | Clé `next-themes` (`storageKey`), gère le thème clair/sombre. |
| `bioMode` | `"true"` \| `"false"` | Toggle indépendant du thème clair/sombre (easter-egg « vintage »), appliqué via `classList.toggle("bio-mode")` dans `src/features/manager/components/Changelog/Changelog.tsx`. Sans rapport avec `darkMode` au-delà du fait que les deux manipulent des classes sur `<html>`/`<body>`. |

### 12.4 Règle d'usage des tokens — jamais de couleur en dur

**Interdit** :
- `bg-white`, `bg-black`, `text-white`, `text-black` — utiliser le token sémantique correspondant au rôle : `bg-card`/`bg-background`/`bg-popover` pour une surface, `text-foreground`/`text-popover-foreground`/`text-card-foreground` pour du texte.
- Toute couleur hex littérale (`#fff`, `#1a1a1a`...) dans `className`, `style` inline, ou une constante TS — utiliser un token `@theme` : `--chart-1` à `--chart-8` pour une série catégorielle (graphique, badge de différenciation), un token sémantique (`--success`, `--warning`, `--destructive`, `--primary`...) sinon.

**Exceptions documentées** (ne pas les « corriger » par erreur) :
- Éléments décoratifs intentionnellement indépendants du thème.
- **Couleurs de données** : une couleur qui vient de la base (`profiles.color`, couleur de catégorie, couleur d'onglet CRM) ou qui est concaténée avec un alpha hexadécimal (`${color}20`) ne peut pas être un token — `hsl(var(--x))` casserait la concaténation, et la valeur doit rester stable entre les thèmes puisqu'elle identifie une entité.
- **Rendus canvas / WebGL** : three.js, maplibre et `CanvasRenderingContext2D` n'acceptent que des couleurs littérales, aucune résolution de `var(--token)` n'y est possible.
- **Texte posé sur un aplat de couleur dynamique** : quand le fond est une donnée, le contraste ne peut pas venir d'un token `-foreground`.
- Scrims/overlays semi-transparents dont l'intention est réellement indépendante du thème (ex. `bg-black/50` sur un fond de modale) — à vérifier au cas par cas, ne pas en faire une excuse par défaut.
- Couleurs d'assets tiers (SVG/images) non tokenisables.

**Ajouter un nouveau token** si aucun existant ne convient : l'ajouter dans `@theme` (`index.css`) avec une valeur dans `:root` **et** `.dark` (et `.bio-mode`/`.dark.bio-mode` si le token doit aussi y participer) — suivre le précédent `--text-2xs`/`--text-3xs`/`--text-4xs` (`docs/PLAN_ASSAINISSEMENT.md` §7.5, ajoutés pour la même raison : combler un manque plutôt que coder une valeur arbitraire). Un nouveau token est la bonne réponse à un besoin récurrent, pas un moyen de contourner la règle pour un cas isolé.

**Ne pas non plus détourner un token existant de son rôle** : c'est ce qui s'était produit avec `--accent`, chargé du vert de marque alors que les primitives shadcn s'en servent comme surface de survol (voir le tableau `brand` vs `accent` en §12.1). Un token dont le nom vient d'une bibliothèque tierce garde la sémantique de cette bibliothèque.

**Application** : une règle oxlint (`nokk-project/no-restricted-syntax`, `.oxlintrc.json` + `scripts/oxlint-plugin.mjs`) signale en `warn` tout nouveau littéral `bg-white`/`bg-black`/`text-white`/`text-black`/hex — limitée aux littéraux de chaîne simples (ne détecte pas les couleurs construites dynamiquement, template literals, etc.). La dette historique a été entièrement résorbée le 2026-08-12 (459 → 0, voir `docs/PLAN_ASSAINISSEMENT.md` §7.8) : **la baseline lint est verrouillée à zéro**, donc toute nouvelle occurrence fait échouer la CI. Pour un cas relevant réellement des exceptions ci-dessus, poser un `eslint-disable-next-line nokk-project/no-restricted-syntax` **avec sa justification**, jamais un disable nu.

### 12.5 Ce que la règle ESLint ne voit pas — la baseline à zéro n'est pas une preuve

La baseline verrouillée à 0 du §12.4 mesure **une** chose : qu'aucun nouveau littéral `bg-white`/`bg-black`/`text-white`/`text-black`/hex n'apparaît dans une chaîne simple. Elle ne dit rien du reste, et un audit du 2026-08-20 a chiffré l'angle mort à **2 325 occurrences** de couleurs de palette Tailwind dans 154 fichiers, alors que le lint était au vert.

Quatre familles échappent structurellement à la règle :

| Angle mort | Exemple réel |
|---|---|
| **Palette Tailwind** (`slate`, `emerald`, `amber`…) | `text-slate-400`, `bg-emerald-50` — le plus gros volume, de loin |
| **Template literals** | `` backgroundImage: `…#fca5a5 0, #fca5a5 1px…` `` — la règle inspecte les `Literal`, pas les `TemplateLiteral` |
| **Fonctions de couleur CSS** | `borderColor: "rgb(226 232 240)"`, `todo: "hsl(215, 16%, 47%)"` — ni `#`, ni `bg-white` |
| **Mots-clés CSS** | `style={{ color: "white" }}` — la règle attrape la *classe* `text-white`, pas la *valeur* |

**Corollaire pratique** : avant d'affirmer qu'une zone est tokenisée, la greper explicitement. Le lint vert prouve l'absence de régression sur un périmètre étroit, pas la conformité au §12.4.

### 12.6 Un token sémantique doit dire la vérité, et servir aux deux usages

`--warning` a longtemps valu `210 90% 60%` — une teinte **bleue**, identique à `--chart-2`. `bg-warning` rendait donc un avertissement bleu.

Le coût est mesurable : le token n'était utilisé que **10 fois** dans toute l'app, contre **260** classes `amber`/`orange`/`yellow` écrites en dur juste à côté. Sur la même période, `--destructive` — rouge, donc conforme à son nom — était adopté **157 fois**. Un token qui ment n'est pas ignoré passivement : il pousse activement chaque développeur à écrire une couleur en dur, et c'est ainsi qu'on accumule des centaines d'occurrences sans qu'aucune règle ne se déclenche.

**Second invariant, sur la luminosité** : un token sémantique sert à la fois d'**aplat** (`bg-warning` + `text-warning-foreground`) et de **texte** (`text-warning` sur `bg-warning-light`). Ces deux usages tirent dans des directions opposées. La luminosité doit satisfaire les deux — c'est pourquoi `--success` est à 32 %, `--destructive` à 45 % et `--warning` à 38 % en thème clair. Un ambre à 50 % fonctionne en aplat et devient illisible en texte sur fond clair ; c'est le réglage qui décide si le token est utilisable, pas seulement sa teinte.

Avant d'ajouter ou de modifier un token de statut, vérifier les deux points : **la teinte correspond-elle au nom ?** et **la luminosité tient-elle dans les deux usages, dans les deux thèmes ?**

### 12.7 Le piège `shadow-<nom>` — couleur d'ombre, pas taille d'ombre

`shadow-card` a été utilisée sur 9 `<Card>` pendant des mois sans produire aucun effet — pire, en en supprimant un.

`shadow-*` est ambigu en Tailwind v4 : selon ce qui existe dans le thème, `shadow-x` est soit une **taille** d'ombre (via `--shadow-x`), soit une **couleur** d'ombre (via `--color-x`). Comme `--color-card` existe, `shadow-card` a été résolue en couleur — elle repeignait l'ombre `shadow-sm` que `Card` porte en base dans la couleur de fond de la carte, donc l'effaçait :

```css
.shadow-card{--tw-shadow-color:hsl(var(--card))}
```

Ni erreur de build, ni de lint, ni de type. **Une couleur d'ombre n'a de sens qu'accompagnée d'une taille** (`shadow-lg shadow-primary/20` est correct ; `shadow-card` seule ne l'est pas).

**Méthode de détection** — ne pas chercher des noms connus, mais diffuser les classes du code contre le CSS réellement émis. C'est la seule façon de trouver celles qu'on ne soupçonne pas :

```bash
npm run build
CSS=$(ls dist/static/css/index.*.css)
for c in $(grep -rhoE '\b(shadow|bg-gradient|animate)-[a-z][a-z0-9-]*' src --include=*.tsx | sort -u); do
    grep -qE "\.$c[{\\\\]" "$CSS" || echo "ABSENTE: $c"
done
```

Les classes utilisées uniquement derrière une variante (`data-[state=open]:animate-accordion-down`) ressortent en faux positifs : leur sélecteur émis est préfixé et échappé. Vérifier au cas par cas avant de conclure.

---

## 13. Motion — durées, easings et accessibilité

Troisième axe du design system, après la structure des composants (§1-11) et la couleur (§12). Même principe directeur que le §12 : **le mouvement vient du socle, pas de la feature**. Une feature qui écrit ses propres durées est un symptôme, exactement comme une feature qui écrit ses propres couleurs.

Le point de départ de cette section : la feature `crm` était nettement plus vivante que le reste de l'app (≈3 classes d'animation par fichier contre 0 pour `sell-journal`, `auth` ou `profile`), non par choix de conception mais parce qu'aucune convention transverse n'existait. Neuf valeurs de durée et cinq easings circulaient en parallèle.

### 13.1 Échelle de tokens

Tous définis dans le bloc `@theme` de `src/index.css`.

| Token | Valeur | Utilitaire généré | Usage canonique |
|---|---|---|---|
| `--transition-duration-instant` | 100ms | `duration-instant` | Retour tactile immédiat (press, cases à cocher) |
| `--transition-duration-fast` | 150ms | `duration-fast` | Changements de couleur : hover de bouton, de ligne, de badge |
| `--transition-duration-base` | 200ms | `duration-base` | Défaut pour une interaction visible (carte, onglet) |
| `--transition-duration-slow` | 300ms | `duration-slow` | Entrées d'éléments, fondus de contenu, sorties de panneaux |
| `--transition-duration-slower` | 500ms | `duration-slower` | Entrées de panneaux latéraux, grands déplacements |
| `--transition-duration-glacial` | 700ms | `duration-glacial` | Indicateur d'onglets glissant — réservé aux mouvements « signature » |
| `--ease-emphasized` | `cubic-bezier(0.22, 1, 0.36, 1)` | `ease-emphasized` | Mouvement décidé par l'utilisateur (expo-out) |
| `--ease-overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `ease-overshoot` | Apparition d'un élément qui « arrive » (back-out) |
| `--ease-decel` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | `ease-decel` | Micro-déplacements (< 8px) |
| `--shadow-surface` | `var(--shadow-card)` | `shadow-surface` | Élévation de repos |
| `--shadow-raised` | `var(--shadow-elevated)` | `shadow-raised` | Élévation au survol / carte détachée |
| `--shadow-glow` | `var(--shadow-primary)` | `shadow-glow` | Accent de marque porté par une ombre |

La colonne « utilitaire généré » n'est pas décorative — voir §13.2.

### 13.2 Le piège Tailwind v4 : quels namespaces existent réellement

**Une entrée dans `@theme` ne génère un utilitaire que si son préfixe correspond à un *namespace* connu de Tailwind.** Sinon, elle produit une variable CSS parfaitement valide… et aucune classe.

| Utilitaire | Namespace réel |
|---|---|
| `duration-*` | **`--transition-duration-*`** — *pas* `--duration-*` |
| `ease-*` | `--ease-*` |
| `shadow-*` | `--shadow-*` |
| `animate-*` | `--animate-*` |

Le piège est difficile à voir parce qu'il **échoue silencieusement**. Contrairement à une couleur codée en dur, que la règle ESLint du §12.4 attrape, un token invisible ne déclenche ni erreur de build, ni erreur de lint, ni erreur de type : la classe est simplement absente du CSS et l'élément ne bouge pas.

**Le précédent, dans ce dépôt** : `--shadow-card`, `--shadow-elevated` et `--shadow-primary` étaient définis dans `:root` (et redéfinis dans `.dark`) mais **jamais déclarés dans `@theme`**. Deux fichiers utilisaient `shadow-elevated` et `hover:shadow-elevated` — sans produire la moindre ombre, pendant des mois. Le même scénario a produit `transition-smooth`, `shadow-medium` et `animate-fade-in`, trois classes qui n'ont jamais existé.

**Règle opérationnelle** : avant d'ajouter un token censé générer un utilitaire, vérifier le namespace, puis **vérifier l'émission réelle dans le CSS de build** — c'est le seul contrôle qui prouve quoi que ce soit :

```bash
npm run build
grep -oE '\.(ease-emphasized|shadow-raised|duration-base)[ {]' dist/static/css/index.*.css
```

**Tout token listé au §13.1 doit apparaître dans ce grep, même si aucun composant ne l'utilise encore.** La raison est un effet de bord utile de la détection automatique de sources : ce document est lui-même scanné par Tailwind, et les noms de la colonne « utilitaire généré » du tableau ci-dessus y sont vus comme des candidats. Un token dont le namespace est correct est donc émis du seul fait d'être documenté ; un token dont le namespace est faux ne correspond à aucune règle et reste absent. **L'absence d'un token documenté est donc le signal fiable d'un namespace erroné**, indépendamment de son adoption dans le code.

**Étendre, ne jamais redéfinir.** `--ease-*` contient déjà `--ease-in`, `--ease-out` et `--ease-in-out` (defaults de `tailwindcss/theme.css`). Ajouter `--ease-emphasized` étend le namespace ; réécrire `--ease-out` le **remplace pour toute l'app**, y compris pour `tw-animate-css` et les 200+ usages existants. Même logique que le piège `brand` vs `accent` du §12.1 : un token dont le nom vient d'une bibliothèque tierce garde la sémantique de cette bibliothèque.

**Les valeurs nues restent valides.** `duration-300` continue de fonctionner : `duration-*` accepte une liste de valeurs par défaut *et* le namespace de thème. Ajouter des tokens nommés ne casse donc rien — mais la forme nommée devient la forme préférée, et `duration-[…]` / `ease-[…]` sont proscrits au même titre que les autres valeurs arbitraires (`CLAUDE.md`).

### 13.3 Vocabulaire — quel easing pour quelle intention

- **`ease-out`** (défaut Tailwind) : changements de couleur, hovers. Ne pas le remplacer par une courbe expressive — un `ease-emphasized` sur un simple changement de fond donne une sensation molle sur les survols de tableau.
- **`ease-emphasized`** (expo-out) : déplacement **décidé par l'utilisateur** — onglets, panneaux latéraux, sidebar, indicateur glissant. Démarre vite, s'arrête net.
- **`ease-overshoot`** (back-out) : apparition d'un élément qui « arrive » — colonnes, cartes d'une grille. **Jamais en sortie** : un élément qui part ne rebondit pas.
- **`ease-decel`** : micro-déplacements sous ~8px, où une courbe marquée serait perçue comme un tremblement.

**Règles de durée** : plus le déplacement est grand, plus la durée est longue. Et **une sortie est plus rapide ou égale à l'entrée correspondante** — un élément qui s'efface doit libérer l'écran vite, alors qu'une entrée trop brusque désoriente. `sheet.tsx` en est l'application de référence (entrée `duration-slower`, sortie `duration-slow`, asymétrie commentée sur place).

### 13.4 `prefers-reduced-motion` — respecté par construction

Mécanisme à deux étages :

1. **Une media query globale dans `src/index.css`** neutralise toute animation et transition CSS de l'app — `tw-animate-css`, keyframes maison, transitions des primitives — sans qu'aucune feature ait à y penser.
2. **`usePrefersReducedMotion()`** (`src/shared/hooks/`) pour ce qui est piloté en JS, que le CSS ne peut pas atteindre : framer-motion, anime.js.

Trois pièges, chacun rencontré dans ce dépôt, sont traités explicitement par la règle globale :

- **`animation-delay` doit être remis à 0**, pas seulement la durée. Les staggers combinent `fill-mode-backwards` et un `animationDelay` inline : l'élément est *invisible* avant son délai. Neutraliser la durée en conservant le délai laisserait donc des blocs de contenu vides pendant plusieurs centaines de millisecondes. **Réduire le mouvement ne doit jamais masquer du contenu.**
- **Les spinners doivent survivre.** `animation-iteration-count: 1` fige `animate-spin` — tous les indicateurs de chargement de l'app s'arrêteraient net. D'où l'exclusion `:not(.animate-spin):not(.motion-essential)`. Un mouvement qui **porte de l'information d'état** n'est pas de la décoration ; `motion-essential` est l'échappatoire documentée pour les cas équivalents (barre de progression indéterminée).
- **La règle rend les transitions instantanées, elle n'annule pas l'état final d'une transformation.** Un `hover:-translate-y-0.5` reste actif, il saute simplement sans transition. Tout `hover:` qui déplace ou met à l'échelle doit donc porter son propre `motion-reduce:` de neutralisation — c'est la seule chose que le CSS global ne peut pas faire à notre place. `Card variant="interactive"` et `Button` en sont les exemples de référence.

### 13.5 Le piège de perf : un hook d'abonnement global par ligne

`useReducedMotion()` de framer-motion crée **un `matchMedia` et un listener à chaque appel**. Appelé dans le rendu d'une ligne de liste, il produit autant d'abonnements que de lignes — mesuré à ~100 abonnements media-query par page sur le journal d'API de `arrivage-admin`.

Le contournement initial (remonter la valeur au parent et la passer en prop) traitait le symptôme au prix d'une discipline que personne ne tient à chaque nouveau composant. La cause est désormais traitée à la source : `usePrefersReducedMotion()` s'appuie sur un **store au niveau du module** (`useSyncExternalStore` + un `Set` de callbacks), donc **un seul listener natif quel que soit le nombre d'abonnés**. Bénéfice secondaire : il retourne `boolean` et non `boolean | null`, ce qui supprime les `?? false` disséminés.

**Généralisation** : ne jamais appeler, à l'intérieur d'une liste, un hook qui s'abonne à une ressource globale. Vaut aussi pour `useTheme`, `useIsMobile` et tout `ResizeObserver`. Sur les très grandes listes, passer la valeur en prop reste préférable même avec un store partagé — un hook de moins à exécuter par ligne.

### 13.6 Stagger — le plafond n'est pas cosmétique

Utiliser `staggerDelay()` / `staggerStyle()` de `src/shared/lib/motion.ts`.

Le plafond est **structurel**. Sans lui, avec un pas de 40 ms, la 60ᵉ ligne d'une liste attend 2,4 s avant d'apparaître : l'utilisateur perçoit un bug de chargement, pas une animation. Le CRM plafonne déjà systématiquement (`Math.min(index * N, cap)`) ; ces helpers ne font que formaliser une convention existante.

Corollaire : **le stagger passe par un `style={{ animationDelay }}` sur une animation CSS**, jamais par framer-motion — pour ne pas monter un moteur d'animation JS par ligne.

### 13.7 Où mettre le mouvement — CSS d'abord, framer-motion en dernier recours

Arbre de décision, dans l'esprit du §10 :

| Besoin | Outil |
|---|---|
| Hover, focus, changement d'état, entrée simple | **CSS** — `transition-*` + tokens, ou `animate-in` (tw-animate-css) |
| Liste de N éléments qui apparaissent | **CSS + `staggerStyle()`** |
| Élément dont la **sortie** doit être animée | **framer-motion** (`AnimatePresence`) — le CSS ne peut pas animer un démontage |
| Réordonnancement, reflow de grille | **framer-motion** (`layout`) |
| Geste, drag, valeur suivie en continu | **framer-motion**, ou un setter DOM direct hors React quand le coût de re-render est prohibitif |

`src/shared/components/misc/StatTile.tsx` est le composant de référence pour un usage partagé de framer-motion (stagger + reduced-motion). Les primitives Radix (`dialog`, `sheet`, `dropdown-menu`, `select`, `popover`, `tooltip`, `accordion`) portent **déjà** leurs animations d'entrée/sortie via `tw-animate-css` : ne pas les réanimer par-dessus.

### 13.8 Composants d'état

Trois situations reviennent dans presque toutes les features et ont chacune leur composant partagé — les réécrire à la main est un anti-pattern au sens du §8 :

| Situation | Composant |
|---|---|
| Liste ou page sans contenu | `molecules/empty-state.tsx` — distinguer `variant="default"` (rien n'existe encore) de `variant="search"` (un filtre ne renvoie rien) : ces deux cas n'appellent pas la même action de sortie |
| Chargement d'un bloc de contenu | `molecules/skeleton-presets.tsx` — `SkeletonText`, `SkeletonCard`, `SkeletonList`, `SkeletonTable`, `SkeletonStatTiles`, et `SkeletonGroup` pour une forme sur-mesure |
| Bouton en cours de soumission | prop `loading` de `atoms/button.tsx` — elle pose le spinner, la désactivation **et** `aria-busy` ; un `Loader2` posé à la main n'en fait qu'un tiers |
| Bascule de vue hors Radix (filtres, sélecteur de vue) | `molecules/tab-button-group.tsx` — `TabButtonGroup` + `TabButton` |
| Chargement d'une route lazy | `molecules/route-fallback.tsx` — `RouteFallback` (dans le shell) et `FullPageFallback` (avant le shell) |
| Notification transitoire (succès, erreur, chargement) | **Sonner** — `import { toast } from "sonner"` |

Préférer un squelette de forme approchante à un spinner : il réduit le décalage visuel à l'arrivée du contenu. Les fallbacks de route portent un **délai d'apparition de 150 ms** — sans lui, chaque navigation vers un chunk déjà en cache produit un flash de squelette, plus perturbant que le vide qu'il comble.

Un squelette **sur-mesure reste légitime** : c'est même préférable quand la forme du contenu attendu est particulière (vignette carrée, avatar + champs, ligne de tableau). Ce que les presets apportent en plus de la forme, c'est le `role="status" aria-busy` : sans lui un lecteur d'écran ne voit que des div vides. `SkeletonGroup` fournit ce conteneur annoncé sans imposer de forme. Quand un preset en imbrique un autre, seul le conteneur externe doit annoncer — d'où la prop `announce`, sinon un chargement de route annonce « Chargement » jusqu'à trois fois.

Ce qui **n'est pas** un état vide : une notice d'une ligne au fil du contenu (« Aucune permission attribuée. »), un `CommandEmpty` de cmdk, un placeholder de vignette, la zone de dépôt vide d'une colonne kanban. Les convertir en bloc centré avec icône dégrade la page au lieu de l'unifier. Le critère est « bloc qui occupe la zone de contenu d'une région », pas « phrase qui contient *Aucun* ».

**Un seul système de toast : Sonner.** Quatre coexistaient (le `toast` Radix de shadcn, son `Toaster`, un wrapper `toast-improvements` sans aucun consommateur, et Sonner), dont deux montés en parallèle dans `AppProviders`. Les trois autres ont été supprimés. Sonner est appelé directement — `toast.success(titre, { description })` / `toast.error(...)` — sans hook : c'est un import statique, donc il ne rentre pas dans les tableaux de dépendances de `useCallback`, contrairement au `const { toast } = useToast()` qu'il remplace. La configuration visuelle (thème, classes) est centralisée dans `atoms/sonner.tsx` ; ne pas repasser de `style` inline au site d'appel, ce que faisait le wrapper supprimé au prix de couleurs codées en dur (§12.4).

**Onglets** : `<TabsList indicator>` active la pastille glissante. La prop est **opt-in** et non le défaut, parce que l'indicateur mesure `offsetLeft` : une liste en `flex-wrap` ou qui déborde placerait la pastille au mauvais endroit. Chaque liste doit être vue une fois avant d'être basculée. Les 20 listes tenant sur une ligne sont basculées ; `analytics/Analytics.tsx` et `manager/Manager.tsx` restent en dehors, en `flex-wrap`.

La pastille et **la couleur du texte actif forment une paire** : `indicator` neutralise le fond du trigger, donc le `data-[state=active]:text-foreground` de la base tomberait sur `bg-sidebar-accent` (vert sombre) — ~2:1 en thème clair, sous le seuil WCAG AA, et invisible en thème sombre. C'est pour cela que `text-sidebar-accent-foreground` est porté par la **liste** et non par chaque appelant : les 5 premières activations avaient oublié de compenser. Une liste qui repeint la pastille via `indicatorClassName` doit donc aussi repeindre le texte.

`<TabsList variant="underline">` couvre les barres d'onglets soulignées, collées en haut d'un panneau, où une pastille flotterait au milieu d'une bordure.

Pour un groupe de boutons qui n'est pas un `TabsList` (filtres, sélecteur de vue), utiliser `molecules/tab-button-group.tsx` plutôt que de câbler `liquid-tabs-indicator` à la main : `TabButton` porte le `data-state` que la pastille cherche, et `TabButtonGroup` bake le `relative` dont elle a besoin comme `offsetParent` — un appelant qui l'oublie obtient une pastille calée sur un ancêtre quelconque, sans erreur. `liquid-tabs-indicator.tsx` reste exporté pour les cas hors gabarit.

**Cartes** : `variant="interactive"` uniquement quand la carte est réellement actionnable ; `variant="elevated"` pour une élévation statique. Poser un hover-lift sur une carte de mise en page crée une affordance mensongère (§13.7) — c'est la raison pour laquelle `default` est resté byte-identique à l'existant.

### 13.9 Application

- **Automatique** : `nokk-project/no-restricted-syntax` (`.oxlintrc.json`) signale les valeurs arbitraires `duration-[…]` / `ease-[…]`, les durées nues `duration-<n>`, et `transition-all` — au même titre que les couleurs en dur du §12.4. `transition-all` n'est pas qu'une divergence de socle : il fait surveiller au navigateur **toutes** les propriétés animables du nœud, y compris celles qui déclenchent un layout ; nommer les propriétés (`transition-colors`, `transition-[box-shadow,transform]`) est à la fois plus lisible et moins coûteux. Comme les règles couleurs, ces sélecteurs ne voient que les `Literal` : un `transition-all` dans un template literal passe au travers (§12.5). Le compteur « valeurs Tailwind arbitraires » de `npm run tech-debt:report` doit rester stable ou baisser.
- **Vérification d'émission** : le grep sur le CSS de build du §13.2, seul contrôle qui détecte un token cassé.
- **Revue** (§9) : tout `hover:` qui déplace a-t-il son `motion-reduce:` ? aucun hook d'abonnement global dans un `.map()` ? le stagger est-il plafonné ? l'état vide distingue-t-il « vide » de « filtré » ?

---

## 14. Modules à onglets — le socle des stocks

Le dépôt compte deux modules de stock (`features/stock`, `features/stock_handpick`) et en attend d'autres. Cette section décrit ce qu'ils partagent, et surtout **ce qui rend le partage vérifiable plutôt que déclaratif**.

### 14.1 Le contrat de thème

`src/shared/ui/module-theme.ts` définit `ModuleTheme` : l'arbre de clés que tout thème de module doit exposer. Chaque thème se termine par `satisfies ModuleTheme`.

```ts
export const MON_THEME = { … } satisfies ModuleTheme
```

**Une clé du socle manquante ou renommée casse le build**, et l'erreur nomme la clé absente en pointant le fichier de thème. C'est le seul dispositif du dépôt qui empêche *mécaniquement* un nouveau module d'inventer son propre vocabulaire de tokens.

Chaque groupe est déclaré `Extensible<{…}>`, et l'interface porte une signature d'index à la racine : un module garde le droit d'avoir des tokens que les autres n'ont pas (`kanban` pour `stock`, `flux` pour le handpick). Le contrat impose la **présence** des clés, jamais l'égalité des valeurs — deux modules peuvent légitimement diverger sur la densité d'une grille de cartes.

Deux pistes ont été écartées et ne doivent pas être « simplifiées » par la suite : une annotation `: ModuleTheme` effacerait les clés hors socle du type public, et un helper générique `<T extends ModuleTheme>` déplace l'erreur chez les consommateurs quand le socle n'est pas satisfait. Le raisonnement complet est dans l'en-tête du fichier.

### 14.2 Les primitives partagées

| Composant | Rôle |
|---|---|
| `molecules/search-select` | Liste déroulante **cherchable** |
| `molecules/info-tooltip` | Pastille d'aide à côté d'un libellé |
| `molecules/board-header` | Titre + sous-titre + action principale d'un onglet |
| `molecules/load-more` | Pilule « Voir plus » des grilles de cartes |
| `molecules/status-badge` | Pastille de statut, habillage déjà résolu |
| `molecules/tab-button-group` | Bascule de vue segmentée |
| `molecules/vue-toggle` | Bascule entre les vues internes d'une page (`?vue=`), libellé court en mobile, pastille de compte |
| `molecules/confirm-action` | Confirmation d'une action (destructive ou non), bouton occupé pendant l'appel |
| `organisms/filter-bar` | Barre compacte + panneau repliable + badge de comptage |
| `organisms/form-sheet` | Coquille des sheets de formulaire ; `size="xl"` pour une saisie en grille, `footerSummary` pour des totaux collés au pied |
| `organisms/referential-panel` | CRUD d'un référentiel (table / cartes) |
| `organisms/referential-forms` | `EditRow` (édition inline) et `CreateSheet` (création) des référentiels simples à champs texte |
| `organisms/module-tabs` | Barre d'onglets Radix + pastille glissante (présentation seule) |
| `organisms/record-table` | Tableau piloté par un descripteur de colonnes, groupement et repli en cartes |
| `organisms/activity-feed` | Journal d'activité groupé |
| `organisms/activity-detail-sheet` | Détail d'un groupe de journal, avec son tableau de diff |

Et hors `shared/ui`, trois pièces du même socle :

| Module | Rôle |
|---|---|
| `app/routes/layouts/TabbedModuleRoute` | Template de page : onglets visibles, canonicalisation d'URL, **unique** effet de garde |
| `shared/lib/tabbedModule` | Résolution d'URL pure (tables dérivées, alias historiques, clamp des sous-sections) |
| `shared/lib/logGrouping` | Regroupement des entrées de journal, paramétré par `anchor` |
| `shared/hooks/useDetailDeepLink` | Garde de second niveau des liens profonds vers une sheet |
| `shared/hooks/useDebouncedCallback` | Regroupe une rafale d'événements realtime en un seul rechargement |

Ces composants ne connaissent **aucune entité métier** : ils reçoivent leur thème, leurs droits déjà résolus et leurs options. C'est la condition posée par le §4 pour vivre dans `shared/ui`.

### 14.3 Règles d'usage

- **Listes déroulantes** — `SearchSelect` dès que les options viennent d'un **référentiel** (fournisseur, catégorie, emplacement, auteur) : leur nombre croît avec les données. `atoms/select` pour une **énumération fermée et courte** (unité, sens d'un mouvement, statut) ; y ajouter une recherche pour trois options serait du bruit.
- **Pagination** — grille de cartes → `LoadMore` ; tableau → pagination numérotée (`atoms/pagination`). Les deux modules mélangeaient les deux modèles sans critère.
- **Filtrage** — barre compacte (recherche + bascules) surmontant un panneau repliable. `activeCount` est **requis** et non optionnel : le repli peut masquer un filtre actif, et sans le badge une liste filtrée à vide n'a aucune explication à l'écran. Le décompte passe par `countActiveFilters(filters, defaults)`, qui se déduit des valeurs par défaut du module — pas d'une liste de clés tenue à la main.
- **Tableaux** — `RecordTable` plutôt qu'une table écrite à la main sur `atoms/table`. Les colonnes (`RecordColumn`) restent dans la feature : elles portent le vocabulaire métier. Le `colSpan` d'une bannière de groupe se déduit du nombre de colonnes réservées — ne pas réintroduire de constante magique, l'ancienne (`COLUMNS.length - 3`) cassait silencieusement à chaque colonne ajoutée.
- **Valeurs Tailwind arbitraires** — elles ne montent **jamais** dans `shared/ui`. Déplacer `min-w-[900px]` du site d'appel vers un composant partagé transforme une dette locale en dette globale : les primitives prennent ces classes en props (`tableClassName`, `wrapperClassName`), et une largeur de colonne passe par `style={{ width }}`, qui n'est pas une classe arbitraire.
- **Journal d'activité** — `ActivityFeed` + `ActivityDetailSheet`, alimentés par un objet `vocabulary` (libellés et icônes par entité et par action) et un dictionnaire `fieldLabels` décrivant le schéma du module. Le socle ne connaît ni « balle » ni « mouvement ». Le regroupement passe par `shared/lib/logGrouping`, dont le paramètre `anchor` rend visible le seul écart de comportement subsistant entre les deux stocks. Chaque entrée est une carte : le feed applique `theme.activity.row` (bordure, fond `card`, rayon), clé qui existait dans les deux thèmes sans être câblée — les lignes n'avaient qu'un séparateur et se fondaient dans l'arrière-plan de la page. Un module qui laisserait cette clé vide obtiendrait des lignes sans surface.
- **Droits** — un composant de `shared/ui` n'appelle jamais `hasPermission` : il reçoit `canCreate`/`canUpdate`/`canDelete` déjà résolus. C'est ce qui le garde hors de toute dépendance à `features/auth`.

### 14.4 Vocabulaire et URL

Onglets communs : **Dashboard**, **Inventaire**, **Flux**, **Historique**, **Paramètres**, aux segments `dashboard` / `inventaire` / `flux` / `historique` / `parametres`, avec les mêmes identifiants internes (`dashboardTab`, `inventaireTab`, …). « Arrivages » et « Départs » sont des **titres de section** à l'intérieur de Flux, pas des onglets : le segment `detail` porte déjà un id de ressource (`/stock/flux/{id}` ouvre une sheet), il ne peut pas porter aussi une sous-vue.

La **salle de tri** (`/salle-de-tri`) et les **commandes boutiques** (`/commandes`) ne sont PAS des onglets du stock : ce sont des pages à part (code dans `features/stock`, dont elles partagent référentiels et journal). Leur `detail` porte un id de ressource (ou `new`) et leurs sous-vues passent par le paramètre `?vue=`, lu sans jamais rediriger.

Un segment renommé ne se supprime pas : il entre dans une table `LEGACY_SECTIONS` consommée par la canonicalisation de la route, **détail conservé**. Rien n'expire un favori, un lien de notification ou une URL en base — voir `docs/ROUTING.md`.
