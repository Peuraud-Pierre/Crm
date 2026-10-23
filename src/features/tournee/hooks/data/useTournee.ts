/**
 * Hook de données de la feature Tournée : charge les événements CRM du mois
 * courant + les profils des setters, puis délègue au moteur pur (engine.ts)
 * la construction de l'état du plateau.
 *
 * Temps réel : tout INSERT/UPDATE/DELETE sur Event_calendar recharge le
 * plateau (débouncé 500 ms, même pattern que useBalle) — un RDV posé par un
 * collègue fait avancer son pion en live chez tout le monde.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    fetchTourneeEvents,
    fetchTourneeProfiles,
    subscribeToTourneeEvents,
} from "../../services/tourneeService"
import { buildGame } from "../../utils/engine"
import { dailyChallenges } from "../../utils/challenges"
import type { TourneeEventRow, TourneeGame, TourneeProfile } from "../../types"

interface UseTourneeResult {
    game: TourneeGame | null
    loading: boolean
    error: string | null
    refresh: () => void
}

/** Bornes ISO du mois courant + libellé français ("juillet 2026"). */
function currentMonthRange() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const label = new Intl.DateTimeFormat("fr-FR", {
        month: "long",
        year: "numeric",
    }).format(now)
    // Clé locale YYYY-MM-DD : tirage des défis du jour.
    const dayKey = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("-")
    return { start: start.toISOString(), end: end.toISOString(), label, dayKey }
}

export function useTournee(): UseTourneeResult {
    const [events, setEvents] = useState<TourneeEventRow[]>([])
    const [profiles, setProfiles] = useState<TourneeProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)
    // Stale-while-revalidate : le skeleton ne s'affiche qu'au PREMIER
    // chargement. Les refetchs suivants (Realtime, polling) se font en
    // arrière-plan sans repasser `loading` à true — sinon le plateau 3D
    // serait démonté/remonté à chaque coup et l'animation des dés
    // (déclenchée par la comparaison avec le coup précédent) ne jouerait
    // jamais.
    const hasLoadedRef = useRef(false)

    const { start, end, label, dayKey } = useMemo(currentMonthRange, [])

    useEffect(() => {
        let cancelled = false
        const initial = !hasLoadedRef.current
        if (initial) {
            // Rechargement initial relancé après un échec (refresh via reloadKey) :
            // on repasse explicitement en skeleton + on efface l'erreur avant le
            // refetch. Pas dérivable — dépend de hasLoadedRef (cycle de vie).
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- réarmement du premier chargement avant fetch async
            setLoading(true)
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- réarmement du premier chargement avant fetch async
            setError(null)
        }

        fetchTourneeEvents(start, end)
            .then(async (rows) => {
                const playerIds = [
                    ...new Set(
                        rows
                            .map((r) => r.creator_id)
                            .filter((id): id is string => !!id)
                    ),
                ]
                const found = await fetchTourneeProfiles(playerIds)
                if (cancelled) return
                hasLoadedRef.current = true
                setEvents(rows)
                setProfiles(found)
                setError(null)
            })
            .catch((err: unknown) => {
                if (cancelled) return
                console.error("Erreur chargement La Tournée:", err)
                // En arrière-plan, on garde le plateau affiché avec les
                // données déjà chargées ; l'écran d'erreur est réservé au
                // premier chargement.
                if (initial) {
                    setError(
                        "Impossible de charger le plateau. Réessaie dans un instant."
                    )
                }
            })
            .finally(() => {
                if (!cancelled && initial) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [start, end, reloadKey])

    const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

    // Live : un événement CRM créé/modifié par n'importe quel setter
    // rafraîchit le plateau après 500 ms de calme. Si l'abonnement Realtime
    // est KO (socket coupé par le proxy, table non publiée…), on bascule
    // automatiquement en polling (30 s, onglet visible uniquement) — et on
    // revient au live si la connexion se rétablit.
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        let pollId: ReturnType<typeof setInterval> | undefined
        // Le canal émet CLOSED lors du désabonnement : sans ce flag, le
        // callback de statut post-démontage recréerait un interval orphelin.
        let disposed = false

        const unsubscribe = subscribeToTourneeEvents(
            () => {
                clearTimeout(timeoutId)
                timeoutId = setTimeout(refresh, 500)
            },
            (healthy) => {
                if (disposed) return
                if (!healthy && pollId === undefined) {
                    pollId = setInterval(() => {
                        if (document.visibilityState === "visible") {
                            refresh()
                        }
                    }, 30_000)
                } else if (healthy && pollId !== undefined) {
                    clearInterval(pollId)
                    pollId = undefined
                }
            }
        )

        return () => {
            disposed = true
            clearTimeout(timeoutId)
            if (pollId !== undefined) clearInterval(pollId)
            unsubscribe()
        }
    }, [refresh])

    const game = useMemo(
        () =>
            loading || error
                ? null
                : buildGame(events, profiles, label, {
                      challenges: dailyChallenges(dayKey),
                      today: new Date(),
                  }),
        [events, profiles, label, dayKey, loading, error]
    )

    return { game, loading, error, refresh }
}
