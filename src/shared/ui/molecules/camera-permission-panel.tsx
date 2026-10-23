import { Camera, CameraOff, Loader2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cameraHelp } from "@/shared/lib/camera"
import type { CameraState } from "@/shared/hooks/useCameraPermission"
import { cn } from "@/shared/lib/utils"

interface CameraPermissionPanelProps {
    state: CameraState
    requesting: boolean
    /** Doit rester un vrai `onClick` : l'invite du navigateur en dépend. */
    onRequest: () => void
    /** Message hors HTTPS, propre à l'appelant (que saisir à la place). */
    insecureText?: string
    className?: string
}

const COPY: Record<Exclude<CameraState, "granted" | "checking">, { title: string; text: string }> = {
    prompt: {
        title: "Autoriser la caméra",
        text: "La caméra sert à lire les QR codes et les étiquettes. Votre navigateur va vous demander l'autorisation ; elle n'est utilisée que pendant le scan.",
    },
    denied: {
        title: "Caméra bloquée",
        text: "L'accès à la caméra a été refusé pour ce site. Le navigateur ne le redemandera pas tout seul :",
    },
    "no-camera": {
        title: "Aucune caméra détectée",
        text: "Branchez ou activez une caméra, puis réessayez.",
    },
    busy: {
        title: "Caméra déjà utilisée",
        text: "Une autre application ou un autre onglet se sert de la caméra. Fermez-le, puis réessayez.",
    },
    insecure: {
        title: "Connexion non sécurisée",
        text: "Le navigateur n'autorise la caméra que sur une connexion HTTPS.",
    },
    unsupported: {
        title: "Caméra non prise en charge",
        text: "Ce navigateur ne permet pas d'utiliser la caméra.",
    },
}

/**
 * Ce qui empêche la caméra de tourner, et comment y remédier. Ne rend rien
 * quand l'accès est accordé : l'appelant affiche alors son flux vidéo.
 */
export function CameraPermissionPanel({
    state,
    requesting,
    onRequest,
    insecureText,
    className,
}: CameraPermissionPanelProps) {
    if (state === "granted") return null

    if (state === "checking") {
        return (
            <div role="status" className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Vérification de l'accès à la caméra…
            </div>
        )
    }

    const { title, text } = COPY[state]
    const blocked = state === "denied"
    // Rien à retenter hors HTTPS ou sans API caméra : le navigateur refusera.
    const actionable = state !== "insecure" && state !== "unsupported"

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn("flex flex-col items-center gap-3 rounded-xl bg-muted p-6 text-center", className)}
        >
            <div
                className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full",
                    state === "prompt" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
                )}
            >
                {state === "prompt" ? <Camera className="h-6 w-6" aria-hidden /> : <CameraOff className="h-6 w-6" aria-hidden />}
            </div>
            <div className="space-y-1">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">
                    {state === "insecure" && insecureText ? insecureText : text}
                </p>
            </div>
            {blocked && (
                <ol className="list-decimal space-y-1 pl-5 text-left text-xs text-muted-foreground">
                    {cameraHelp().map((step) => (
                        <li key={step}>{step}</li>
                    ))}
                </ol>
            )}
            {actionable && (
                <Button onClick={onRequest} disabled={requesting}>
                    {requesting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
                    {state === "prompt" ? "Autoriser la caméra" : "Réessayer"}
                </Button>
            )}
        </div>
    )
}
