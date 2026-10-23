/**
 * Contrat de thème des modules à onglets (les stocks, aujourd'hui).
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * `features/stock` et `features/stock_handpick` exposaient chacun un objet de
 * tokens à l'arbre de clés différent (`settings.layout.content` d'un côté,
 * `settings.content` de l'autre ; `board.emptyState` objet contre string).
 * Rien n'empêchait un troisième module d'inventer un quatrième arbre — et
 * c'est ainsi qu'on se retrouve avec quatre interfaces pour un même métier.
 *
 * Ce type ne produit aucun runtime : il est consommé via `satisfies`.
 *
 *     export const MON_THEME = { … } satisfies ModuleTheme
 *
 * **Une clé du socle manquante ou renommée casse le build**, et l'erreur
 * pointe le fichier de thème en nommant la clé absente. C'est tout l'intérêt
 * du dispositif : la divergence devient impossible à écrire, pas seulement
 * déconseillée.
 *
 * Pourquoi `Extensible`
 * ---------------------
 * `satisfies` contrôle les propriétés excédentaires : tel quel, il rejetterait
 * `kanban` (propre à `stock`), `flux` (propre au handpick) ou les déclinaisons
 * `card.<statut>`. Or ces clés sont légitimes — un module a le droit d'avoir
 * des tokens que les autres n'ont pas. Chaque groupe est donc ouvert par une
 * signature d'index.
 *
 * Deux autres pistes ont été écartées. Une simple annotation `: ModuleTheme`
 * effacerait les clés hors socle du type public, et les composants qui les
 * lisent ne compileraient plus. Un helper générique `<T extends ModuleTheme>`
 * accepte bien l'extension, mais quand le socle n'est PAS satisfait, TypeScript
 * retombe sur la contrainte : l'erreur se déplace alors chez les consommateurs
 * (« `flux` n'existe pas sur ModuleTheme ») au lieu de nommer la clé manquante
 * — vérifié, et proprement indéchiffrable pour qui écrit un nouveau module.
 *
 * Ce que le contrat vérifie, et ce qu'il ne vérifie pas
 * ----------------------------------------------------
 * Il impose la PRÉSENCE des clés, pas l'égalité des valeurs : deux modules
 * peuvent légitimement diverger sur une grille de cartes (le stock principal
 * affiche des cartes denses jusqu'à 8 colonnes, le handpick des cartes larges
 * sur 4).
 *
 * Toutes les valeurs sont des chaînes de classes Tailwind, tokens `@theme`
 * uniquement — pas de valeur arbitraire (`shadow-[…]`), voir CLAUDE.md.
 * Exception assumée : `chart`, dont les valeurs sont des couleurs CSS
 * `hsl(var(--chart-N))` destinées à recharts, qui n'accepte pas de classes.
 */
/**
 * Ouvre un groupe de tokens aux clés propres à un module, sans relâcher la
 * vérification de celles du socle : les membres déclarés restent obligatoires
 * et typés, la signature d'index n'accueille que le surplus.
 */
type Extensible<T> = T & { [key: string]: unknown }

export interface ModuleTheme {
    /**
     * Groupes hors socle propres à un module (`kanban`, `flux`, `button`…).
     * Même rôle qu'`Extensible`, au niveau racine.
     */
    [key: string]: unknown

    /** Fondations de page. */
    page: Extensible<{
        background: string
        text: string
        /** Sur-titre discret, en capitales. */
        title: string
    }>

    input: Extensible<{
        base: string
        text: string
    }>

    /** Navigation principale — `<TabsList indicator>`, cf. DESIGN_SYSTEM.md §13.8. */
    tabs: Extensible<{
        list: string
        trigger: string
    }>

    /**
     * Barre de filtres : ligne compacte (recherche + bascules) surmontant un
     * panneau repliable. `tabActive`/`tabInactive` habillent les bascules de
     * vue qui ne sont pas des `TabsTrigger` Radix (segmented controls maison).
     */
    filterBar: Extensible<{
        container: string
        /** Doit porter `relative` : sert d'offsetParent à la pastille active. */
        tabToggle: string
        tabActive: string
        tabInactive: string
        search: string
        panel: string
        panelLabel: string
    }>

    /** Surfaces de contenu d'un onglet. */
    board: Extensible<{
        container: string
        /** Grille de cartes — densité laissée libre à chaque module. */
        grid: string
        /** Classes passées au `className` de `<EmptyState>`. */
        emptyState: string
        /** Table visible à partir de `md`. */
        tableWrapper: string
        /** Liste de cartes de repli sous `md`. */
        cardList: string
        /** Bouton pilule « Charger plus » des grilles de cartes. */
        loadMore: string
    }>

    /** En-têtes de board et de page. */
    section: Extensible<{
        title: string
        description: string
        groupTitle: string
    }>

    card: Extensible<{
        base: string
        /** Identifiant technique affiché en chiffres tabulaires. */
        identity: string
        title: string
        meta: string
        footerBorder: string
    }>

    settings: Extensible<{
        /** Conteneur du contenu, sous la sous-navigation. */
        content: string
        /** Ligne d'édition inline d'un référentiel. */
        editRow: string
        /** Libellé de champ dans une ligne d'édition. */
        fieldLabel: string
        /** Puce d'une valeur rattachée (catégorie d'un fournisseur…). */
        chip: string
        chipEmpty: string
        /** Passé tel quel au `sectionTheme` de `ReferentialPanel`. */
        section: Extensible<{
            title: string
            description: string
        }>
    }>

    /** Journal d'activité. */
    activity: Extensible<{
        row: string
        timestamp: string
        /** Nom de colonne dans un diff. */
        diffKey: string
        /** Indexé par action (`create` / `update` / `delete`). */
        actionColors: Record<string, string>
        /**
         * Indexé par type d'entité du module. Au socle parce que la ligne de
         * journal partagée en a besoin : un module qui l'oublierait rendrait des
         * icônes d'entité sans couleur, sans erreur ni test rouge.
         */
        entityColors: Record<string, string>
    }>

    /**
     * Couleurs CSS pour recharts — `hsl(var(--chart-N))` et non des hex figés,
     * pour que les graphes suivent le thème clair/sombre sans re-render.
     */
    chart: Extensible<{
        palette: readonly string[]
        grid: string
        axis: string
    }>
}
