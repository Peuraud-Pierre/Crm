import { ArrowDown, ArrowUp, FileText, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import type { ScanItem } from "@/features/stock/hooks/ui/useScanDoc"
import { formatBytes } from "@/features/stock/utils/scanFiles"

interface ScanFileListProps {
    items: ScanItem[]
    disabled: boolean
    onMove: (id: string, offset: -1 | 1) => void
    onRemove: (id: string) => void
}

/**
 * Fichiers à envoyer, numérotés : l'ordre de la liste est l'ordre des pages du
 * classeur. Un PDF compte pour toutes ses pages, d'où « fichier » et non
 * « page » dans le libellé.
 */
export function ScanFileList({ items, disabled, onMove, onRemove }: ScanFileListProps) {
    return (
        <ol className="flex flex-col gap-2" aria-label="Fichiers à scanner, dans l'ordre des pages">
            {items.map((item, index) => (
                <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
                >
                    <span className="w-6 shrink-0 text-center text-sm font-semibold text-muted-foreground">
                        {index + 1}
                    </span>
                    {item.previewUrl ? (
                        <img
                            src={item.previewUrl}
                            alt=""
                            className="size-12 shrink-0 rounded-md border border-border object-cover"
                        />
                    ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                            <FileText size={20} className="text-muted-foreground" />
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {item.kind === "pdf" ? "PDF" : "Photo"} · {formatBytes(item.file.size)}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled || index === 0}
                            onClick={() => onMove(item.id, -1)}
                            aria-label={`Monter ${item.file.name}`}
                        >
                            <ArrowUp size={16} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled || index === items.length - 1}
                            onClick={() => onMove(item.id, 1)}
                            aria-label={`Descendre ${item.file.name}`}
                        >
                            <ArrowDown size={16} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            onClick={() => onRemove(item.id)}
                            aria-label={`Retirer ${item.file.name}`}
                        >
                            <X size={16} />
                        </Button>
                    </div>
                </li>
            ))}
        </ol>
    )
}
