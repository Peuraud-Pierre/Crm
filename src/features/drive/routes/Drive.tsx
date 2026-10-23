import type { UploadProgress } from "@/features/drive/utils/ChunkedUploader"
import DriveBreadcrumb from "@/features/drive/components/DriveBreadcrumb"
import Grid from "@/features/drive/components/Grid"
import ListView from "@/features/drive/components/ListView"
import DriveControls, {
    type DriveView,
} from "@/features/drive/components/DriveControls"
import DriveNameDialog from "@/features/drive/components/DriveNameDialog"
import DriveActions from "@/features/drive/components/DriveActions"
import UploadProgressBar from "@/features/drive/components/UploadProgressBar"
import Preview from "@/features/drive/components/Preview"
import Share from "@/features/drive/components/Share"
import { DRIVE_DRAG_TYPE, type DriveItem, type PathSegment } from "@/features/drive/types"
import Toolbar from "@/features/drive/components/Toolbar"
import { Dialog } from "@/shared/ui/atoms/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { splitFileName } from "@/features/drive/utils/fileName"
import { type SortKey, sortItems } from "@/features/drive/utils/sortItems"
import { toast } from "sonner"
import { useShareCtx } from "@/features/drive/context/ShareProvider"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useDrive } from "@/features/drive/hooks/useDrive"
import { useSelection } from "@/features/sorters/hooks/useSelection"
import { downloadFile } from "@/shared/lib/utils"
import { downloadName } from "@/features/drive/utils/fileDisplay"
import { env } from "@/shared/lib/env"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"

export default function Drive() {
    const { user } = useAuth()
    const currentUserId = user?.user_id ?? user?.id

    // L'URL est la source de vérité du dossier courant (docs/ROUTING.md) :
    // le deep-link, le retour arrière et le partage de lien marchent sans état
    // supplémentaire à synchroniser.
    const { folderId } = useParams<{ folderId?: string }>()
    const navigate = useNavigate()

    const [tab, setTab] = useState<"perso" | "partage">("perso")
    const [items, setItems] = useState<DriveItem[]>([])
    const [path, setPath] = useState<PathSegment[]>([])
    const [query, setQuery] = useState("")
    const [preview, setPreview] = useState<DriveItem | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
    const [newFolderOpen, setNewFolderOpen] = useState(false)
    const [fileDropActive, setFileDropActive] = useState(false)
    const [sort, setSort] = useState<SortKey>("date-desc")
    // Le mode de vue suit l'utilisateur d'une session à l'autre. localStorage
    // peut lever (navigation privée, cookies bloqués) : on retombe sur la
    // grille plutôt que de casser la page.
    const [view, setView] = useState<DriveView>(() => {
        try {
            return localStorage.getItem("drive:view") === "list"
                ? "list"
                : "grid"
        } catch {
            return "grid"
        }
    })

    const changeView = (next: DriveView) => {
        setView(next)
        try {
            localStorage.setItem("drive:view", next)
        } catch {
            // Préférence non mémorisable : sans conséquence sur l'affichage.
        }
    }

    const { setShareOpen, setItemIds } = useShareCtx()

    const {
        listFolder,
        createFolder,
        renameItem,
        moveItems,
        deleteItems,
        uploadFiles,
    } =
        useDrive(env.PUBLIC_API_BASE_URL + "/api/gallery")

    const { selected, selectedIds, clear, toggle } = useSelection()

    // Éléments visibles selon l'onglet, dossiers en tête.
    const visible = useMemo(
        () =>
            sortItems(
                items.filter(
                    (p) =>
                        p.owner === tab &&
                        p.title?.toLowerCase().includes(query.toLowerCase())
                ),
                sort
            ),
        [items, tab, query, sort]
    )

    // Le partage n'a de sens que sur ce qu'on possède : le backend refuse
    // qu'un destinataire redistribue le fichier d'un autre (403).
    const canShare = useMemo(
        () =>
            selectedIds.length > 0 &&
            selectedIds.every(
                (id) => items.find((p) => p.id === id)?.owner === "perso"
            ),
        [selectedIds, items]
    )

    const reload = useCallback(async () => {
        if (!currentUserId) return
        try {
            const result = await listFolder(currentUserId, folderId)
            setItems(result.items)
            setPath(result.path)
        } catch (err) {
            const message = err instanceof Error ? err.message : ""
            // Le dossier a cessé d'être accessible pendant qu'on le regardait :
            // partage révoqué, dossier supprimé par son propriétaire. L'URL
            // pointe alors dans le vide, et elle survit au changement (favori,
            // onglet resté ouvert, lien collé). Sans ce retour à la racine, la
            // page reste vide sur une route morte, sans moyen d'en sortir.
            if (folderId && message === "folder not found") {
                toast.info("Ce dossier n'est plus accessible", {
                    description: "Retour à la racine du Drive.",
                })
                navigate("/drive", { replace: true })
                return
            }
            toast.error("Erreur de chargement", {
                description: message || "Impossible de charger le Drive.",
            })
        }
    }, [currentUserId, folderId, listFolder, navigate])

    // Recharge à l'ouverture et à chaque changement de dossier dans l'URL.
    useEffect(() => {
        clear()
        reload()
    }, [reload])

    const openFolder = (id?: string) => {
        navigate(id ? `/drive/${id}` : "/drive")
    }

    // Glisser-déposer interne : le dossier de destination est un dossier de la
    // vue, ou undefined pour remonter à la racine depuis le fil d'Ariane.
    const handleMove = async (ids: string[], folderId?: string) => {
        try {
            await moveItems(ids, folderId)
            setItems((prev) => prev.filter((x) => !ids.includes(x.id)))
            clear()
            toast.success("Déplacement réussi", {
                description: `${ids.length} élément(s) déplacé(s).`,
            })
        } catch (err) {
            toast.error("Déplacement impossible", {
                description:
                    (err instanceof Error ? err.message : undefined) ||
                    "Les éléments n'ont pas pu être déplacés.",
            })
            reload()
        }
    }

    // Un dépôt venu du bureau annonce "Files" ; un déplacement interne annonce
    // DRIVE_DRAG_TYPE. Sans cette distinction, glisser une carte d'un dossier
    // à l'autre déclencherait un envoi de fichiers.
    const isExternalFileDrag = (e: React.DragEvent) =>
        e.dataTransfer.types.includes("Files") &&
        !e.dataTransfer.types.includes(DRIVE_DRAG_TYPE)

    // Renommage : l'élément visé est celui de la sélection, qui n'en compte
    // qu'un seul quand le bouton est proposé.
    const [renameOpen, setRenameOpen] = useState(false)
    const renameTarget =
        selectedIds.length === 1
            ? items.find((item) => item.id === selectedIds[0])
            : undefined

    // L'extension reste hors du champ de saisie et sera recollée au nom : la
    // modifier casserait l'ouverture du fichier, le type MIME enregistré ne
    // suivant pas le nouveau suffixe.
    const { base: renameBase, ext: renameExt } = splitFileName(
        renameTarget?.title ?? "",
        renameTarget?.isFolder
    )

    const handleRename = async (title: string) => {
        if (!renameTarget) return
        try {
            await renameItem(renameTarget.id, title)
            // Mise à jour locale plutôt que rechargement : le serveur a déjà
            // validé et nettoyé le titre, et recharger ferait clignoter la vue.
            setItems((prev) =>
                prev.map((item) =>
                    item.id === renameTarget.id ? { ...item, title } : item
                )
            )
            toast.success("Renommé", { description: title })
        } catch (err) {
            toast.error("Renommage impossible", {
                description:
                    (err instanceof Error ? err.message : undefined) ||
                    "L'élément n'a pas pu être renommé.",
            })
            throw err
        }
    }

    const handleCreateFolder = async (title: string) => {
        try {
            const folder = await createFolder(title, folderId)
            setItems((prev) => [folder, ...prev])
            toast.success("Dossier créé", { description: folder.title })
        } catch (err) {
            toast.error("Création impossible", {
                description:
                    (err instanceof Error ? err.message : undefined) ||
                    "Le dossier n'a pas pu être créé.",
            })
            throw err
        }
    }

    // 📤 Envoi de fichiers dans le dossier courant. Un seul chemin pour le
    // sélecteur de fichiers, l'appareil photo et le dépôt par glisser.
    const handleUpload = async (files: FileList) => {
        if (!files.length) return

        setUploading(true)
        setUploadProgress(null)
        try {
            const uploaded = await uploadFiles(
                files,
                (progress) => setUploadProgress(progress),
                folderId
            )
            setItems((prev) => [...uploaded, ...prev])
            toast.success("Envoi réussi", {
                description: `${uploaded.length} fichier(s) ajouté(s)`,
            })
        } catch (err) {
            toast.error("Erreur d'envoi", {
                description:
                    (err instanceof Error ? err.message : undefined) ||
                    "Échec lors de l'envoi des fichiers.",
            })
        } finally {
            setUploading(false)
            setUploadProgress(null)
        }
    }

    // ✅ Suppression d’éléments — un dossier emporte son contenu (ON DELETE CASCADE)
    const handleDelete = async (ids: string[]) => {
        if (!ids.length) return
        try {
            await deleteItems(ids)
            setItems((p) => p.filter((x) => !ids.includes(x.id)))
            clear()
            toast.success("Suppression réussie", { description: `${ids.length} élément(s) supprimé(s).` })
        } catch (err) {
            toast.error("Erreur de suppression", { description: (err instanceof Error ? err.message : undefined) || "Impossible de supprimer cet élément." })
        }
    }

    // ✅ Partage d’images

    return (
        <div
            className="relative mx-auto max-w-7xl p-4 md:p-6"
            onDragOver={(e) => {
                if (!isExternalFileDrag(e)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "copy"
                setFileDropActive(true)
            }}
            onDragLeave={(e) => {
                // dragleave part aussi au survol d'un enfant : ne fermer que
                // lorsque le pointeur quitte réellement la zone.
                if (e.currentTarget.contains(e.relatedTarget as Node | null))
                    return
                setFileDropActive(false)
            }}
            onDrop={(e) => {
                if (!isExternalFileDrag(e)) return
                e.preventDefault()
                setFileDropActive(false)
                handleUpload(e.dataTransfer.files)
            }}
        >
            {fileDropActive && (
                <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary/5">
                    <p className="text-sm font-medium text-primary">
                        Déposer pour envoyer dans ce dossier
                    </p>
                </div>
            )}
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Drive
                    </h1>
                    {/* Le fil d'Ariane tient lieu de sous-titre : il dit où l'on
                        se trouve, ce qu'un libellé fixe ne faisait pas. L'ancien
                        « Perso / Partagé — tous types de fichiers » répétait les
                        onglets rendus deux lignes plus bas. */}
                    <div className="mt-1">
                        <DriveBreadcrumb
                            path={path}
                            onNavigate={openFolder}
                            onDropInto={handleMove}
                        />
                    </div>
                </div>
                <DriveControls
                    query={query}
                    onQueryChange={setQuery}
                    sort={sort}
                    onSortChange={setSort}
                    view={view}
                    onViewChange={changeView}
                />
            </div>

            {/* Onglets */}
            <Tabs
                value={tab}
                onValueChange={(v) => setTab(v as "perso" | "partage")}
                className="w-full"
            >
                <TabsList indicator indicatorClassName="rounded-xl" className="grid w-full grid-cols-2 rounded-2xl">
                    <TabsTrigger value="perso" className="rounded-xl">
                        Perso
                    </TabsTrigger>
                    <TabsTrigger value="partage" className="rounded-xl">
                        Partagé
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={tab} className="mt-4">
                    {/* Actions permanentes avant la barre de sélection : celle-ci
                        n'apparaît qu'avec une sélection, et la placer au-dessus
                        faisait descendre les boutons au moment même où l'on
                        cochait un fichier — la cible se dérobait sous le clic. */}
                    {uploading && uploadProgress && (
                        <UploadProgressBar progress={uploadProgress} />
                    )}

                    <DriveActions
                        uploading={uploading}
                        onUpload={handleUpload}
                        onNewFolder={() => setNewFolderOpen(true)}
                        onOpenTrash={() => navigate("/drive/corbeille")}
                    />

                    <Toolbar
                        selected={selectedIds.length}
                        canShare={canShare}
                        onClear={clear}
                        onDelete={() => {
                            handleDelete(selectedIds)
                        }}
                        onDownload={() => {
                            // Un dossier n'a pas d'URL : le télécharger
                            // lancerait un fetch("") sur la page courante.
                            const files = selectedIds
                                .map((id) => items.find((x) => x.id === id))
                                .filter((item) => item && !item.isFolder)
                            if (!files.length) {
                                toast.info("Rien à télécharger", {
                                    description:
                                        "Un dossier ne se télécharge pas, seulement les fichiers qu'il contient.",
                                })
                                return
                            }
                            Promise.all(
                                files.map((item) =>
                                    item
                                        ? downloadFile(
                                              item.url,
                                              downloadName(item)
                                          )
                                        : undefined
                                )
                            ).catch((err) =>
                                toast.error("Téléchargement impossible", {
                                    description:
                                        (err instanceof Error
                                            ? err.message
                                            : undefined) ??
                                        "Le fichier n'a pas pu être récupéré.",
                                })
                            )
                        }}
                        onRename={() => setRenameOpen(true)}
                        onShare={() => {
                            setItemIds(selectedIds)
                            setShareOpen(true)
                        }}
                    />

                    {(() => {
                        const viewProps = {
                            items: visible,
                            selected,
                            selectedIds,
                            onToggle: toggle,
                            onOpen: (item: DriveItem) =>
                                item.isFolder
                                    ? openFolder(item.id)
                                    : setPreview(item),
                            onMoveInto: (ids: string[], folderId: string) =>
                                handleMove(ids, folderId),
                        }
                        return view === "list" ? (
                            <ListView {...viewProps} />
                        ) : (
                            <Grid {...viewProps} />
                        )
                    })()}

                </TabsContent>
            </Tabs>

            {/* Création de dossier */}
            <DriveNameDialog
                open={newFolderOpen}
                onOpenChange={setNewFolderOpen}
                onSubmit={handleCreateFolder}
            />

            {/* Renommage. `key` sur l'id : changer d'élément remonte le dialog,
                donc le champ reprend le nom courant sans effet de synchro. */}
            {renameTarget && (
                <DriveNameDialog
                    key={renameTarget.id}
                    open={renameOpen}
                    onOpenChange={setRenameOpen}
                    onSubmit={handleRename}
                    heading={
                        renameTarget.isFolder
                            ? "Renommer le dossier"
                            : "Renommer le fichier"
                    }
                    label="Nouveau nom"
                    placeholder={renameBase}
                    submitLabel="Renommer"
                    pendingLabel="Renommage…"
                    initialValue={renameBase}
                    suffix={renameExt}
                />
            )}

            {/* Partage */}
            <Share />

            {/* Aperçu */}
            <Dialog
                open={!!preview}
                onOpenChange={(o) => !o && setPreview(null)}
            >
                {preview && (
                    <Preview
                        preview={preview}
                        previewDelete={handleDelete}
                        onClose={() => setPreview(null)} // ✅ onClose ferme la preview
                    />
                )}
            </Dialog>
        </div>
    )
}
