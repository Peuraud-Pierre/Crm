import type { Json } from "@/integrations/supabase/types"
import { evaluateDetailedMatch, type GameScore } from "@/shared/utils/pingPongScores"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import * as pingPongService from "../../services/pingPongService"

const getErrorMessage = (error: unknown): string | undefined =>
    error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : undefined

export interface PingPongPlayer {
    id: string
    user_id: string
    elo_rating: number
    wins: number
    losses: number
    created_at: string
    updated_at: string
}

export type StoredGameScore = {
    game_number: number
    set_number: number
    player1_points: number
    player2_points: number
    winner: "player1" | "player2"
}

export interface Tournament {
    id: string
    name: string
    description?: string | null
    status: "upcoming" | "active" | "completed"
    created_by: string
    created_at: string
    updated_at: string
    start_date: string
    end_date?: string | null
    points_per_game: number
    games_per_set: number
    sets_to_win: number
}

export interface TournamentParticipant {
    id: string
    tournament_id: string
    player_id: string
    seed: number
    created_at: string
}

export interface Match {
    id: string
    tournament_id: string | null
    player1_id: string | null
    player2_id: string | null
    player1_score: number | null
    player2_score: number | null
    winner_id: string | null
    status: "scheduled" | "in_progress" | "completed"
    played_at?: string | null
    elo_applied: boolean
    created_at: string
    updated_at: string
    round_number: number
    match_index: number
    player1_source_match_id: string | null
    player2_source_match_id: string | null
    score_details: StoredGameScore[] | null
}

type WinnerOnlyPayload = {
    mode: "winnerOnly"
    winnerId: string
}

type DetailedPayload = {
    mode: "detailed"
    games: GameScore[]
}

export type MatchResultPayload = WinnerOnlyPayload | DetailedPayload

interface CreateTournamentPayload {
    name: string
    description?: string
    pointsPerGame: number
    gamesPerSet: number
    setsToWin: number
    playerIds: string[]
}

const shuffleArray = <T,>(values: T[]): T[] => {
    const array = [...values]
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
}

const isPowerOfTwo = (value: number) => value > 0 && (value & (value - 1)) === 0

export function usePingPong() {
    const [players, setPlayers] = useState<PingPongPlayer[]>([])
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [participants, setParticipants] = useState<TournamentParticipant[]>(
        []
    )
    const [matches, setMatches] = useState<Match[]>([])
    const [loading, setLoading] = useState(true)

    const sortedMatches = useMemo(
        () =>
            [...matches].sort((a, b) => {
                if (a.tournament_id !== b.tournament_id) {
                    return (a.tournament_id || "").localeCompare(
                        b.tournament_id || ""
                    )
                }
                if (a.round_number !== b.round_number) {
                    return a.round_number - b.round_number
                }
                if (a.match_index !== b.match_index) {
                    return a.match_index - b.match_index
                }
                return a.created_at.localeCompare(b.created_at)
            }),
        [matches]
    )

    const fetchPlayers = async () => {
        try {
            const { data, error } = await pingPongService.fetchPlayers()

            if (error) throw error
            setPlayers((data || []) as PingPongPlayer[])
        } catch (error) {
            console.error("Error fetching players:", error)
            toast.error("Erreur lors du chargement des joueurs")
        }
    }

    const fetchTournaments = async () => {
        try {
            const { data, error } = await pingPongService.fetchTournaments()

            if (error) throw error
            setTournaments((data || []) as Tournament[])
        } catch (error) {
            console.error("Error fetching tournaments:", error)
            toast.error("Erreur lors du chargement des tournois")
        }
    }

    const fetchParticipants = async () => {
        try {
            const { data, error } = await pingPongService.fetchParticipants()

            if (error) throw error
            setParticipants((data || []) as TournamentParticipant[])
        } catch (error) {
            console.error("Error fetching tournament participants:", error)
            toast.error("Erreur lors du chargement des participants")
        }
    }

    const fetchMatches = async () => {
        try {
            const { data, error } = await pingPongService.fetchMatches()

            if (error) throw error
            const parsedMatches = (data || []).map((raw) => ({
                ...(raw as Record<string, unknown>),
                score_details: Array.isArray((raw as Match).score_details)
                    ? ((raw as Match).score_details as StoredGameScore[])
                    : null,
            })) as Match[]

            setMatches(parsedMatches)
        } catch (error) {
            console.error("Error fetching matches:", error)
            toast.error("Erreur lors du chargement des matchs")
        }
    }

    const createTournament = async ({
        name,
        description,
        pointsPerGame,
        gamesPerSet,
        setsToWin,
        playerIds,
    }: CreateTournamentPayload) => {
        try {
            const {
                data: { user },
            } = await pingPongService.getCurrentUser()
            if (!user) throw new Error("Utilisateur non connecté")

            if (playerIds.length < 2) {
                toast.error("Sélectionnez au moins deux joueurs")
                return { success: false }
            }

            if (!isPowerOfTwo(playerIds.length)) {
                toast.error(
                    "Le nombre de joueurs doit être une puissance de 2 (2, 4, 8, ...)"
                )
                return { success: false }
            }

            const cleanedPlayerIds = playerIds
                .map((id) => String(id).trim())
                .filter((id) => id.length > 0)

            if (cleanedPlayerIds.length < 2) {
                toast.error("Sélection invalide de joueurs")
                return { success: false }
            }

            const shuffledPlayers = shuffleArray(cleanedPlayerIds)

            await Promise.all(
                cleanedPlayerIds.map(async (userId) => {
                    const { data: existing } =
                        await pingPongService.findPlayerIdByUserId(userId)

                    if (existing) return

                    const { error: insertError } =
                        await pingPongService.insertPlayer({
                            user_id: userId,
                            elo_rating: 500,
                            wins: 0,
                            losses: 0,
                        })

                    if (insertError && insertError.code !== "23505") {
                        throw insertError
                    }
                })
            )

            const { data: tournament, error: tournamentError } =
                await pingPongService.insertTournament({
                    name,
                    description: description || null,
                    created_by: user.id,
                    status: "active",
                    start_date: new Date().toISOString(),
                    points_per_game: pointsPerGame,
                    games_per_set: gamesPerSet,
                    sets_to_win: setsToWin,
                })

            if (tournamentError || !tournament) throw tournamentError

            const participantRows = shuffledPlayers.map((playerId, index) => ({
                tournament_id: tournament.id,
                player_id: playerId,
                seed: index + 1,
            }))

            const { error: participantError } =
                await pingPongService.insertParticipants(participantRows)

            if (participantError) throw participantError

            // Round 1 matches
            const firstRoundMatches = [] as pingPongService.MatchInsert[]
            for (let i = 0; i < shuffledPlayers.length; i += 2) {
                firstRoundMatches.push({
                    tournament_id: tournament.id,
                    round_number: 1,
                    match_index: i / 2,
                    player1_id: shuffledPlayers[i] ?? null,
                    player2_id: shuffledPlayers[i + 1] ?? null,
                    status: "scheduled",
                    player1_score: 0,
                    player2_score: 0,
                    score_details: [],
                })
            }

            const { data: insertedRoundOne, error: roundOneError } =
                await pingPongService.insertMatches(firstRoundMatches)

            if (roundOneError || !insertedRoundOne) throw roundOneError

            let previousRound = insertedRoundOne as Match[]
            let roundNumber = 2

            while (previousRound.length > 1) {
                const nextRoundPayload = [] as pingPongService.MatchInsert[]
                for (let i = 0; i < previousRound.length; i += 2) {
                    nextRoundPayload.push({
                        tournament_id: tournament.id,
                        round_number: roundNumber,
                        match_index: i / 2,
                        player1_id: null,
                        player2_id: null,
                        status: "scheduled",
                        player1_score: 0,
                        player2_score: 0,
                        player1_source_match_id: previousRound[i]?.id ?? null,
                        player2_source_match_id:
                            previousRound[i + 1]?.id ?? null,
                        score_details: [],
                    })
                }

                const { data: insertedRound, error: roundError } =
                    await pingPongService.insertMatches(nextRoundPayload)

                if (roundError || !insertedRound) throw roundError
                previousRound = insertedRound as Match[]
                roundNumber += 1
            }

            await Promise.all([
                fetchTournaments(),
                fetchParticipants(),
                fetchMatches(),
            ])

            toast.success("Tournoi créé avec succès")
            return { success: true, data: tournament }
        } catch (error: unknown) {
            console.error("Error creating tournament:", error)
            const message = getErrorMessage(error)
            toast.error(message ?? "Erreur lors de la création du tournoi")
            return { success: false, error: message }
        }
    }

    const deleteTournament = async (tournamentId: string) => {
        try {
            const {
                data: { user },
                error: authError,
            } = await pingPongService.getCurrentUser()
            if (authError) throw authError
            if (!user) throw new Error("Utilisateur non connecté")

            const { data: tournament, error: fetchError } =
                await pingPongService.fetchTournamentOwner(tournamentId)

            if (fetchError) throw fetchError
            if (!tournament) {
                toast.error("Tournoi introuvable")
                return { success: false }
            }

            if (tournament.created_by !== user.id) {
                toast.error("Vous n'êtes pas autorisé à supprimer ce tournoi")
                return { success: false }
            }

            const { error } =
                await pingPongService.deleteTournamentById(tournamentId)

            if (error) throw error

            await Promise.all([
                fetchTournaments(),
                fetchParticipants(),
                fetchMatches(),
            ])

            toast.success("Tournoi supprimé")
            return { success: true }
        } catch (error: unknown) {
            console.error("Error deleting tournament:", error)
            const message = getErrorMessage(error)
            toast.error(message ?? "Erreur lors de la suppression du tournoi")
            return { success: false, error: message }
        }
    }

    const updateNextMatchesWithWinner = async (
        tournamentId: string,
        matchId: string,
        winnerId: string
    ) => {
        const { data: nextMatches, error } =
            await pingPongService.fetchNextMatches(tournamentId, matchId)

        if (error || !nextMatches?.length) {
            return
        }

        await Promise.all(
            nextMatches.map(async (nextMatch) => {
                const updates: pingPongService.MatchUpdate = {}

                if (nextMatch.player1_source_match_id === matchId) {
                    updates.player1_id = winnerId
                    updates.player1_score = 0
                }

                if (nextMatch.player2_source_match_id === matchId) {
                    updates.player2_id = winnerId
                    updates.player2_score = 0
                }

                if (Object.keys(updates).length === 0) {
                    return
                }

                updates.score_details = []

                const bothPlayersAssigned =
                    (updates.player1_id ?? nextMatch.player1_id) !== null &&
                    (updates.player2_id ?? nextMatch.player2_id) !== null

                if (bothPlayersAssigned) {
                    updates.status = "scheduled"
                }

                await pingPongService.updateMatch(nextMatch.id, updates)
            })
        )
    }

    const updateMatchResult = async (
        matchId: string,
        payload: MatchResultPayload
    ) => {
        try {
            const match = matches.find((m) => m.id === matchId)
            if (!match) {
                toast.error("Match introuvable")
                return { success: false }
            }

            if (!match.player1_id || !match.player2_id) {
                toast.error(
                    "Les joueurs de ce match ne sont pas encore déterminés"
                )
                return { success: false }
            }

            const tournament = tournaments.find(
                (t) => t.id === match.tournament_id
            )

            if (!tournament) {
                toast.error("Tournoi introuvable pour ce match")
                return { success: false }
            }

            let player1Sets = 0
            let player2Sets = 0
            let winnerId: string | null = null
            let scoreDetails: StoredGameScore[] | null = null

            if (payload.mode === "winnerOnly") {
                winnerId = payload.winnerId
                if (!winnerId) {
                    toast.error("Sélectionnez un vainqueur")
                    return { success: false }
                }

                const winnerSets = Math.max(1, tournament.sets_to_win)
                if (winnerId === match.player1_id) {
                    player1Sets = winnerSets
                    player2Sets = 0
                } else if (winnerId === match.player2_id) {
                    player1Sets = 0
                    player2Sets = winnerSets
                } else {
                    toast.error("Vainqueur invalide")
                    return { success: false }
                }
            } else {
                if (!payload.games.length) {
                    toast.error("Ajoutez au moins un jeu")
                    return { success: false }
                }

                const evaluation = evaluateDetailedMatch(payload.games, {
                    pointsPerGame: tournament.points_per_game,
                    gamesPerSet: tournament.games_per_set,
                    setsToWin: tournament.sets_to_win,
                })

                player1Sets = evaluation.setsWon.player1
                player2Sets = evaluation.setsWon.player2
                winnerId =
                    evaluation.winner === "player1"
                        ? match.player1_id
                        : match.player2_id
                scoreDetails = evaluation.games.map((game) => ({
                    game_number: game.gameNumber,
                    set_number: game.setNumber,
                    player1_points: game.player1Points,
                    player2_points: game.player2Points,
                    winner: game.winner,
                }))

                if (!winnerId) {
                    toast.error("Impossible de déterminer le vainqueur")
                    return { success: false }
                }
            }

            const { error } = await pingPongService.updateMatch(matchId, {
                player1_score: player1Sets,
                player2_score: player2Sets,
                winner_id: winnerId,
                status: "completed",
                played_at: new Date().toISOString(),
                elo_applied: false,
                score_details: scoreDetails as unknown as Json,
            })

            if (error) throw error

            if (match.tournament_id) {
                await updateNextMatchesWithWinner(
                    match.tournament_id,
                    matchId,
                    winnerId
                )

                const { count, error: remainingError } =
                    await pingPongService.countRemainingMatches(
                        match.tournament_id
                    )

                if (!remainingError && (count ?? 0) === 0) {
                    await pingPongService.updateTournament(
                        match.tournament_id,
                        {
                            status: "completed",
                            end_date: new Date().toISOString(),
                        }
                    )
                }
            }

            toast.success("Résultat enregistré !")
            return { success: true }
        } catch (error: unknown) {
            console.error("Error updating match result:", error)
            const message = getErrorMessage(error)
            toast.error(message ?? "Erreur lors de la mise à jour du résultat")
            return { success: false, error: message }
        }
    }

    const initializePlayer = async () => {
        try {
            const {
                data: { user },
            } = await pingPongService.getCurrentUser()
            if (!user) throw new Error("Utilisateur non connecté")

            const { data: existingPlayer } =
                await pingPongService.findPlayerByUserId(user.id)

            if (existingPlayer) {
                return { success: true, data: existingPlayer }
            }

            const { data, error } = await pingPongService.insertPlayerReturning(
                { user_id: user.id }
            )

            if (error) throw error

            toast.success("Profil ping pong créé ! ELO initial : 500")
            return { success: true, data }
        } catch (error: unknown) {
            console.error("Error initializing player:", error)
            const message = getErrorMessage(error)
            toast.error(message ?? "Erreur lors de l'initialisation du profil")
            return { success: false, error: message }
        }
    }

    useEffect(() => {
        const fetchAll = async () => {
            await Promise.all([
                fetchPlayers(),
                fetchTournaments(),
                fetchParticipants(),
                fetchMatches(),
            ])
            setLoading(false)
        }

        fetchAll()

        const unsubscribePlayers =
            pingPongService.subscribeToTable<PingPongPlayer>(
                "ping-pong-players-changes",
                "ping_pong_players",
                ({ eventType, newRow, oldRow }) => {
                    setPlayers((prev) => {
                        const next = [...prev]
                        if (eventType === "INSERT") {
                            next.push(newRow as PingPongPlayer)
                        } else if (eventType === "UPDATE") {
                            const updated = newRow as PingPongPlayer
                            const recordId = updated?.id ?? oldRow?.id
                            const index = recordId
                                ? next.findIndex((p) => p.id === recordId)
                                : -1
                            if (index !== -1) {
                                next[index] = updated
                            }
                        }
                        return next.sort((a, b) => b.elo_rating - a.elo_rating)
                    })
                }
            )

        const unsubscribeTournaments =
            pingPongService.subscribeToTable<Tournament>(
                "tournaments-changes",
                "tournaments",
                ({ eventType, newRow, oldRow }) => {
                    setTournaments((prev) => {
                        if (eventType === "INSERT") {
                            return [newRow as Tournament, ...prev]
                        }
                        if (eventType === "UPDATE") {
                            return prev.map((t) =>
                                t.id === newRow.id
                                    ? (newRow as Tournament)
                                    : t
                            )
                        }
                        if (eventType === "DELETE") {
                            return prev.filter((t) => t.id !== oldRow.id)
                        }
                        return prev
                    })
                }
            )

        const unsubscribeMatches = pingPongService.subscribeToTable<Match>(
            "matches-changes",
            "matches",
            ({ eventType, newRow, oldRow }) => {
                setMatches((prev) => {
                    if (eventType === "INSERT") {
                        return [...prev, newRow as Match]
                    }
                    if (eventType === "UPDATE") {
                        return prev.map((m) =>
                            m.id === newRow.id ? (newRow as Match) : m
                        )
                    }
                    if (eventType === "DELETE") {
                        return prev.filter((m) => m.id !== oldRow.id)
                    }
                    return prev
                })
            }
        )

        const unsubscribeParticipants =
            pingPongService.subscribeToTable<TournamentParticipant>(
                "tournament-participants-changes",
                "tournament_participants",
                ({ eventType, newRow, oldRow }) => {
                    setParticipants((prev) => {
                        if (eventType === "INSERT") {
                            return [
                                ...prev,
                                newRow as TournamentParticipant,
                            ]
                        }
                        if (eventType === "UPDATE") {
                            return prev.map((p) =>
                                p.id === newRow.id
                                    ? (newRow as TournamentParticipant)
                                    : p
                            )
                        }
                        if (eventType === "DELETE") {
                            return prev.filter((p) => p.id !== oldRow.id)
                        }
                        return prev
                    })
                }
            )

        return () => {
            unsubscribePlayers()
            unsubscribeTournaments()
            unsubscribeMatches()
            unsubscribeParticipants()
        }
    }, [])

    return {
        players,
        tournaments,
        participants,
        matches: sortedMatches,
        loading,
        createTournament,
        updateMatchResult,
        deleteTournament,
        initializePlayer,
        refetch: () =>
            Promise.all([
                fetchPlayers(),
                fetchTournaments(),
                fetchParticipants(),
                fetchMatches(),
            ]),
    }
}
