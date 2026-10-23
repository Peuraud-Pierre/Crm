import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as service from "../../services/changelogService"
import type {
    ChangelogCategory,
    ChangelogCategoryInput,
    ChangelogVersionInput,
    ChangelogVersionStatus,
    ChangelogVersionWithItems,
} from "../../types/changelog.types"

/**
 * Orchestration du changelog (versions, éléments, catégories).
 *
 * Trois corrections de fond par rapport au hook qu'il remplace
 * (`features/manager/hooks/Manager_hook/useChangelog.ts`) :
 *
 * 1. **Les erreurs ne sont plus avalées.** Toutes ses opérations
 *    finissaient par un `catch { toast.error("Erreur lors de …") }` sans
 *    liaison — l'objet d'erreur était jeté, donc ni le message Postgres
 *    ni un refus de RLS n'étaient consultables, ni dans l'interface ni
 *    dans la console.
 *
 * 2. **L'édition d'une version est atomique.** Elle supprimait les
 *    éléments puis les réinsérait en deux requêtes : un échec entre les
 *    deux laissait la version vide. Voir `service.replaceItems`.
 *
 * 3. **Politique de rechargement homogène.** `createVersion`/`editVersion`
 *    rechargeaient depuis le serveur tandis que `deleteVersion`/
 *    `updateStatus` modifiaient l'état local : deux comportements pour la
 *    même table, et un état divergent dès qu'une écriture échouait
 *    silencieusement.
 */
export function useChangelog() {
    const { user } = useAuth()
    const userId = user?.user_id

    const [versions, setVersions] = useState<ChangelogVersionWithItems[]>([])
    const [categories, setCategories] = useState<ChangelogCategory[]>([])
    const [loading, setLoading] = useState(true)

    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        const requestId = ++requestIdRef.current
        try {
            const [nextVersions, nextCategories] = await Promise.all([
                service.fetchVersionsWithItems(),
                service.fetchCategories(),
            ])
            if (requestIdRef.current !== requestId) return
            setVersions(nextVersions)
            setCategories(nextCategories)
        } catch (err) {
            console.error("[useChangelog] refetch:", err)
            toast.error("Erreur lors du chargement du changelog")
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!userId) return
        void refetch()
    }, [userId, refetch])

    /**
     * Enveloppe commune des écritures : message d'erreur réel, trace en
     * console, rechargement après succès. Le message Postgres est
     * privilégié quand il existe — « des éléments utilisent cette
     * catégorie » vaut mieux que « Erreur ».
     */
    const mutate = useCallback(
        async (
            label: string,
            operation: () => Promise<void>,
            successMessage: string,
            humanize?: (message: string) => string | null
        ): Promise<boolean> => {
            try {
                await operation()
                await refetch()
                toast.success(successMessage)
                return true
            } catch (err) {
                console.error(`[useChangelog] ${label}:`, err)
                const raw = err instanceof Error ? err.message : String(err)
                toast.error(humanize?.(raw) ?? raw)
                return false
            }
        },
        [refetch]
    )

    /* ─── Versions ─────────────────────────────────────────────── */

    const createVersion = useCallback(
        (input: ChangelogVersionInput) =>
            mutate(
                "createVersion",
                async () => {
                    const versionId = await service.insertVersion({
                        version: input.version,
                        deployment_date: input.deployment_date,
                        status: input.status,
                        summary: input.summary ?? null,
                        created_by: userId ?? null,
                    })
                    await service.insertItems(versionId, input.items)
                },
                "Changelog créé"
            ),
        [mutate, userId]
    )

    const editVersion = useCallback(
        (versionId: string, input: ChangelogVersionInput) =>
            mutate(
                "editVersion",
                async () => {
                    await service.updateVersion(versionId, {
                        version: input.version,
                        deployment_date: input.deployment_date,
                        status: input.status,
                        summary: input.summary ?? null,
                    })
                    await service.replaceItems(versionId, input.items)
                },
                "Changelog mis à jour"
            ),
        [mutate]
    )

    const removeVersion = useCallback(
        (versionId: string) =>
            mutate(
                "removeVersion",
                () => service.deleteVersion(versionId),
                "Changelog supprimé"
            ),
        [mutate]
    )

    const updateStatus = useCallback(
        (versionId: string, status: ChangelogVersionStatus) =>
            mutate(
                "updateStatus",
                () => service.updateVersion(versionId, { status }),
                "Statut mis à jour"
            ),
        [mutate]
    )

    /* ─── Catégories ───────────────────────────────────────────── */

    const createCategory = useCallback(
        (input: ChangelogCategoryInput) =>
            mutate(
                "createCategory",
                () => service.insertCategory(input),
                "Catégorie créée"
            ),
        [mutate]
    )

    const editCategory = useCallback(
        (categoryId: string, input: ChangelogCategoryInput) =>
            mutate(
                "editCategory",
                () => service.updateCategory(categoryId, input),
                "Catégorie mise à jour"
            ),
        [mutate]
    )

    const removeCategory = useCallback(
        (categoryId: string) =>
            mutate(
                "removeCategory",
                () => service.deleteCategory(categoryId),
                "Catégorie supprimée",
                (message) =>
                    message.includes("violates foreign key constraint")
                        ? "Impossible de supprimer : des éléments utilisent cette catégorie"
                        : null
            ),
        [mutate]
    )

    const reorderCategories = useCallback(
        (orderedIds: string[]) =>
            mutate(
                "reorderCategories",
                async () => {
                    await Promise.all(
                        orderedIds.map((id, position) =>
                            service.updateCategory(id, { position })
                        )
                    )
                },
                "Ordre des catégories enregistré"
            ),
        [mutate]
    )

    return {
        versions,
        categories,
        loading,
        refetch,
        createVersion,
        editVersion,
        removeVersion,
        updateStatus,
        createCategory,
        editCategory,
        removeCategory,
        reorderCategories,
    }
}
