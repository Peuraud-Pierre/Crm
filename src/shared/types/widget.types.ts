import type { ComponentType, LazyExoticComponent } from "react"

/**
 * Contrat des modules (« widgets ») posables sur le canevas du dashboard.
 *
 * Il vit dans `shared/` et non dans `features/dashboard` pour une raison
 * précise : chaque feature déclare ses propres widgets et les expose par
 * son barrel, tandis que le dashboard les assemble. Si le type venait du
 * dashboard, les deux s'importeraient mutuellement.
 *
 * Aucune feature n'importe le dashboard, et le dashboard n'importe que
 * les barrels — la dépendance reste à sens unique.
 */

/**
 * Valeur d'un réglage. Volontairement scalaire : les réglages voyagent
 * dans la même ligne `jsonb` que la disposition, ils décrivent un choix,
 * pas un document.
 */
export type WidgetSettingValue = string | number | boolean | null

/** Ce que reçoit un widget à l'affichage. */
export interface WidgetProps {
    /** Réglages propres à cette instance (filtres, période, texte…). */
    settings: Record<string, WidgetSettingValue>
    /** Hauteur allouée, en unités de ligne de la grille. */
    height: number
    /**
     * Densité choisie par l'utilisateur pour toute sa page. Un widget qui
     * sait resserrer son rendu (moins de lignes, pas de description) s'en
     * sert ; les autres l'ignorent.
     */
    compact: boolean
    /**
     * Enregistre un réglage depuis le widget lui-même.
     *
     * La plupart des modules n'en ont pas besoin — leurs réglages sont
     * édités dans le panneau. C'est le bloc-notes qui le justifie : son
     * réglage EST son contenu, et il serait absurde de devoir ouvrir un
     * panneau pour écrire dedans.
     */
    onSettingsChange: (patch: Record<string, WidgetSettingValue>) => void
}

/**
 * Socle commun à tous les réglages.
 *
 * `description` n'est pas décorative : un libellé seul ne dit pas ce
 * qu'un réglage change, et un panneau qu'il faut essayer pour comprendre
 * est un panneau qu'on n'ouvre pas deux fois.
 */
interface WidgetSettingBase {
    key: string
    label: string
    /** Une phrase, sous le champ. */
    description?: string
    /**
     * Section du panneau. Les réglages sans groupe restent en tête ;
     * au-delà de trois champs, une liste plate devient un formulaire.
     */
    group?: string
}

/** Une option proposée par un réglage `select` ou `multiselect`. */
export interface WidgetSettingOption {
    value: string
    label: string
}

/**
 * Jeux d'options que le panneau de réglages sait construire lui-même.
 * `routes` = les pages auxquelles l'utilisateur a droit (`allowedRoutes`).
 */
export type WidgetSettingOptionsSource = "routes"

/** Un réglage exposé à l'utilisateur dans le panneau du widget. */
export type WidgetSetting =
    | (WidgetSettingBase & {
          type: "select"
          options: { value: string; label: string }[]
          defaultValue: string
      })
    | (WidgetSettingBase & {
          type: "boolean"
          defaultValue: boolean
      })
    | (WidgetSettingBase & {
          type: "number"
          min: number
          max: number
          defaultValue: number
      })
    | (WidgetSettingBase & {
          type: "text"
          /** Bornée : `user_dashboard_layout.layout` n'est pas un entrepôt. */
          maxLength: number
          multiline?: boolean
          placeholder?: string
          defaultValue: string
      })
    | (WidgetSettingBase & {
          type: "multiselect"
          /** Options fixes, connues à la déclaration du module. */
          options?: WidgetSettingOption[]
          /**
           * Source résolue au rendu, quand les options dépendent de
           * l'utilisateur et ne peuvent donc pas être écrites dans le
           * registre — c'est le cas des raccourcis, dont le choix est
           * exactement la liste des pages auxquelles ce compte a droit.
           * Le panneau de réglages résout la source ; `SettingField` ne
           * voit que des options déjà calculées et reste ignorant de
           * l'auth comme du routage.
           */
          optionsSource?: WidgetSettingOptionsSource
          /**
           * Liste de valeurs séparées par des virgules. La valeur reste
           * **scalaire** : c'est le contrat de `settingValueSchema`
           * (`features/dashboard/types/layout.types.ts`), et un seul cas
           * d'usage ne justifie pas d'y faire entrer des tableaux.
           *
           * Vide = « tout », et non « rien » : c'est l'état initial d'un
           * module qu'on vient de poser, qui doit montrer quelque chose.
           */
          defaultValue: string
      })

/**
 * Regroupement dans le catalogue.
 *
 * `activite` = ce qui m'attend aujourd'hui (mes tâches, mes tickets),
 * `metier` = l'état d'un domaine (stock, CRM, leads),
 * `outils` = ce qui ne montre aucune donnée métier (raccourcis, notes).
 */
export type WidgetCategory = "activite" | "metier" | "outils"

/**
 * Couleur d'identité d'un module.
 *
 * Les huit teintes de `--color-chart-*` sont la seule palette
 * **catégorielle** du design system : elles distinguent des choses de
 * même nature, sans hiérarchie ni sémantique d'état. C'est exactement ce
 * qu'un accent de module doit faire. Les jetons sémantiques
 * (`success`, `warning`, `destructive`) sont écartés : teinter un module
 * « tickets » en `warning` lui ferait annoncer une alerte qui n'existe
 * pas.
 */
export type WidgetAccent =
    | "chart-1"
    | "chart-2"
    | "chart-3"
    | "chart-4"
    | "chart-5"
    | "chart-6"
    | "chart-7"
    | "chart-8"

export interface WidgetDef {
    /** Identifiant stable, préfixé par la feature : `crm.taches`. */
    id: string
    title: string
    /** Une phrase, affichée dans le catalogue. */
    description?: string
    icon: ComponentType<{ className?: string }>
    category: WidgetCategory

    /**
     * Teinte du module sur le canevas. Absente = dérivée de la
     * catégorie. C'est la feature qui choisit : elle seule sait ce que
     * son module voisine sur une page réelle.
     */
    accent?: WidgetAccent

    /**
     * Code de permission requis. Absent = visible par tous.
     * Un widget dont la permission manque n'apparaît ni au catalogue ni
     * au rendu, même s'il figure dans une disposition enregistrée.
     */
    permission?: string

    /**
     * Clé de feature (`title` de `menuItems.ts`). Sert à afficher un état
     * dégradé quand la feature est en maintenance, plutôt que de laisser
     * le widget échouer.
     */
    featureKey?: string

    /**
     * « Voir tout » : la page de la feature d'où viennent les données.
     * Absent pour un module qui n'a pas de page (raccourcis, notes) ou
     * dont la feature n'expose pas de route (notifications).
     */
    href?: string

    /**
     * Nombre maximal d'instances sur une même page. Absent = illimité —
     * poser deux fois le même module avec des réglages différents est un
     * usage prévu, pas un accident.
     */
    maxInstances?: number

    /**
     * Rang du module dans la page par défaut — celle que voit quelqu'un
     * sans disposition personnelle et dont le rôle n'a pas de gabarit.
     * Absent = le module n'y figure pas, il faut aller le chercher au
     * catalogue. C'est la feature qui décide si son module mérite d'être
     * là d'emblée, pas le dashboard.
     */
    starter?: number

    /** Largeur souhaitée à la pose, en colonnes sur 12. */
    defaultW: number
    /**
     * Largeur minimale. **Absente = deux colonnes**, le plancher du
     * moteur. Les modules déclaraient 3 ou 4 : sur douze colonnes, cela
     * interdisait le tiers de la page à la moitié du catalogue, pour
     * protéger une lisibilité que le module sait mieux juger que le
     * registre — il a sa largeur allouée et peut resserrer son rendu.
     */
    minW?: number
    /** Largeur maximale. **Absente = toute la grille.** */
    maxW?: number

    /** Hauteur souhaitée à la pose, en unités de ligne. */
    defaultH: number
    /** Hauteur minimale. **Absente = deux lignes**, le plancher du moteur. */
    minH?: number
    /**
     * Plafond de hauteur. **Absent = pas de plafond** — c'est le cas de
     * tous les modules actuels. `minH` suffit à garantir que le contenu
     * reste lisible ; brider le haut ne protégeait rien et interdisait à
     * l'utilisateur d'accorder à un module la place qu'il lui donne.
     * Le contrat reste disponible pour un module qui aurait une vraie
     * raison de se plafonner.
     */
    maxH?: number

    /** Réglages proposés dans le panneau du widget. */
    settings?: WidgetSetting[]

    /**
     * `React.lazy` obligatoire : le code d'une feature n'est téléchargé
     * que si son widget est réellement posé sur le dashboard.
     */
    Component: LazyExoticComponent<ComponentType<WidgetProps>>
}

/**
 * Bornes de taille d'un widget, telles que le moteur de grille les lit.
 * Toutes optionnelles : le moteur applique ses propres planchers et
 * plafonds quand le module ne dit rien, ce qui est le cas courant.
 */
export interface SizeBounds {
    minW?: number
    maxW?: number
    minH?: number
    maxH?: number
}

export function sizeBounds(widget: WidgetDef): SizeBounds {
    return {
        minW: widget.minW,
        maxW: widget.maxW,
        minH: widget.minH,
        maxH: widget.maxH,
    }
}
