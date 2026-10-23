import { z } from "zod"
import { GRID_COLS, LAYOUT_VERSION, SETTINGS_TEXT_MAX } from "../constants"

/**
 * Forme persistée d'une disposition de dashboard (colonne `layout` de
 * `user_dashboard_layout` et `dashboard_layout_templates`).
 *
 * Le JSON venant de la base n'est **jamais** supposé valide : il a pu
 * être écrit par une version antérieure du front, référencer un widget
 * qui n'existe plus, ou avoir été édité à la main. Il est donc analysé
 * par zod au chargement, et ce qui ne passe pas est ignoré — le
 * dashboard retombe sur le niveau suivant plutôt que de rendre une page
 * blanche.
 *
 * Format 2 : chaque module porte ses **coordonnées** sur la grille, et
 * non plus sa seule largeur dans un flux ordonné. C'est ce qui permet de
 * poser un module où on veut au lieu de le faire glisser dans une file.
 */

/**
 * Les réglages sont un sac de clés libres — chaque widget décrit les
 * siennes. On borne seulement ce qui pourrait faire enfler la ligne :
 * une chaîne y est plafonnée, sans quoi un bloc-notes transformerait
 * `user_dashboard_layout` en entrepôt de documents.
 */
const settingValueSchema = z.union([
    z.string().max(SETTINGS_TEXT_MAX),
    z.number(),
    z.boolean(),
    z.null(),
])

export const layoutItemSchema = z.object({
    /** Identifie cette carte ; un même widget peut être posé deux fois. */
    instanceId: z.string().min(1),
    /** Renvoie à `WidgetDef.id`. */
    widgetId: z.string().min(1),
    x: z.number().int().min(0).max(GRID_COLS - 1),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(GRID_COLS),
    h: z.number().int().min(1),
    /**
     * @deprecated Renommage d'instance, retiré de l'interface. Le champ
     * reste toléré au schéma pour que les dispositions déjà en base
     * passent la validation ; `sanitizeLayout` l'écarte à la lecture.
     */
    title: z.string().max(60).optional(),
    settings: z.record(z.string(), settingValueSchema).default({}),
})

/** Repli des deux zones imposées — elles ne quittent jamais la page. */
/**
 * L'état de repli des zones fixes.
 *
 * Une seule entrée : `changelog` a été retirée avec le dépliage de
 * l'ourlet, qui ouvre désormais un lecteur plein écran. Elle continuait
 * d'être écrite sans que personne ne la lise. Aucun bump de version
 * n'est nécessaire — `z.object` écarte les clés inconnues, donc les
 * dispositions déjà enregistrées se relisent telles quelles.
 */
export const bandsSchema = z.object({
    announcements: z.boolean().default(true),
})

export const dashboardLayoutSchema = z.object({
    version: z.number().int().positive(),
    items: z.array(layoutItemSchema),
    bands: bandsSchema.default({ announcements: true }),
    density: z.enum(["comfortable", "compact"]).default("comfortable"),
})

export type LayoutItem = z.infer<typeof layoutItemSchema>
export type DashboardLayout = z.infer<typeof dashboardLayoutSchema>
export type LayoutBands = z.infer<typeof bandsSchema>
export type LayoutDensity = DashboardLayout["density"]

/** Disposition vide, valide, utilisée comme repli. */
export function emptyLayout(): DashboardLayout {
    return {
        version: LAYOUT_VERSION,
        items: [],
        bands: { announcements: true },
        density: "comfortable",
    }
}

/**
 * Analyse une disposition **au format courant**.
 *
 * Retourne `null` — et non une erreur — si elle est inexploitable :
 * l'appelant enchaîne alors sur le niveau de repli suivant. Les formats
 * antérieurs passent par `readStoredLayout` (`../layout/migrateV1`), qui
 * les convertit avant d'arriver ici.
 */
export function parseLayout(value: unknown): DashboardLayout | null {
    const result = dashboardLayoutSchema.safeParse(value)
    if (!result.success) {
        console.warn("[dashboard] disposition illisible, ignorée", result.error)
        return null
    }
    return result.data
}

/** Origine de la disposition affichée — sert à l'UI (« Réinitialiser »). */
export type LayoutSource = "user" | "role" | "service" | "default"
