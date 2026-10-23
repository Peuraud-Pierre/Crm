/**
 * Traduction des erreurs PostgREST du référentiel en messages actionnables.
 *
 * Sans ça, l'utilisateur ne voit qu'un « Erreur lors de l'action » générique
 * là où deux cas très concrets dominent : la ligne est encore référencée
 * (contrainte de clé étrangère), ou la RLS refuse l'écriture faute de
 * permission (voir 20260818120000_stock_settings_permissions.sql).
 */

const FOREIGN_KEY_VIOLATION  = "23503"
const UNIQUE_VIOLATION       = "23505"
const INSUFFICIENT_PRIVILEGE = "42501"

/**
 * Refus décidé par la couche service, avant ou à la place de PostgREST.
 *
 * Deux cas concrets qu'aucun code d'erreur Postgres ne couvre : un doublon
 * détecté par comparaison (la base n'a pas de contrainte d'unicité sur le nom
 * des catégories), et une écriture refusée par la RLS — qui ne renvoie PAS
 * d'erreur, seulement zéro ligne affectée. Le message est déjà rédigé pour
 * l'utilisateur, `referentialErrorMessage` le laisse donc passer tel quel.
 */
export class ReferentialConflictError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ReferentialConflictError"
    }
}

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

/**
 * @param entity Complément déjà déterminé, accordé en genre :
 *               « du fournisseur », « de la catégorie ».
 * @param action Clé d'action de `useOptimisticCrud` : create | update | delete.
 */
export function referentialErrorMessage(
    entity: string,
    action: string,
    error: unknown,
): string {
    const label = ACTION_LABEL[action] ?? "l'action"

    // Message déjà rédigé par la couche service : le reformuler le rendrait
    // plus vague que ce qu'elle sait.
    if (error instanceof ReferentialConflictError) return error.message

    switch (errorCode(error)) {
        // Une clé étrangère violée ne veut dire « encore référencé » que sur
        // une suppression. À la création ou à la modification, c'est l'élément
        // VISÉ qui n'existe plus (supprimé entre-temps).
        case FOREIGN_KEY_VIOLATION:
            return action === "delete"
                ? "Suppression impossible : des enregistrements font encore référence à cet élément."
                : `Échec de ${label} ${entity} : un élément lié n'existe plus. Rechargez la page.`
        case UNIQUE_VIOLATION:
            return "Ce nom est déjà utilisé."
        case INSUFFICIENT_PRIVILEGE:
            return `Vous n'avez pas la permission d'effectuer ${label} ${entity}.`
        default:
            return `Erreur lors de ${label} ${entity}.`
    }
}

/**
 * Les RPC lèvent des messages déjà rédigés pour un humain (« une livraison
 * sans carton ne peut pas partir ») sous le code P0001 : on les montre tels
 * quels plutôt qu'un message générique.
 */
export function rpcMessage(error: unknown): string | null {
    if (typeof error !== "object" || error === null) return null
    const { code, message } = error as { code?: string; message?: string }
    if (code !== "P0001" || !message) return null
    return message.charAt(0).toUpperCase() + message.slice(1) + "."
}
