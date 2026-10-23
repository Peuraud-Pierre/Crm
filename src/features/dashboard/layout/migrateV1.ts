import { z } from "zod"
import { GRID_COLS, LAYOUT_VERSION } from "../constants"
import {
    parseLayout,
    type DashboardLayout,
    type LayoutItem,
} from "../types/layout.types"
import { firstFreeSpot } from "./gridEngine"

/**
 * Conversion des dispositions écrites par la version précédente du front.
 *
 * Le format 1 décrivait un **flux** : une largeur (`span`), une hauteur
 * (`rows`) et un ordre de tableau, que le navigateur remplissait avec
 * `grid-auto-flow: dense`. Le format 2 décrit des **coordonnées**. Pour
 * passer de l'un à l'autre sans déranger l'utilisateur, on rejoue ce
 * remplissage : chaque module va au premier emplacement libre, ce qui
 * reproduit exactement ce qu'il voyait.
 *
 * Rien n'est réécrit en base au chargement : la conversion a lieu à
 * chaque lecture tant que l'utilisateur n'a pas touché à sa page, et la
 * première modification enregistre du format 2. Une disposition jamais
 * modifiée n'est donc jamais migrée — et ne peut pas être corrompue par
 * une migration.
 */

/** Les modules imposés du format 1 sont devenus des zones fixes. */
const DROPPED_WIDGET_IDS = new Set([
    "announcements.carousel",
    "changelog.timeline",
])

/**
 * Le pas de ligne est passé de 120 à 60 px : une hauteur de 2 unités
 * d'hier en vaut 4 aujourd'hui, et la carte garde sa taille à l'écran.
 */
const ROW_UNIT_RATIO = 2

const v1ItemSchema = z.object({
    instanceId: z.string().min(1),
    widgetId: z.string().min(1),
    span: z.number().int().positive(),
    rows: z.number().int().positive(),
    settings: z.record(z.string(), z.unknown()).default({}),
})

const v1LayoutSchema = z.object({
    version: z.literal(1),
    items: z.array(v1ItemSchema),
})

export function migrateV1(value: unknown): DashboardLayout | null {
    const parsed = v1LayoutSchema.safeParse(value)
    if (!parsed.success) return null

    const items: LayoutItem[] = []

    for (const old of parsed.data.items) {
        if (DROPPED_WIDGET_IDS.has(old.widgetId)) continue

        const w = Math.min(old.span, GRID_COLS)
        const h = old.rows * ROW_UNIT_RATIO
        const { x, y } = firstFreeSpot(items, w, h)

        items.push({
            instanceId: old.instanceId,
            widgetId: old.widgetId,
            x,
            y,
            w,
            h,
            // Les réglages du format 1 n'étaient jamais éditables : ils
            // valaient `{}` partout. On les reprend tels quels plutôt que
            // de les jeter, au cas où un gabarit en aurait porté.
            settings: old.settings as LayoutItem["settings"],
        })
    }

    return {
        version: LAYOUT_VERSION,
        items,
        bands: { announcements: true },
        density: "comfortable",
    }
}

/**
 * Lit une disposition venant de la base, quel que soit son format.
 *
 * Retourne `null` si elle est inexploitable — y compris quand sa version
 * est **supérieure** à celle que ce front connaît : elle a alors été
 * écrite par un déploiement plus récent, et l'interpréter avec les règles
 * d'aujourd'hui produirait un écran faux. Mieux vaut retomber sur le
 * gabarit du rôle.
 */
export function readStoredLayout(value: unknown): DashboardLayout | null {
    if (value === null || typeof value !== "object") return null

    const version = (value as { version?: unknown }).version
    if (typeof version !== "number") return null

    if (version === 1) return migrateV1(value)
    if (version === LAYOUT_VERSION) return parseLayout(value)

    console.warn(
        `[dashboard] disposition en version ${version}, inconnue de ce front — ignorée`
    )
    return null
}
