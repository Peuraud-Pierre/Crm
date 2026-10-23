import { useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertTriangle, ClipboardList, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { TRI_PERMISSIONS } from "@/features/salle-de-tri/constants"
import { formatDuree, formatKg } from "@/features/salle-de-tri/utils/triAnalytics"
import {
    checkHoraires,
    draftFromFiche,
    newBalle,
    toBallesInput,
    totauxDraft,
    toTimeInput,
    type BalleDraft,
} from "@/features/salle-de-tri/utils/triDraft"
import type { FicheTriComplete } from "@/features/salle-de-tri/types/tri.types"
import { FicheTriBallesEditor } from "./FicheTriBallesEditor"

interface FicheTriSheetProps {
    open: boolean
    /** Fiche à modifier ; absente, c'est une création. */
    fiche: FicheTriComplete | null
    onClose: () => void
    /** Appelé avec l'id de la fiche enregistrée. */
    onSaved: (id: string) => void
}

const today = () => format(new Date(), "yyyy-MM-dd")

/**
 * Saisie d'une feuille de tri par le responsable : l'en-tête (trieur, date,
 * horaires) puis une carte par balle — le fournisseur est celui de chaque
 * balle, une séance en trie de plusieurs. Un trieur absent du
 * référentiel s'ajoute depuis le champ même, sans quitter la saisie.
 *
 * Un écart entre poids initial et répartition ne bloque JAMAIS
 * l'enregistrement : il est montré ici, puis signalé sur la fiche.
 */
export function FicheTriSheet({ open, fiche, onClose, onSaved }: FicheTriSheetProps) {
    const { hasPermission } = useAuth()
    const { trieurs, saveFiche, createTrieur } = useTriContext()

    const [trieurId, setTrieurId] = useState("")
    const [dateTri, setDateTri] = useState(today)
    const [heureDebut, setHeureDebut] = useState("")
    const [heureFin, setHeureFin] = useState("")
    const [balles, setBalles] = useState<BalleDraft[]>(() => [newBalle()])
    const [showErrors, setShowErrors] = useState(false)
    const [saving, setSaving] = useState(false)

    // (Ré)initialisation à chaque ouverture — une sheet rouverte sur une autre
    // fiche ne garde rien de la précédente —, AJUSTÉE PENDANT LE RENDU plutôt
    // que dans un effet : le formulaire s'affiche directement avec les bonnes
    // valeurs, sans une première passe sur celles de l'ouverture précédente.
    const openKey = open ? (fiche?.id ?? "new") : null
    const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null)
    if (openKey !== prevOpenKey) {
        setPrevOpenKey(openKey)
        if (openKey !== null) {
            setTrieurId(fiche?.trieur_id ?? "")
            setDateTri(fiche?.date_tri ?? today())
            setHeureDebut(toTimeInput(fiche?.heure_debut))
            setHeureFin(toTimeInput(fiche?.heure_fin))
            setBalles(fiche ? draftFromFiche(fiche) : [newBalle()])
            setShowErrors(false)
        }
    }

    const trieurOptions = useMemo(
        () => trieurs
            .filter((t) => t.actif || t.id === trieurId)
            .map((t) => ({ value: t.id, label: t.nom, icon: UserRound })),
        [trieurs, trieurId],
    )

    const horaires = checkHoraires(heureDebut, heureFin)
    const enteteComplet = !!trieurId && !!dateTri && horaires.ok
    const totaux = totauxDraft(balles)

    const submit = async () => {
        setShowErrors(true)
        const parsed = toBallesInput(balles)
        if (!enteteComplet || !parsed.ok) {
            if (!parsed.ok) toast.error(parsed.problemes[0])
            else if (!horaires.ok) toast.error(horaires.probleme)
            return
        }
        setSaving(true)
        try {
            const id = await saveFiche(
                {
                    id: fiche?.id,
                    date_tri: dateTri,
                    trieur_id: trieurId,
                    heure_debut: heureDebut || null,
                    heure_fin: heureFin || null,
                },
                parsed.balles,
            )
            if (id) {
                toast.success(fiche ? `Fiche ${fiche.code} modifiée` : "Fiche de tri enregistrée", {
                    description: totaux.ecarts > 0
                        ? `${totaux.ecarts} balle${totaux.ecarts > 1 ? "s" : ""} en écart, signalée${totaux.ecarts > 1 ? "s" : ""} sur la fiche.`
                        : undefined,
                })
                onSaved(id)
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <FormSheet
            open={open}
            onClose={onClose}
            icon={ClipboardList}
            title={fiche ? `Modifier la fiche ${fiche.code}` : "Nouvelle fiche de tri"}
            description="Recopie de la feuille du trieur : qui et quand, puis une carte par balle ouverte — son fournisseur, sa catégorie et la répartition de ses kilos."
            size="xl"
            onSubmit={submit}
            submitLabel={fiche ? "Enregistrer" : "Enregistrer la fiche"}
            loading={saving}
            footerSummary={<TotauxBar {...totaux} />}
        >
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="En-tête de la fiche">
                <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold">Trieur <span className="text-destructive">*</span></Label>
                    <SearchSelect
                        options={trieurOptions}
                        value={trieurId}
                        onChange={(value) => setTrieurId(value)}
                        placeholder="Choisir un trieur"
                        variant="input"
                        size="md"
                        required
                        showValidation={showErrors}
                        emptyMessage="Aucun trieur"
                        onCreate={hasPermission(TRI_PERMISSIONS.create)
                            ? async (nom) => {
                                const created = await createTrieur({ nom, actif: true })
                                if (created) setTrieurId(created.id)
                            }
                            : undefined}
                        createLabel="Ajouter le trieur"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="tri-date" className="text-sm font-semibold">Date du tri <span className="text-destructive">*</span></Label>
                    <Input id="tri-date" type="date" value={dateTri} max={today()} onChange={(e) => setDateTri(e.target.value)} className="h-10" />
                </div>
                <Horaires
                    debut={heureDebut}
                    fin={heureFin}
                    onDebut={setHeureDebut}
                    onFin={setHeureFin}
                    probleme={horaires.ok ? null : horaires.probleme}
                    minutes={horaires.ok ? horaires.minutes : null}
                    showErrors={showErrors}
                />
            </section>

            <section className="flex flex-col gap-3" aria-label="Balles triées">
                <h3 className="text-sm font-semibold">Balles triées</h3>
                <FicheTriBallesEditor balles={balles} setBalles={setBalles} showErrors={showErrors} />
            </section>
        </FormSheet>
    )
}

interface HorairesProps {
    debut: string
    fin: string
    onDebut: (v: string) => void
    onFin: (v: string) => void
    probleme: string | null
    minutes: number | null
    showErrors: boolean
}

/**
 * Plage de travail : deux sélecteurs d'heure, la durée se déduit. Une plage
 * à moitié saisie n'est signalée qu'à l'enregistrement — pendant la frappe,
 * c'est une étape normale.
 */
function Horaires({ debut, fin, onDebut, onFin, probleme, minutes, showErrors }: HorairesProps) {
    // Fin avant début : faux quoi qu'on tape ensuite, on le dit tout de suite.
    const visible = probleme && (showErrors || (debut && fin))
    return (
        <fieldset className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
            <legend className="mb-2 text-sm font-semibold">Horaires</legend>
            <div
                className={cn(
                    "flex h-10 items-center rounded-md border bg-background",
                    visible ? "border-destructive/60" : "border-input",
                )}
            >
                <input
                    type="time"
                    value={debut}
                    onChange={(e) => onDebut(e.target.value)}
                    aria-label="Heure de début"
                    className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm tabular-nums outline-none"
                />
                <span className="text-muted-foreground" aria-hidden>→</span>
                <input
                    type="time"
                    value={fin}
                    min={debut || undefined}
                    onChange={(e) => onFin(e.target.value)}
                    aria-label="Heure de fin"
                    className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm tabular-nums outline-none"
                />
            </div>
            <p className={cn("text-xs", visible ? "text-destructive" : "text-muted-foreground")}>
                {visible ? probleme : minutes !== null ? `Durée : ${formatDuree(minutes)}` : "Facultatif — sert au calcul des kg/h"}
            </p>
        </fieldset>
    )
}

/** Totaux en direct, collés au pied de la saisie. */
function TotauxBar({ balles, initial, reparti, ecarts }: ReturnType<typeof totauxDraft>) {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-live="polite">
            <span><span className="font-semibold tabular-nums text-foreground">{balles}</span> balle{balles > 1 ? "s" : ""}</span>
            <span><span className="font-semibold tabular-nums text-foreground">{formatKg(initial)}</span> triés</span>
            <span><span className="font-semibold tabular-nums text-foreground">{formatKg(reparti)}</span> répartis</span>
            {ecarts > 0 && (
                <span
                    className="inline-flex items-center gap-1 font-medium text-warning"
                    title="Un écart n'empêche pas d'enregistrer : il sera signalé sur la fiche."
                >
                    <AlertTriangle size={12} aria-hidden />
                    {ecarts} en écart
                    <span className="hidden sm:inline">· enregistrable, signalé sur la fiche</span>
                </span>
            )}
        </div>
    )
}
