/**
 * Traduction des erreurs PostgREST du module en messages actionnables.
 *
 * Reprend `stock/utils/crudErrors.ts` et l'étend sur deux points propres à ce
 * module :
 *
 *  • la suppression d'un fournisseur / d'une catégorie encore utilisé échoue
 *    par construction (FK des balles en ON DELETE RESTRICT). Le message doit
 *    nommer le blocage ET la sortie : la désactivation.
 *  • les triggers de cohérence (paire fournisseur ↔ catégorie, hiérarchie et
 *    cycles du plan) lèvent des exceptions applicatives dont le message est
 *    déjà rédigé en français côté base. Le remplacer par un texte générique
 *    ferait perdre l'information ; on le remonte tel quel.
 */

const FOREIGN_KEY_VIOLATION  = "23503"
const UNIQUE_VIOLATION       = "23505"
const CHECK_VIOLATION        = "23514"
const INSUFFICIENT_PRIVILEGE = "42501"
/** RAISE EXCEPTION sans ERRCODE (triggers du plan). */
const RAISE_EXCEPTION        = "P0001"

const ACTION_LABEL: Record<string, string> = {
    create: "la création",
    update: "la modification",
    delete: "la suppression",
}

function errorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined
    const code = (error as { code?: unknown }).code
    return typeof code === "string" ? code : undefined
}

function errorMessage(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined
    const message = (error as { message?: unknown }).message
    return typeof message === "string" && message.trim() !== "" ? message : undefined
}

/**
 * @param entity Complément déjà déterminé, accordé en genre :
 *               « du fournisseur », « de la catégorie », « de la balle ».
 * @param action Clé d'action de `useOptimisticCrud` : create | update | delete.
 * @param usageCount Nombre d'enregistrements bloquant une suppression, quand
 *                   il a pu être compté avant l'appel.
 */
export function handpickErrorMessage(
    entity: string,
    action: string,
    error: unknown,
    usageCount?: number,
): string {
    const label = ACTION_LABEL[action] ?? "l'action"
    const code = errorCode(error)

    switch (code) {
        // Une clé étrangère violée ne veut dire « encore référencé » que sur
        // une suppression. À la création ou à la modification, c'est l'élément
        // VISÉ qui n'existe plus — une ligne de colisage pointant une balle
        // supprimée entre-temps, par exemple.
        case FOREIGN_KEY_VIOLATION:
            if (action !== "delete") {
                return `Échec de ${label} ${entity} : un élément lié n'existe plus. Rechargez la page.`
            }
            return usageCount !== undefined && usageCount > 0
                ? `Suppression impossible : ${usageCount} balle${usageCount > 1 ? "s" : ""} y font encore référence. Désactivez l'élément plutôt que de le supprimer.`
                : "Suppression impossible : des enregistrements font encore référence à cet élément. Désactivez-le plutôt que de le supprimer."

        case UNIQUE_VIOLATION:
            return "Ce nom est déjà utilisé."

        // Triggers de cohérence : leur message nomme précisément le problème
        // (catégorie non proposée par le fournisseur, cycle dans le plan…).
        case CHECK_VIOLATION:
        case RAISE_EXCEPTION:
            return errorMessage(error) ?? `Erreur lors de ${label} ${entity}.`

        case INSUFFICIENT_PRIVILEGE:
            return `Vous n'avez pas la permission d'effectuer ${label} ${entity}.`

        default:
            return `Erreur lors de ${label} ${entity}.`
    }
}
