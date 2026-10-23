import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import * as service from "@/features/commandes/services/commandeService"
import { referentialErrorMessage, rpcMessage } from "@/features/stock"
import { useDebouncedCallback } from "@/shared/hooks/useDebouncedCallback"
import type {
    AvancementLigne,
    Boutique,
    Carton,
    CommandeBoutique,
    LivraisonBoutique,
    Palette,
} from "@/features/commandes/types/commande.types"

/**
 * Données de la salle de commande : boutiques, commandes, livraisons.
 *
 * Le détail (cartons d'une livraison, avancement d'une commande) n'est pas
 * chargé ici mais à la demande (`useLivraisonDetail`, `useAvancement`), qui
 * se relisent quand `version` change — c'est-à-dire à chaque événement
 * realtime regroupé. La boutique scanne, l'écran de l'entrepôt suit.
 */
export function useCommandes() {
    const [boutiques, setBoutiques] = useState<Boutique[]>([])
    const [commandes, setCommandes] = useState<CommandeBoutique[]>([])
    const [livraisons, setLivraisons] = useState<LivraisonBoutique[]>([])
    const [loading, setLoading] = useState(true)
    const [version, setVersion] = useState(0)

    const load = useCallback(async () => {
        try {
            const [b, c, l] = await Promise.all([
                service.fetchBoutiques(),
                service.fetchCommandes(),
                service.fetchLivraisons(),
            ])
            setBoutiques(b)
            setCommandes(c)
            setLivraisons(l)
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors du chargement de la salle de commande")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const reload = useDebouncedCallback(() => {
        void load()
        setVersion((v) => v + 1)
    })
    useEffect(() => service.subscribeCommandes(reload), [reload])

    /**
     * Exécute une écriture : erreur traduite en toast, rechargement en cas de
     * succès. Rend le résultat, ou `null` en échec — l'appelant garde alors
     * son formulaire ouvert.
     */
    const run = useCallback(async <R,>(entity: string, action: string, fn: () => Promise<R>): Promise<R | null> => {
        try {
            const result = await fn()
            // Rechargement ATTENDU, pas différé : l'appelant navigue souvent
            // vers ce qu'il vient de créer, et la garde des liens profonds
            // prendrait un id encore absent de la liste pour un lien mort.
            await load()
            setVersion((v) => v + 1)
            return result
        } catch (error) {
            console.error(error)
            toast.error(rpcMessage(error) ?? referentialErrorMessage(entity, action, error))
            return null
        }
    }, [load])

    return { boutiques, commandes, livraisons, loading, version, run }
}

/**
 * Lecture à la demande, relue à chaque `version` (événement realtime). Le
 * chargement est dérivé de la clé : une relecture garde l'ancien contenu
 * à l'écran jusqu'à l'arrivée du nouveau, sans clignotement.
 */
function useKeyedLoad<T>(key: string | null, version: number, load: (key: string) => Promise<T>, empty: T) {
    const [loaded, setLoaded] = useState<{ key: string; data: T } | null>(null)

    useEffect(() => {
        if (!key) return
        let cancelled = false
        load(key)
            .then((data) => {
                if (!cancelled) setLoaded({ key, data })
            })
            .catch((error: unknown) => {
                console.error(error)
                toast.error("Erreur lors du chargement du détail")
            })
        return () => {
            cancelled = true
        }
    }, [key, version, load])

    const current = key && loaded?.key === key ? loaded.data : null
    return { data: current ?? empty, loading: !!key && current === null }
}

const NO_DETAIL = { palettes: [] as Palette[], cartons: [] as Carton[] }
const loadDetail = async (id: string) => {
    const [palettes, cartons] = await Promise.all([service.fetchPalettes(id), service.fetchCartons(id)])
    return { palettes, cartons }
}

/** Palettes et cartons d'une livraison. */
export function useLivraisonDetail(livraisonId: string | null, version: number) {
    const { data, loading } = useKeyedLoad(livraisonId, version, loadDetail, NO_DETAIL)
    return { palettes: data.palettes, cartons: data.cartons, loading }
}

const NO_LIGNES: AvancementLigne[] = []

/** Avancement par ligne d'une commande. */
export function useAvancement(commandeId: string | null, version: number) {
    const { data, loading } = useKeyedLoad(commandeId, version, service.fetchAvancement, NO_LIGNES)
    return { lignes: data, loading }
}

/** Nombre de commandes passées lues pour les suggestions. */
const HISTORIQUE_COMMANDES = 10
const loadHistorique = (key: string) => service.fetchLignesDeCommandes(key.split(","))

/**
 * Les dernières commandes d'une boutique et leurs lignes : de quoi proposer
 * ses catégories habituelles et « reprendre la dernière commande ».
 * `commandes` arrive triée du plus récent au plus ancien (`numero` décroissant).
 */
export function useHistoriqueBoutique(boutiqueId: string | null, commandes: readonly CommandeBoutique[], version: number) {
    const passees = boutiqueId
        ? commandes.filter((c) => c.boutique_id === boutiqueId && c.statut !== "annulee").slice(0, HISTORIQUE_COMMANDES)
        : []
    const key = passees.length ? passees.map((c) => c.id).join(",") : null
    const { data } = useKeyedLoad(key, version, loadHistorique, NO_LIGNES)
    return { commandes: passees, lignes: data }
}
