import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Download, Pencil, Share2, Trash2, X } from "lucide-react"

export default function Toolbar({
    selected,
    canShare,
    onClear,
    onDelete,
    onDownload,
    onRename,
    onShare,
}: {
    selected: number
    /**
     * Faux dès qu'un élément reçu en partage est sélectionné : seul son
     * propriétaire décide de qui y a accès, et le backend refuse la demande
     * (403). Sans ce garde-fou le bouton était proposé puis échouait.
     */
    canShare: boolean
    onClear: () => void
    onDelete: () => void
    /**
     * Renommage : proposé seulement sur une sélection d'un seul élément —
     * l'API prend un id et un titre, il n'y a rien à renommer en lot.
     */
    onRename: () => void
    onDownload: () => void
    onShare: () => void
}) {
    if (!selected) return null

    return (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center justify-between rounded-2xl border bg-card/80 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/60">
            {/* Gauche : badge + vider */}
            <div className="flex items-center gap-2 px-2">
                <Badge
                    variant="secondary"
                    className="rounded-xl px-3 py-1 text-sm"
                >
                    {selected} sélectionné{selected > 1 ? "s" : ""}
                </Badge>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="gap-1 text-sm"
                >
                    <X className="h-4 w-4" />
                    <span className="hidden sm:inline">Vider</span>
                </Button>
            </div>

            {/* Droite : actions (scrollable si trop large) */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto px-1">
                {selected === 1 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRename}
                        className="gap-1 text-sm whitespace-nowrap"
                    >
                        <Pencil className="h-4 w-4" />
                        <span className="hidden sm:inline">Renommer</span>
                    </Button>
                )}

                <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDelete}
                    className="gap-1 text-sm whitespace-nowrap"
                >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Supprimer</span>
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={onDownload}
                    className="gap-1 text-sm whitespace-nowrap"
                >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Télécharger</span>
                </Button>

                {canShare && (
                    <Button
                        size="sm"
                        onClick={onShare}
                        className="gap-1 text-sm whitespace-nowrap"
                    >
                        <Share2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Partager</span>
                    </Button>
                )}
            </div>
        </div>
    )
}
