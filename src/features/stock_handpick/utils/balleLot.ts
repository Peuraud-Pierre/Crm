import type {
    BalleHandpickFormInput,
    PackingMode,
} from "@/features/stock_handpick/types/balle.types"

/**
 * Une ligne de la création en lot : ce qui varie d'une balle à l'autre d'un
 * même arrivage. Le reste (usine, date, statut, type, notes) est commun.
 */
export interface BalleLotLine {
    /** Clé React stable : l'index changerait à chaque suppression de ligne. */
    key: string
    raw_name: string | null
    category_id: string | null
    packing: number | null
    packing_mode: PackingMode
    emplacement_id: string | null
}

let lineSeq = 0
const nextKey = () => `line-${++lineSeq}`

export function emptyLine(): BalleLotLine {
    return {
        key: nextKey(),
        raw_name: null,
        category_id: null,
        packing: null,
        packing_mode: "kilos",
        emplacement_id: null,
    }
}

export function duplicateLine(line: BalleLotLine): BalleLotLine {
    return { ...line, key: nextKey() }
}

/**
 * Une charge utile par ligne. Même invariant que `setEmplacement` côté
 * service : une balle adressée est en entrepôt ; sans emplacement, pas de
 * situation (la « zone logique » n'est plus saisie).
 */
export function buildLotPayloads(
    common: BalleHandpickFormInput,
    lines: readonly BalleLotLine[],
): BalleHandpickFormInput[] {
    return lines.map(({ raw_name, category_id, packing, packing_mode, emplacement_id }) => ({
        ...common,
        raw_name,
        category_id,
        packing,
        packing_mode,
        emplacement_id,
        location: emplacement_id ? "warehouse" : null,
    }))
}
