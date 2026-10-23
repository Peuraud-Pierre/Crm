import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { Html5Qrcode, type Html5QrcodeSupportedFormats } from "html5-qrcode"
import { toast } from "sonner"
import { classifyCameraError } from "@/shared/lib/camera"
import { useCameraPermission } from "@/shared/hooks/useCameraPermission"
import { CameraPermissionPanel } from "@/shared/ui/molecules/camera-permission-panel"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"

/**
 * Familles de codes lues par la caméra. `qr` : étiquettes logistiques ;
 * `ean` : codes-barres EAN-13 des étiquettes produit. Lire moins de formats
 * accélère le décodage, d'où le choix explicite à l'appel.
 */
export type ScannerFormats = "qr" | "ean" | "qr+ean"

// Valeurs de l'enum `Html5QrcodeSupportedFormats` (QR_CODE = 0, EAN_13 = 9),
// écrites en dur : importer l'enum à l'exécution casserait les tests qui
// simulent `html5-qrcode` en ne fournissant que la classe `Html5Qrcode`.
const QR_CODE = 0 as Html5QrcodeSupportedFormats
const EAN_13 = 9 as Html5QrcodeSupportedFormats

const FORMATS: Record<ScannerFormats, Html5QrcodeSupportedFormats[]> = {
    qr: [QR_CODE],
    ean: [EAN_13],
    "qr+ean": [QR_CODE, EAN_13],
}

/** Textes affichés : le scanner ne sait pas ce qu'il lit, l'appelant le dit. */
export interface CodeScannerTexts {
    title: string
    description: string
    /** Toast quand un code lu n'est pas reconnu par `parse`. */
    rejected: string
    /** Toast quand la saisie manuelle ne désigne rien. */
    manualNotFound?: string
    manualPlaceholder?: string
    manualLabel?: string
    /** Message hors HTTPS, la caméra y étant refusée par le navigateur. */
    insecure: string
}

export interface CodeScannerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Code lu et reconnu : la valeur rendue par `parse`. */
    onScan: (value: string) => void
    /** Saisie manuelle ; `false` si elle ne désigne rien. Absente : pas de champ. */
    onManual?: (text: string) => boolean
    /** Texte brut lu → valeur métier, ou `null` si le code est étranger. */
    parse: (raw: string) => string | null
    texts: CodeScannerTexts
    formats?: ScannerFormats
}

/**
 * Lecture d'une étiquette à la caméra arrière. S'arrête au premier code
 * valide ; un code étranger est signalé une seule fois, le lecteur continue.
 * La caméra exige HTTPS (ou localhost) : sinon, la saisie manuelle reste.
 *
 * La caméra ne démarre que si le navigateur l'a déjà accordée. Sinon, un
 * panneau explique pourquoi et propose « Autoriser la caméra » : la demande
 * part de ce clic, seul moyen pour que Safari et les PWA iOS affichent leur
 * invite (un démarrage depuis un effet, hors geste, y est refusé en silence).
 */
export function CodeScanner({
    open,
    onOpenChange,
    onScan,
    onManual,
    parse,
    texts,
    formats = "qr",
}: CodeScannerProps) {
    const regionId = `code-scanner-${useId().replace(/:/g, "")}`
    const camera = useCameraPermission({ enabled: open })
    const granted = camera.state === "granted"
    const report = camera.report
    // Le contenu du dialog est porté (portal) et monté après l'ouverture : la
    // caméra démarre quand la zone vidéo existe vraiment, pas à `open`. La
    // zone n'est rendue qu'une fois l'accès accordé.
    const [region, setRegion] = useState<HTMLDivElement | null>(null)
    const [manual, setManual] = useState("")
    // Le lecteur rappelle le callback ~10×/s : une seule prise en compte.
    const handledRef = useRef(false)
    const lastRejectedRef = useRef<string | null>(null)
    // Les callbacks changent à chaque rendu de l'appelant : les lire par ref
    // évite de redémarrer la caméra à chaque rendu.
    const latestRef = useRef({ onScan, parse, rejected: texts.rejected })
    latestRef.current = { onScan, parse, rejected: texts.rejected }

    useEffect(() => {
        if (!open || !region || !granted) return
        handledRef.current = false
        lastRejectedRef.current = null
        const scanner = new Html5Qrcode(region.id, { formatsToSupport: FORMATS[formats], verbose: false })
        // Un code-barres est large et bas : un cadre carré le couperait.
        const qrbox = formats === "ean" ? { width: 280, height: 140 } : { width: 240, height: 240 }
        // Fermé pendant le démarrage (permission, flux vidéo : 0,5 à 2 s) :
        // `stop()` lève tant que la caméra ne tourne pas, on l'arrête donc
        // dès que le démarrage aboutit, et ses lectures sont ignorées.
        let disposed = false
        const starting = scanner
            .start(
                { facingMode: "environment" },
                { fps: 10, qrbox },
                (text) => {
                    if (disposed || handledRef.current) return
                    const value = latestRef.current.parse(text)
                    if (value) {
                        handledRef.current = true
                        latestRef.current.onScan(value)
                        return
                    }
                    if (lastRejectedRef.current !== text) {
                        lastRejectedRef.current = text
                        toast.error(latestRef.current.rejected)
                    }
                },
                () => {
                    // Pas de code dans l'image : normal entre deux lectures.
                },
            )
            .then(() => true)
            .catch((error: unknown) => {
                console.error(error)
                // Refus, caméra absente ou occupée : le panneau dit laquelle.
                if (!disposed) report(classifyCameraError(error))
                return false
            })
        return () => {
            disposed = true
            void starting.then((running) => {
                if (running) return scanner.stop().then(() => scanner.clear())
            }).catch(console.error)
        }
    }, [open, region, granted, formats, report])

    const submitManual = (event: FormEvent) => {
        event.preventDefault()
        if (!onManual || !manual.trim()) return
        if (onManual(manual)) setManual("")
        else if (texts.manualNotFound) toast.error(texts.manualNotFound)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{texts.title}</DialogTitle>
                    <DialogDescription>{texts.description}</DialogDescription>
                </DialogHeader>
                {granted ? (
                    <div
                        id={regionId}
                        ref={setRegion}
                        className={formats === "ean"
                            ? "aspect-video w-full overflow-hidden rounded-xl bg-muted"
                            : "aspect-square w-full overflow-hidden rounded-xl bg-muted"}
                    />
                ) : (
                    <CameraPermissionPanel
                        state={camera.state}
                        requesting={camera.requesting}
                        onRequest={() => void camera.request()}
                        insecureText={texts.insecure}
                    />
                )}
                {onManual && (
                    <form onSubmit={submitManual} className="flex gap-2">
                        <Input
                            value={manual}
                            onChange={(event) => setManual(event.target.value)}
                            placeholder={texts.manualPlaceholder}
                            aria-label={texts.manualLabel}
                        />
                        <Button type="submit" variant="outline">Ouvrir</Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
