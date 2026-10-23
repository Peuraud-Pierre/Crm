import { supabase } from "@/integrations/supabase/client"

/**
 * Channel realtime "projects-sync" : changements postgres sur les tables du
 * module Projects + broadcast `projects:refresh`. Déplacé depuis
 * hooks/Projects/sync/useProjectRealtime.ts (déplacement mécanique) — seule la
 * couche service est autorisée à importer le client Supabase (règle ESLint
 * no-restricted-imports).
 */

export type ProjectSyncSubscription = {
    /** Diffuse un événement `projects:refresh` aux autres clients. */
    broadcastRefresh: () => Promise<string>
    unsubscribe: () => void
}

// --- TABLES TO WATCH ---
const watchedTables = [
    "project_teams",
    "project_team_members",
    "project_sprints",
    "project_tasks",
]

export function subscribeToProjectSync(
    onChange: () => void
): ProjectSyncSubscription {
    const channel = supabase.channel("projects-sync")

    watchedTables.forEach((table) => {
        channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            () => {
                onChange()
            }
        )
    })

    // --- BROADCAST EVENTS ---
    channel.on("broadcast", { event: "projects:refresh" }, () => {
        onChange()
    })

    channel.subscribe()

    return {
        broadcastRefresh: () =>
            channel.send({
                type: "broadcast",
                event: "projects:refresh",
            }),
        unsubscribe: () => {
            supabase.removeChannel(channel)
        },
    }
}
