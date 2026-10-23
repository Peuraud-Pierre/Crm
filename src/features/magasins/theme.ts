import type { EquipementKind, PlanItem } from "./types/magasin.types"

/**
 * Tokens de présentation du module Magasins. Les onglets reprennent les
 * valeurs du stock handpick (même composant `ModuleTabs`, même pastille
 * glissante) pour que les deux modules se ressemblent.
 */
export const MAGASIN_THEME = {
    tabs: {
        list: "flex w-full h-auto p-1.5 bg-card rounded-xl border border-border",
        trigger:
            "flex-1 flex flex-col items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-3 h-auto rounded-lg text-muted-foreground hover:text-foreground transition-colors duration-base ease-emphasized border-none",
    },
    section: {
        title: "text-xl font-bold text-foreground",
        description: "text-sm text-muted-foreground",
        groupTitle: "text-sm font-semibold text-muted-foreground uppercase tracking-wider",
    },
    board: {
        container: "flex flex-col gap-5",
        emptyState: "rounded-xl border-2 border-dashed border-border bg-muted/20",
    },
    viewToggle: "relative flex p-1 bg-muted/50 rounded-lg border border-border/50",
} as const

/**
 * Couleur fixe des équipements, par rôle : une entrée se lit en vert, une
 * sortie en rouge, d'un coup d'œil, quel que soit le magasin.
 */
export const EQUIPEMENT_COLOR_VAR: Record<EquipementKind, string> = {
    caisse: "--warning",
    entree: "--success",
    sortie: "--destructive",
    entree_sortie: "--primary",
    // Neutre : un escalier n'est ni une issue ni un poste de vente.
    escalier: "--muted-foreground",
    escalier_colimacon: "--muted-foreground",
    // Présentation, ni issue ni vente.
    mannequin: "--secondary-foreground",
}

/** Escalier qui descend : plus sombre que celui qui monte, pour ne pas les confondre. */
export const STAIRS_DOWN_COLOR_VAR = "--foreground"

export const isEquipementKind = (kind: PlanItem["kind"]): kind is EquipementKind => kind in EQUIPEMENT_COLOR_VAR

/** Couleur CSS d'un élément du plan, zone, emplacement ou équipement. */
export function itemCssColor(item: Pick<PlanItem, "kind" | "color" | "colorIndex"> & { descend?: boolean }): string {
    if (item.descend) return `hsl(var(${STAIRS_DOWN_COLOR_VAR}))`
    if (isEquipementKind(item.kind)) return `hsl(var(${EQUIPEMENT_COLOR_VAR[item.kind]}))`
    return planItemColor(item.color, item.colorIndex)
}

/** Nombre de couleurs de graphique du design system (`--chart-1` … `--chart-5`). */
export const CHART_COLOR_COUNT = 5

/**
 * Couleur d'un élément du plan : celle de sa zone si elle est choisie, sinon
 * une couleur de graphique du thème, selon le rang de la zone racine — deux
 * zones voisines ne se confondent pas, et le thème sombre est suivi.
 */
export function planItemColor(color: string | null, colorIndex: number): string {
    return color ?? `hsl(var(--chart-${(colorIndex % CHART_COLOR_COUNT) + 1}))`
}

/**
 * Couleur automatique d'une zone racine en `#rrggbb`, pour initialiser le
 * sélecteur de couleur (qui n'accepte que ce format). Lue sur le thème actif.
 */
export function chartColorHex(colorIndex: number): string {
    const variable = `--chart-${(colorIndex % CHART_COLOR_COUNT) + 1}`
    const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
    const [h, s, l] = raw.split(/\s+/).map((part) => parseFloat(part))
    // Thème illisible (environnement de test) : gris moyen.
    if (![h, s, l].every(Number.isFinite)) return "#" + "80".repeat(3)
    const sat = s / 100
    const light = l / 100
    const a = sat * Math.min(light, 1 - light)
    const channel = (n: number) => {
        const k = (n + h / 30) % 12
        const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
        return Math.round(value * 255).toString(16).padStart(2, "0")
    }
    return "#" + channel(0) + channel(8) + channel(4)
}
