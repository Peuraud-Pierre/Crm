// Erreurs PostgREST du module traduites en messages lisibles. Même approche
// que `stock_handpick/utils/crudErrors.ts` : les triggers du plan lèvent des
// messages déjà rédigés en français, remontés tels quels.

const UNIQUE_VIOLATION = "23505"
const CHECK_VIOLATION = "23514"
const INSUFFICIENT_PRIVILEGE = "42501"
const RAISE_EXCEPTION = "P0001"

/**
 * Codes d'une base en retard sur l'application : colonne ou champ inconnu
 * (42703 — dont le trigger des étages d'avant son correctif), table absente
 * (42P01), table ou colonne absente du cache de l'API (PGRST204/205). Ce n'est
 * pas une erreur à réessayer : il manque une migration.
 */
const OUTDATED_SCHEMA = new Set(["42703", "42P01", "PGRST204", "PGRST205"])

const OUTDATED_MESSAGE =
    "La base de données n'est pas à jour pour cette fonction : appliquez les dernières migrations des magasins (supabase/migrations), puis réessayez."

/**
 * Messages des triggers qui nomment encore l'« étagère » : la valeur en base
 * reste `etagere`, mais l'interface parle de portant.
 */
const TRIGGER_WORDING: Record<string, string> = {
    "Une étagère doit être rattachée à une zone ou à un rayon":
        "Un portant doit être rattaché à une zone ou à un rayon",
}

const ACTION_LABEL = {
    create: "la création",
    update: "la modification",
    delete: "la suppression",
} as const

export type CrudAction = keyof typeof ACTION_LABEL

function field(error: unknown, name: "code" | "message"): string | undefined {
    if (typeof error !== "object" || error === null) return undefined
    const value = (error as Record<string, unknown>)[name]
    return typeof value === "string" && value.trim() !== "" ? value : undefined
}

/**
 * @param entity Complément accordé : « du magasin », « de la zone »,
 *               « de l'emplacement ».
 */
export function magasinErrorMessage(entity: string, action: CrudAction, error: unknown): string {
    const label = ACTION_LABEL[action]
    const code = field(error, "code")
    if (code && OUTDATED_SCHEMA.has(code)) return OUTDATED_MESSAGE
    switch (code) {
        case UNIQUE_VIOLATION:
            return entity === "de l'étage"
                ? "Ce magasin a déjà un étage à ce niveau."
                : "Ce code est déjà utilisé à ce niveau. Choisissez-en un autre."
        case RAISE_EXCEPTION: {
            const message = field(error, "message")
            return message ? (TRIGGER_WORDING[message] ?? message) : `Échec de ${label} ${entity}.`
        }
        case CHECK_VIOLATION:
            // Type refusé par la contrainte `…_kind_valid` : ce n'est pas une
            // saisie à corriger, c'est la base qui n'a pas la migration qui
            // l'autorise (nouveau type d'équipement, par exemple).
            if (field(error, "message")?.includes("_kind_valid")) {
                return `Ce type n'est pas encore accepté par la base de données : appliquez la dernière migration des magasins (supabase/migrations), puis réessayez.`
            }
            return `Valeur refusée lors de ${label} ${entity} : vérifiez le code et les dimensions.`
        case INSUFFICIENT_PRIVILEGE:
            return `Vous n'avez pas le droit d'effectuer ${label} ${entity}.`
        default:
            return `Échec de ${label} ${entity}. Réessayez.`
    }
}
