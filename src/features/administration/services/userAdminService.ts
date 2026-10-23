import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"
import type {
    AdminProfile,
    AssignmentCounts,
    CreateUserInput,
    InviteUserInput,
    ProfileStatus,
    ProfileUpdateInput,
} from "../types"

const PROFILE_SELECT = `
    id,
    user_id,
    email,
    full_name,
    avatar_url,
    status,
    last_login,
    created_at,
    updated_at,
    role_id,
    service_id,
    role:roles(id, nom),
    service:services(id, nom)
`

// Supabase peut renvoyer une jointure sous forme d'objet ou de tableau selon
// la cardinalité inférée — normalisation en objet unique ou null.
type RawRelation =
    | { id: string; nom: string }
    | { id: string; nom: string }[]
    | null

function normalizeRelation(value: RawRelation): { id: string; nom: string } | null {
    if (Array.isArray(value)) return value[0] ?? null
    return value ?? null
}

export async function listProfiles(): Promise<AdminProfile[]> {
    const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        // Les profils archivés (utilisateur supprimé) restent en base pour la
        // traçabilité des journaux d'activité — jamais dans les listes.
        .is("archived_at", null)
        .order("created_at", { ascending: false })

    if (error) throw error

    return (data ?? []).map((row) => {
        const { role, service, ...rest } = row as Omit<
            AdminProfile,
            "role" | "service"
        > & { role: RawRelation; service: RawRelation }
        return {
            ...rest,
            role: normalizeRelation(role),
            service: normalizeRelation(service),
        }
    })
}

/** Effectifs par rôle et par service — une seule requête légère agrégée côté client. */
export async function countProfilesByAssignment(): Promise<AssignmentCounts> {
    const { data, error } = await supabase
        .from("profiles")
        .select("role_id, service_id")

    if (error) throw error

    const byRole = new Map<string, number>()
    const byService = new Map<string, number>()
    for (const row of data ?? []) {
        if (row.role_id) {
            byRole.set(row.role_id, (byRole.get(row.role_id) ?? 0) + 1)
        }
        if (row.service_id) {
            byService.set(
                row.service_id,
                (byService.get(row.service_id) ?? 0) + 1
            )
        }
    }
    return { byRole, byService }
}

/** Abonnement realtime à la table profiles. Renvoie la fonction de désinscription. */
export function subscribeToProfiles(onChange: () => void): () => void {
    const channel = supabase
        .channel("administration-profiles")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "profiles" },
            onChange
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}

export async function updateProfile(
    userId: string,
    updates: ProfileUpdateInput
): Promise<void> {
    // `.select()` est obligatoire : une UPDATE bloquée par RLS renvoie
    // 0 ligne sans erreur (voir crm/services/calendarEventService.ts).
    const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId)
        .select("user_id")

    if (error) throw error
    if (!data || data.length === 0) {
        throw new Error("Aucune ligne mise à jour")
    }
}

export async function setProfileStatus(
    userId: string,
    status: ProfileStatus
): Promise<void> {
    await updateProfile(userId, { status })
}

async function keyexchangeRequest(
    path: string,
    init: RequestInit
): Promise<void> {
    const token = (await supabase.auth.getSession()).data.session?.access_token
    if (!token) throw new Error("Non authentifié")

    const res = await fetch(`${env.PUBLIC_SUPABASE_URL}/keyexchange/api/admin${path}`, {
        ...init,
        headers: {
            ...init.headers,
            Authorization: `Bearer ${token}`,
        },
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || "Erreur backend")
    }
}

export async function createUser(input: CreateUserInput): Promise<void> {
    await keyexchangeRequest("/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    })
}

export async function inviteUser(input: InviteUserInput): Promise<void> {
    await keyexchangeRequest("/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    })
}

export async function deleteUser(userId: string): Promise<void> {
    await keyexchangeRequest(`/delete-user?user_id=${userId}`, {
        method: "DELETE",
    })
}
