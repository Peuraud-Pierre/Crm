import { useRef, useState } from "react"
import { CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Upload } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/atoms/alert"
import { Button } from "@/shared/ui/atoms/button"
import { BoardHeader } from "@/shared/ui/molecules/board-header"
import { cn } from "@/shared/lib/utils"
import { GESTION_THEME } from "@/features/stock/theme"
import { scanDocBaseUrl } from "@/features/stock/services/scanDocService"
import { useScanDoc } from "@/features/stock/hooks/ui/useScanDoc"
import { SCAN_ACCEPT, SCAN_LIMITS } from "@/features/stock/utils/scanFiles"
import { ScanFileList } from "./ScanFileList"

/**
 * Onglet Scan : des scans PDF ou des photos de fiches de stock manuscrites
 * deviennent un classeur Excel, lu par scan-doc. Plusieurs fichiers donnent un
 * seul classeur, dans l'ordre de la liste.
 */
export default function ScanBoard() {
    const scan = useScanDoc()
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = useState(false)

    if (!scanDocBaseUrl()) {
        return (
            <div className="p-6 text-sm text-muted-foreground">
                Le service de scan n'est pas configuré (variable PUBLIC_SCAN_DOC_URL).
            </div>
        )
    }

    const pick = (files: FileList | null) => {
        if (files) scan.addFiles(Array.from(files))
        // Permet de choisir à nouveau le même fichier après l'avoir retiré.
        if (inputRef.current) inputRef.current.value = ""
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            <BoardHeader
                title="Scan de fiches"
                theme={GESTION_THEME.section}
                description={`PDF ou photos (JPEG, PNG) de fiches de stock : un seul classeur Excel pour l'ensemble, ${SCAN_LIMITS.maxFiles} pages et 20 Mo au maximum.`}
            />

            <div
                role="button"
                tabIndex={0}
                aria-disabled={scan.busy}
                onClick={() => !scan.busy && inputRef.current?.click()}
                onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !scan.busy) {
                        e.preventDefault()
                        inputRef.current?.click()
                    }
                }}
                onDragOver={(e) => {
                    if (scan.busy || !e.dataTransfer.types.includes("Files")) return
                    e.preventDefault()
                    setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragActive(false)
                    if (!scan.busy) scan.addFiles(Array.from(e.dataTransfer.files))
                }}
                className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors",
                    "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    dragActive && "border-primary bg-primary/5",
                    scan.busy && "cursor-not-allowed opacity-60",
                )}
            >
                <Upload size={28} className="text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                    Déposez vos fichiers ici, ou touchez pour choisir ou prendre une photo
                </p>
                <p className="text-xs text-muted-foreground">PDF, JPEG ou PNG</p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={SCAN_ACCEPT}
                    className="hidden"
                    onChange={(e) => pick(e.target.files)}
                    data-testid="scan-input"
                />
            </div>

            {scan.rejected.length > 0 && (
                <Alert variant="destructive">
                    <AlertTitle>Fichiers refusés</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-4">
                            {scan.rejected.map((msg) => (
                                <li key={msg}>{msg}</li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {scan.items.length > 0 && (
                <ScanFileList
                    items={scan.items}
                    disabled={scan.busy}
                    onMove={scan.move}
                    onRemove={scan.remove}
                />
            )}

            {scan.error && (
                <Alert variant="destructive">
                    <AlertTitle>Le scan n'a pas abouti</AlertTitle>
                    <AlertDescription>{scan.error}</AlertDescription>
                </Alert>
            )}

            {scan.step === "done" && scan.result && (
                <Alert>
                    <CheckCircle2 size={16} />
                    <AlertTitle>Classeur prêt</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center gap-2">
                        <span>{scan.result.filename} a été téléchargé.</span>
                        <Button variant="link" className="h-auto p-0" onClick={scan.downloadAgain}>
                            <Download size={14} /> Télécharger à nouveau
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
                {scan.busy ? (
                    <>
                        <span className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                            <Loader2 size={16} className="animate-spin" />
                            {scan.step === "preparing"
                                ? "Préparation des photos…"
                                : "Lecture en cours — environ une minute pour 15 pages…"}
                        </span>
                        <Button variant="outline" onClick={scan.cancel}>
                            Annuler
                        </Button>
                    </>
                ) : (
                    <>
                        {scan.items.length > 0 && (
                            <Button variant="ghost" onClick={scan.reset}>
                                <RotateCcw size={16} /> Tout retirer
                            </Button>
                        )}
                        <Button disabled={scan.items.length === 0} onClick={() => void scan.submit()}>
                            <FileSpreadsheet size={16} />
                            {scan.step === "error" ? "Réessayer" : "Générer l'Excel"}
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}
