import { supabase } from "@/integrations/supabase/client"
import type {
    Tables,
    TablesInsert,
    TablesUpdate,
} from "@/integrations/supabase/types"

// Couche service de la feature pingpong : seul point d'accès autorisé au
// client Supabase (règle no-restricted-imports). Wrappers mécaniques —
// la logique métier reste dans le hook usePingPong.

export type PingPongPlayerRow = Tables<"ping_pong_players">
export type TournamentRow = Tables<"tournaments">
export type TournamentParticipantRow = Tables<"tournament_participants">
export type MatchRow = Tables<"matches">
export type MatchInsert = TablesInsert<"matches">
export type MatchUpdate = TablesUpdate<"matches">

export async function getCurrentUser() {
    return supabase.auth.getUser()
}

export async function fetchPlayers() {
    return supabase
        .from("ping_pong_players")
        .select("*")
        .order("elo_rating", { ascending: false })
}

export async function fetchTournaments() {
    return supabase
        .from("tournaments")
        .select("*")
        .order("created_at", { ascending: false })
}

export async function fetchParticipants() {
    return supabase
        .from("tournament_participants")
        .select("*")
        .order("seed", { ascending: true })
}

export async function fetchMatches() {
    return supabase
        .from("matches")
        .select("*")
        .order("round_number", { ascending: true })
        .order("match_index", { ascending: true })
}

export async function findPlayerIdByUserId(userId: string) {
    return supabase
        .from("ping_pong_players")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle()
}

export async function insertPlayer(row: TablesInsert<"ping_pong_players">) {
    return supabase.from("ping_pong_players").insert([row])
}

export async function insertTournament(row: TablesInsert<"tournaments">) {
    return supabase.from("tournaments").insert([row]).select().single()
}

export async function insertParticipants(
    rows: TablesInsert<"tournament_participants">[]
) {
    return supabase.from("tournament_participants").insert(rows)
}

export async function insertMatches(rows: MatchInsert[]) {
    return supabase.from("matches").insert(rows).select()
}

export async function fetchTournamentOwner(tournamentId: string) {
    return supabase
        .from("tournaments")
        .select("id, created_by")
        .eq("id", tournamentId)
        .maybeSingle()
}

export async function deleteTournamentById(tournamentId: string) {
    return supabase.from("tournaments").delete().eq("id", tournamentId)
}

export async function fetchNextMatches(tournamentId: string, matchId: string) {
    return supabase
        .from("matches")
        .select(
            "id, player1_id, player2_id, player1_source_match_id, player2_source_match_id, status"
        )
        .eq("tournament_id", tournamentId)
        .or(
            `player1_source_match_id.eq.${matchId},player2_source_match_id.eq.${matchId}`
        )
}

export async function updateMatch(matchId: string, updates: MatchUpdate) {
    return supabase.from("matches").update(updates).eq("id", matchId)
}

export async function countRemainingMatches(tournamentId: string) {
    return supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .not("status", "eq", "completed")
}

export async function updateTournament(
    tournamentId: string,
    updates: TablesUpdate<"tournaments">
) {
    return supabase.from("tournaments").update(updates).eq("id", tournamentId)
}

export async function findPlayerByUserId(userId: string) {
    return supabase
        .from("ping_pong_players")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
}

export async function insertPlayerReturning(
    row: TablesInsert<"ping_pong_players">
) {
    return supabase.from("ping_pong_players").insert([row]).select().single()
}

// Forme normalisée d'un changement Realtime (modèle :
// src/features/crm/services/realtimeService.ts).
export type RealtimeChange<Row> = {
    eventType: "INSERT" | "UPDATE" | "DELETE"
    newRow: Partial<Row>
    oldRow: Partial<Row>
}

/**
 * Abonnement Realtime générique à une table du schéma public.
 * Retourne la fonction de désabonnement.
 */
export function subscribeToTable<Row>(
    channelName: string,
    table: string,
    handler: (change: RealtimeChange<Row>) => void
): () => void {
    const channel = supabase
        .channel(channelName)
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            (payload) => {
                handler({
                    eventType: payload.eventType,
                    // Cast : le payload Realtime n'est pas typé par table côté
                    // supabase-js ; les lignes proviennent bien de `table`.
                    newRow: (payload.new ?? {}) as Partial<Row>,
                    oldRow: (payload.old ?? {}) as Partial<Row>,
                })
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
