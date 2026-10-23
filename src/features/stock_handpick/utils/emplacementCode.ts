import { HANDPICK_ROUTE_BASE } from "@/features/stock_handpick/types/ui.types"

/**
 * Étiquettes QR des emplacements.
 *
 * Le QR porte l'URL de l'emplacement dans l'app
 * (`<origin>/stock-handpick/codes/<id>`) : l'appareil photo natif du
 * téléphone l'ouvre directement, et le lecteur intégré en extrait l'id.
 * L'id, et non le chemin, parce qu'il survit à un renommage.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
const CODE_PATH = `${HANDPICK_ROUTE_BASE}/codes/`
// Origin libre : un code imprimé depuis la préprod reste lisible en prod.
const URL_RE = new RegExp(`${CODE_PATH}(${UUID})/?(?:[?#].*)?$`, "i")
const BARE_RE = new RegExp(`^${UUID}$`, "i")

export function emplacementCodeUrl(origin: string, id: string): string {
    return `${origin.replace(/\/+$/, "")}${CODE_PATH}${id}`
}

/** Id d'emplacement lu dans un QR (URL de code) ou tapé (uuid nu), sinon `null`. */
export function parseEmplacementCode(text: string): string | null {
    const value = text.trim()
    if (BARE_RE.test(value)) return value.toLowerCase()
    const match = URL_RE.exec(value)
    return match ? match[1].toLowerCase() : null
}

/**
 * `detail` de l'onglet Plan : un id seul désigne une balle (« Voir dans le
 * plan 3D » de sa fiche), `emp-<id>` un emplacement.
 */
export const PLAN_EMPLACEMENT_PREFIX = "emp-"

export const planDetailOfEmplacement = (id: string) => `${PLAN_EMPLACEMENT_PREFIX}${id}`

export function emplacementOfPlanDetail(detail: string | undefined): string | null {
    if (!detail?.startsWith(PLAN_EMPLACEMENT_PREFIX)) return null
    return detail.slice(PLAN_EMPLACEMENT_PREFIX.length) || null
}

const tokens = (text: string) => text.toUpperCase().split(/[^0-9A-Z]+/).filter(Boolean)

/**
 * Saisie manuelle d'un chemin (`B R2 E3 H1`, `b/r2/e3/h1`, `A · SOL`) :
 * l'emplacement dont les segments correspondent exactement, sinon `null`.
 */
export function findEmplacementByPath(
    text: string,
    paths: ReadonlyMap<string, readonly string[]>,
): string | null {
    const wanted = tokens(text).join("/")
    if (!wanted) return null
    for (const [id, segments] of paths) {
        if (segments.map((s) => s.toUpperCase()).join("/") === wanted) return id
    }
    return null
}
