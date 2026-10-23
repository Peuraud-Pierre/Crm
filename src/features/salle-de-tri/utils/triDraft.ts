import { TRI_ECART_SEUIL_KG } from "@/features/salle-de-tri/constants"
import type {
    FicheTriBalleInput,
    FicheTriComplete,
    Qualite,
    TriRepartition,
} from "@/features/salle-de-tri/types/tri.types"
import { parsePoids } from "@/shared/utils/poids"

export { parsePoids }

/**
 * Brouillon de saisie d'une fiche de tri — fonctions pures, testées.
 *
 * Une ligne de la feuille = une BALLE : fournisseur, catégorie, poids
 * initial, qualité, note, et sa répartition en kilos par type de sortie.
 *
 * Les poids restent en TEXTE pendant la saisie : « 12, » est une étape
 * normale de frappe, pas une erreur à corriger sous les doigts de
 * l'utilisateur. Ils ne sont convertis qu'à l'enregistrement.
 *
 * L'écart entre poids initial et total réparti n'est JAMAIS un problème
 * bloquant : il est montré pendant la saisie et signalé sur la fiche.
 */

export interface BalleDraft {
    /** Clé React stable, sans rapport avec l'id en base. */
    key: string
    fournisseur_id: string
    category_id: string
    poids: string
    qualite: Qualite | null
    note: string
    /** Kilos saisis par id de type de sortie ; absent ou vide = 0. */
    repartition: Record<string, string>
}

let seq = 0
const nextKey = () => `balle-${++seq}`

/**
 * Nouvelle balle. Reprend le fournisseur et la catégorie de la précédente :
 * un trieur ouvre souvent plusieurs balles d'un même arrivage à la suite.
 */
export function newBalle(previous?: BalleDraft): BalleDraft {
    return {
        key: nextKey(),
        fournisseur_id: previous?.fournisseur_id ?? "",
        category_id: previous?.category_id ?? "",
        poids: "",
        qualite: null,
        note: "",
        repartition: {},
    }
}

const hasRepartition = (b: BalleDraft) => Object.values(b.repartition).some((v) => v.trim() !== "")

/** Une balle entièrement vide est ignorée à l'enregistrement, pas refusée. */
export const isBlank = (b: BalleDraft) =>
    !b.fournisseur_id && !b.category_id && !b.poids.trim() && b.qualite === null && !b.note.trim() && !hasRepartition(b)

/** Kilos lisibles de la répartition (les montants illisibles comptent 0). */
export const repartiDraft = (b: BalleDraft) =>
    Object.values(b.repartition).reduce((s, v) => s + (parsePoids(v) ?? 0), 0)

/** Réparti − initial, arrondi au centième ; `null` tant que le poids initial est illisible. */
export function ecartDraft(b: BalleDraft): number | null {
    const initial = parsePoids(b.poids)
    if (initial === null) return null
    return Math.round((repartiDraft(b) - initial) * 100) / 100
}

export const isEcart = (ecart: number | null): boolean =>
    ecart !== null && Math.abs(ecart) >= TRI_ECART_SEUIL_KG

/** Ce qui empêche d'enregistrer une balle commencée, ou `null` si elle est enregistrable. */
export function balleProbleme(b: BalleDraft): string | null {
    if (isBlank(b)) return null
    if (!b.fournisseur_id) return "fournisseur manquant"
    if (!b.category_id) return "catégorie manquante"
    if (parsePoids(b.poids) === null) return "poids initial invalide"
    if (b.qualite === null) return "qualité manquante"
    const illisible = Object.values(b.repartition).some((v) => v.trim() !== "" && parsePoids(v) === null)
    if (illisible) return "répartition : un montant est illisible"
    return null
}

export interface DraftTotals {
    balles: number
    initial: number
    reparti: number
    /** Balles dont le poids initial est lisible et qui présentent un écart. */
    ecarts: number
}

/** Totaux en direct, pour le pied de la saisie. */
export function totauxDraft(balles: readonly BalleDraft[]): DraftTotals {
    const pleines = balles.filter((b) => !isBlank(b))
    return {
        balles: pleines.length,
        initial: pleines.reduce((s, b) => s + (parsePoids(b.poids) ?? 0), 0),
        reparti: pleines.reduce((s, b) => s + repartiDraft(b), 0),
        ecarts: pleines.filter((b) => isEcart(ecartDraft(b))).length,
    }
}

/**
 * Balles prêtes pour la RPC, ou la liste des problèmes. Les balles vides
 * sont écartées ; il en faut au moins une pleine. Les parts à zéro ou vides
 * ne partent pas.
 */
export function toBallesInput(
    balles: readonly BalleDraft[],
): { ok: true; balles: FicheTriBalleInput[] } | { ok: false; problemes: string[] } {
    const problemes: string[] = []
    const out: FicheTriBalleInput[] = []
    balles.forEach((b, i) => {
        if (isBlank(b)) return
        const probleme = balleProbleme(b)
        if (probleme) {
            problemes.push(`Balle ${i + 1} : ${probleme}`)
            return
        }
        const repartition: TriRepartition[] = []
        for (const [sortie_id, raw] of Object.entries(b.repartition)) {
            const kg = parsePoids(raw)
            if (kg !== null) repartition.push({ sortie_id, poids_kg: kg })
        }
        out.push({
            fournisseur_id: b.fournisseur_id,
            category_id: b.category_id,
            poids_initial_kg: parsePoids(b.poids) as number,
            qualite: b.qualite as Qualite,
            note: b.note.trim() || null,
            repartition,
        })
    })
    if (problemes.length === 0 && out.length === 0) problemes.push("Saisissez au moins une balle.")
    return problemes.length ? { ok: false, problemes } : { ok: true, balles: out }
}

const kgText = (kg: number) => String(kg).replace(".", ",")

/** Brouillon pré-rempli depuis une fiche existante (modification). */
export function draftFromFiche(fiche: FicheTriComplete): BalleDraft[] {
    return fiche.balles.map((b) => ({
        key: nextKey(),
        fournisseur_id: b.fournisseur_id,
        category_id: b.category_id,
        poids: kgText(b.poids_initial_kg),
        qualite: b.qualite,
        note: b.note ?? "",
        repartition: Object.fromEntries(b.repartition.map((r) => [r.sortie_id, kgText(r.poids_kg)])),
    }))
}

// ── Horaires ─────────────────────────────────────────────────────────────────

/** `HH:MM[:SS]` → minutes depuis minuit ; `null` si vide ou illisible. */
export function minutesDuJour(hhmm: string | null | undefined): number | null {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "")
    if (!m) return null
    const h = Number(m[1])
    const min = Number(m[2])
    return h < 24 && min < 60 ? h * 60 + min : null
}

export type HorairesCheck =
    | { ok: true; minutes: number | null }
    | { ok: false; probleme: string }

/**
 * Horaires facultatifs mais entiers, la fin après le début — la même règle
 * que la contrainte `fiches_tri_horaires_check`. `minutes` : la durée, ou
 * `null` sans horaires.
 */
export function checkHoraires(debut: string, fin: string): HorairesCheck {
    const d = minutesDuJour(debut)
    const f = minutesDuJour(fin)
    if (d === null && f === null) return { ok: true, minutes: null }
    if (d === null) return { ok: false, probleme: "Heure de début manquante" }
    if (f === null) return { ok: false, probleme: "Heure de fin manquante" }
    if (f <= d) return { ok: false, probleme: "La fin doit suivre le début" }
    return { ok: true, minutes: f - d }
}

/** `HH:MM:SS` de la base → `HH:MM` d'un `<input type="time">`. */
export const toTimeInput = (value: string | null | undefined) => (value ? value.slice(0, 5) : "")
