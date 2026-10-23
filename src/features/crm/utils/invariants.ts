import type { Client, FicheAppro, CRMUser } from "@/features/crm/types"

/**
 * Référence à un propriétaire/customer telle que reçue par les composants calendrier :
 * soit un UUID brut, soit l'objet profil partiel renvoyé par Supabase.
 *
 * @deprecated Utiliser `CRMUser` et `CustomerRef` depuis `@/features/crm/types`.
 * Conservé pour la rétro-compatibilité.
 */
export type CustomerObject = CRMUser
export type CustomerRef = string | CRMUser | null | undefined

export function isCustomerObject(value: unknown): value is CRMUser {
    return (
        typeof value === "object" &&
        value !== null &&
        ("id" in value || "user_id" in value || "full_name" in value)
    )
}

export function getCustomerKey(ref: CustomerRef): string | null {
    if (!ref) return null
    if (typeof ref === "string") return ref
    return ref.id ?? ref.user_id ?? null
}

/**
 * Identifiant du propriétaire tel que stocké dans la colonne FK
 * `Event_calendar.customer` (qui référence `profiles.user_id`).
 *
 * ⚠️ À utiliser pour ÉCRIRE l'owner (insert/update), contrairement à
 * `getCustomerKey` (qui privilégie `id`, la PK de `profiles`) destiné au
 * regroupement / clés React.
 */
export function getCustomerUserId(ref: CustomerRef): string | undefined {
    if (!ref) return undefined
    if (typeof ref === "string") return ref
    return ref.user_id ?? undefined
}

export function getCustomerName(
    ref: CustomerRef,
    fallback = "Utilisateur"
): string {
    if (!ref) return fallback
    if (typeof ref === "string") return fallback
    return ref.full_name ?? fallback
}

/** Type-guard : `brief` peut être un FicheAppro, une string JSON ou null. */
export function isFicheAppro(
    brief: Client["brief"] | undefined
): brief is FicheAppro {
    return typeof brief === "object" && brief !== null
}

/** Récupère un champ de la fiche de manière sûre. */
export function getBriefField<K extends keyof FicheAppro>(
    brief: Client["brief"] | undefined,
    key: K
): FicheAppro[K] | undefined {
    return isFicheAppro(brief) ? brief[key] : undefined
}

/**
 * Vérifie les invariants critiques d'un client. Log en dev, ne throw jamais
 * pour ne pas casser le rendu sur un seul item invalide.
 */
export function assertClient(client: Client): client is Client & { id: string } {
    const ok =
        !!client.id &&
        (client.collum == null ||
            (Number.isInteger(client.collum) &&
                client.collum >= 0 &&
                client.collum <= 8))
    if (!ok && process.env.NODE_ENV !== "production") {
        console.warn("[CRM] Invariant client invalide:", client)
    }
    return ok
}
