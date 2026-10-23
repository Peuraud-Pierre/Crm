import { CodeScanner as SharedCodeScanner, type CodeScannerTexts } from "@/shared/ui/organisms/code-scanner"
import { parseEmplacementCode } from "@/features/stock_handpick/utils/emplacementCode"

interface CodeScannerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onScan: (id: string) => void
    /** Saisie manuelle (chemin ou code) ; `false` si elle ne désigne rien. */
    onManual: (text: string) => boolean
}

const TEXTS: CodeScannerTexts = {
    title: "Scanner une étiquette",
    description: "Visez le QR code de l'emplacement.",
    rejected: "Code non reconnu : ce n'est pas une étiquette d'emplacement.",
    manualNotFound: "Aucun emplacement ne correspond à ce code.",
    manualPlaceholder: "Ou tapez le chemin : B R2 E3 H1",
    manualLabel: "Code de l'emplacement",
    insecure: "La caméra exige une connexion HTTPS. Saisissez le code de l'emplacement.",
}

/** Lecture d'une étiquette d'emplacement — le lecteur vit dans `shared/ui/organisms/code-scanner`. */
export function CodeScanner(props: CodeScannerProps) {
    return <SharedCodeScanner {...props} parse={parseEmplacementCode} texts={TEXTS} formats="qr" />
}
