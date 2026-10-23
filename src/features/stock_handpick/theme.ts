import type { ModuleTheme } from "@/shared/ui/module-theme"

/**
 * Tokens de présentation du module Stock Handpick.
 *
 * Satisfait `ModuleTheme` (`shared/ui/module-theme.ts`), le socle de clés
 * commun à tous les modules de stock — même arbre que `GESTION_THEME`, ce qui
 * permet aux primitives partagées de consommer indifféremment l'un ou l'autre.
 * La clé hors socle `flux` est propre à ce module.
 *
 * Deux différences de VALEURS assumées avec son aîné :
 *
 *  • aucune valeur arbitraire (`shadow-[0_0_8px_...]`, `text-[11px]`…).
 *    `src/features/stock` est identifié comme le pire contrevenant du dépôt
 *    (CLAUDE.md) — ne pas importer sa dette ici.
 *  • pas de déclinaison de `card` par statut : la couleur d'un statut est
 *    déclarée UNE fois dans `BALLE_STATUS_CONFIG` (constants.ts), la carte se
 *    contente de la porter. C'est le modèle vers lequel `stock` doit revenir.
 *
 * Deux valeurs divergent encore et convergeront avec les primitives
 * partagées : `settings.section.title` (`text-base` ici, `text-lg` dans
 * `stock`) et `activity.actionColors` (bordures ici, aplats seuls dans
 * `stock`). Elles sont signalées sur place.
 */
export const HANDPICK_THEME = {
    // === FONDATIONS ===
    page: {
        background: "bg-background",
        text: "text-foreground",
        title: "text-xs font-bold uppercase tracking-wider text-muted-foreground",
    },
    input: {
        base: "bg-background border-border",
        text: "text-foreground placeholder:text-muted-foreground",
    },

    // === NAVIGATION PRINCIPALE (components/Tabs.tsx) ===
    tabs: {
        list: "flex w-full h-auto p-1.5 bg-card rounded-xl border border-border",
        // L'état actif est porté par la pastille glissante de `<TabsList indicator>`
        // (DESIGN_SYSTEM.md §13.8) : le trigger ne pose ni fond, ni ombre, ni ring,
        // ils se superposeraient à elle.
        trigger:
            "flex-1 flex flex-col items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-3 h-auto rounded-lg text-muted-foreground hover:text-foreground transition-colors duration-base ease-emphasized border-none",
    },

    // === BARRE DE FILTRES ===
    filterBar: {
        container: "rounded-lg bg-card shadow-sm border border-border",
        // `relative` : sert d'offsetParent à la pastille active.
        tabToggle: "relative flex p-1 bg-muted/50 rounded-lg border border-border/50",
        tabActive: "bg-background text-foreground shadow-sm",
        tabInactive: "text-muted-foreground hover:text-foreground",
        search: "bg-muted/30 border-border",
        panel: "px-3 py-2.5 overflow-x-auto bg-muted/10",
        panelLabel: "text-3xs font-bold uppercase tracking-wider text-muted-foreground",
    },

    // === SURFACES ===
    board: {
        container: "flex flex-col gap-5",
        // Cartes carrées et denses, comme le stock principal : les deux modules
        // rendent désormais la même `BaleCard`, et sa géométrie impose cette
        // grille. Une grille large y étirerait des carrés.
        grid: "grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8",
        emptyState: "rounded-xl border-2 border-dashed border-border bg-muted/20",
        tableWrapper: "hidden overflow-hidden rounded-xl border border-border md:block",
        cardList: "flex flex-col gap-3 md:hidden",
        loadMore:
            "flex items-center px-6 py-2.5 text-sm font-medium transition-colors bg-card border rounded-full shadow-sm text-foreground border-border hover:bg-muted",
    },

    // === SECTIONS (en-têtes de boards/pages) ===
    // Valeurs alignées sur `stock`. Les onglets posent encore leurs titres en
    // dur (`text-base font-semibold`) : c'est la primitive `BoardHeader` qui
    // les y branchera, et c'est à ce moment que l'échelle convergera.
    section: {
        title: "text-xl font-bold text-foreground",
        description: "text-sm text-muted-foreground",
        groupTitle: "text-sm font-semibold text-muted-foreground uppercase tracking-wider",
    },

    card: {
        base: "relative group overflow-hidden border bg-card transition-[box-shadow,border-color] duration-slow hover:shadow-lg",
        // Identité d'une balle : elle n'a pas de code lisible, on affiche son
        // UUID tronqué en chiffres tabulaires pour que la colonne s'aligne.
        identity: "font-mono text-xs tabular-nums text-muted-foreground",
        title: "font-medium text-foreground",
        meta: "text-sm text-muted-foreground",
        footerBorder: "border-t border-border/60",
        // Surfaces communes à tous les statuts, passées à `BaleCard`. La
        // déclinaison par statut, elle, reste dans `BALLE_STATUS_CONFIG`.
        surface: "bg-card",
        text: "text-foreground",
        mutedText: "text-muted-foreground",
        // Chiffre et unité d'une quantité, sur la fiche de détail.
        value: "tabular-nums text-lg font-semibold text-foreground",
        unit: "text-xs text-muted-foreground",
        // Valeur absente — était écrite en dur dans la carte ET le tableau.
        emptyValue: "italic text-muted-foreground",
    },

    // === PARAMÈTRES ===
    settings: {
        content: "rounded-xl border border-border bg-card",
        editRow: "flex flex-col gap-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-end dark:bg-primary/10",
        fieldLabel: "ml-0.5 text-xs font-medium text-muted-foreground",
        // Puces des catégories rattachées à un fournisseur.
        chip: "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground",
        chipEmpty: "text-xs italic text-muted-foreground",
        section: {
            // Aligné sur `stock` : les deux alimentent le même `sectionTheme`
            // de `ReferentialPanel`, deux échelles y étaient injustifiables.
            title: "text-lg font-semibold text-foreground",
            description: "text-sm text-muted-foreground",
            // Surface d'une ligne libellé / valeur, sur la fiche de détail
            // comme dans les panneaux de paramètres. Aligné sur `stock`.
            row: "flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50",
        },
    },

    // === FLUX (hors socle — propre à ce module) ===
    flux: {
        in:  "bg-success-light text-success border-success/20",
        out: "bg-warning-light text-warning border-warning/20",
        amount: "tabular-nums font-medium text-foreground",
    },

    // === HISTORIQUE ===
    activity: {
        row: "flex gap-3 rounded-lg border border-border bg-card p-3",
        timestamp: "text-xs tabular-nums text-muted-foreground",
        diffKey: "font-mono text-xs text-muted-foreground",
        // Diverge de `stock`, qui n'a que les aplats sans bordure.
        actionColors: {
            create: "bg-success-light text-success border-success/20",
            update: "bg-chart-2/10 text-chart-2 border-chart-2/20",
            delete: "bg-destructive-light text-destructive border-destructive/20",
        } as Record<string, string>,
        // Une couleur par type d'entité du module. Les deux stocks partagent la
        // teinte des concepts qu'ils ont en commun (balle, catégorie,
        // fournisseur) : passer d'un module à l'autre ne doit pas redéfinir le
        // code couleur dans la tête de l'utilisateur.
        entityColors: {
            balle: "text-chart-4",
            category: "text-chart-5",
            fournisseur: "text-chart-6",
            fournisseur_category: "text-chart-6",
            // Teinte de l'arrivage du stock principal, même concept.
            flux: "text-chart-7",
            mouvement: "text-chart-2",
            zone: "text-chart-1",
            emplacement: "text-chart-3",
        } as Record<string, string>,
    },

    // === GRAPHIQUES (dashboard) ===
    // hsl(var(--chart-N)) et non une couleur figée : les graphes suivent le
    // thème clair/sombre.
    chart: {
        palette: [
            "hsl(var(--chart-1))",
            "hsl(var(--chart-2))",
            "hsl(var(--chart-3))",
            "hsl(var(--chart-4))",
            "hsl(var(--chart-5))",
        ],
        grid: "hsl(var(--border))",
        axis: "hsl(var(--muted-foreground))",
    },
} satisfies ModuleTheme
