import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import * as triService from "@/features/salle-de-tri/services/triService"
import { referentialErrorMessage, rpcMessage } from "@/features/stock"
import { useDebouncedCallback } from "@/shared/hooks/useDebouncedCallback"
import type {
    FicheTriComplete,
    FicheTriInput,
    FicheTriBalleInput,
    Trieur,
    TriSortie,
} from "@/features/salle-de-tri/types/tri.types"

/**
 * Données de la salle de tri : fiches de la période (avec leurs balles),
 * trieurs, types de sortie, et les écritures. Tout événement realtime
 * relance le chargement (regroupé), les totaux venant de la vue.
 *
 * Les écritures renvoient un booléen (ou l'élément) et signalent elles-mêmes
 * l'erreur : l'appelant décide seulement de refermer ou non son formulaire.
 */
export function useTri(range: { from: string; to: string }) {
    const [fiches, setFiches] = useState<FicheTriComplete[]>([])
    const [trieurs, setTrieurs] = useState<Trieur[]>([])
    const [sorties, setSorties] = useState<TriSortie[]>([])
    // Période dont les fiches sont chargées : `loading` en est dérivé.
    const [loadedRange, setLoadedRange] = useState<string | null>(null)
    const rangeKey = `${range.from}|${range.to}`

    const loadFiches = useCallback(async () => {
        try {
            setFiches(await triService.fetchFichesComplete(range))
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors du chargement des fiches de tri")
        }
    }, [range.from, range.to])

    const loadReferentials = useCallback(async () => {
        try {
            const [t, s] = await Promise.all([triService.fetchTrieurs(), triService.fetchSorties()])
            setTrieurs(t)
            setSorties(s)
        } catch (error) {
            console.error(error)
            toast.error("Erreur lors du chargement des trieurs")
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        void Promise.all([loadFiches(), loadReferentials()]).finally(() => {
            if (!cancelled) setLoadedRange(rangeKey)
        })
        return () => {
            cancelled = true
        }
    }, [loadFiches, loadReferentials, rangeKey])
    const loading = loadedRange !== rangeKey

    const reload = useDebouncedCallback(() => {
        void loadFiches()
        void loadReferentials()
    })
    useEffect(() => triService.subscribeTri(reload), [reload])

    const run = useCallback(async <R,>(entity: string, action: string, fn: () => Promise<R>): Promise<R | null> => {
        try {
            const result = await fn()
            reload()
            return result
        } catch (error) {
            console.error(error)
            toast.error(rpcMessage(error) ?? referentialErrorMessage(entity, action, error))
            return null
        }
    }, [reload])

    const saveFiche = useCallback(
        (fiche: FicheTriInput, balles: FicheTriBalleInput[]) =>
            run("de la fiche", fiche.id ? "update" : "create", () => triService.saveFiche(fiche, balles)),
        [run],
    )
    const deleteFiche = useCallback(
        async (id: string) => (await run("de la fiche", "delete", () => triService.deleteFiche(id).then(() => true))) ?? false,
        [run],
    )

    const createTrieur = useCallback(
        (payload: Pick<Trieur, "nom" | "actif">) => run("du trieur", "create", () => triService.insertTrieur(payload)),
        [run],
    )
    const updateTrieur = useCallback(
        async (id: string, payload: Partial<Pick<Trieur, "nom" | "actif">>) =>
            (await run("du trieur", "update", () => triService.updateTrieur(id, payload).then(() => true))) ?? false,
        [run],
    )
    const deleteTrieur = useCallback(
        async (id: string) => (await run("du trieur", "delete", () => triService.deleteTrieur(id).then(() => true))) ?? false,
        [run],
    )

    const createSortie = useCallback(
        (payload: Pick<TriSortie, "code" | "libelle" | "ordre" | "actif">) =>
            run("du type de sortie", "create", () => triService.insertSortie(payload)),
        [run],
    )
    const updateSortie = useCallback(
        async (id: string, payload: Partial<Pick<TriSortie, "code" | "libelle" | "ordre" | "actif">>) =>
            (await run("du type de sortie", "update", () => triService.updateSortie(id, payload).then(() => true))) ?? false,
        [run],
    )
    const deleteSortie = useCallback(
        async (id: string) => (await run("du type de sortie", "delete", () => triService.deleteSortie(id).then(() => true))) ?? false,
        [run],
    )

    return {
        fiches,
        trieurs,
        sorties,
        loading,
        saveFiche,
        deleteFiche,
        fetchFiche: triService.fetchFicheComplete,
        createTrieur,
        updateTrieur,
        deleteTrieur,
        createSortie,
        updateSortie,
        deleteSortie,
    }
}
