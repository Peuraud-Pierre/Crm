import React from "react"
import { AnalyzeData } from "@/features/content/components/App/PhotoAnalyzer/components/AnalyzeData"
import { StoryAnalyzeView } from "@/features/content/components/App/StorySuggester/StoryAnalyzeView"
import SecureMedia from "@/features/content/components/SecureMedia"
import { Button } from "@/shared/ui/atoms/button"
import {
    fetchAnalyzeById,
    fetchContentGenerations,
    subscribeToContentGenerationChanges,
} from "@/features/content/services/contentGenerationService"
import type { Database, Json } from "@/integrations/supabase/types"
import { cn } from "@/shared/lib/utils"
import { staggerStyle } from "@/shared/lib/motion"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    Download,
    Image as ImageIcon,
    Loader2,
    Shield,
    XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"
import jsPDF from "jspdf"

type ContentItem = {
    id: string
    user_id: string
    status: string | null
    image_url: string | null
    video_url: string | null
    created_at: string | null
    analyze?: string | null
    profiles?: {
        full_name: string | null
        email: string | null
        avatar_url: string | null
    } | null
}

type AnalyzeRow =
    Database["public"]["Tables"]["analyze_content_generation"]["Row"]

export interface StoryData {
    secondary_caption: string
    hashtags: string[]
    visual_style: { filtre: string; effet: string }
    story_concepts: Array<{ title: string; caption: string; description: string }>
    cta: string
    emojis_suggested: string[]
    platform: string
    story_style: string
}

export interface AnalyzeItem {
    id: string
    created_at: string
    category: string | null
    color: string | null
    brand: string | null
    summary: string | null
    brand_history: string | { overview: string } | null
    specs?: { name: string; value: string }[] | null
    auth_notes?: string | null
    storyData?: StoryData | null
}

interface ContentListProps {
    userId?: string
    adminView?: boolean
}

export default function ContentList({ userId, adminView }: ContentListProps) {
    const [items, setItems] = useState<ContentItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)
    const [analyzeData, setAnalyzeData] = useState<AnalyzeItem | null>(null)
    const formatDate = React.useCallback(
        (value?: string | null) =>
            value ? new Date(value).toLocaleString() : "—",
        []
    )
    const getDownloadName = (item: ContentItem, mediaUrl: string) => {
        const fallbackBase = "content"
        const safeBase = fallbackBase.replace(/[\\/:*?"<>|]/g, "-")

        try {
            const { pathname } = new URL(mediaUrl)
            const lastSegment = pathname.split("/").pop()
            if (lastSegment && lastSegment.includes(".")) {
                return lastSegment
            }
        } catch {
            // Ignore URL parsing errors and fallback to default naming.
        }

        const ext = item.video_url ? "mp4" : "jpg"
        return `${safeBase}.${ext}`
    }

    const fetchDataUrl = async (url: string): Promise<string> => {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error("Failed to fetch media")
        }
        const blob = await response.blob()
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    }

    const loadImageDimensions = async (src: string) => {
        return await new Promise<{ width: number; height: number }>(
            (resolve, reject) => {
                const img = new Image()
                img.onload = () =>
                    resolve({
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                    })
                img.onerror = () => reject(new Error("Image load failed"))
                img.src = src
            }
        )
    }

    const addTextBlock = (
        doc: jsPDF,
        text: string,
        cursorY: { value: number },
        pageWidth: number,
        pageHeight: number,
        margin: number
    ) => {
        const lines = doc.splitTextToSize(text, pageWidth - margin * 2)
        lines.forEach((line: string) => {
            if (cursorY.value > pageHeight - margin) {
                doc.addPage()
                cursorY.value = margin
            }
            doc.text(line, margin, cursorY.value)
            cursorY.value += 12
        })
        cursorY.value += 8
    }

    const handleDownload = async (item: ContentItem) => {
        const mediaUrl = item.image_url || item.video_url || ""
        if (!mediaUrl) return

        // Si pas d'analyze, télécharger directement le fichier (image ou vidéo)
        if (!item.analyze) {
            const filename = getDownloadName(item, mediaUrl)
            const response = await fetch(mediaUrl)
            const blob = await response.blob()
            const blobUrl = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = blobUrl
            a.download = filename
            a.click()
            window.URL.revokeObjectURL(blobUrl)
            return
        }

        const margin = 40
        const doc = new jsPDF("p", "pt", "a4")
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        const nowString = new Date().toLocaleString("fr-FR")
        const cursorY = { value: margin }

        doc.setFont("helvetica", "bold")
        doc.setFontSize(18)
        doc.text("Analyse photo", margin, cursorY.value)
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.text(`Exporté le ${nowString}`, pageWidth - margin, cursorY.value, {
            align: "right",
        })
        cursorY.value += 30

        if (item.image_url) {
            try {
                const imageDataUrl = await fetchDataUrl(mediaUrl)
                const { width: imgWidth, height: imgHeight } =
                    await loadImageDimensions(imageDataUrl)
                const availableWidth = pageWidth - margin * 2
                const ratio = imgHeight / imgWidth
                let drawWidth = availableWidth
                let drawHeight = drawWidth * ratio
                const maxImageHeight =
                    (pageHeight - cursorY.value - margin) * 0.6
                if (drawHeight > maxImageHeight) {
                    const scale = maxImageHeight / drawHeight
                    drawHeight = maxImageHeight
                    drawWidth = drawWidth * scale
                }
                if (cursorY.value + drawHeight > pageHeight - margin) {
                    doc.addPage()
                    cursorY.value = margin
                }
                doc.addImage(
                    imageDataUrl,
                    imageDataUrl.includes("png") ? "PNG" : "JPEG",
                    margin,
                    cursorY.value,
                    drawWidth,
                    drawHeight
                )
                cursorY.value += drawHeight + 20
            } catch (error) {
                console.error("Image embed failed", error)
            }
        } else {
            addTextBlock(
                doc,
                "Média : vidéo disponible (aperçu non inclus).",
                cursorY,
                pageWidth,
                pageHeight,
                margin
            )
        }

        if (analyzeData?.summary) {
            doc.setFont("helvetica", "bold")
            doc.setFontSize(12)
            addTextBlock(doc, "Résumé", cursorY, pageWidth, pageHeight, margin)
            doc.setFont("helvetica", "normal")
            doc.setFontSize(11)
            addTextBlock(
                doc,
                analyzeData.summary,
                cursorY,
                pageWidth,
                pageHeight,
                margin
            )
        }

        const infoEntries = [
            { label: "Catégorie", value: analyzeData?.category },
            { label: "Marque", value: analyzeData?.brand },
            { label: "Couleur", value: analyzeData?.color },
        ].filter(Boolean)

        if (infoEntries.length > 0) {
            doc.setFont("helvetica", "bold")
            doc.setFontSize(12)
            addTextBlock(
                doc,
                "Informations clés",
                cursorY,
                pageWidth,
                pageHeight,
                margin
            )
            doc.setFont("helvetica", "normal")
            doc.setFontSize(11)
            infoEntries.forEach((entry) => {
                const line = `${entry.label}: ${entry.value}`
                addTextBlock(doc, line, cursorY, pageWidth, pageHeight, margin)
            })
        }

        if (Array.isArray(analyzeData?.specs) && analyzeData.specs.length > 0) {
            doc.setFont("helvetica", "bold")
            doc.setFontSize(12)
            addTextBlock(
                doc,
                "Spécifications",
                cursorY,
                pageWidth,
                pageHeight,
                margin
            )
            doc.setFont("helvetica", "normal")
            doc.setFontSize(11)
            analyzeData.specs.forEach((spec) => {
                addTextBlock(
                    doc,
                    `${spec.name}: ${spec.value}`,
                    cursorY,
                    pageWidth,
                    pageHeight,
                    margin
                )
            })
        }

        if (analyzeData?.brand_history) {
            doc.setFont("helvetica", "bold")
            doc.setFontSize(12)
            addTextBlock(
                doc,
                "Historique de la marque",
                cursorY,
                pageWidth,
                pageHeight,
                margin
            )
            doc.setFont("helvetica", "normal")
            doc.setFontSize(11)
            const historyText =
                typeof analyzeData.brand_history === "string"
                    ? analyzeData.brand_history
                    : analyzeData.brand_history.overview
            addTextBlock(
                doc,
                historyText,
                cursorY,
                pageWidth,
                pageHeight,
                margin
            )
        }

        if (analyzeData?.auth_notes) {
            doc.setFont("helvetica", "bold")
            doc.setFontSize(12)
            addTextBlock(
                doc,
                "Notes internes",
                cursorY,
                pageWidth,
                pageHeight,
                margin
            )
            doc.setFont("helvetica", "normal")
            doc.setFontSize(11)
            addTextBlock(
                doc,
                analyzeData.auth_notes,
                cursorY,
                pageWidth,
                pageHeight,
                margin
            )
        }

        doc.save(
            getDownloadName(item, mediaUrl).replace(/\.(jpg|jpeg|png)$/, ".pdf")
        )
    }

    const normalizeSpecs = (value: Json | null): AnalyzeItem["specs"] => {
        if (!value) return null

        let parsed: unknown = value
        if (typeof value === "string") {
            try {
                parsed = JSON.parse(value)
            } catch {
                return null
            }
        }

        if (!Array.isArray(parsed)) return null

        return parsed
            .filter(
                (entry): entry is { name?: unknown; value?: unknown } =>
                    typeof entry === "object" && entry !== null
            )
            .map((entry) => ({
                name: typeof entry.name === "string" ? entry.name : "undefined",
                value: entry.value == null ? "" : String(entry.value),
            }))
    }

    const toAnalyzeItem = (row: AnalyzeRow): AnalyzeItem => {
        const isStory = row.brand === "story_creator"
        let storyData: StoryData | null = null
        if (isStory && row.specs != null) {
            try {
                const parsed =
                    typeof row.specs === "string"
                        ? JSON.parse(row.specs)
                        : row.specs
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    storyData = parsed as StoryData
                }
            } catch {
                storyData = null
            }
        }
        return {
            id: row.id,
            created_at: row.created_at,
            category: row.category,
            color: row.color,
            brand: row.brand,
            summary: row.summary,
            brand_history: row.brand_history,
            specs: isStory ? null : normalizeSpecs(row.specs),
            auth_notes: row.auth_notes ?? null,
            storyData,
        }
    }

    // --- Chargement initial + realtime ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)

            const { data, error } = await fetchContentGenerations(
                !adminView && userId ? userId : undefined
            )

            if (error) {
                console.error("Erreur de chargement :", error)
            } else if (data) {
                const normalized = data.map((row) => ({
                    id: row.id,
                    user_id: row.user_id ?? "",
                    status: row.status,
                    image_url: row.image_url,
                    video_url: row.video_url,
                    created_at: row.created_at,
                    analyze: row.analyze ?? null,
                    profiles: row.profiles
                        ? {
                              full_name: row.profiles.full_name,
                              email: row.profiles.email,
                              avatar_url: row.profiles.avatar_url,
                          }
                        : null,
                }))
                setItems(normalized)
            }

            setLoading(false)
        }

        fetchData()

        const unsubscribe = subscribeToContentGenerationChanges(
            "content_generation_realtime",
            (payload) => {
                if (payload.eventType === "DELETE") {
                    setItems((prev) => prev.filter((i) => i.id !== payload.old.id))
                    setSelectedItem((prev) => prev?.id === payload.old.id ? null : prev)
                    return
                }

                const row = payload.new
                // Filtrer côté client si pas admin
                if (!adminView && userId && row.user_id !== userId) return

                const updated: ContentItem = {
                    id: row.id,
                    user_id: row.user_id ?? "",
                    status: row.status,
                    image_url: row.image_url,
                    video_url: row.video_url,
                    created_at: row.created_at,
                    analyze: row.analyze ?? null,
                    profiles: null, // pas dispo dans le payload realtime
                }

                if (payload.eventType === "INSERT") {
                    setItems((prev) => {
                        if (prev.some((i) => i.id === updated.id)) return prev
                        return [updated, ...prev]
                    })
                } else if (payload.eventType === "UPDATE") {
                    setItems((prev) =>
                        prev.map((i) => i.id === updated.id ? { ...i, ...updated } : i)
                    )
                    setSelectedItem((prev) =>
                        prev?.id === updated.id ? { ...prev, ...updated } : prev
                    )
                }
            }
        )

        return unsubscribe
    }, [userId, adminView])

    // --- Récupération analyse ---
    useEffect(() => {
        const analyzeId = selectedItem?.analyze
        if (!analyzeId) {
            // Resync de l'analyse sur changement d'item sélectionné (le reste
            // de l'effet est un fetch asynchrone, pas factorisable en useMemo).
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setAnalyzeData(null)
            return
        }

        const fetchAnalyze = async () => {
            const { data, error } = await fetchAnalyzeById(analyzeId)

            if (error || !data) {
                console.error("Erreur fetch analyze:", error)
                setAnalyzeData(null)
                return
            }

            setAnalyzeData(toAnalyzeItem(data as AnalyzeRow))
        }

        fetchAnalyze()
    }, [selectedItem])

    // --- Loading / vide ---
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p>Chargement des contenus...</p>
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <EmptyState
                className="h-full"
                icon={ImageIcon}
                title={
                    adminView
                        ? "Aucun contenu à modérer pour le moment"
                        : "Aucune génération de contenu pour le moment"
                }
                description={
                    adminView
                        ? "Les contenus soumis par les utilisateurs apparaîtront ici."
                        : "Lancez une génération pour voir vos contenus apparaître ici."
                }
            />
        )
    }

    // --- Vue détaillée ---
    if (selectedItem) {
        const isVideo = !!selectedItem.video_url
        const mediaUrl = selectedItem.video_url || selectedItem.image_url || ""
        const isError =
            selectedItem.status === "error" || selectedItem.status === "false"

        return (
            <div className="flex flex-col items-center justify-center min-h-screen sm:min-h-[90vh] p-4 text-center overflow-hidden">
                {/* Bandeau admin */}
                {adminView && (
                    <div className="flex items-center gap-2 mb-4 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                        <Shield className="w-3 h-3" />
                        <span>Vue administrateur</span>
                    </div>
                )}

                {/* Retour */}
                <div className="mb-4 w-full max-w-2xl flex justify-start">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedItem(null)}
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Retour à la liste
                    </Button>
                </div>

                {/* Media */}
                <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-md overflow-hidden flex items-center justify-center">
                    <div className="flex items-center justify-center w-full h-full p-2">
                        <SecureMedia
                            src={mediaUrl}
                            alt={"Résultat"}
                            isVideo={isVideo}
                            className="max-h-[65vh] max-w-full object-contain rounded-md transition-transform duration-slow ease-emphasized hover:scale-105 motion-reduce:hover:scale-100"
                        />
                    </div>
                </div>

                {/* Infos */}
                <div className="w-full max-w-2xl mt-4 bg-muted/30 border border-border rounded-lg p-4 text-sm text-muted-foreground flex flex-col items-center">
                    {adminView && (
                        <p className="text-xs text-muted-foreground mb-2">
                            👤{" "}
                            <span className="font-semibold">Utilisateur :</span>{" "}
                            {selectedItem.profiles?.full_name ||
                                selectedItem.user_id}
                        </p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:justify-center gap-2 text-xs text-muted-foreground">
                        <span>
                            <span className="font-semibold">Statut :</span>{" "}
                            {selectedItem.status === "done"
                                ? "Terminé ✅"
                                : selectedItem.status === "processing"
                                  ? "En cours ⏳"
                                  : isError
                                    ? "Erreur ❌"
                                    : "En attente"}
                        </span>
                        <span>
                            <span className="font-semibold">Créé :</span>{" "}
                            {formatDate(selectedItem.created_at)}
                        </span>
                    </div>

                    <div className="mt-4">
                        <Button onClick={() => handleDownload(selectedItem)}>
                            <Download className="w-4 h-4 mr-1" /> Télécharger
                        </Button>
                    </div>

                    {analyzeData?.brand === "story_creator" ? (
                        <StoryAnalyzeView analyzeData={analyzeData} />
                    ) : (
                        <AnalyzeData analyzeData={analyzeData} />
                    )}
                </div>
            </div>
        )
    }

    // --- Vue grille ---
    return (
        <div
            className={cn(
                "grid gap-4 p-4",
                adminView
                    ? "md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                    : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}
        >
            {items.map((item, index) => {
                const isVideo = !!item.video_url
                const mediaUrl = item.video_url || item.image_url || ""
                const isError =
                    item.status === "error" || item.status === "false"

                return (
                    <div
                        key={item.id}
                        className={cn(
                            "group border border-border rounded-xl overflow-hidden bg-card cursor-pointer flex flex-col relative",
                            "transition-[box-shadow,transform,border-color] duration-base ease-emphasized hover:shadow-raised hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                            "animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out",
                            isError && "border-destructive",
                            item.status === "processing" && "border-primary/50"
                        )}
                        style={staggerStyle(index, { step: 35, cap: 350 })}
                        onClick={() => setSelectedItem(item)}
                    >
                        <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                            {item.status === "processing" && (
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            )}

                            {isError && (
                                <XCircle className="w-8 h-8 text-destructive" />
                            )}

                            {item.status === "done" && (
                                <SecureMedia
                                    src={mediaUrl}
                                    alt={"Résultat"}
                                    isVideo={isVideo}
                                    className="object-cover w-full h-full p-[6px] rounded-sm"
                                />
                            )}
                        </div>

                        <div className="p-3 flex-1 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-muted-foreground truncate">
                                    {formatDate(item.created_at)}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                {adminView && (
                                    <p className="text-[10px] text-muted-foreground/80 truncate">
                                        👤{" "}
                                        {item.profiles?.full_name ||
                                            "Utilisateur inconnu"}
                                    </p>
                                )}
                                {!adminView && (
                                    <p className="text-[10px] text-muted-foreground/80 truncate">
                                        {isVideo ? "Vidéo" : "Image"}
                                        {item.status === "processing" &&
                                            " en cours..."}
                                    </p>
                                )}
                                {item.status === "done" && (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                )}
                                {item.status === "processing" && (
                                    <Clock className="w-4 h-4 text-primary" />
                                )}
                                {isError && (
                                    <XCircle className="w-4 h-4 text-destructive" />
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
