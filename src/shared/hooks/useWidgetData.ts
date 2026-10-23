import { useEffect, useState, type DependencyList } from "react"

interface WidgetData<T> {
    data: T | null
    /** Vrai tant que la première requête n'a pas abouti — succès ou échec. */
    loading: boolean
    error: Error | null
}

/**
 * Charge la donnée d'un module de dashboard.
 *
 * Les modules répétaient tous le même corps : un `useEffect`, un drapeau
 * `cancelled`, un `loading`, et un `.catch()` qui se contentait de logger.
 * Ce dernier point n'était pas un détail de forme : l'échec n'ayant pas
 * d'état à lui, le module retombait sur son état vide et **annonçait
 * « rien à afficher » pour dire « la requête a échoué »**. C'est ce qui a
 * laissé passer une erreur PostgREST en production sur les arrivages.
 *
 * D'où le troisième état. `error` n'est pas une commodité : c'est la seule
 * façon de distinguer les deux situations à l'écran.
 *
 * Pas de toast pour autant — un module qui échoue ne doit pas interpeller
 * l'utilisateur au chargement de l'accueil, il doit le dire dans son
 * cadre. `WidgetErrorBoundary` ne couvre pas ce cas : il n'attrape que les
 * exceptions de rendu, jamais une promesse rejetée.
 *
 * Une requête relancée (un module redimensionné en demande davantage) ne
 * remet pas la vue en chargement : le résultat précédent reste affiché
 * jusqu'à ce que le nouveau le remplace d'un bloc. Faire clignoter un
 * squelette à chaque poignée tirée serait un recul.
 *
 * @param fetcher Requête à exécuter, ou `null` quand les prérequis ne sont
 *   pas réunis (typiquement l'identifiant utilisateur, pas encore chargé) —
 *   le hook reste alors en chargement sans rien demander.
 * @param deps Dépendances de la requête, comme pour `useEffect`.
 * @param context Préfixe des logs, ex. `"MyTicketsWidget"`.
 */
export function useWidgetData<T>(
    fetcher: (() => Promise<T>) | null,
    deps: DependencyList,
    context: string
): WidgetData<T> {
    const [state, setState] = useState<WidgetData<T>>({
        data: null,
        loading: true,
        error: null,
    })

    useEffect(() => {
        if (!fetcher) return
        let cancelled = false

        fetcher()
            .then((data) => {
                if (!cancelled) setState({ data, loading: false, error: null })
            })
            .catch((err: unknown) => {
                if (cancelled) return
                console.error(`[${context}]`, err)
                setState({
                    data: null,
                    loading: false,
                    error: err instanceof Error ? err : new Error(String(err)),
                })
            })

        return () => {
            cancelled = true
        }
        // `fetcher` est une closure recréée à chaque rendu : la mettre en
        // dépendance relancerait la requête en boucle. Ce sont les `deps`
        // fournies par l'appelant qui décrivent ce dont elle dépend
        // réellement — même contrat que `useEffect`.
    }, deps)

    return state
}
