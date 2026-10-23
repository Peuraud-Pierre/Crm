import { getAccessToken } from "@/features/drive/services/driveService"
import { useCallback, useEffect, useState } from "react"

export interface UseShareProps {
    baseUrl: string
}

export function useShare({ baseUrl }: UseShareProps) {
    const [shareOpen, setShareOpen] = useState(false)
    const [shareFilter, setShareFilter] = useState("")
    const [itemIds, setItemIds] = useState<string[]>([]) // ✅ plusieurs items possibles
    const [shareTargets, setShareTargets] = useState<Record<string, boolean>>(
        {}
    )
    const [existingPermissions, setExistingPermissions] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const tokenHeader = useCallback(async () => {
        const token = await getAccessToken()
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        }
    }, [])

    // ✅ Charger les permissions pour une photo donnée
    // ✅ Charger les permissions pour UNE photo donnée (si applicable)
    const loadPermissions = useCallback(
        async (itemId: string) => {
            setError(null)
            setLoading(true)
            try {
                // 🔐 Récupère le token Supabase si dispo
                const headers = await tokenHeader()

                const res = await fetch(`${baseUrl}/permissions/${itemId}`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ action: "get" }),
                    credentials: "include",
                })

                if (!res.ok) throw new Error(`Erreur ${res.status}`)

                let data: unknown = null
                try {
                    data = await res.json()
                } catch {
                    data = []
                }

                // 🔒 Gestion sécurisée des cas vides ou inattendus
                const usersField = (data as { users?: unknown })?.users
                const list: string[] = Array.isArray(data)
                    ? (data as string[])
                    : Array.isArray(usersField)
                    ? (usersField as string[])
                    : []
                const map: Record<string, boolean> = {}
                for (const id of list) map[id] = true

                setExistingPermissions(list)
                setShareTargets(map)
            } catch (err) {
                console.error("❌ loadPermissions:", err)
                setError(err instanceof Error ? err.message : "Impossible de charger les permissions")
            } finally {
                setLoading(false)
            }
        },
        [baseUrl]
    )

    const apiShare = useCallback(
        async (picture_id: string, user_ids: string[]) => {
            if (!user_ids.length) return
            const headers = await tokenHeader()
            const res = await fetch(`${baseUrl}/share`, {
                method: "POST", // ✅ /share (POST)
                headers,
                body: JSON.stringify({ picture_id, user_ids }),
            })
            if (!res.ok) throw new Error(await res.text())
        },
        [baseUrl, tokenHeader]
    )

    const apiUnshare = useCallback(
        async (picture_id: string, user_ids: string[]) => {
            if (!user_ids.length) return
            const headers = await tokenHeader()
            const res = await fetch(`${baseUrl}/unshare`, {
                method: "POST", // ✅ /unshare (POST)
                headers,
                body: JSON.stringify({ picture_id, user_ids }),
            })
            if (!res.ok) throw new Error(await res.text())
        },
        [baseUrl, tokenHeader]
    )

    // --- Révoquer tout le monde (si plus personne n'est coché)
    const unshareAll = useCallback(async () => {
        if (!itemIds.length) return
        setLoading(true)
        setError(null)
        try {
            const toRemove = existingPermissions
            await Promise.all(itemIds.map((pid) => apiUnshare(pid, toRemove)))
            setExistingPermissions([])
            setShareTargets({})
            setShareOpen(false)
        } catch (e) {
            console.error("❌ unshareAll:", e)
            setError(e instanceof Error ? e.message : "Erreur lors de la révocation")
            throw e
        } finally {
            setLoading(false)
        }
    }, [itemIds, existingPermissions, apiUnshare])

    // --- Envoyer le diff (ajouts / retraits) pour toutes les items sélectionnées
    const submitShare = useCallback(async () => {
        if (!itemIds.length) return
        setLoading(true)
        setError(null)
        try {
            const currentChecked = Object.keys(shareTargets).filter(
                (id) => shareTargets[id]
            )
            const toAdd = currentChecked.filter(
                (id) => !existingPermissions.includes(id)
            )
            const toRemove = existingPermissions.filter(
                (id) => !currentChecked.includes(id)
            )

            await Promise.all(
                itemIds.map(async (pid) => {
                    await apiShare(pid, toAdd)
                    await apiUnshare(pid, toRemove)
                })
            )

            setExistingPermissions(currentChecked)
            setShareOpen(false)
        } catch (err) {
            console.error("❌ submitShare:", err)
            setError(err instanceof Error ? err.message : "Erreur lors du partage")
            throw err
        } finally {
            setLoading(false)
        }
    }, [itemIds, shareTargets, existingPermissions, apiShare, apiUnshare])

    const toggleTarget = useCallback((id: string) => {
        setShareTargets((s) => ({ ...s, [id]: !s[id] }))
    }, [])

    // Auto-load quand on ouvre le tiroir avec une seule photo
    useEffect(() => {
        if (shareOpen && itemIds.length === 1) {
            const timer = setTimeout(() => loadPermissions(itemIds[0]), 150)
            return () => clearTimeout(timer)
        }
    }, [shareOpen, itemIds, loadPermissions])

    return {
        shareOpen,
        setShareOpen,
        itemIds,
        setItemIds, // ✅ permet de passer plusieurs IDs d’un coup
        shareFilter,
        setShareFilter,
        shareTargets,
        setShareTargets,
        loadPermissions,
        submitShare,
        loading,
        error,
        toggleTarget,
        unshareAll,
    }
}
