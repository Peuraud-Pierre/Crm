import type { Tables, TablesUpdate } from "@/integrations/supabase/types"

export type Permission = Pick<
    Tables<"permissions">,
    "id" | "code" | "label" | "category"
>

// Le champ legacy `permissions: Json` (ère JSONB) est remplacé par la liste
// normalisée issue des tables de jonction roles_permissions/services_permissions.
export type Role = Omit<Tables<"roles">, "permissions"> & {
    permissions: Permission[]
}
export type Service = Omit<Tables<"services">, "permissions"> & {
    permissions: Permission[]
}

// Rôles et services partagent la même forme — les composants génériques
// (EntityCard, RolesTab/ServicesTab) travaillent sur cette abstraction.
export type Entity = Role | Service
export type EntityKind = "role" | "service"

/** Forme légère pour les listes déroulantes (assignation rôle/service). */
export type EntityOption = Pick<Tables<"roles">, "id" | "nom">

export type ProfileStatus = "active" | "inactive" | "pending"

// `role` (texte legacy), `phone` et les champs RGPD ne concernent pas l'admin.
// Le statut est contraint par CHECK en base mais typé `string` dans les types
// générés — l'union est rétablie ici.
export type AdminProfile = Omit<
    Tables<"profiles">,
    "role" | "status" | "phone" | "privacy_accepted_at" | "privacy_accepted_version"
> & {
    status: ProfileStatus
    role: Pick<Tables<"roles">, "id" | "nom"> | null
    service: Pick<Tables<"services">, "id" | "nom"> | null
}

// `status` est resserré sur l'union applicative (le généré dit `string | null`).
export type ProfileUpdateInput = Pick<
    TablesUpdate<"profiles">,
    "full_name" | "email" | "role_id" | "service_id"
> & { status?: ProfileStatus }

export interface CreateUserInput {
    email: string
    full_name: string
    /** UUID du rôle */
    role: string
    /** UUID du service */
    service: string
    password: string
}

export type InviteUserInput = Omit<CreateUserInput, "password">

/** Permissions d'un utilisateur : individuelles + codes hérités du rôle/service. */
export interface UserPermissions {
    individual: Permission[]
    inheritedCodes: Set<string>
}

/** Détenteurs d'une permission — pour la vue d'audit de l'onglet Permissions. */
export interface PermissionHolders {
    roles: Pick<Tables<"roles">, "id" | "nom">[]
    services: Pick<Tables<"services">, "id" | "nom">[]
    userCount: number
}

/**
 * Effectifs par rôle et par service (id → nombre de profils). Tenus hors des
 * entités Role/Service pour ne pas interférer avec leur état optimiste.
 */
export interface AssignmentCounts {
    byRole: Map<string, number>
    byService: Map<string, number>
}

export type PermissionAssignments = Map<string, PermissionHolders>
