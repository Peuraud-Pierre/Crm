import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { fetchMappingsForKeys } from "@/features/stock/services/packingLabelDictionaryService"
import * as packingService from "@/features/stock/services/packingListService"
import type { PackingListLigne } from "@/features/stock/types/packing-list.types"
import type { PackingLigneState } from "@/features/stock/services/packingListService"
import { groupLignes, reviewProgress } from "@/features/stock/utils/packingGrouping"

/**
 * Provenance des correspondances reprises du tableau : « déjà validé sur
 * GR 153 ». Purement informatif — un échec de lecture retire la mention sans
 * rien casser, la résolution elle-même est déjà en base.
 *
 * Lu avec les lignes plutôt que dans un effet à part : la provenance n'a de
 * sens qu'attachée à un jeu de lignes précis, et les deux états se posent
 * alors ensemble, sans rendu intermédiaire incohérent.
 */
async function loadDictionaryLabels(
    lignes: readonly PackingListLigne[],
): Promise<Map<string, string | null>> {
    const keys = [
        ...new Set(lignes.filter((l) => l.resolution === "dictionary").map((l) => l.raw_label_key)),
    ]
    if (keys.length === 0) return new Map()
    try {
        const mappings = await fetchMappingsForKeys(keys)
        return new Map([...mappings].map(([key, m]) => [key, m.last_container_label]))
    } catch (error) {
        console.error("[usePackingList] dictionnaire:", error)
        return new Map()
    }
}

/**
 * Lignes d'UNE packing list et gestes de vérification.
 *
 * `packingId` à `null` = aucune packing ouverte : le hook ne charge rien.
 *
 * Les gestes de vérification sont OPTIMISTES. L'écran enchaîne les groupes au
 * clavier (Entrée → groupe suivant) : attendre l'aller-retour réseau à chaque
 * validation rendrait le geste pénible sur quarante groupes. En cas d'échec,
 * l'état est rechargé depuis la base et un toast le signale.
 *
 * Seule la DERNIÈRE lecture lancée écrit l'état — même garde que
 * `stock_handpick/hooks/data/useMouvementHandpick.ts`.
 *
 * `onHeaderChange` est appelé quand l'en-tête bouge (statut, suppression) :
 * c'est au propriétaire des arrivages de recharger la synthèse.
 *
 * ── Annulation ──────────────────────────────────────────────────────────────
 * Une pile de trois gestes permet de revenir sur la dernière décision. Elle vit
 * ICI et non dans l'écran, parce qu'annuler défait une ÉCRITURE : dans un
 * composant, elle survivrait à un rechargement correctif et prétendrait défaire
 * un état qui n'existe plus.
 *
 * Elle n'enregistre un geste QUE si toutes les lignes touchées étaient encore
 * sans catégorie. C'est une restriction d'honnêteté, pas une limite technique :
 * le trigger `packing_label_feedback_record` supprime la trace d'apprentissage
 * quand `category_id` repasse à `NULL`, mais ne fait RIEN quand on restaure une
 * autre catégorie. Annuler la correction d'un libellé déjà classé laisserait
 * donc l'exemple en base — l'écran dirait « annulé », la base dirait le
 * contraire. Ce cas n'ouvre simplement pas l'annulation ; il couvre 100 % du
 * démarrage à froid, qui est ce qu'on cherche à alléger.
 *
 * La pile est VIDÉE à chaque rechargement des lignes (correctif après échec,
 * notification realtime, validation, réouverture) : c'est cette ligne-là qui
 * garantit qu'on ne propose jamais d'annuler dans le vide.
 */
/** Un geste annulable : ce qu'il a touché, et de quoi le nommer à l'écran. */
interface UndoEntry {
    /** Libellés bruts concernés — « Annuler » seul obligerait à se souvenir. */
    labels: string[]
    entries: PackingLigneState[]
}

/** Profondeur volontairement courte : au-delà, ce n'est plus annuler, c'est naviguer. */
const UNDO_DEPTH = 3

export function usePackingList(
    packingId: string | null,
    onHeaderChange: () => void | Promise<void>,
) {
    const [lignes, setLignes] = useState<PackingListLigne[]>([])
    const [loading, setLoading] = useState(false)
    const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
    /**
     * Miroirs synchrones des deux états ci-dessus. Deux décisions enchaînées au
     * clavier se suivent de quelques millisecondes : lire `lignes` dans la
     * closure donnerait la valeur du rendu précédent, et la seconde décision
     * écraserait la première.
     */
    const lignesRef = useRef<PackingListLigne[]>([])
    const undoRef = useRef<UndoEntry[]>([])
    const [dictionaryLabels, setDictionaryLabels] = useState<Map<string, string | null>>(
        () => new Map(),
    )
    const requestRef = useRef(0)

    // Référence stable : l'abonnement realtime ne doit pas se refaire à chaque
    // rendu du parent.
    const onHeaderChangeRef = useRef(onHeaderChange)
    useEffect(() => {
        onHeaderChangeRef.current = onHeaderChange
    }, [onHeaderChange])

    const clearUndo = useCallback(() => {
        undoRef.current = []
        setUndoStack([])
    }, [])

    const fetchLignes = useCallback(async () => {
        const request = ++requestRef.current
        if (!packingId) {
            setLignes([])
            lignesRef.current = []
            clearUndo()
            setDictionaryLabels(new Map())
            return
        }
        setLoading(true)
        try {
            const rows = await packingService.fetchLignes(packingId)
            if (request !== requestRef.current) return
            setLignes(rows)
            lignesRef.current = rows
            // Toute relecture rend la pile caduque : elle décrit un état qui
            // vient d'être remplacé par celui de la base.
            clearUndo()
            setDictionaryLabels(await loadDictionaryLabels(rows))
        } catch (error) {
            if (request !== requestRef.current) return
            toast.error("Erreur lors du chargement de la packing list")
            console.error("[usePackingList] fetchLignes:", error)
            setLignes([])
            lignesRef.current = []
        } finally {
            if (request === requestRef.current) setLoading(false)
        }
    }, [packingId, clearUndo])

    useEffect(() => {
        fetchLignes()
    }, [fetchLignes])

    useEffect(() => {
        if (!packingId) return
        return packingService.subscribeToPackingList(packingId, () => {
            onHeaderChangeRef.current()
            fetchLignes()
        })
    }, [packingId, fetchLignes])

    const groups = useMemo(() => groupLignes(lignes), [lignes])
    const progress = useMemo(() => reviewProgress(groups), [groups])

    // ─── Vérification (optimiste) ─────────────────────────────────────────────

    const optimistic = useCallback(
        async (
            patch: (ligne: PackingListLigne) => PackingListLigne,
            write: () => Promise<void>,
            failure: string,
            /** Absent : geste non annulable (l'annulation elle-même, par exemple). */
            undoable = true,
        ) => {
            const current = lignesRef.current
            const next = current.map(patch)
            const changed = current.filter((ligne, index) => next[index] !== ligne)

            // Voir le docblock : seul un geste parti de lignes SANS catégorie
            // s'annule jusque dans le journal d'apprentissage.
            if (undoable && changed.length > 0 && changed.every((l) => l.category_id === null)) {
                const entry: UndoEntry = {
                    labels: [...new Set(changed.map((l) => l.raw_label))],
                    entries: changed.map((l) => ({
                        id: l.id,
                        category_id: l.category_id,
                        resolution: l.resolution,
                        reviewed_at: l.reviewed_at,
                    })),
                }
                undoRef.current = [...undoRef.current, entry].slice(-UNDO_DEPTH)
                setUndoStack(undoRef.current)
            }

            lignesRef.current = next
            setLignes(next)
            try {
                await write()
            } catch (error) {
                toast.error(failure)
                console.error("[usePackingList]", error)
                await fetchLignes()
            }
        },
        [fetchLignes],
    )

    /** Arbitrage humain : la trace qui enseignera le dictionnaire à la validation. */
    const humanPatch = (categoryId: string, reviewedAt: string) =>
        (l: PackingListLigne): PackingListLigne => ({
            ...l,
            category_id: categoryId,
            resolution: "human",
            reviewed_at: reviewedAt,
        })

    /** Réattribution explicite : TOUTES les lignes du libellé changent. */
    const assignGroup = useCallback(
        (rawLabelKey: string, categoryId: string) => {
            if (!packingId) return Promise.resolve()
            const reviewedAt = new Date().toISOString()
            const patch = humanPatch(categoryId, reviewedAt)
            return optimistic(
                (l) => (l.raw_label_key === rawLabelKey ? patch(l) : l),
                () => packingService.assignGroup(packingId, rawLabelKey, categoryId),
                "Catégorie non enregistrée",
            )
        },
        [packingId, optimistic],
    )

    /**
     * Confirmation de la proposition : seules les lignes encore SANS catégorie
     * sont remplies. Un libellé dont une ligne a été réattribuée à la main
     * garde cet arbitrage.
     */
    const acceptGroup = useCallback(
        (rawLabelKey: string, categoryId: string) => {
            if (!packingId) return Promise.resolve()
            const reviewedAt = new Date().toISOString()
            const patch = humanPatch(categoryId, reviewedAt)
            return optimistic(
                (l) => (l.raw_label_key === rawLabelKey && l.category_id === null ? patch(l) : l),
                () => packingService.assignGroupUnmatched(packingId, rawLabelKey, categoryId),
                "Catégorie non enregistrée",
            )
        },
        [packingId, optimistic],
    )

    /** Même geste, sur plusieurs libellés à la fois. */
    const acceptMany = useCallback(
        (assignments: ReadonlyArray<{ rawLabelKey: string; categoryId: string }>) => {
            if (!packingId || assignments.length === 0) return Promise.resolve()
            const reviewedAt = new Date().toISOString()
            const byKey = new Map(assignments.map((a) => [a.rawLabelKey, a.categoryId]))
            return optimistic(
                (l) => {
                    const categoryId = byKey.get(l.raw_label_key)
                    if (!categoryId || l.category_id !== null) return l
                    return humanPatch(categoryId, reviewedAt)(l)
                },
                () => packingService.assignManyUnmatched(packingId, assignments),
                "Catégories non enregistrées",
            )
        },
        [packingId, optimistic],
    )

    const assignLigne = useCallback(
        (id: string, categoryId: string) => {
            const reviewedAt = new Date().toISOString()
            const patch = humanPatch(categoryId, reviewedAt)
            return optimistic(
                (l) => (l.id === id ? patch(l) : l),
                () => packingService.assignLigne(id, categoryId),
                "Catégorie non enregistrée",
            )
        },
        [optimistic],
    )

    /**
     * Défait le dernier geste. Le toast nomme le libellé : « Annuler » seul
     * obligerait à se souvenir de ce qu'on annule.
     *
     * Pas de « Rétablir » dans le toast : refaire par-dessus un état qui a pu
     * être rechargé entre-temps est une promesse qu'on ne peut pas tenir.
     */
    const undo = useCallback(async () => {
        const last = undoRef.current[undoRef.current.length - 1]
        if (!packingId || !last) return

        undoRef.current = undoRef.current.slice(0, -1)
        setUndoStack(undoRef.current)

        const byId = new Map(last.entries.map((e) => [e.id, e]))
        await optimistic(
            (l) => {
                const previous = byId.get(l.id)
                return previous
                    ? {
                          ...l,
                          category_id: previous.category_id,
                          resolution: previous.resolution,
                          reviewed_at: previous.reviewed_at,
                      }
                    : l
            },
            () => packingService.restoreLignes(packingId, last.entries),
            "Annulation impossible",
            false,
        )

        toast.success(
            last.labels.length === 1
                ? `Décision annulée — « ${last.labels[0]} » est de nouveau à classer.`
                : `${last.labels.length} décisions annulées — ces libellés sont de nouveau à classer.`,
        )
    }, [packingId, optimistic])

    // ─── Cycle de vie — throw on error ─────────────────────────────────────────

    const validate = useCallback(async () => {
        if (!packingId) return
        await packingService.validatePackingList(packingId)
        await Promise.all([onHeaderChangeRef.current(), fetchLignes()])
    }, [packingId, fetchLignes])

    const reopen = useCallback(async () => {
        if (!packingId) return
        await packingService.reopenPackingList(packingId)
        await onHeaderChangeRef.current()
    }, [packingId])

    const remove = useCallback(async () => {
        if (!packingId) return
        await packingService.deletePackingList(packingId)
        await onHeaderChangeRef.current()
    }, [packingId])

    return {
        lignes,
        groups,
        progress,
        dictionaryLabels,
        loading,
        fetchLignes,
        assignGroup,
        acceptGroup,
        acceptMany,
        assignLigne,
        undo,
        /** Libellés que la prochaine annulation ramènerait. Vide : rien à annuler. */
        undoLabels: undoStack[undoStack.length - 1]?.labels ?? [],
        validate,
        reopen,
        remove,
    }
}
