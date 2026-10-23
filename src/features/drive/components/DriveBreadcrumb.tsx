import { HardDrive } from "lucide-react"
import { useState } from "react"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/shared/ui/atoms/breadcrumb"

import { DRIVE_DRAG_TYPE, type PathSegment } from "@/features/drive/types"

/**
 * Fil d'Ariane racine → dossier courant.
 *
 * Chaque maillon accepte le dépôt d'éléments : c'est le geste qui permet de
 * faire remonter un fichier d'un niveau sans passer par un menu.
 *
 * @param path chemin renvoyé par l'API, de la racine vers le dossier courant.
 * @param onNavigate appelé avec l'id du dossier visé, undefined pour la racine.
 * @param onDropInto appelé avec les éléments déposés et le dossier visé.
 */
export default function DriveBreadcrumb({
    path,
    onNavigate,
    onDropInto,
}: {
    path: PathSegment[]
    onNavigate: (folderId?: string) => void
    onDropInto?: (ids: string[], folderId?: string) => void
}) {
    const [dropTarget, setDropTarget] = useState<string | null>(null)

    // Le dernier maillon est le dossier courant : y déposer ne déplacerait rien.
    const dropProps = (folderId: string | undefined, key: string) => {
        if (!onDropInto) return {}
        return {
            onDragOver: (e: React.DragEvent) => {
                if (!e.dataTransfer.types.includes(DRIVE_DRAG_TYPE)) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move" as const
                setDropTarget(key)
            },
            onDragLeave: () => setDropTarget(null),
            onDrop: (e: React.DragEvent) => {
                setDropTarget(null)
                const raw = e.dataTransfer.getData(DRIVE_DRAG_TYPE)
                if (!raw) return
                e.preventDefault()
                try {
                    const ids = JSON.parse(raw) as string[]
                    if (ids.length) onDropInto(ids, folderId)
                } catch {
                    // Charge utile illisible : un glisser venu d'ailleurs.
                }
            },
            "data-drop-active": dropTarget === key || undefined,
        }
    }

    return (
        <Breadcrumb>
            <BreadcrumbList className="flex-nowrap overflow-x-auto">
                <BreadcrumbItem>
                    {path.length === 0 ? (
                        <BreadcrumbPage className="flex items-center gap-1 font-medium">
                            <HardDrive className="h-3.5 w-3.5" />
                            Drive
                        </BreadcrumbPage>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onNavigate(undefined)}
                            className="flex items-center gap-1 rounded px-1 transition-colors hover:text-foreground data-[drop-active]:bg-primary/10 data-[drop-active]:text-foreground"
                            {...dropProps(undefined, "root")}
                        >
                            <HardDrive className="h-3.5 w-3.5" />
                            Drive
                        </button>
                    )}
                </BreadcrumbItem>

                {path.map((segment, i) => {
                    const isLast = i === path.length - 1
                    // Tableau (séparateur + item) plutôt qu'un Fragment : le
                    // plugin de dev injecte `data-source` sur tout élément JSX,
                    // ce que React.Fragment refuse.
                    return [
                        <BreadcrumbSeparator key={`sep-${segment.id}`} />,
                        <BreadcrumbItem key={segment.id} className="min-w-0">
                            {isLast ? (
                                <BreadcrumbPage className="max-w-[30ch] truncate font-medium">
                                    {segment.title}
                                </BreadcrumbPage>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onNavigate(segment.id)}
                                    className="max-w-[24ch] truncate rounded px-1 transition-colors hover:text-foreground data-[drop-active]:bg-primary/10 data-[drop-active]:text-foreground"
                                    {...dropProps(segment.id, segment.id)}
                                >
                                    {segment.title}
                                </button>
                            )}
                        </BreadcrumbItem>,
                    ]
                })}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
