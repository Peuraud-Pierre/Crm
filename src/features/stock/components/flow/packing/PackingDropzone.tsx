import { useRef, useState } from "react"
import { AlertCircle, FileSpreadsheet, Upload } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
    PACKING_ACCEPTED_EXTENSIONS,
    PACKING_MAX_FILE_MB,
} from "@/features/stock/constants"

interface PackingDropzoneProps {
    onFile: (file: File) => void
    /** Refus du dernier fichier (format, taille, erreur du service). */
    error?: string | null
    disabled?: boolean
}

/**
 * Zone de dépôt du fichier Excel.
 *
 * C'est un vrai `<button>` : glisser-déposer pour la souris, mais Entrée ou
 * Espace ouvrent le sélecteur de fichier au clavier — une `<div>` cliquable
 * n'aurait été atteignable qu'à la souris.
 */
export function PackingDropzone({ onFile, error, disabled = false }: PackingDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragOver, setDragOver] = useState(false)

    const pick = (files: FileList | null) => {
        const file = files?.[0]
        if (file && !disabled) onFile(file)
    }

    return (
        <div className="flex flex-col gap-3">
            <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                    event.preventDefault()
                    if (!disabled) setDragOver(true)
                }}
                onDragLeave={(event) => {
                    // dragleave part aussi au survol d'un enfant : ne fermer que
                    // lorsque le pointeur quitte réellement la zone.
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                    setDragOver(false)
                }}
                onDrop={(event) => {
                    event.preventDefault()
                    setDragOver(false)
                    pick(event.dataTransfer.files)
                }}
                className={cn(
                    "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-fast sm:px-6 sm:py-10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    dragOver
                        ? "border-primary bg-primary/5"
                        : error
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/40",
                )}
            >
                {/* `motion-reduce:scale-100` est indispensable : la media query
                    globale rend les transitions instantanées mais n'annule pas
                    l'état final d'une transformation (DESIGN_SYSTEM.md §13.4). */}
                <div
                    className={cn(
                        "rounded-full bg-muted p-3 transition-transform duration-fast ease-overshoot motion-reduce:transition-none",
                        dragOver && "scale-110 motion-reduce:scale-100",
                    )}
                >
                    {dragOver ? (
                        <Upload size={22} className="text-primary" aria-hidden />
                    ) : (
                        <FileSpreadsheet size={22} className="text-muted-foreground" aria-hidden />
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                        {dragOver ? "Déposez le fichier" : "Glissez la packing list ici"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        ou <span className="font-medium text-primary">choisissez un fichier</span>
                    </p>
                </div>
                <p className="text-2xs text-muted-foreground">
                    {PACKING_ACCEPTED_EXTENSIONS.join(" · ")} · {PACKING_MAX_FILE_MB} Mo max
                </p>
            </button>

            <input
                ref={inputRef}
                type="file"
                accept={PACKING_ACCEPTED_EXTENSIONS.join(",")}
                className="hidden"
                data-testid="packing-file-input"
                onChange={(event) => {
                    pick(event.target.files)
                    // Permet de redéposer le même fichier après une erreur.
                    event.target.value = ""
                }}
            />

            {error && (
                <p role="alert" className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle size={14} className="mt-px shrink-0" aria-hidden />
                    {error}
                </p>
            )}
        </div>
    )
}
