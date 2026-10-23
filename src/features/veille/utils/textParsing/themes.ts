export type ColorTheme = "red" | "green" | "blue" | "muted"

export interface ThemeConfig {
    num: string
    bold: string
}

/**
 * Les paires clair/sombre écrites à la main sont remplacées par des tokens :
 * ceux-ci basculent seuls avec le thème, donc `dark:` devient inutile.
 * `bold` reprend le même token que `num` — la hiérarchie est portée par la
 * graisse du texte, pas par une seconde nuance de la même couleur.
 */
export const COLOR_THEMES: Record<ColorTheme, ThemeConfig> = {
    red: {
        num: "text-destructive",
        bold: "text-destructive",
    },
    green: {
        num: "text-success",
        bold: "text-success",
    },
    blue: {
        num: "text-chart-2",
        bold: "text-chart-2",
    },
    muted: {
        num: "text-muted-foreground",
        bold: "text-foreground",
    },
}
