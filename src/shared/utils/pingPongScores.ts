import { z } from "zod"

export interface GameScore {
    player1: number
    player2: number
}

export type GameWinner = "player1" | "player2"

export interface StoredGameScore {
    game_number: number
    set_number: number
    player1_points: number
    player2_points: number
    winner: GameWinner
}

export interface AnnotatedGameScore {
    gameNumber: number
    setNumber: number
    player1Points: number
    player2Points: number
    winner: GameWinner
}

interface EvaluationRules {
    pointsPerGame: number
    gamesPerSet: number
    setsToWin: number
}

interface EvaluatedMatch {
    games: AnnotatedGameScore[]
    setsWon: {
        player1: number
        player2: number
    }
    winner: GameWinner
}

const scoreSchema = z.object({
    player1: z.number().min(0),
    player2: z.number().min(0),
})

const rulesSchema = z.object({
    pointsPerGame: z.number().min(1),
    gamesPerSet: z.number().min(1),
    setsToWin: z.number().min(1),
})

const differenceToWin = (pointsPerGame: number) => (pointsPerGame >= 11 ? 2 : 1)

export function evaluateDetailedMatch(
    inputScores: GameScore[],
    rawRules: EvaluationRules
): EvaluatedMatch {
    const scores = inputScores.map((score) => scoreSchema.parse(score))
    const rules = rulesSchema.parse(rawRules)

    if (!scores.length) {
        throw new Error("Ajoutez au moins un jeu")
    }

    const gamesToWinSet = Math.floor(rules.gamesPerSet / 2) + 1
    const minDifference = differenceToWin(rules.pointsPerGame)

    let currentSet = 1
    let gamesInCurrentSet = 0
    let player1Games = 0
    let player2Games = 0
    let player1Sets = 0
    let player2Sets = 0

    const annotatedGames: AnnotatedGameScore[] = []

    for (let index = 0; index < scores.length; index += 1) {
        if (player1Sets >= rules.setsToWin || player2Sets >= rules.setsToWin) {
            break
        }

        const score = scores[index]
        const { player1, player2 } = score
        const gameNumber = annotatedGames.length + 1

        if (player1 === player2) {
            throw new Error(
                `Le jeu ${gameNumber} est à égalité. Il faut un vainqueur.`
            )
        }

        const highestScore = Math.max(player1, player2)
        const difference = Math.abs(player1 - player2)

        if (highestScore < rules.pointsPerGame) {
            throw new Error(
                `Le jeu ${gameNumber} doit atteindre au moins ${rules.pointsPerGame} points pour le vainqueur.`
            )
        }

        if (difference < minDifference) {
            throw new Error(
                `Le jeu ${gameNumber} doit être gagné avec ${minDifference} points d'écart.`
            )
        }

        const winner: GameWinner = player1 > player2 ? "player1" : "player2"

        annotatedGames.push({
            gameNumber,
            setNumber: currentSet,
            player1Points: player1,
            player2Points: player2,
            winner,
        })

        if (winner === "player1") {
            player1Games += 1
        } else {
            player2Games += 1
        }

        gamesInCurrentSet += 1

        const reachedGamesForSet =
            player1Games >= gamesToWinSet ||
            player2Games >= gamesToWinSet ||
            gamesInCurrentSet >= rules.gamesPerSet

        if (reachedGamesForSet) {
            if (player1Games === player2Games) {
                throw new Error(
                    `Le set ${currentSet} n'a pas de vainqueur clair.`
                )
            }

            if (player1Games > player2Games) {
                player1Sets += 1
            } else {
                player2Sets += 1
            }

            currentSet += 1
            gamesInCurrentSet = 0
            player1Games = 0
            player2Games = 0
        }
    }

    if (player1Sets < rules.setsToWin && player2Sets < rules.setsToWin) {
        throw new Error(
            `Les scores saisis ne permettent pas de déterminer ${rules.setsToWin} set(s) gagnant(s).`
        )
    }

    const winner: GameWinner = player1Sets > player2Sets ? "player1" : "player2"

    return {
        games: annotatedGames.filter(
            (game) => game.setNumber <= player1Sets + player2Sets
        ),
        setsWon: {
            player1: player1Sets,
            player2: player2Sets,
        },
        winner,
    }
}

export function formatScoreDetails(
    details: StoredGameScore[]
): AnnotatedGameScore[] {
    return details
        .map((detail) => ({
            gameNumber: detail.game_number,
            setNumber: detail.set_number,
            player1Points: detail.player1_points,
            player2Points: detail.player2_points,
            winner: detail.winner,
        }))
        .sort((a, b) => a.gameNumber - b.gameNumber)
}
