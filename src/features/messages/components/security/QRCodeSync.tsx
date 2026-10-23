import { useState, useEffect } from "react"
import QRCode from "qrcode"
import { Button } from "@/shared/ui/atoms/button"
import { QrCode, X } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { CodeScanner, type CodeScannerTexts } from "@/shared/ui/organisms/code-scanner"

/**
 * Génère un token temporaire contenant l'exportKey PAKE pour la synchronisation multi-device
 */
async function generateSyncToken(exportKey: string): Promise<string> {
    const payload = {
        exportKey,
        timestamp: Date.now(),
        version: "1.0",
    }
    return btoa(JSON.stringify(payload))
}

/**
 * Parse et valide un token de synchronisation
 */
function parseSyncToken(token: string): { exportKey: string; timestamp: number } | null {
    try {
        const decoded = JSON.parse(atob(token))
        const age = Date.now() - decoded.timestamp

        // Token expire après 10 minutes
        if (age > 10 * 60 * 1000) {
            console.error("Token expiré")
            return null
        }

        return {
            exportKey: decoded.exportKey,
            timestamp: decoded.timestamp,
        }
    } catch (error) {
        console.error("Token invalide:", error)
        return null
    }
}

type QRCodeExportProps = {
    exportKey: string
    onClose: () => void
}

/**
 * Composant pour afficher un QR Code contenant l'exportKey PAKE
 */
export function QRCodeExport({ exportKey, onClose }: QRCodeExportProps) {
    const [qrDataUrl, setQrDataUrl] = useState<string>("")

    useEffect(() => {
        async function generateQR() {
            const token = await generateSyncToken(exportKey)
            const dataUrl = await QRCode.toDataURL(token, {
                width: 300,
                margin: 2,
                errorCorrectionLevel: "M",
            })
            setQrDataUrl(dataUrl)
        }
        void generateQR()
    }, [exportKey])

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Synchroniser un nouvel appareil
                    </DialogTitle>
                    <DialogDescription>
                        Scannez ce QR Code depuis votre autre appareil pour le synchroniser
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4 py-4">
                    {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR Code de synchronisation" className="rounded-lg" />
                    ) : (
                        <Skeleton className="h-[300px] w-[300px] rounded-lg" />
                    )}

                    <div className="text-sm text-muted-foreground text-center">
                        ⏱️ Ce code expire dans 10 minutes
                    </div>

                    <Button onClick={onClose} variant="outline" className="w-full">
                        <X className="h-4 w-4 mr-2" />
                        Fermer
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

type QRCodeImportProps = {
    onScanSuccess: (exportKey: string) => void
    onClose: () => void
}

const IMPORT_TEXTS: CodeScannerTexts = {
    title: "Scanner le QR Code",
    description: "Placez le QR Code devant la caméra pour synchroniser cet appareil",
    rejected: "QR Code invalide ou expiré",
    insecure: "La caméra exige une connexion HTTPS.",
}

const parseExportKey = (raw: string) => parseSyncToken(raw)?.exportKey ?? null

/**
 * Scanne le QR Code d'un autre appareil pour importer l'exportKey PAKE — par
 * le lecteur partagé, qui gère aussi la permission caméra.
 */
export function QRCodeImport({ onScanSuccess, onClose }: QRCodeImportProps) {
    return (
        <CodeScanner
            open
            onOpenChange={(next) => {
                if (!next) onClose()
            }}
            onScan={onScanSuccess}
            parse={parseExportKey}
            texts={IMPORT_TEXTS}
            formats="qr"
        />
    )
}
