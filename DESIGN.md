---
name: La Console NOKK_PROJECT
description: Console interne de pilotage — papier chaud, encre ardoise, tampon vert.
colors:
  registre-green: "hsl(131 65% 28%)"
  registre-green-deep: "hsl(131 65% 24%)"
  brand-green: "hsl(131 65% 32%)"
  brand-wash: "hsl(131 65% 95%)"
  warm-paper: "hsl(40 20% 98%)"
  sheet-white: "hsl(0 0% 100%)"
  slate-ink: "hsl(220 25% 15%)"
  slate-ink-soft: "hsl(220 25% 25%)"
  pencil-grey: "hsl(220 10% 50%)"
  linen: "hsl(40 10% 95%)"
  linen-press: "hsl(40 10% 92%)"
  rule-line: "hsl(220 13% 90%)"
  focus-blue: "hsl(210 100% 40%)"
  customs-amber: "hsl(38 92% 38%)"
  customs-amber-wash: "hsl(38 92% 94%)"
  rust-alert: "hsl(15 100% 45%)"
  rust-alert-wash: "hsl(15 100% 95%)"
  visio-violet: "hsl(270 70% 55%)"
  night-desk: "hsl(220 25% 8%)"
  night-sheet: "hsl(220 25% 10%)"
  night-linen: "hsl(220 25% 15%)"
  night-rule: "hsl(220 25% 20%)"
  night-ink: "hsl(220 13% 90%)"
  night-green: "hsl(131 50% 38%)"
  night-sidebar: "hsl(220 25% 5%)"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.75rem
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.25rem
  body-mobile-input:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5rem
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1rem
  label-dense:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.registre-green}"
    textColor: "{colors.sheet-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.registre-green-deep}"
  button-outline:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.linen-press}"
  button-secondary:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.slate-ink-soft}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-destructive:
    backgroundColor: "{colors.rust-alert}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.warm-paper}"
    textColor: "{colors.slate-ink}"
    typography: "{typography.body-mobile-input}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-success:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.sheet-white}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-warning:
    backgroundColor: "{colors.customs-amber}"
    textColor: "{colors.sheet-white}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  sidebar-item:
    backgroundColor: "{colors.registre-green}"
    textColor: "{colors.sheet-white}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px"
    height: "32px"
  sidebar-item-active:
    backgroundColor: "{colors.brand-green}"
---

# Design System: La Console NOKK_PROJECT

<!-- Ce fichier décrit le langage VISUEL. La structure des composants (atoms /
     molecules / organisms), le mécanisme de thème et les pièges Tailwind v4
     sont dans docs/DESIGN_SYSTEM.md, qui reste la source de vérité technique.
     Les valeurs normatives vivent dans src/index.css ; le frontmatter ci-dessus
     en est le reflet (canonique HSL, comme le code). -->

## Overview

**Creative North Star: "Le Registre vert"**

La Console est un registre de commerce bien tenu. On y écrit à l'encre ardoise sur un papier légèrement chaud, et un tampon vert NOKK_PROJECT signe ce qui appartient à la maison. Elle n'essaie pas de séduire : elle doit être exacte, durable et lisible par toute l'entreprise, de l'atelier de tri au bureau de la direction. L'assurance vient de la tenue (alignements nets, statuts sans ambiguïté, une seule couleur d'identité), pas de l'ornement.

Les composants sont familiers et éprouvés (socle shadcn/Radix). La marque ne se joue pas dans des formes inventées. Elle tient dans trois choses : le vert de la barre latérale, la chaleur du fond papier et la rigueur des tokens sémantiques. En pratique, l'interface est dense : `text-xs` et `text-sm` dominent l'app, et les tableaux, kanbans et cartes de balles se lisent de près. Le registre se consulte, il ne se feuillette pas.

Le système existe à parité en clair et en sombre. Le registre de nuit troque le papier contre un bureau ardoise profond, sans jamais perdre le vert.

**Key Characteristics:**
- Un seul vert d'identité, porté par la barre latérale et l'action principale.
- Fond papier chaud (teinte 40°), neutres ardoise froids (teinte 220°) : le contraste chaud/froid remplace la décoration.
- Surfaces plates au repos, élévation réservée à l'interaction.
- Couleurs de statut sémantiques qui disent la vérité (l'ambre avertit, le rouille alerte, le vert confirme).
- Police système, aucune police web : la Console se charge vite, partout, y compris en PWA sur le terrain.

## Colors

Une palette de registre : un papier, une encre, un tampon, et trois encres de statut.

### Primary
- **Vert Registre** (`registre-green`) : la couleur de la maison. Fond de la barre latérale en thème clair, boutons d'action principale, onglet actif. Au survol, il fonce en **Vert Registre profond** (`registre-green-deep`). En sombre, il s'éclaircit en `night-green` pour garder son contraste.
- **Vert Tampon** (`brand-green`) : le vert d'identité « choisi délibérément » (token `--brand`). Icônes de marque, item actif de la barre latérale, accents qui signent. Il a pour lavis **Vert Tampon dilué** (`brand-wash`), le fond des pastilles et des surfaces de confirmation.

### Neutral
- **Papier chaud** (`warm-paper`) : fond de page. Sa légère teinte chaude distingue la Console d'un back-office gris.
- **Feuille blanche** (`sheet-white`) : cartes, popovers, dialogs. C'est la feuille posée sur le papier.
- **Encre ardoise** (`slate-ink`) : texte principal. L'ardoise douce (`slate-ink-soft`) sert au texte des surfaces secondaires.
- **Gris crayon** (`pencil-grey`) : texte secondaire, métadonnées, placeholders.
- **Lin** (`linen`) et **Lin pressé** (`linen-press`) : surfaces secondaires et muettes, puis surface de survol et de sélection neutre (token `--accent`).
- **Filet** (`rule-line`) : bordures et séparateurs, les lignes du registre.
- **Registre de nuit** : `night-desk` (fond), `night-sheet` (cartes), `night-linen` (surfaces secondaires), `night-rule` (bordures), `night-ink` (texte), `night-sidebar` (barre latérale, presque noire, où le vert ne reste que sur l'item actif).

### Statut
- **Ambre douane** (`customs-amber`, lavis `customs-amber-wash`) : avertissement (facture manquante, échéance proche). Sa luminosité de 38 % lui permet de servir en aplat comme en texte.
- **Rouille** (`rust-alert`, lavis `rust-alert-wash`) : destructif et bloquant.
- Le **succès** réutilise le Vert Tampon : dans ce registre, confirmer, c'est tamponner.
- **Violet visio** (`visio-violet`) : réservé au type d'événement visio du calendrier CRM.
- **Bleu focus** (`focus-blue`) : uniquement l'anneau de focus clavier. Ce n'est pas une couleur de contenu.
- **Palette de graphiques** (`--chart-1` à `--chart-8`) : catégorielle, non sémantique, déclinée en sombre. Elle sert à différencier des séries, jamais à signaler un statut.

### Named Rules
**La règle du Tampon unique.** Le vert est la seule couleur d'identité. Aucune deuxième couleur de marque. Une nouvelle couleur sémantique se dérive d'un token existant (`hsl(var(--x) / alpha)`, comme les `--event-*`), elle ne s'invente pas.

**La règle Brand ≠ Accent.** `accent` est un survol neutre (lin), `brand` est le vert. Ne jamais remettre du vert dans `--accent` : tous les survols shadcn de l'app viraient au vert plein (incident documenté, `docs/DESIGN_SYSTEM.md` §12.1).

**La règle du Statut honnête.** Un avertissement est ambre, jamais bleu. Une couleur de statut écrite en dur (`amber-500`, `red-600`) est une dette : passer par `warning`, `destructive` ou `success`.

## Typography

**Police unique :** la police système (`ui-sans-serif, system-ui, sans-serif`, pile par défaut de Tailwind)

**Character :** C'est l'écriture du teneur de registre : neutre, native sur chaque appareil, instantanée. La hiérarchie vient du poids et de la taille, jamais d'une deuxième famille.

### Hierarchy
- **Headline** (600, 1.5rem, interligne 1, tracking −0.025em) : titres de carte (`CardTitle`) et titres de section majeurs.
- **Title** (600, 1.125rem) : titres d'onglet et d'en-tête de board (`BoardHeader`).
- **Body** (400, 0.875rem / 1.25rem) : texte courant, cellules de tableau, boutons, items de la barre latérale. C'est la taille de travail de la Console.
- **Body mobile input** (400, 1rem) : les champs passent à 16px sous `md` pour éviter le zoom automatique d'iOS, puis reviennent à 14px.
- **Label** (500, 0.75rem) : badges, métadonnées, en-têtes de colonnes. C'est la taille la plus utilisée de l'app.
- **Label dense** (500, 11px / 10px / 9px via `text-2xs` / `text-3xs` / `text-4xs`) : tableaux et pastilles très denses (stock) et libellés d'onglets.

### Named Rules
**La règle de l'Échelle fermée.** Rien sous `text-xs` hors des trois tokens `text-2xs`/`3xs`/`4xs`. Pas de `text-[11px]`. Le `text-4xs` (9px) reste exceptionnel et ne porte jamais d'information unique.

## Layout

La Console est un shell à barre latérale : 16rem dépliée, 3rem repliée en icônes, et une feuille (`Sheet`) de 18rem sur mobile. Les modules à onglets suivent un gabarit commun (`TabbedModuleRoute` + `ModuleTabs`). La barre d'onglets est pleine largeur avec une pastille glissante. Sur mobile, les libellés d'onglets sont masqués et seules les icônes restent (`hidden sm:block`). Le contenu commence 24px sous la barre.

Le rythme suit la grille Tailwind de 4px : `gap-2` (8px) entre éléments voisins, `gap-1` (4px) dans les composés serrés, `p-4` (16px) pour les cartes de données, `p-6` (24px) pour les cartes de mise en page. Les breakpoints sont ceux de Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). Le mobile est un usage de premier rang : les tableaux se replient en cartes (`RecordTable`), et les filtres se replient dans un panneau dont le badge compte les filtres actifs.

### Named Rules
**La règle du Terrain.** Tout écran doit fonctionner au téléphone. Un tableau large se replie en cartes, il ne défile pas horizontalement sans raison.

## Elevation & Depth

Le système est plat par défaut. Une carte au repos porte une ombre minimale (`shadow-sm`) et un filet : elle est posée sur le papier, elle ne flotte pas. La profondeur se construit par les surfaces (papier → feuille → lin) plus que par les ombres. L'élévation n'apparaît qu'en réponse à l'interaction ou pour ce qui passe au-dessus du contenu (popover, dialog, sheet).

### Shadow Vocabulary
- **Surface** (`shadow-surface`, `0 2px 8px hsl(220 25% 15% / 0.08)`) : posé, pour les conteneurs qui ont besoin d'un détachement léger.
- **Relevé** (`shadow-raised`, `0 8px 30px hsl(220 25% 15% / 0.12)`) : survol des cartes interactives et variante `elevated`.
- **Halo vert** (`shadow-glow`, `0 4px 20px hsl(131 65% 28% / 0.25)`) : rare, il souligne une action de marque.
- En sombre, les ombres passent au noir pur (opacités de 0.2 et 0.3) : sur un fond ardoise, une ombre teintée ne se voit pas.

### Named Rules
**La règle du Plat au repos.** Une surface ne s'élève que si elle est actionnable. Le hover-lift est réservé à `Card variant="interactive"`. Donner du relief à une carte non cliquable, c'est mentir sur l'affordance.

## Shapes

Les coins sont doucement arrondis, sur une seule base : `--radius` de 12px. Le système en dérive trois paliers : `rounded-lg` 12px pour les cartes et conteneurs, `rounded-md` 10px pour les boutons, champs et items de navigation, `rounded-sm` 8px pour les petits éléments internes. Les badges et la pilule « Voir plus » sont pleinement arrondis (`rounded-full`). Les bordures sont des filets de 1px en `rule-line` : le registre est réglé, pas encadré.

## Components

### Buttons
Robustes et sobres. Un bouton ressemble à un bouton, sans surprise.
- **Shape :** coins doux (10px). Hauteurs de 40px par défaut, 36px en `sm`, 44px en `lg`, carré de 40px pour les icônes.
- **Primary :** aplat Vert Registre, texte blanc, poids 500, padding 8×16px.
- **Hover / Focus :** survol à 90 % d'opacité, retour de pression `active:scale-98` neutralisé par `motion-reduce`, anneau de focus bleu de 2px. Transition `duration-fast` (150ms).
- **Outline / Secondary / Ghost :** outline = filet + fond papier, survol lin. Secondary = aplat lin. Ghost = rien au repos, lin au survol. Link = texte vert souligné au survol.
- **Loading :** la prop `loading` affiche un spinner en tête et désactive le bouton.

### Chips / Badges
- **Style :** pilule (`rounded-full`), label 12px semi-gras, padding 2×10px, bordure transparente sur les variantes pleines.
- **Variantes :** `default` (vert), `secondary` (lin), `success`, `warning` (ambre), `destructive` (rouille), `outline` (filet seul). Pour un statut métier, préférer `StatusBadge`, dont l'habillage est déjà résolu.

### Cards / Containers
- **Corner Style :** 12px.
- **Background :** Feuille blanche sur Papier chaud (en sombre : `night-sheet` sur `night-desk`).
- **Shadow Strategy :** `shadow-sm` au repos. `interactive` : lift de 2px et `shadow-raised` au survol (easing `ease-emphasized`, 200ms). `elevated` : `shadow-raised` statique.
- **Border :** filet de 1px.
- **Internal Padding :** 24px (`CardHeader`/`CardContent`), 16px pour les cartes de données denses.

### Inputs / Fields
- **Style :** filet de 1px, fond papier, coins de 10px, hauteur de 40px, padding 8×12px. Texte à 16px sous `md`, 14px au-dessus.
- **Focus :** anneau bleu de 2px, sans décalage.
- **Disabled :** 50 % d'opacité, curseur interdit.
- **Listes déroulantes :** `SearchSelect` pour un référentiel qui grandit, `Select` pour une énumération courte et fermée.

### Navigation
- **Barre latérale :** aplat Vert Registre en clair, presque noir en sombre. Items de 32px, texte 14px, coins de 10px, icônes de 16px. Au survol et à l'état actif, l'item prend le Vert Tampon et passe en poids 500. Repliable en mode icônes. Sur mobile, elle devient une feuille.
- **Onglets de module :** `ModuleTabs`, une barre Radix avec une pastille glissante (`LiquidTabsIndicator`). Icône et libellé de 11px, icône seule sur mobile. L'URL est la source de vérité (`docs/ROUTING.md`).

### Frise d'acheminement (signature)
`ShipmentTimeline` suit un conteneur du départ à la réception. Le véhicule (navire, camion) est positionné par la donnée. Il ne s'anime (`ship-bob`, `truck-rumble`) que sur le segment en cours : un trajet fini ou pas commencé reste immobile.

## Do's and Don'ts

### Do:
- **Do** passer par les tokens sémantiques (`bg-primary`, `text-warning`, `bg-brand-light`) et dériver toute nouvelle couleur d'un token existant (`hsl(var(--x) / alpha)`).
- **Do** livrer chaque écran en clair ET en sombre, au même niveau. Vérifier les contrastes AA dans les deux thèmes.
- **Do** réserver l'élévation aux surfaces actionnables (`Card variant="interactive"`) et aux calques (popover, dialog, sheet).
- **Do** utiliser les tokens de mouvement (`duration-fast`/`base`/`slow`, `ease-emphasized`/`decel`/`overshoot`) et porter `motion-reduce:` sur tout `hover:` qui déplace ou met à l'échelle.
- **Do** réutiliser le socle partagé (`RecordTable`, `FilterBar`, `BoardHeader`, `StatusBadge`, `FormSheet`) avant d'écrire une variante locale.

### Don't:
- **Don't** mettre une couleur saturée dans `--accent`. C'est le survol neutre de toutes les primitives shadcn.
- **Don't** écrire une couleur de statut en dur (`amber-500`, `red-600`, `green-700`) ni une valeur arbitraire (`text-[11px]`, `w-[123px]`, `shadow-[…]`) sans justification commentée.
- **Don't** ajouter une police web ni une deuxième couleur de marque.
- **Don't** donner un hover-lift à une carte non cliquable.
- **Don't** utiliser la palette `--chart-*` pour signaler un statut.
