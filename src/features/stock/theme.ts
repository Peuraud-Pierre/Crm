import type { ModuleTheme } from "@/shared/ui/module-theme"

/**
 * Tokens de présentation du module Stock.
 *
 * Satisfait `ModuleTheme` (`shared/ui/module-theme.ts`) : le socle de clés est
 * commun à tous les modules de stock, ce qui interdit à un nouveau module d'en
 * inventer un autre. Les clés hors socle (`bar`, `button`, `toggleGroup`,
 * `kanban`, `badges`, `card.status`) restent propres à ce module.
 *
 * Certaines clés du socle n'ont pas encore de consommateur ICI — elles en ont
 * dans le handpick, et portent les valeurs cibles communes :
 * `board.tableWrapper`/`cardList` (ce module n'a pas de vue tableau des
 * balles), `settings.editRow`/`fieldLabel`/`chip`/`chipEmpty` et
 * `activity.row`/`timestamp`/`diffKey` (ses lignes d'édition et son journal
 * posent encore leurs classes à la main), `card.identity`/`title`/`meta`
 * /`footerBorder` (sa carte de balle a un dessin propre, carré et dense).
 *
 * Les câbler suppose de découper `BalleCreationSheet` (524 l.) et
 * `LivraisonCreationSheet` (1027 l.), god components déjà suivis comme dette
 * dans `docs/PLAN_ASSAINISSEMENT.md` — un chantier distinct de la convergence
 * UI. Le contrat garantit en attendant qu'un composant partagé recevant ce
 * thème trouvera les clés qu'il attend.
 */
export const GESTION_THEME = {
  // === FONDATIONS ===
  page: {
    background: "bg-background",
    text: "text-foreground",
    title: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
  },
  bar: {
    container: "bg-card border-border shadow-sm",
    separator: "bg-border",
    icon: "text-muted-foreground",
  },
  input: {
    base: "bg-background border-border",
    text: "text-foreground placeholder:text-muted-foreground",
    focus: "focus-visible:ring-ring/20 ring-offset-background",
  },
  toggleGroup: {
    container: "bg-muted/50 border-border p-2 rounded-sm",
  },

  // === NAVIGATION PRINCIPALE (StockTabs) ===
  tabs: {
    list: "flex w-full h-auto p-1.5 bg-card rounded-xl border border-border",
    // L'état actif est porté par la pastille glissante de `<TabsList indicator>`
    // (DESIGN_SYSTEM.md §13.8) : le trigger ne pose plus ni fond, ni ombre, ni
    // ring — ils se superposeraient à elle. La couleur du texte actif vient
    // elle aussi de la liste : elle est appairée à la couleur de la pastille,
    // et la fixer ici la désappairerait.
    trigger:
      "flex-1 flex flex-col items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-3 h-auto rounded-lg text-muted-foreground hover:text-foreground transition-colors duration-base ease-emphasized border-none",
  },

  // === BARRE DE FILTRES (FilterBar, FlowFilterBar, panels) ===
  filterBar: {
    container: "rounded-lg bg-card shadow-sm border border-border",
    // `relative` : sert d'offsetParent à la pastille de TabButtonGroup.
    tabToggle: "relative flex p-1 bg-muted/50 rounded-lg border border-border/50",
    tabActive: "bg-background text-foreground shadow-sm",
    tabInactive: "text-muted-foreground hover:text-foreground",
    search: "bg-muted/30 border-border",
    panel: "px-3 py-2.5 overflow-x-auto bg-muted/10",
    panelLabel: "text-3xs font-bold uppercase tracking-wider text-muted-foreground",
  },

  // === BOUTONS & INTERACTIONS ===
  button: {
    primary:
      "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm transition-colors font-bold",
    outline:
      "bg-background border-primary/20 text-foreground hover:bg-muted",
    ghost:
      "text-muted-foreground hover:bg-muted hover:text-foreground",
  },

  // === BOARDS (grilles de cartes) ===
  board: {
    container: "flex flex-col gap-5",
    // Cartes denses : une balle porte peu d'information, la grille monte donc
    // beaucoup plus haut en colonnes que celle du handpick.
    grid: "grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8",
    // Passé au `className` d'`<EmptyState>` — était un objet à trois clés dont
    // une seule (`container`) était lue.
    emptyState:
      "flex flex-col items-center justify-center w-full min-h-[300px] p-8 text-center border-2 border-dashed rounded-xl border-border bg-muted/50",
    tableWrapper: "hidden overflow-hidden rounded-xl border border-border md:block",
    cardList: "flex flex-col gap-3 md:hidden",
    loadMore:
      "flex items-center px-6 py-2.5 text-sm font-medium transition-colors bg-card border rounded-full shadow-sm text-foreground border-border hover:bg-muted",
  },

  // === SECTIONS (en-têtes de boards/pages) ===
  section: {
    title: "text-xl font-bold text-foreground",
    description: "text-sm text-muted-foreground",
    groupTitle: "text-sm font-semibold text-muted-foreground uppercase tracking-wider",
  },

  // === PARAMÈTRES ===
  settings: {
    content: "bg-card rounded-xl border border-border/60 shadow-sm",
    editRow:
      "flex flex-col gap-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-end dark:bg-primary/10",
    fieldLabel: "ml-0.5 text-xs font-medium text-muted-foreground",
    chip: "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground",
    chipEmpty: "text-xs italic text-muted-foreground",
    list: {
      tag: "px-2 py-0.5 rounded text-3xs font-mono font-medium bg-muted text-muted-foreground",
    },
    section: {
      title: "text-lg font-semibold text-foreground",
      description: "text-sm text-muted-foreground",
      row: "flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50",
    },
  },

  // === ACTIVITÉ (journal, badges action/entité) ===
  activity: {
    row: "flex gap-3 rounded-lg border border-border bg-card p-3",
    timestamp: "text-xs tabular-nums text-muted-foreground",
    diffKey: "font-mono text-xs text-muted-foreground",
    // Bordures alignées sur le handpick : une pastille d'action sans
    // bordure se confond avec un simple aplat de fond sur les lignes de
    // journal, qui en ont déjà un.
    actionColors: {
      create: "bg-success-light text-success border-success/20",
      update: "bg-chart-2/10 text-chart-2 border-chart-2/20",
      delete: "bg-destructive-light text-destructive border-destructive/20",
    } as Record<string, string>,
    entityColors: {
      balle:       "text-chart-4",
      delivery:    "text-chart-2",
      category:    "text-chart-5",
      fournisseur: "text-chart-6",
      arrivage:    "text-chart-7",
      // Une entité absente de cette table rend une pastille vide SANS
      // erreur (Record<string, string>) : toute nouvelle entité du journal
      // s'ajoute ici en même temps que dans `ActivityEntityType`.
      fiche_tri:          "text-chart-1",
      trieur:             "text-chart-3",
      commande:           "text-chart-8",
      livraison_boutique: "text-chart-2",
      carton:             "text-chart-4",
    } as Record<string, string>,
  },

  // === CHARTS ===
  // Réutilise les tokens catégoriels --chart-1..8 (src/index.css) plutôt que
  // des hex fixes, pour que les lignes du graphique s'adaptent au dark mode
  // (même pattern que les tokens --event-* : hsl(var(--x)) non résolu par
  // Tailwind, résolu dynamiquement par le navigateur à chaque changement de
  // thème, sans re-render nécessaire).
  chart: {
    palette: [
      "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))",
      "hsl(var(--chart-5))", "hsl(var(--chart-6))", "hsl(var(--chart-7))", "hsl(var(--chart-8))",
    ] as string[],
    grid: "hsl(var(--border))",
    axis: "hsl(var(--muted-foreground))",
  },

  // === KANBAN & COLONNES ===
  kanban: {
    column: {
      bg: "bg-card",
      border: "border-border p-4",
      headerBorder: "border-border",
      title: "text-foreground",
      scrollArea: "bg-muted/50",
    },
    emptyState: {
      text: "text-muted-foreground",
    },
  },

  // === BADGES & LABELS ===
  badges: {
    status: {
      shipped:
        "bg-chart-2/10 text-chart-2 border-chart-2/20",
      stocked:
        "bg-chart-1/10 text-chart-1 border-chart-1/20",
      used: "bg-chart-5/10 text-chart-5 border-chart-5/20",
      exported:
        "bg-chart-4/10 text-chart-4 border-chart-4/20",
      transfered:
        "bg-chart-7/10 text-chart-7 border-chart-7/20",
    },
  },

  // === CARTES ===
  card: {
    base: "relative group overflow-hidden transition-[box-shadow,border-color] duration-slow hover:shadow-lg border",
    identity: "font-mono text-xs tabular-nums text-muted-foreground",
    title: "font-medium text-foreground",
    meta: "text-sm text-muted-foreground",
    footerBorder: "border-t border-border/60",

    // Surfaces communes à tous les statuts : elles étaient répétées à
    // l'identique dans chacun des cinq objets ci-dessous.
    surface: "bg-card",
    text: "text-foreground",
    mutedText: "text-muted-foreground",

    /**
     * Déclinaison par statut, réduite aux quatre clés qui varient réellement.
     * Elle en comptait dix : `bg`/`text`/`mutedText` étaient identiques pour
     * les cinq statuts (hissées ci-dessus), `badge` dupliquait mot pour mot
     * `badges.status` (désormais seule source, via BALLE_STATUS_CONFIG), et
     * `avatarBg`/`timerBg` n'avaient aucun consommateur.
     *
     * `statusDot` a perdu son `shadow-[0_0_8px_hsl(var(--chart-N)/0.5)]` :
     * c'était la seule source de valeurs Tailwind arbitraires du fichier, pour
     * un halo de 8 px sur une pastille de 8 px.
     */
    status: {
      shipped: {
        border: "border-chart-2/20 hover:border-chart-2/60",
        icon: "text-chart-2",
        footerBorder: "border-chart-2/10",
        statusDot: "bg-chart-2",
      },
      stocked: {
        border: "border-chart-1/20 hover:border-chart-1/60",
        icon: "text-chart-1",
        footerBorder: "border-chart-1/10",
        statusDot: "bg-chart-1",
      },
      used: {
        border: "border-chart-5/20 hover:border-chart-5/60",
        icon: "text-chart-5",
        footerBorder: "border-chart-5/10",
        statusDot: "bg-chart-5",
      },
      exported: {
        border: "border-chart-4/20 hover:border-chart-4/60",
        icon: "text-chart-4",
        footerBorder: "border-chart-4/10",
        statusDot: "bg-chart-4",
      },
      transfered: {
        border: "border-chart-7/20 hover:border-chart-7/60",
        icon: "text-chart-7",
        footerBorder: "border-chart-7/10",
        statusDot: "bg-chart-7",
      },
    },
  },
} satisfies ModuleTheme
