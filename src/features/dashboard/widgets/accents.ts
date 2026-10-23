import type {
    WidgetAccent,
    WidgetCategory,
    WidgetDef,
} from "@/shared/types/widget.types"

/**
 * Traduction d'un accent en classes.
 *
 * Les chaînes sont écrites en entier et jamais composées : Tailwind lit
 * le source pour savoir quelles classes générer, et une classe assemblée
 * à l'exécution (`` `bg-${accent}/10` ``) n'existerait tout simplement
 * pas dans la feuille de style.
 *
 * `pill` reprend l'idiome de `StatTile` — la pastille teintée est déjà le
 * vocabulaire du projet pour « voici de quoi il s'agit ». `rule` est le
 * filet en tête de carte : c'est là que passe toute la couleur du
 * canevas, et c'est la seule chose qu'on s'autorise à y mettre.
 */
interface AccentClasses {
    /** Pastille d'icône : fond, texte, anneau. */
    pill: string
    /** Filet d'identité en tête de carte. */
    rule: string
}

const ACCENTS: Record<WidgetAccent, AccentClasses> = {
    "chart-1": {
        pill: "bg-chart-1/10 text-chart-1 ring-chart-1/20",
        rule: "bg-chart-1/60",
    },
    "chart-2": {
        pill: "bg-chart-2/10 text-chart-2 ring-chart-2/20",
        rule: "bg-chart-2/60",
    },
    "chart-3": {
        pill: "bg-chart-3/10 text-chart-3 ring-chart-3/20",
        rule: "bg-chart-3/60",
    },
    "chart-4": {
        pill: "bg-chart-4/10 text-chart-4 ring-chart-4/20",
        rule: "bg-chart-4/60",
    },
    "chart-5": {
        pill: "bg-chart-5/10 text-chart-5 ring-chart-5/20",
        rule: "bg-chart-5/60",
    },
    "chart-6": {
        pill: "bg-chart-6/10 text-chart-6 ring-chart-6/20",
        rule: "bg-chart-6/60",
    },
    "chart-7": {
        pill: "bg-chart-7/10 text-chart-7 ring-chart-7/20",
        rule: "bg-chart-7/60",
    },
    "chart-8": {
        pill: "bg-chart-8/10 text-chart-8 ring-chart-8/20",
        rule: "bg-chart-8/60",
    },
}

/**
 * Repli quand un module ne déclare pas sa teinte : la catégorie sert de
 * réponse par défaut. Elle est grossière — trois teintes pour neuf
 * modules — mais elle est *vraie* : deux modules de la même catégorie se
 * ressemblent effectivement. Un module qui veut se distinguer déclare
 * son accent.
 */
const BY_CATEGORY: Record<WidgetCategory, WidgetAccent> = {
    activite: "chart-3",
    metier: "chart-1",
    outils: "chart-8",
}

export function widgetAccent(widget: WidgetDef): AccentClasses {
    return ACCENTS[widget.accent ?? BY_CATEGORY[widget.category]]
}
