import { memo, useState } from "react"
import { History, Check, Loader2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/shared/ui/atoms/dialog"
import { Button } from "@/shared/ui/atoms/button"
import { Badge } from "@/shared/ui/atoms/badge"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import {
    useAmeliaSubmissions,
    type AmeliaSubmission,
} from "@/features/crm/hooks/CRM_hook/use_amelia_submissions"
import type { FicheAppro } from "@/features/crm/types/client"
import { capitalizeName } from "@/features/crm/utils/capitalizeName"

// Libellés FR pour les clés du brief ; fallback sur la clé brute si absente.
const FIELD_LABELS: Record<string, string> = {
    ville: "Ville",
    pays: "Pays",
    activiteType: "Type d'activité",
    boutiqueType: "Canal de vente",
    surface: "Surface (m²)",
    plateformes: "Plateformes",
    Horizon: "Horizon",
    experience: "Expérience",
    localisationType: "Zone",
    budget: "Budget",
    approvisionnement: "Approvisionnement",
    vendDeja: "Produits vendus",
    besoinsFemme: "Styles recherchés",
    Matiere: "Matières",
    marques: "Marques",
    Note: "Notes",
    language: "Langue",
    provenance: "Provenance",
}

const ORDER = Object.keys(FIELD_LABELS)

function formatValue(value: unknown): string | null {
    if (value == null || value === "") return null
    if (Array.isArray(value)) {
        if (value.length === 0) return null
        const parts = value.map((v) =>
            v && typeof v === "object" && "nom" in v
                ? String((v as { nom: unknown }).nom)
                : String(v)
        )
        return parts.join(", ")
    }
    if (typeof value === "object") return null
    return String(value)
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return iso
    }
}

const SubmissionCard = memo(function SubmissionCard({
    submission,
    index,
    isLatest,
    onApply,
    applying,
}: {
    submission: AmeliaSubmission
    index: number
    isLatest: boolean
    onApply: (s: AmeliaSubmission) => void
    applying: boolean
}) {
    const brief = submission.brief ?? {}
    // Clés connues d'abord (ordre stable), puis les éventuelles clés restantes.
    const keys = [
        ...ORDER.filter((k) => k in brief),
        ...Object.keys(brief).filter((k) => !ORDER.includes(k)),
    ]
    const rows = keys
        .map((k) => ({
            label: FIELD_LABELS[k] ?? k,
            value: formatValue((brief as Record<string, unknown>)[k]),
        }))
        .filter((r) => r.value !== null)

    return (
        <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold truncate">
                        {submission.full_name || "Sans nom"}
                    </span>
                    {isLatest && (
                        <Badge variant="secondary" className="text-[10px]">
                            Actuelle
                        </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                        v{index + 1}
                    </span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(submission.submitted_at)}
                </span>
            </div>

            {(submission.societe || submission.telephone) && (
                <p className="text-[11px] text-muted-foreground">
                    {[submission.societe, submission.telephone]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
            )}

            {rows.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                    {rows.map((r) => (
                        <div key={r.label} className="text-[11px] min-w-0">
                            <span className="text-muted-foreground">
                                {r.label} :{" "}
                            </span>
                            <span className="font-medium break-words">
                                {r.value}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end pt-1">
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    loading={applying}
                    onClick={() => onApply(submission)}
                >
                    {!applying && <Check className="h-3 w-3" />}
                    Appliquer cette version
                </Button>
            </div>
        </div>
    )
})

export const AmeliaVersions = memo(function AmeliaVersions() {
    const { customer, fiche, setFiche, update_fiche_client } = useCRMContext()
    const { submissions, loading } = useAmeliaSubmissions(customer?.id)
    const [open, setOpen] = useState(false)
    const [applyingId, setApplyingId] = useState<string | null>(null)

    // Rien à afficher si aucune soumission Amelia pour ce client.
    if (!loading && submissions.length === 0) return null

    const handleApply = async (s: AmeliaSubmission) => {
        if (!customer?.id) return
        setApplyingId(s.id)
        try {
            // Merge sur la fiche courante pour conserver les champs requis de
            // FicheAppro absents de la soumission, puis on écrase avec la version.
            const mergedBrief = {
                ...fiche,
                ...(s.brief ?? {}),
            } as FicheAppro
            await update_fiche_client({
                id: customer.id,
                brief: mergedBrief,
                ...(s.full_name ? { nom: capitalizeName(s.full_name) } : {}),
                ...(s.societe ? { societe: s.societe } : {}),
                ...(s.telephone ? { telephone: s.telephone } : {}),
            })
            setFiche(mergedBrief)
            setOpen(false)
        } finally {
            setApplyingId(null)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                >
                    <History className="h-3.5 w-3.5" />
                    Versions Amelia
                    {submissions.length > 0 && (
                        <Badge
                            variant="secondary"
                            className="ml-0.5 px-1.5 text-[10px]"
                        >
                            {submissions.length}
                        </Badge>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        Versions des infos Amelia
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Chaque prise de RDV via Amelia archive les infos
                        remplies. Applique la version souhaitée sur la fiche.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                    {loading ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        submissions.map((s, i) => (
                            <SubmissionCard
                                key={s.id}
                                submission={s}
                                index={submissions.length - 1 - i}
                                isLatest={i === 0}
                                onApply={handleApply}
                                applying={applyingId === s.id}
                            />
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
})
