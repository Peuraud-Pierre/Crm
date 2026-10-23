import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { usePingPong } from "@/features/pingpong/hooks/Ping_Pong_hook/usePingPong"
import type { Tournament as PingPongTournament } from "@/features/pingpong/hooks/Ping_Pong_hook/usePingPong"
import { useProfilesCtx } from "@/shared/context/ProfilesProvider"
import { toast } from "sonner"
import { PageHelpBubble } from "@/shared/components/layout/PageHelpBubble"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { ScrollArea } from "@/shared/ui/atoms/scroll-area"
import { Badge } from "@/shared/ui/atoms/badge"
import { RadioGroup, RadioGroupItem } from "@/shared/ui/atoms/radio-group"
import {
    Trophy,
    Users,
    Shuffle,
    Plus,
    Medal,
    ChevronLeft,
    ChevronRight,
    Timer,
    Trash2,
} from "lucide-react"
import {
    evaluateDetailedMatch,
    formatScoreDetails,
    type AnnotatedGameScore,
} from "@/shared/utils/pingPongScores"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

const PAGE_SIZE = 10
type SortKey = "elo" | "matches" | "wins" | "losses" | "name"
type SortDirection = "asc" | "desc"

const isPowerOfTwo = (value: number) => value > 0 && (value & (value - 1)) === 0

export default function PingPong() {
    const { user } = useAuth()
    const { profiles } = useProfilesCtx()
    const {
        players,
        tournaments,
        participants,
        matches,
        loading,
        createTournament,
        updateMatchResult,
        deleteTournament,
        refetch: refetchPingPong,
    } = usePingPong()

    const [leaderboardPage, setLeaderboardPage] = useState(0)
    const [sortKey, setSortKey] = useState<SortKey>("elo")
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

    const [isCreateTournamentOpen, setIsCreateTournamentOpen] = useState(false)
    const [createTournamentLoading, setCreateTournamentLoading] =
        useState(false)
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
    const [tournamentName, setTournamentName] = useState("")
    const [tournamentDescription, setTournamentDescription] = useState("")
    const [pointsPerGame, setPointsPerGame] = useState(11)
    const [gamesPerSet, setGamesPerSet] = useState(3)
    const [setsToWin, setSetsToWin] = useState(2)

    const [activeTab, setActiveTab] = useState<"active" | "completed">("active")
    const [selectedTournamentId, setSelectedTournamentId] = useState<
        string | null
    >(null)
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
    const [scoreEntryMode, setScoreEntryMode] = useState<
        "winnerOnly" | "detailed"
    >("winnerOnly")
    const [winnerSelection, setWinnerSelection] = useState<string | null>(null)
    const gameRowIdRef = useRef(0)
    const createGameRow = (player1 = "", player2 = "") => {
        gameRowIdRef.current += 1
        return { id: `game-${gameRowIdRef.current}`, player1, player2 }
    }
    const [gameInputs, setGameInputs] = useState<
        { id: string; player1: string; player2: string }[]
    >(() => [createGameRow()])
    const [detailedError, setDetailedError] = useState<string | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const authIds = useMemo(() => {
        if (!user) return [] as string[]
        const ids = new Set<string>()
        const append = (value?: string | null) => {
            if (value && String(value).trim()) ids.add(String(value).trim())
        }
        append((user as { id?: string }).id ?? null)
        append((user as { user_id?: string }).user_id ?? null)
        append((user as { user?: { id?: string } }).user?.id ?? null)
        append((user as { user?: { user_id?: string } }).user?.user_id ?? null)
        return Array.from(ids)
    }, [user])

    const leaderboard = useMemo(() => {
        return players
            .map((player) => {
                const profile = profiles.find(
                    (p) => p.user_id === player.user_id
                )
                const matchesPlayed = (player.wins ?? 0) + (player.losses ?? 0)
                return {
                    ...player,
                    matchesPlayed,
                    full_name: profile?.full_name ?? "Utilisateur inconnu",
                }
            })
            .filter((player) => player.matchesPlayed > 0)
    }, [players, profiles])

    const sortedLeaderboard = useMemo(() => {
        const sorted = [...leaderboard]
        sorted.sort((a, b) => {
            const directionFactor = sortDirection === "asc" ? 1 : -1
            const compareNumbers = (valueA: number, valueB: number) => {
                if (valueA === valueB) {
                    return (
                        a.full_name.localeCompare(b.full_name) * directionFactor
                    )
                }
                return directionFactor * (valueA - valueB)
            }

            switch (sortKey) {
                case "name":
                    return (
                        directionFactor * a.full_name.localeCompare(b.full_name)
                    )
                case "matches":
                    return compareNumbers(a.matchesPlayed, b.matchesPlayed)
                case "wins":
                    return compareNumbers(a.wins, b.wins)
                case "losses":
                    return compareNumbers(a.losses, b.losses)
                case "elo":
                default:
                    return compareNumbers(a.elo_rating, b.elo_rating)
            }
        })
        return sorted
    }, [leaderboard, sortDirection, sortKey])

    const totalLeaderboardPages = Math.max(
        1,
        Math.ceil(sortedLeaderboard.length / PAGE_SIZE)
    )
    const paginatedLeaderboard = sortedLeaderboard.slice(
        leaderboardPage * PAGE_SIZE,
        leaderboardPage * PAGE_SIZE + PAGE_SIZE
    )

    const activeTournaments = useMemo(
        () =>
            tournaments.filter(
                (tournament) => tournament.status !== "completed"
            ),
        [tournaments]
    )

    const completedTournaments = useMemo(
        () =>
            tournaments.filter(
                (tournament) => tournament.status === "completed"
            ),
        [tournaments]
    )

    const availableTournamentList =
        activeTab === "active" ? activeTournaments : completedTournaments

    const pingPongPlayerMap = useMemo(() => {
        const map = new Map<string, (typeof players)[number]>()
        players.forEach((player) => {
            if (player.user_id) {
                map.set(player.user_id, player)
            }
        })
        return map
    }, [players])

    const selectableProfiles = useMemo(
        () =>
            profiles.filter((profile) => {
                if (!profile.user_id) return false
                if (profile.status && profile.status !== "active") return false
                return true
            }),
        [profiles]
    )

    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- entity resync: keep the selected tournament valid when the available list changes */
    useEffect(() => {
        if (!availableTournamentList.length) {
            setSelectedTournamentId(null)
            return
        }
        if (
            !selectedTournamentId ||
            !availableTournamentList.some((t) => t.id === selectedTournamentId)
        ) {
            setSelectedTournamentId(availableTournamentList[0].id)
        }
    }, [availableTournamentList, selectedTournamentId])
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

    const selectedTournament = useMemo(
        () =>
            tournaments.find(
                (tournament) => tournament.id === selectedTournamentId
            ) || null,
        [tournaments, selectedTournamentId]
    )

    const selectedTournamentOwnerId = useMemo(() => {
        if (!selectedTournament) return null
        const rawOwnerId = String(selectedTournament.created_by ?? "").trim()
        if (!rawOwnerId) return null
        const ownerProfile = profiles.find(
            (profile) =>
                profile.user_id === rawOwnerId || profile.id === rawOwnerId
        )
        return ownerProfile?.user_id ?? rawOwnerId
    }, [selectedTournament, profiles])

    const isTournamentOwner = useMemo(() => {
        if (!selectedTournamentOwnerId) return false
        return authIds.some((id) => id === selectedTournamentOwnerId)
    }, [selectedTournamentOwnerId, authIds])

    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- controlled-form reset: clear the score-entry form when the selected tournament changes */
    useEffect(() => {
        setSelectedMatchId(null)
        setScoreEntryMode("winnerOnly")
        setWinnerSelection(null)
        setGameInputs([createGameRow()])
        setDetailedError(null)
    }, [selectedTournamentId])
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

    const selectedTournamentParticipants = useMemo(
        () =>
            selectedTournamentId
                ? participants
                      .filter(
                          (participant) =>
                              participant.tournament_id === selectedTournamentId
                      )
                      .sort((a, b) => a.seed - b.seed)
                : [],
        [participants, selectedTournamentId]
    )

    const selectedTournamentMatches = useMemo(
        () =>
            selectedTournamentId
                ? matches.filter(
                      (match) => match.tournament_id === selectedTournamentId
                  )
                : [],
        [matches, selectedTournamentId]
    )

    const rounds = useMemo(() => {
        const byRound = new Map<number, typeof selectedTournamentMatches>()
        selectedTournamentMatches.forEach((match) => {
            const current = byRound.get(match.round_number) ?? []
            current.push(match)
            byRound.set(match.round_number, current)
        })

        return Array.from(byRound.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([roundNumber, roundMatches]) => ({
                roundNumber,
                matches: roundMatches.sort(
                    (a, b) => a.match_index - b.match_index
                ),
            }))
    }, [selectedTournamentMatches])

    const selectedMatch = useMemo(() => {
        if (!selectedMatchId) return null
        return (
            selectedTournamentMatches.find(
                (match) => match.id === selectedMatchId
            ) || null
        )
    }, [selectedMatchId, selectedTournamentMatches])

    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- controlled-form reset: hydrate the score-entry form from the selected match */
    useEffect(() => {
        if (!selectedMatch) {
            setScoreEntryMode("winnerOnly")
            setWinnerSelection(null)
            setGameInputs([createGameRow()])
            setDetailedError(null)
            return
        }

        if (
            selectedMatch.score_details &&
            selectedMatch.score_details.length > 0
        ) {
            const ordered = [...selectedMatch.score_details].sort(
                (a, b) => a.game_number - b.game_number
            )
            setScoreEntryMode("detailed")
            setGameInputs(
                ordered.map((detail) =>
                    createGameRow(
                        String(detail.player1_points ?? 0),
                        String(detail.player2_points ?? 0)
                    )
                )
            )
        } else {
            setScoreEntryMode("winnerOnly")
            setGameInputs([createGameRow()])
        }

        setWinnerSelection(
            selectedMatch.winner_id ?? selectedMatch.player1_id ?? null
        )
        setDetailedError(null)
    }, [selectedMatch])
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

    const getProfileName = (userId: string | null) => {
        if (!userId) return "À déterminer"
        const trimmedId = userId.trim()
        const profile = profiles.find(
            (candidate) =>
                candidate.user_id === trimmedId || candidate.id === trimmedId
        )
        return profile?.full_name ?? "Utilisateur inconnu"
    }

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
        } else {
            setSortKey(key)
            setSortDirection("desc")
        }
        setLeaderboardPage(0)
    }

    const togglePlayerSelection = (playerId: string | null | undefined) => {
        if (!playerId) return
        setSelectedPlayerIds((prev) =>
            prev.includes(playerId)
                ? prev.filter((id) => id !== playerId)
                : [...prev, playerId]
        )
    }

    const handleGameValueChange = (
        index: number,
        field: "player1" | "player2",
        value: string
    ) => {
        setGameInputs((prev) =>
            prev.map((entry, idx) =>
                idx === index ? { ...entry, [field]: value } : entry
            )
        )
        setDetailedError(null)
    }

    const addGameRow = () => {
        setGameInputs((prev) => [...prev, createGameRow()])
        setDetailedError(null)
    }

    const removeGameRow = (index: number) => {
        setGameInputs((prev) => {
            if (prev.length <= 1) {
                return prev
            }
            return prev.filter((_, idx) => idx !== index)
        })
        setDetailedError(null)
    }

    const handleCreateTournament = async () => {
        if (!tournamentName.trim()) {
            toast.error("Le nom du tournoi est requis")
            return
        }

        if (selectedPlayerIds.length < 2) {
            toast.error("Sélectionnez au moins deux joueurs")
            return
        }

        if (!isPowerOfTwo(selectedPlayerIds.length)) {
            toast.error(
                "Le nombre de joueurs doit être une puissance de 2 (2, 4, 8, ...)"
            )
            return
        }

        setCreateTournamentLoading(true)
        const result = await createTournament({
            name: tournamentName.trim(),
            description: tournamentDescription.trim() || undefined,
            pointsPerGame,
            gamesPerSet,
            setsToWin,
            playerIds: selectedPlayerIds,
        })

        setCreateTournamentLoading(false)

        if (result.success) {
            setIsCreateTournamentOpen(false)
            setTournamentName("")
            setTournamentDescription("")
            setPointsPerGame(11)
            setGamesPerSet(3)
            setSetsToWin(2)
            setSelectedPlayerIds([])
        }
    }

    const handleUpdateMatch = async () => {
        if (!selectedMatch || !selectedTournament) return

        if (scoreEntryMode === "winnerOnly") {
            if (!winnerSelection) {
                toast.error("Sélectionnez un vainqueur")
                return
            }

            const result = await updateMatchResult(selectedMatch.id, {
                mode: "winnerOnly",
                winnerId: winnerSelection,
            })

            if (!result.success) {
                toast.error(
                    result.error ?? "Impossible de mettre à jour le match"
                )
                return
            }
        } else {
            const sanitizedGames = [] as { player1: number; player2: number }[]

            for (const entry of gameInputs) {
                const trimmedPlayer1 = entry.player1.trim()
                const trimmedPlayer2 = entry.player2.trim()

                if (!trimmedPlayer1 && !trimmedPlayer2) {
                    continue
                }

                if (!trimmedPlayer1 || !trimmedPlayer2) {
                    setDetailedError(
                        "Complétez les deux scores pour chaque jeu"
                    )
                    toast.error("Complétez les deux scores pour chaque jeu")
                    return
                }

                const player1Score = Number(trimmedPlayer1)
                const player2Score = Number(trimmedPlayer2)

                if (Number.isNaN(player1Score) || Number.isNaN(player2Score)) {
                    setDetailedError("Les scores doivent être des nombres")
                    toast.error("Les scores doivent être des nombres")
                    return
                }

                sanitizedGames.push({
                    player1: player1Score,
                    player2: player2Score,
                })
            }

            if (!sanitizedGames.length) {
                setDetailedError(
                    "Ajoutez au moins un jeu pour enregistrer le score"
                )
                toast.error("Ajoutez au moins un jeu pour enregistrer le score")
                return
            }

            setDetailedError(null)

            const result = await updateMatchResult(selectedMatch.id, {
                mode: "detailed",
                games: sanitizedGames,
            })

            if (!result.success) {
                toast.error(
                    result.error ?? "Impossible de mettre à jour le match"
                )
                return
            }
        }

        await refetchPingPong()
        setSelectedMatchId(selectedMatch.id)
        toast.success("Match mis à jour")
    }

    const handleDeleteTournament = async () => {
        if (!selectedTournament) return
        const confirmDelete = window.confirm(
            `Supprimer définitivement le tournoi "${selectedTournament.name}" ?`
        )
        if (!confirmDelete) return

        setDeleteLoading(true)
        const result = await deleteTournament(selectedTournament.id)
        setDeleteLoading(false)

        if (result.success) {
            setSelectedTournamentId(null)
            setSelectedMatchId(null)
            await refetchPingPong()
        } else if (result.error) {
            toast.error(result.error)
        }
    }

    const groupedScoreDetails = useMemo(() => {
        if (!selectedMatch?.score_details?.length)
            return [] as {
                setNumber: number
                games: AnnotatedGameScore[]
            }[]

        const formatted = formatScoreDetails(selectedMatch.score_details)
        const groups = new Map<number, AnnotatedGameScore[]>()

        formatted.forEach((game) => {
            const collection = groups.get(game.setNumber) ?? []
            collection.push(game)
            groups.set(game.setNumber, collection)
        })

        return Array.from(groups.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([setNumber, games]) => ({
                setNumber,
                games: games.sort((a, b) => a.gameNumber - b.gameNumber),
            }))
    }, [selectedMatch?.score_details])

    const detailedPreview = useMemo(() => {
        if (scoreEntryMode !== "detailed" || !selectedTournament) return null

        const sanitized: { player1: number; player2: number }[] = []

        for (const entry of gameInputs) {
            const trimmedPlayer1 = entry.player1.trim()
            const trimmedPlayer2 = entry.player2.trim()

            if (!trimmedPlayer1 && !trimmedPlayer2) {
                continue
            }

            if (!trimmedPlayer1 || !trimmedPlayer2) {
                return null
            }

            const player1Score = Number(trimmedPlayer1)
            const player2Score = Number(trimmedPlayer2)

            if (Number.isNaN(player1Score) || Number.isNaN(player2Score)) {
                return null
            }

            sanitized.push({ player1: player1Score, player2: player2Score })
        }

        if (!sanitized.length) {
            return null
        }

        try {
            const evaluation = evaluateDetailedMatch(sanitized, {
                pointsPerGame: selectedTournament.points_per_game,
                gamesPerSet: selectedTournament.games_per_set,
                setsToWin: selectedTournament.sets_to_win,
            })

            return { data: evaluation } as const
        } catch (error) {
            return { error: (error as Error).message } as const
        }
    }, [scoreEntryMode, gameInputs, selectedTournament])

    const selectedMatchWinnerName = useMemo(() => {
        if (!selectedMatch?.winner_id) return null
        return getProfileName(selectedMatch.winner_id)
    }, [selectedMatch?.winner_id, profiles])

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Chargement des données ping pong...
                </p>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col">
            <main className="flex-1 p-6 space-y-6">
                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-semibold">
                                Classement des joueurs
                            </h2>
                            <div className="flex justify-end">
                                <PageHelpBubble
                                    title="Classement"
                                    description="Vous pouvez ici consulter le classement des joueurs."
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {sortedLeaderboard.length} joueurs classés
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={leaderboardPage === 0}
                                    onClick={() =>
                                        setLeaderboardPage((prev) =>
                                            Math.max(0, prev - 1)
                                        )
                                    }
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    {leaderboardPage + 1} /{" "}
                                    {totalLeaderboardPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={
                                        leaderboardPage >=
                                        totalLeaderboardPages - 1
                                    }
                                    onClick={() =>
                                        setLeaderboardPage((prev) =>
                                            Math.min(
                                                totalLeaderboardPages - 1,
                                                prev + 1
                                            )
                                        )
                                    }
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <Card className="shadow-surface">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12 text-muted-foreground">
                                            #
                                        </TableHead>
                                        <TableHead
                                            className="cursor-pointer"
                                            onClick={() => toggleSort("name")}
                                        >
                                            Joueur
                                        </TableHead>
                                        <TableHead
                                            className="cursor-pointer text-right"
                                            onClick={() =>
                                                toggleSort("matches")
                                            }
                                        >
                                            Matchs
                                        </TableHead>
                                        <TableHead
                                            className="cursor-pointer text-right"
                                            onClick={() => toggleSort("wins")}
                                        >
                                            Victoires
                                        </TableHead>
                                        <TableHead
                                            className="cursor-pointer text-right"
                                            onClick={() => toggleSort("losses")}
                                        >
                                            Défaites
                                        </TableHead>
                                        <TableHead
                                            className="cursor-pointer text-right"
                                            onClick={() => toggleSort("elo")}
                                        >
                                            ELO
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedLeaderboard.map(
                                        (player, index) => (
                                            <TableRow key={player.id}>
                                                <TableCell className="font-mono text-sm text-muted-foreground">
                                                    {leaderboardPage *
                                                        PAGE_SIZE +
                                                        index +
                                                        1}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Medal className="w-4 h-4 text-muted-foreground" />
                                                        {player.full_name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {player.matchesPlayed}
                                                </TableCell>
                                                <TableCell className="text-right text-green-600">
                                                    {player.wins}
                                                </TableCell>
                                                <TableCell className="text-right text-destructive">
                                                    {player.losses}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {player.elo_rating}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    )}
                                </TableBody>
                            </Table>
                            {/* Hors du <Table> : dans son wrapper overflow-auto, une
                                cellule colSpan text-center se centre sur la largeur
                                totale du tableau (6 colonnes), pas sur la zone
                                visible — donc décalée sur mobile. */}
                            {paginatedLeaderboard.length === 0 && (
                                <EmptyState
                                    size="sm"
                                    icon={Users}
                                    title="Aucun joueur classé"
                                    description="Le classement se remplit au premier match joué."
                                />
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Shuffle className="w-5 h-5 text-primary" />
                            <h2 className="text-xl font-semibold">Tournois</h2>
                        </div>
                        <Dialog
                            open={isCreateTournamentOpen}
                            onOpenChange={setIsCreateTournamentOpen}
                        >
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Créer un tournoi
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle>
                                        Créer un nouveau tournoi
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="tournament-name">
                                                Nom
                                            </Label>
                                            <Input
                                                id="tournament-name"
                                                value={tournamentName}
                                                onChange={(event) =>
                                                    setTournamentName(
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="Tournoi interne"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="tournament-points">
                                                Points par jeu
                                            </Label>
                                            <Input
                                                id="tournament-points"
                                                type="number"
                                                min={1}
                                                value={pointsPerGame}
                                                onChange={(event) =>
                                                    setPointsPerGame(
                                                        Number(
                                                            event.target.value
                                                        )
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="tournament-games">
                                                Jeux par set
                                            </Label>
                                            <Input
                                                id="tournament-games"
                                                type="number"
                                                min={1}
                                                value={gamesPerSet}
                                                onChange={(event) =>
                                                    setGamesPerSet(
                                                        Number(
                                                            event.target.value
                                                        )
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="tournament-sets">
                                                Sets pour gagner
                                            </Label>
                                            <Input
                                                id="tournament-sets"
                                                type="number"
                                                min={1}
                                                value={setsToWin}
                                                onChange={(event) =>
                                                    setSetsToWin(
                                                        Number(
                                                            event.target.value
                                                        )
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="tournament-description">
                                            Description
                                        </Label>
                                        <Textarea
                                            id="tournament-description"
                                            value={tournamentDescription}
                                            onChange={(event) =>
                                                setTournamentDescription(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Décrivez le contexte du tournoi"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>
                                            Joueurs ({selectedPlayerIds.length})
                                        </Label>
                                        <ScrollArea className="h-48 rounded-md border p-3">
                                            <div className="space-y-2">
                                                {selectableProfiles.length ===
                                                0 ? (
                                                    <p className="text-sm text-muted-foreground">
                                                        Aucun profil disponible
                                                        pour le moment.
                                                    </p>
                                                ) : (
                                                    selectableProfiles.map(
                                                        (profile) => {
                                                            const ranking =
                                                                profile.user_id
                                                                    ? pingPongPlayerMap.get(
                                                                          profile.user_id
                                                                      )
                                                                    : null
                                                            return (
                                                                <label
                                                                    key={
                                                                        profile.user_id
                                                                    }
                                                                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                                                                >
                                                                    <span className="flex flex-col">
                                                                        <span className="font-medium">
                                                                            {profile.full_name ??
                                                                                "Utilisateur inconnu"}
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {ranking
                                                                                ? `ELO ${ranking.elo_rating}`
                                                                                : "Pas encore classé"}
                                                                        </span>
                                                                    </span>
                                                                    <Checkbox
                                                                        checked={selectedPlayerIds.includes(
                                                                            profile.user_id
                                                                        )}
                                                                        onCheckedChange={() =>
                                                                            togglePlayerSelection(
                                                                                profile.user_id
                                                                            )
                                                                        }
                                                                    />
                                                                </label>
                                                            )
                                                        }
                                                    )
                                                )}
                                            </div>
                                        </ScrollArea>
                                        <p className="text-xs text-muted-foreground">
                                            Le nombre de joueurs doit être une
                                            puissance de 2 (2, 4, 8, 16 ...).
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                setIsCreateTournamentOpen(false)
                                            }
                                            disabled={createTournamentLoading}
                                        >
                                            Annuler
                                        </Button>
                                        <Button
                                            onClick={handleCreateTournament}
                                            disabled={createTournamentLoading}
                                        >
                                            {createTournamentLoading
                                                ? "Création..."
                                                : "Créer"}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Card className="shadow-surface">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-semibold">
                                Gestion des tournois
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Tabs
                                value={activeTab}
                                onValueChange={(value) =>
                                    setActiveTab(value as typeof activeTab)
                                }
                            >
                                <TabsList indicator>
                                    <TabsTrigger value="active">
                                        Tournois en cours
                                    </TabsTrigger>
                                    <TabsTrigger value="completed">
                                        Tournois terminés
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="active">
                                    <TournamentLayout
                                        tournaments={activeTournaments}
                                        selectedTournamentId={
                                            selectedTournamentId
                                        }
                                        onSelectTournament={
                                            setSelectedTournamentId
                                        }
                                    />
                                </TabsContent>
                                <TabsContent value="completed">
                                    <TournamentLayout
                                        tournaments={completedTournaments}
                                        selectedTournamentId={
                                            selectedTournamentId
                                        }
                                        onSelectTournament={
                                            setSelectedTournamentId
                                        }
                                    />
                                </TabsContent>
                            </Tabs>

                            {selectedTournament ? (
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                    <div className="space-y-4">
                                        <Card className="h-full">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base font-semibold">
                                                    Informations
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-3 text-sm">
                                                <div>
                                                    <p className="text-muted-foreground">
                                                        Créateur
                                                    </p>
                                                    <p className="font-medium">
                                                        {getProfileName(
                                                            selectedTournament.created_by
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <Card className="bg-muted/40">
                                                        <CardContent className="p-3 text-center">
                                                            <p className="text-xs text-muted-foreground">
                                                                Points / jeu
                                                            </p>
                                                            <p className="text-lg font-semibold">
                                                                {
                                                                    selectedTournament.points_per_game
                                                                }
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card className="bg-muted/40">
                                                        <CardContent className="p-3 text-center">
                                                            <p className="text-xs text-muted-foreground">
                                                                Jeux / set
                                                            </p>
                                                            <p className="text-lg font-semibold">
                                                                {
                                                                    selectedTournament.games_per_set
                                                                }
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                    <Card className="bg-muted/40">
                                                        <CardContent className="p-3 text-center">
                                                            <p className="text-xs text-muted-foreground">
                                                                Sets pour gagner
                                                            </p>
                                                            <p className="text-lg font-semibold">
                                                                {
                                                                    selectedTournament.sets_to_win
                                                                }
                                                            </p>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                                {selectedTournament.description && (
                                                    <div>
                                                        <p className="text-muted-foreground">
                                                            Description
                                                        </p>
                                                        <p>
                                                            {
                                                                selectedTournament.description
                                                            }
                                                        </p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-muted-foreground mb-2 flex items-center gap-2">
                                                        <Users className="w-4 h-4" />{" "}
                                                        Participants
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedTournamentParticipants.length ===
                                                        0 ? (
                                                            <Badge variant="outline">
                                                                Aucun
                                                                participant
                                                            </Badge>
                                                        ) : (
                                                            selectedTournamentParticipants.map(
                                                                (
                                                                    participant
                                                                ) => {
                                                                    const name =
                                                                        getProfileName(
                                                                            participant.player_id
                                                                        )
                                                                    return (
                                                                        <Badge
                                                                            key={
                                                                                participant.id
                                                                            }
                                                                            variant="secondary"
                                                                        >
                                                                            #
                                                                            {
                                                                                participant.seed
                                                                            }{" "}
                                                                            {
                                                                                name
                                                                            }
                                                                        </Badge>
                                                                    )
                                                                }
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                {isTournamentOwner && (
                                                    <div className="pt-2">
                                                        <Button
                                                            variant="destructive"
                                                            className="w-full"
                                                            onClick={
                                                                handleDeleteTournament
                                                            }
                                                            disabled={
                                                                deleteLoading
                                                            }
                                                        >
                                                            {deleteLoading
                                                                ? "Suppression..."
                                                                : "Supprimer le tournoi"}
                                                        </Button>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="xl:col-span-2 space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Timer className="w-4 h-4 text-muted-foreground" />
                                            <h3 className="font-semibold">
                                                Arbre du tournoi
                                            </h3>
                                        </div>
                                        {rounds.length === 0 ? (
                                            <Card>
                                                <EmptyState
                                                    size="sm"
                                                    icon={Timer}
                                                    title="Aucun match"
                                                    description="L'arbre apparaîtra une fois le tournoi lancé."
                                                />
                                            </Card>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <div className="flex items-start gap-4 min-w-full">
                                                    {rounds.map((round) => (
                                                        <div
                                                            key={
                                                                round.roundNumber
                                                            }
                                                            className="min-w-[220px] space-y-3"
                                                        >
                                                            <h4 className="text-sm font-semibold text-muted-foreground">
                                                                Manche{" "}
                                                                {
                                                                    round.roundNumber
                                                                }
                                                            </h4>
                                                            {round.matches.map(
                                                                (match) => {
                                                                    const isSelected =
                                                                        selectedMatchId ===
                                                                        match.id
                                                                    return (
                                                                        <Card
                                                                            key={
                                                                                match.id
                                                                            }
                                                                            variant="interactive"
                                                                            className={
                                                                                isSelected
                                                                                    ? "border-primary"
                                                                                    : "hover:border-primary/40"
                                                                            }
                                                                            onClick={() =>
                                                                                setSelectedMatchId(
                                                                                    match.id
                                                                                )
                                                                            }
                                                                        >
                                                                            <CardContent className="p-4 space-y-2">
                                                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                                                    <span>
                                                                                        Match
                                                                                        #
                                                                                        {match.match_index +
                                                                                            1}
                                                                                    </span>
                                                                                    <Badge
                                                                                        variant={
                                                                                            match.status ===
                                                                                            "completed"
                                                                                                ? "secondary"
                                                                                                : match.status ===
                                                                                                    "in_progress"
                                                                                                  ? "default"
                                                                                                  : "outline"
                                                                                        }
                                                                                    >
                                                                                        {match.status ===
                                                                                        "completed"
                                                                                            ? "Terminé"
                                                                                            : match.status ===
                                                                                                "in_progress"
                                                                                              ? "En cours"
                                                                                              : "Prévu"}
                                                                                    </Badge>
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <MatchRow
                                                                                        name={getProfileName(
                                                                                            match.player1_id
                                                                                        )}
                                                                                        score={
                                                                                            match.player1_score
                                                                                        }
                                                                                    />
                                                                                    <MatchRow
                                                                                        name={getProfileName(
                                                                                            match.player2_id
                                                                                        )}
                                                                                        score={
                                                                                            match.player2_score
                                                                                        }
                                                                                    />
                                                                                </div>
                                                                            </CardContent>
                                                                        </Card>
                                                                    )
                                                                }
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <Card className="shadow-surface">
                                            <CardHeader className="pb-3">
                                                <CardTitle className="text-base font-semibold">
                                                    Détails du match sélectionné
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {!selectedMatch ? (
                                                    <p className="text-sm text-muted-foreground">
                                                        Sélectionnez un match
                                                        dans l'arbre pour voir
                                                        les détails.
                                                    </p>
                                                ) : (
                                                    <>
                                                        <div className="space-y-2">
                                                            <p className="text-xs text-muted-foreground">
                                                                Joueurs
                                                            </p>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-sm">
                                                                <div className="rounded-md border p-3">
                                                                    <p className="font-medium">
                                                                        {getProfileName(
                                                                            selectedMatch.player1_id
                                                                        )}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Sets
                                                                        gagnés :{" "}
                                                                        {selectedMatch.player1_score ??
                                                                            0}
                                                                    </p>
                                                                </div>
                                                                <div className="rounded-md border p-3">
                                                                    <p className="font-medium">
                                                                        {getProfileName(
                                                                            selectedMatch.player2_id
                                                                        )}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Sets
                                                                        gagnés :{" "}
                                                                        {selectedMatch.player2_score ??
                                                                            0}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {selectedMatch.status ===
                                                            "completed" && (
                                                            <>
                                                                {groupedScoreDetails.length >
                                                                0 ? (
                                                                    <div className="space-y-2">
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Détail
                                                                            des
                                                                            jeux
                                                                        </p>
                                                                        <div className="space-y-2">
                                                                            {groupedScoreDetails.map(
                                                                                (
                                                                                    set
                                                                                ) => (
                                                                                    <div
                                                                                        key={
                                                                                            set.setNumber
                                                                                        }
                                                                                        className="rounded-md border p-3 space-y-2"
                                                                                    >
                                                                                        <p className="text-xs font-semibold">
                                                                                            Set{" "}
                                                                                            {
                                                                                                set.setNumber
                                                                                            }
                                                                                        </p>
                                                                                        <div className="space-y-1 text-xs font-mono">
                                                                                            {set.games.map(
                                                                                                (
                                                                                                    game
                                                                                                ) => (
                                                                                                    <div
                                                                                                        key={
                                                                                                            game.gameNumber
                                                                                                        }
                                                                                                        className="flex items-center justify-between"
                                                                                                    >
                                                                                                        <span>
                                                                                                            Jeu{" "}
                                                                                                            {
                                                                                                                game.gameNumber
                                                                                                            }
                                                                                                        </span>
                                                                                                        <span>
                                                                                                            {
                                                                                                                game.player1Points
                                                                                                            }{" "}
                                                                                                            -{" "}
                                                                                                            {
                                                                                                                game.player2Points
                                                                                                            }
                                                                                                        </span>
                                                                                                    </div>
                                                                                                )
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    selectedMatchWinnerName && (
                                                                        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                                                            Résultat
                                                                            enregistré
                                                                            :{" "}
                                                                            {
                                                                                selectedMatchWinnerName
                                                                            }{" "}
                                                                            vainqueur
                                                                            (score
                                                                            détaillé
                                                                            non
                                                                            saisi).
                                                                        </div>
                                                                    )
                                                                )}
                                                            </>
                                                        )}

                                                        {isTournamentOwner ? (
                                                            <div className="space-y-3">
                                                                <div className="space-y-2">
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Mode de
                                                                        saisie
                                                                    </p>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <Button
                                                                            variant={
                                                                                scoreEntryMode ===
                                                                                "winnerOnly"
                                                                                    ? "default"
                                                                                    : "outline"
                                                                            }
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setScoreEntryMode(
                                                                                    "winnerOnly"
                                                                                )
                                                                                setDetailedError(
                                                                                    null
                                                                                )
                                                                            }}
                                                                        >
                                                                            Vainqueur
                                                                            seul
                                                                        </Button>
                                                                        <Button
                                                                            variant={
                                                                                scoreEntryMode ===
                                                                                "detailed"
                                                                                    ? "default"
                                                                                    : "outline"
                                                                            }
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setScoreEntryMode(
                                                                                    "detailed"
                                                                                )
                                                                                setDetailedError(
                                                                                    null
                                                                                )
                                                                            }}
                                                                        >
                                                                            Score
                                                                            détaillé
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {scoreEntryMode ===
                                                                "winnerOnly" ? (
                                                                    <div className="space-y-2">
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Sélectionnez
                                                                            le
                                                                            vainqueur
                                                                        </p>
                                                                        <RadioGroup
                                                                            value={
                                                                                winnerSelection ??
                                                                                ""
                                                                            }
                                                                            onValueChange={(
                                                                                value
                                                                            ) =>
                                                                                setWinnerSelection(
                                                                                    value ||
                                                                                        null
                                                                                )
                                                                            }
                                                                        >
                                                                            {[
                                                                                selectedMatch.player1_id,
                                                                                selectedMatch.player2_id,
                                                                            ]
                                                                                .filter(
                                                                                    (
                                                                                        playerId
                                                                                    ): playerId is string =>
                                                                                        Boolean(
                                                                                            playerId
                                                                                        )
                                                                                )
                                                                                .map(
                                                                                    (
                                                                                        playerId
                                                                                    ) => (
                                                                                        <label
                                                                                            key={
                                                                                                playerId
                                                                                            }
                                                                                            htmlFor={`winner-${playerId}`}
                                                                                            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                                                                                        >
                                                                                            <span className="font-medium">
                                                                                                {getProfileName(
                                                                                                    playerId
                                                                                                )}
                                                                                            </span>
                                                                                            <RadioGroupItem
                                                                                                id={`winner-${playerId}`}
                                                                                                value={
                                                                                                    playerId
                                                                                                }
                                                                                            />
                                                                                        </label>
                                                                                    )
                                                                                )}
                                                                        </RadioGroup>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        <div className="space-y-2">
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Renseignez
                                                                                les
                                                                                jeux
                                                                                (points
                                                                                à{" "}
                                                                                {
                                                                                    selectedTournament.points_per_game
                                                                                }

                                                                                )
                                                                            </p>
                                                                            <div className="space-y-2">
                                                                                {gameInputs.map(
                                                                                    (
                                                                                        game,
                                                                                        index
                                                                                    ) => (
                                                                                        <div
                                                                                            key={
                                                                                                game.id
                                                                                            }
                                                                                            className="flex items-start gap-2"
                                                                                        >
                                                                                            <div className="grid grid-cols-2 gap-2 flex-1">
                                                                                                <div className="space-y-1">
                                                                                                    <Label className="text-xs">
                                                                                                        {getProfileName(
                                                                                                            selectedMatch.player1_id
                                                                                                        )}
                                                                                                    </Label>
                                                                                                    <Input
                                                                                                        inputMode="numeric"
                                                                                                        value={
                                                                                                            game.player1
                                                                                                        }
                                                                                                        onChange={(
                                                                                                            event
                                                                                                        ) =>
                                                                                                            handleGameValueChange(
                                                                                                                index,
                                                                                                                "player1",
                                                                                                                event
                                                                                                                    .target
                                                                                                                    .value
                                                                                                            )
                                                                                                        }
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="space-y-1">
                                                                                                    <Label className="text-xs">
                                                                                                        {getProfileName(
                                                                                                            selectedMatch.player2_id
                                                                                                        )}
                                                                                                    </Label>
                                                                                                    <Input
                                                                                                        inputMode="numeric"
                                                                                                        value={
                                                                                                            game.player2
                                                                                                        }
                                                                                                        onChange={(
                                                                                                            event
                                                                                                        ) =>
                                                                                                            handleGameValueChange(
                                                                                                                index,
                                                                                                                "player2",
                                                                                                                event
                                                                                                                    .target
                                                                                                                    .value
                                                                                                            )
                                                                                                        }
                                                                                                    />
                                                                                                </div>
                                                                                            </div>
                                                                                            {gameInputs.length >
                                                                                                1 && (
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    size="icon"
                                                                                                    onClick={() =>
                                                                                                        removeGameRow(
                                                                                                            index
                                                                                                        )
                                                                                                    }
                                                                                                    aria-label="Supprimer le jeu"
                                                                                                >
                                                                                                    <Trash2 className="w-4 h-4" />
                                                                                                </Button>
                                                                                            )}
                                                                                        </div>
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                                                                <span>
                                                                                    {
                                                                                        selectedTournament.games_per_set
                                                                                    }{" "}
                                                                                    jeu(x)
                                                                                    par
                                                                                    set
                                                                                    —{" "}
                                                                                    {
                                                                                        selectedTournament.sets_to_win
                                                                                    }{" "}
                                                                                    set(s)
                                                                                    pour
                                                                                    gagner
                                                                                </span>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={
                                                                                        addGameRow
                                                                                    }
                                                                                >
                                                                                    Ajouter
                                                                                    un
                                                                                    jeu
                                                                                </Button>
                                                                            </div>
                                                                        </div>

                                                                        {detailedPreview?.data && (
                                                                            <div className="rounded-md border p-3 text-xs space-y-1">
                                                                                <p className="font-semibold text-sm">
                                                                                    Aperçu
                                                                                </p>
                                                                                <p>
                                                                                    Sets
                                                                                    :{" "}
                                                                                    {
                                                                                        detailedPreview
                                                                                            .data
                                                                                            .setsWon
                                                                                            .player1
                                                                                    }{" "}
                                                                                    -{" "}
                                                                                    {
                                                                                        detailedPreview
                                                                                            .data
                                                                                            .setsWon
                                                                                            .player2
                                                                                    }
                                                                                </p>
                                                                                <p>
                                                                                    Vainqueur
                                                                                    provisoire
                                                                                    :{" "}
                                                                                    {detailedPreview
                                                                                        .data
                                                                                        .winner ===
                                                                                    "player1"
                                                                                        ? getProfileName(
                                                                                              selectedMatch.player1_id
                                                                                          )
                                                                                        : getProfileName(
                                                                                              selectedMatch.player2_id
                                                                                          )}
                                                                                </p>
                                                                            </div>
                                                                        )}

                                                                        {detailedPreview?.error && (
                                                                            <p className="text-xs text-destructive">
                                                                                {
                                                                                    detailedPreview.error
                                                                                }
                                                                            </p>
                                                                        )}

                                                                        {detailedError && (
                                                                            <p className="text-xs text-destructive">
                                                                                {
                                                                                    detailedError
                                                                                }
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                <Button
                                                                    className="w-full"
                                                                    onClick={
                                                                        handleUpdateMatch
                                                                    }
                                                                    disabled={
                                                                        !selectedMatch.player1_id ||
                                                                        !selectedMatch.player2_id
                                                                    }
                                                                >
                                                                    Enregistrer
                                                                    le résultat
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground">
                                                                Seul le créateur
                                                                du tournoi peut
                                                                modifier les
                                                                scores.
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            ) : (
                                <Card>
                                    <EmptyState
                                        size="sm"
                                        icon={Shuffle}
                                        title="Aucun tournoi sélectionné"
                                        description="Choisissez un tournoi dans la liste."
                                    />
                                </Card>
                            )}
                        </CardContent>
                    </Card>
                </section>
            </main>
        </div>
    )
}

interface TournamentLayoutProps {
    tournaments: PingPongTournament[]
    selectedTournamentId: string | null
    onSelectTournament: (id: string) => void
}

function TournamentLayout({
    tournaments,
    selectedTournamentId,
    onSelectTournament,
}: TournamentLayoutProps) {
    if (!tournaments.length) {
        return (
            <Card className="mt-4">
                <EmptyState
                    size="sm"
                    icon={Shuffle}
                    title="Aucun tournoi"
                    description="Cette catégorie ne contient aucun tournoi."
                />
            </Card>
        )
    }

    return (
        <ScrollArea className="mt-4 max-h-60 rounded-md border">
            <div className="divide-y">
                {tournaments.map((tournament) => (
                    <button
                        key={tournament.id}
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                            selectedTournamentId === tournament.id
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted"
                        }`}
                        onClick={() => onSelectTournament(tournament.id)}
                    >
                        <span className="font-medium">{tournament.name}</span>
                        <Badge
                            variant={
                                tournament.status === "completed"
                                    ? "secondary"
                                    : "outline"
                            }
                        >
                            {tournament.status === "completed"
                                ? "Terminé"
                                : "En cours"}
                        </Badge>
                    </button>
                ))}
            </div>
        </ScrollArea>
    )
}

interface MatchRowProps {
    name: string
    score: number | null
}

function MatchRow({ name, score }: MatchRowProps) {
    return (
        <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{name}</span>
            <span className="font-mono text-xs text-muted-foreground">
                {typeof score === "number" ? score : "-"}
            </span>
        </div>
    )
}
