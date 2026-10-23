/**
 * Défis quotidiens ("cartes Chance" du jour) — sélection déterministe.
 *
 * Deux défis sont tirés chaque jour depuis un hash de la date : tous les
 * setters voient les mêmes défis, et le tirage est rejouable (pas de random).
 * La complétion est évaluée par le moteur sur les événements du jour.
 */
import type { ChallengeDef, TourneeEventRow } from "../types"
import { fnv1a } from "./engine"

const isRdv = (e: TourneeEventRow) =>
    (e.nom ?? "").trim().toLowerCase().startsWith("rdv")

const isAppel = (e: TourneeEventRow) =>
    (e.nom ?? "").trim().toLowerCase() === "appel"

export const CHALLENGE_DEFS: ChallengeDef[] = [
    {
        id: "poseur",
        label: "Poseur de RDV",
        description: "Créer au moins 2 RDV aujourd'hui",
        bonus: 150,
        test: (events) => events.filter(isRdv).length >= 2,
    },
    {
        id: "machine-appels",
        label: "Machine à appels",
        description: "Passer au moins 5 appels aujourd'hui",
        bonus: 100,
        test: (events) => events.filter(isAppel).length >= 5,
    },
    {
        id: "sans-accroc",
        label: "Sans accroc",
        description: "Au moins 1 show et aucun no-show aujourd'hui",
        bonus: 120,
        test: (events) =>
            events.some((e) => isRdv(e) && e.show === true) &&
            !events.some((e) => isRdv(e) && e.show === false),
    },
    {
        id: "decouvreur",
        label: "Découvreur",
        description: "Poser au moins 1 RDV découverte aujourd'hui",
        bonus: 80,
        test: (events) =>
            events.some((e) =>
                (e.nom ?? "").toLowerCase().includes("decouverte")
            ),
    },
    {
        id: "leve-tot",
        label: "Lève-tôt",
        description: "Créer un événement avant 10h",
        bonus: 60,
        test: (events) =>
            events.some(
                (e) =>
                    e.created_at &&
                    new Date(e.created_at).getHours() < 10
            ),
    },
    {
        id: "marathonien",
        label: "Marathonien",
        description: "Au moins 6 actions CRM dans la journée",
        bonus: 130,
        test: (events) => events.length >= 6,
    },
]

/** Les 2 défis du jour, tirés du hash de la date (clé "YYYY-MM-DD"). */
export function dailyChallenges(dateKey: string): ChallengeDef[] {
    const h = fnv1a(dateKey)
    const first = h % CHALLENGE_DEFS.length
    // Décalage 1..n-1 pour garantir deux défis distincts.
    // >>> (non signé) : h >> 8 signé pouvait donner un offset négatif,
    // donc un index de défi hors tableau.
    const second =
        (first + 1 + (((h >>> 8) % (CHALLENGE_DEFS.length - 1)))) %
        CHALLENGE_DEFS.length
    return [CHALLENGE_DEFS[first], CHALLENGE_DEFS[second]]
}
