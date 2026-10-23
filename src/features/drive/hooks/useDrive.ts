// hooks/useDrive.ts
import type { DriveItem, PathSegment } from "@/features/drive/types"
import type {
    UploadedFile,
    UploadProgress,
} from "@/features/drive/utils/ChunkedUploader"
import { ChunkedUploader } from "@/features/drive/utils/ChunkedUploader"
import { getAccessToken } from "@/features/drive/services/driveService"
import { useCallback, useMemo } from "react"

/**
 * Au-delà de ce seuil, l'upload direct se heurte à la limite de payload de
 * Cloudflare, qui répond 413 : on part directement en chunks.
 */
const DIRECT_UPLOAD_MAX_BYTES = 95 * 1024 * 1024

/**
 * Normalise une réponse de l'API en DriveItem.
 *
 * L'URL n'est exigée que pour un fichier : un dossier n'a rien derrière lui,
 * donc pas de jeton de lien à émettre, et le backend renvoie une URL vide.
 */
export function toDriveItem(raw: UploadedFile | undefined): DriveItem {
    if (!raw?.id || (!raw.isFolder && !raw.url)) {
        throw new Error("Réponse invalide du Drive")
    }
    return {
        id: raw.id,
        url: raw.url ?? "",
        title: raw.title,
        // L'uploadeur est forcément le propriétaire.
        owner: "perso",
        owner_id: raw.owner_id ?? "",
        createdAt: raw.createdAt ?? new Date().toISOString(),
        type: raw.type,
        mime: raw.mime,
        sizeBytes: raw.sizeBytes,
        isFolder: raw.isFolder,
        parentId: raw.parentId,
    }
}

export function useDrive(apiBaseUrl: string) {
    const getToken = useCallback(async () => {
        return getAccessToken()
    }, [])

    const updatePermissions = useCallback(
        async (itemId: string, userIds: string[], revoke: boolean = false) => {
            const token = await getToken()
            const endpoint = revoke ? "unshare" : "share"

            const res = await fetch(`${apiBaseUrl}/${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    picture_id: itemId,
                    user_ids: userIds,
                }),
            })

            if (!res.ok) {
                console.error(
                    `Erreur ${revoke ? "révocation" : "partage"}:`,
                    await res.text()
                )
                throw new Error("Échec de la mise à jour des permissions")
            }
        },
        [apiBaseUrl, getToken]
    )

    const deleteItems = useCallback(
        async (ids: string[]) => {
            const token = await getToken()

            for (const id of ids) {
                const res = await fetch(`${apiBaseUrl}/delete/${id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                })

                const data = await res.json().catch(() => ({}))

                if (!res.ok) {
                    console.error("❌ Erreur de suppression:", data)
                    throw new Error(
                        data.error ||
                            `Erreur lors de la suppression (${res.status})`
                    )
                }
            }
        },
        [apiBaseUrl, getToken]
    )

    // 📤 Upload de n'importe quel type de fichier.
    //
    // Un seul chemin : envoi direct, et bascule en chunks dans les trois cas où
    // il ne passe pas (fichier trop gros, 413 renvoyé malgré tout, coupure
    // réseau). Le découpage n'est plus réservé aux vidéos — un PDF de 200 Mo
    // se heurte exactement à la même limite.
    const uploadChunked = useCallback(
        async (
            file: File,
            token: string,
            onProgress?: (progress: UploadProgress) => void
        ): Promise<DriveItem> => {
            const uploader = new ChunkedUploader(apiBaseUrl, token)
            const result = await uploader.upload(file, onProgress)
            // `video` est l'ancienne clé, encore renvoyée par le backend le
            // temps que les deux côtés soient déployés.
            return toDriveItem(result.file ?? result.video)
        },
        [apiBaseUrl]
    )

    const uploadFiles = useCallback(
        async (
            files: FileList,
            onProgress?: (progress: UploadProgress) => void,
            parentId?: string
        ) => {
            const token = await getToken()
            const results: DriveItem[] = []

            for (const file of Array.from(files)) {
                if (file.size > DIRECT_UPLOAD_MAX_BYTES) {
                    results.push(await uploadChunked(file, token, onProgress))
                    continue
                }

                const form = new FormData()
                form.append("file", file)
                if (parentId) form.append("parent_id", parentId)

                let res: Response
                try {
                    res = await fetch(`${apiBaseUrl}/upload-file`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: form,
                    })
                } catch (error) {
                    // Erreur réseau : le chemin chunké découpe la requête et
                    // passe là où l'envoi d'un seul bloc échouait.
                    if (!(error instanceof TypeError)) throw error
                    results.push(await uploadChunked(file, token, onProgress))
                    continue
                }

                if (res.status === 413) {
                    results.push(await uploadChunked(file, token, onProgress))
                    continue
                }

                const data = await res.json().catch(() => ({}))
                if (!res.ok) {
                    console.error("❌ Upload échoué:", data)
                    throw new Error(data.error || "Échec de l'upload")
                }

                // picture/video : réponses des endpoints historiques.
                results.push(toDriveItem(data.file ?? data.picture ?? data.video))
            }

            return results
        },
        [apiBaseUrl, getToken, uploadChunked]
    )


    // 👥 Partage simultané à plusieurs utilisateurs
    const shareItems = useCallback(
        async (itemIds: string[], userIds: string[]) => {
            const token = await getToken()
            for (const id of itemIds) {
                const res = await fetch(`${apiBaseUrl}/share`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ picture_id: id, user_ids: userIds }),
                })

                const data = await res.json().catch(() => ({}))
                if (!res.ok) {
                    console.error("❌ Partage échoué:", data)
                    throw new Error(data.error || "Échec du partage")
                }
            }
        },
        [apiBaseUrl, getToken]
    )

    // 📥 Contenu d'un dossier, avec son fil d'Ariane.
    // parentId absent = racine du Drive.
    const listFolder = useCallback(
        async (
            currentUserId: string,
            parentId?: string
        ): Promise<{ items: DriveItem[]; path: PathSegment[] }> => {
            const token = await getToken()
            const res = await fetch(`${apiBaseUrl}/list`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ parent_id: parentId ?? "" }),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                console.error("❌ Erreur de récupération du Drive:", data)
                throw new Error(data.error || "Impossible de charger le Drive")
            }

            const rawItems = Array.isArray(data.items) ? data.items : []
            const items = (rawItems as Record<string, unknown>[]).map(
                (p): DriveItem => ({
                    id: p.id as string,
                    url: p.url as string,
                    title: p.title as string,
                    owner: p.owner_id === currentUserId ? "perso" : "partage",
                    owner_id: p.owner_id as string,
                    createdAt: p.createdAt as string,
                    type: p.type as DriveItem["type"],
                    mime: p.mime as string | undefined,
                    sizeBytes: p.sizeBytes as number | undefined,
                    isFolder: p.isFolder as boolean | undefined,
                    parentId: p.parentId as string | undefined,
                })
            )

            return {
                items,
                path: Array.isArray(data.path) ? (data.path as PathSegment[]) : [],
            }
        },
        [apiBaseUrl, getToken]
    )

    // 📁 Création d'un dossier dans le dossier courant
    const createFolder = useCallback(
        async (title: string, parentId?: string): Promise<DriveItem> => {
            const token = await getToken()
            const res = await fetch(`${apiBaseUrl}/folders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ title, parent_id: parentId ?? "" }),
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                console.error("❌ Création de dossier échouée:", data)
                throw new Error(data.error || "Impossible de créer le dossier")
            }
            return toDriveItem(data.folder)
        },
        [apiBaseUrl, getToken]
    )

    // ✏️ Renommage d'un fichier ou d'un dossier
    const renameItem = useCallback(
        async (id: string, title: string) => {
            const token = await getToken()
            const res = await fetch(`${apiBaseUrl}/rename`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ id, title }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error("❌ Renommage échoué:", data)
                throw new Error(data.error || "Impossible de renommer")
            }
        },
        [apiBaseUrl, getToken]
    )

    // 🗑️ Contenu de la corbeille, à plat : l'arborescence n'y a plus de sens,
    // et c'est ce qui permet de retrouver un élément dont on a oublié le dossier.
    const listTrash = useCallback(
        async (currentUserId: string): Promise<DriveItem[]> => {
            const token = await getToken()
            const res = await fetch(`${apiBaseUrl}/trash`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            })

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                console.error("❌ Erreur de récupération de la corbeille:", data)
                throw new Error(
                    data.error || "Impossible de charger la corbeille"
                )
            }

            const rawItems = Array.isArray(data.items) ? data.items : []
            return (rawItems as Record<string, unknown>[]).map(
                (p): DriveItem => ({
                    id: p.id as string,
                    url: p.url as string,
                    title: p.title as string,
                    owner: p.owner_id === currentUserId ? "perso" : "partage",
                    owner_id: p.owner_id as string,
                    createdAt: p.createdAt as string,
                    type: p.type as DriveItem["type"],
                    mime: p.mime as string | undefined,
                    sizeBytes: p.sizeBytes as number | undefined,
                    isFolder: p.isFolder as boolean | undefined,
                    parentId: p.parentId as string | undefined,
                    deletedAt: p.deletedAt as string | undefined,
                })
            )
        },
        [apiBaseUrl, getToken]
    )

    // ♻️ Sortie de corbeille
    const restoreItems = useCallback(
        async (ids: string[]) => {
            const token = await getToken()
            const res = await fetch(`${apiBaseUrl}/restore`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ ids }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error("❌ Restauration échouée:", data)
                throw new Error(data.error || "Impossible de restaurer")
            }
        },
        [apiBaseUrl, getToken]
    )

    // ☠️ Suppression définitive. ids absent = vider toute la corbeille.
    const purgeItems = useCallback(
        async (ids?: string[]) => {
            const token = await getToken()
            const res = await fetch(`${apiBaseUrl}/purge`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ ids: ids ?? [] }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error("❌ Purge échouée:", data)
                throw new Error(data.error || "Impossible de vider la corbeille")
            }
        },
        [apiBaseUrl, getToken]
    )

    // 📦 Déplacement vers un dossier. parentId absent = racine.
    const moveItems = useCallback(
        async (ids: string[], parentId?: string) => {
            const token = await getToken()
            const res = await fetch(`${apiBaseUrl}/move`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ ids, parent_id: parentId ?? "" }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error("❌ Déplacement échoué:", data)
                throw new Error(data.error || "Impossible de déplacer")
            }
        },
        [apiBaseUrl, getToken]
    )

    const values = useMemo(
        () => ({
            listFolder,
            createFolder,
            renameItem,
            moveItems,
            listTrash,
            restoreItems,
            purgeItems,
            deleteItems,
            uploadFiles,
            shareItems,
            updatePermissions,
        }),
        [
            listFolder,
            createFolder,
            renameItem,
            moveItems,
            listTrash,
            restoreItems,
            purgeItems,
            deleteItems,
            uploadFiles,
            shareItems,
            updatePermissions,
        ]
    )

    return {
        ...values,
    }
}
