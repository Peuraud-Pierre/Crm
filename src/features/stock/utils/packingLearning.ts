import type { PackingGroup, PackingModelStats } from "@/features/stock/types/packing-list.types"

/**
 * Ce que le classement a appris, dit en une phrase.
 *
 * Deux surfaces posent la même question et doivent donner la même réponse :
 * Paramètres → Correspondances, qui décrit l'état du modèle, et la vérification
 * d'une packing list, où l'on fournit l'effort qui le fait progresser. Deux
 * rédactions parallèles des mêmes nombres finissent toujours par diverger — ce
 * dépôt en a déjà payé le prix ailleurs, d'où cette fonction pure.
 *
 * La règle de rédaction est la même partout : un fait vérifiable par
 * l'utilisateur, jamais un encouragement.
 */

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`)

export interface PackingLearningLine {
    /** Le modèle classe-t-il seul aujourd'hui ? Pilote la teinte, pas le texte. */
    active: boolean
    text: string
}

export function learningStatusLine(stats: PackingModelStats): PackingLearningLine {
    if (stats.threshold === null) {
        return {
            active: false,
            text:
                `Le classement automatique n'est pas encore actif : le modèle doit d'abord être juste ` +
                `${percent(stats.target_precision)} du temps sur ${stats.min_evidence} propositions ` +
                `vérifiées (${stats.evidence} à ce jour). Chaque libellé classé ici l'en rapproche.`,
        }
    }
    return {
        active: true,
        text:
            `Classement automatique actif au-dessus de ${percent(stats.threshold)} de confiance — ses ` +
            `propositions ont été justes ${percent(stats.precision_at_threshold)} du temps sur ` +
            `${stats.support_at_threshold} cas vérifiés.`,
    }
}

/**
 * Ce que la validation de cette packing list va enseigner au tableau de
 * correspondance.
 *
 * `validate_packing_list` y verse les lignes `category_id IS NOT NULL` dont la
 * résolution n'est pas `model` — donc les libellés tranchés par un humain ET
 * ceux repris du tableau, ces derniers n'incrémentant que leur `hit_count`. Une
 * supposition du modèle, même juste, n'y entre jamais : seul un humain enseigne.
 *
 * `knownKeys` sont les clés déjà présentes dans le tableau, lues au moment du
 * geste. Ne PAS les déduire des groupes `dictionary` de l'écran : un libellé
 * reconnu puis corrigé à la main est devenu `reviewed`, sa clé a disparu de
 * cette liste, et on le compterait comme nouveau.
 */
export interface PackingTeaching {
    /** Libellés tranchés à la main qui entrent pour la première fois. */
    created: number
    /** Libellés tranchés à la main dont la correspondance existait déjà. */
    updated: number
    /** Libellés classés seuls par le modèle : ils n'enseignent rien. */
    fromModel: number
}

export function packingTeaching(
    groups: readonly PackingGroup[],
    knownKeys: ReadonlySet<string>,
): PackingTeaching {
    let created = 0
    let updated = 0
    let fromModel = 0

    for (const group of groups) {
        if (group.state === "model") fromModel += 1
        else if (group.state === "reviewed") {
            if (knownKeys.has(group.key)) updated += 1
            else created += 1
        }
    }

    return { created, updated, fromModel }
}
