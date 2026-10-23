import { useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/shared/ui/atoms/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { cameraHelp } from "@/shared/lib/camera"
import { useCameraPermission, type CameraState } from "@/shared/hooks/useCameraPermission"
import { CodeScanner, type CodeScannerTexts } from "@/shared/ui/organisms/code-scanner"

const STATUS: Record<CameraState, string> = {
    checking: "Vérification…",
    granted: "Autorisée sur cet appareil.",
    prompt: "Pas encore autorisée : le navigateur la demandera.",
    denied: "Bloquée dans les réglages du navigateur.",
    "no-camera": "Aucune caméra détectée sur cet appareil.",
    busy: "Utilisée par une autre application.",
    insecure: "Indisponible : la connexion n'est pas sécurisée (HTTPS).",
    unsupported: "Ce navigateur ne prend pas en charge la caméra.",
}

const TEST_TEXTS: CodeScannerTexts = {
    title: "Tester la caméra",
    description: "Visez n'importe quel QR code : son contenu s'affichera.",
    rejected: "Code illisible.",
    insecure: "La caméra exige une connexion HTTPS.",
}

const readAny = (raw: string) => raw || null

/**
 * Caméra de **cet appareil** : comme l'abonnement push, elle dépend du
 * navigateur, qui a le dernier mot — rien n'est enregistré sur le compte.
 */
export function CameraCard() {
    const { state, requesting, request } = useCameraPermission()
    const [testing, setTesting] = useState(false)

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Caméra
                </CardTitle>
                <CardDescription>
                    Lecture des QR codes et des étiquettes sur cet appareil.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Accès à la caméra</p>
                        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                            {STATUS[state]}
                        </p>
                    </div>
                    {state === "granted" ? (
                        <Button variant="outline" size="sm" onClick={() => setTesting(true)}>
                            Tester la caméra
                        </Button>
                    ) : state === "prompt" || state === "denied" || state === "no-camera" || state === "busy" ? (
                        <Button size="sm" onClick={() => void request()} disabled={requesting}>
                            {requesting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                            {state === "prompt" ? "Autoriser la caméra" : "Réessayer"}
                        </Button>
                    ) : null}
                </div>

                {state === "denied" && (
                    <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                        <p className="mb-1 font-medium text-foreground">Pour la réautoriser :</p>
                        <ol className="list-decimal space-y-1 pl-5">
                            {cameraHelp().map((step) => (
                                <li key={step}>{step}</li>
                            ))}
                        </ol>
                    </div>
                )}

                <CodeScanner
                    open={testing}
                    onOpenChange={setTesting}
                    parse={readAny}
                    texts={TEST_TEXTS}
                    formats="qr"
                    onScan={(value) => {
                        setTesting(false)
                        toast.success(`Caméra opérationnelle — code lu : ${value.slice(0, 80)}`)
                    }}
                />
            </CardContent>
        </Card>
    )
}
