// ── errors.ts ──────────────────────────────────────────────────────────────────
// RÔLE : erreur typée unique pour les opérations Supabase (Postgrest/Storage)
// de la couche service (bibliothequeService.ts, bibliothequeMediaService.ts)
// qui ne lèvent pas déjà un type dédié — ThematiqueMediaWriteError reste
// spécifique à la boucle de retry sur conflit média (voir bibliothequeService.ts)
// et n'est pas concernée par ce wrapper.
//
// Avant ce type, la quasi-totalité des fonctions du service faisaient
// `if (error) throw error`, propageant l'objet d'erreur brut renvoyé par
// Supabase (PostgrestError, StorageError...) sans jamais l'envelopper — un
// appelant ne pouvait pas distinguer "une erreur de CETTE couche service" d'une
// exception JS quelconque sans connaître le détail de chaque implémentation.
// BibliothequeServiceError uniformise ce contrat : `cause` porte toujours
// l'erreur d'origine (avec son message, et son éventuel `code` Postgres/Storage)
// pour qui veut l'inspecter, tandis que `.message` reste directement lisible
// (repris de l'erreur d'origine quand disponible) — les tests existants qui
// vérifient un message précis (`.rejects.toThrow("...")`) continuent de
// fonctionner sans modification.

// "extends Error" : cette classe HÉRITE de la classe native Error (elle a
// donc bien un .message, une pile d'appel, et fonctionne avec `throw`/`catch`
// comme n'importe quelle erreur JS), tout en ajoutant ses propres champs.
export class BibliothequeServiceError extends Error {
    constructor(
        // Écrire "public readonly" DIRECTEMENT devant un paramètre de
        // constructeur est un raccourci TypeScript : il crée automatiquement
        // une propriété du même nom sur la classe (ici this.operation et
        // this.cause) et l'assigne avec la valeur reçue — pas besoin d'écrire
        // "this.operation = operation" à la main dans le corps du constructeur.
        // "readonly" interdit de réassigner la propriété après coup.
        /** Nom de l'opération de service qui a échoué (ex: "insertThematique") — utile en log/Sentry. */
        public readonly operation: string,
        // "unknown" (et pas "any") : on sait qu'on va recevoir UNE valeur,
        // mais on ne sait pas encore laquelle (Supabase peut lever plein de
        // formes d'erreurs différentes). Contrairement à "any", TypeScript
        // OBLIGE à vérifier le type de "unknown" (ex: avec "instanceof" ou
        // "typeof") avant de l'utiliser — ça évite des bugs par étourderie.
        /** Erreur d'origine (PostgrestError, StorageError, ou toute autre valeur levée par Supabase). */
        public readonly cause: unknown,
    ) {
        super(BibliothequeServiceError.extractMessage(cause))
        this.name = "BibliothequeServiceError"
    }

    // Essaie d'extraire un message lisible d'une valeur de type inconnu.
    // "cause instanceof Error" vérifie si `cause` a été créé avec `new Error(...)`
    // (ou une classe qui en hérite) : si oui, on peut lire .message en confiance.
    // Sinon, on regarde si c'est un objet quelconque qui a un champ "message"
    // de type string (cas des erreurs Supabase, qui ne sont pas de vraies
    // instances d'Error). En dernier recours, String(cause) convertit
    // n'importe quelle valeur (nombre, objet, etc.) en texte.
    private static extractMessage(cause: unknown): string {
        if (cause instanceof Error) return cause.message
        if (cause && typeof cause === "object" && "message" in cause && typeof (cause as { message?: unknown }).message === "string") {
            return (cause as { message: string }).message
        }
        return String(cause)
    }
}

/** Lève une BibliothequeServiceError si `error` est non-null — sinon ne fait rien. */
export function throwIfError(operation: string, error: unknown): void {
    if (error) throw new BibliothequeServiceError(operation, error)
}
