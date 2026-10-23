import { useCallback, useMemo, useRef, useState } from "react"
import { AlertCircle, ClipboardList, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { DetailSheet } from "@/shared/ui/organisms/detail-sheet"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useReferentialContext } from "@/features/stock/hooks/context/StockProvider"
import { usePackingList } from "@/features/stock/hooks/data/usePackingList"
import { usePackingImport } from "@/features/stock/hooks/ui/usePackingImport"
import { usePackingModelStats } from "@/features/stock/hooks/data/usePackingModelStats"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { packingGap, type PackingSort } from "@/features/stock/utils/packingGrouping"
import { containerLabelMatches } from "@/features/stock/utils/packingDocument"
import { packingTeaching, type PackingTeaching } from "@/features/stock/utils/packingLearning"
import { fetchMappingsForKeys } from "@/features/stock/services/packingLabelDictionaryService"
import { ArrivagePackingSheetFallback } from "./ArrivagePackingSheetFallback"
import { PackingDropzone } from "./PackingDropzone"
import { PackingImportProgress } from "./PackingImportProgress"
import { PackingReviewPanel } from "./PackingReviewPanel"
import { PackingReviewToolbar, type PackingReviewFilter } from "./PackingReviewToolbar"
import { PackingSheetActions } from "./PackingSheetActions"
import { PackingStatusBadge } from "./PackingStatusBadge"
import { PackingValidateDialog } from "./PackingValidateDialog"
import { PackingValidatedView } from "./PackingValidatedView"

interface PackingListSheetProps {
    open: boolean
    row: ArrivageManuelRow | null
    onClose: () => void
    /** Recharge les arrivages et leurs synthèses de packing. */
    onChanged: () => void | Promise<void>
}

const SKELETON_KEYS = ["s1", "s2", "s3", "s4"]

/**
 * Packing list d'un arrivage : import, vérification, consultation.
 *
 * Elle REMPLACE la fiche de l'arrivage à l'écran au lieu de s'empiler dessus —
 * une sheet dans une sheet se referme mal (voir `LignesPanel` du handpick).
 * La refermer ramène à la fiche, comme le formulaire d'édition.
 *
 * Le contenu suit le statut en base, jamais un état local : une packing
 * `en_traitement` reste « en traitement » si l'on ferme et rouvre la sheet,
 * et une vérification interrompue reprend où elle en était.
 *
 * Le corps n'est monté qu'ouvert : ses hooks chargent des lignes et
 * s'abonnent au realtime, rien de cela n'a lieu d'être sheet fermée.
 */
export function PackingListSheet({ open, row, onClose, onChanged }: PackingListSheetProps) {
    if (!open || !row) return null
    return <PackingListSheetBody key={row.id} row={row} onClose={onClose} onChanged={onChanged} />
}

function PackingListSheetBody({
    row,
    onClose,
    onChanged,
}: Omit<PackingListSheetProps, "open" | "row"> & { row: ArrivageManuelRow }) {
    const { hasPermission } = useAuth()
    const canCreate = hasPermission(STOCK_PERMISSIONS.packingCreate)
    const canUpdate = hasPermission(STOCK_PERMISSIONS.packingUpdate)
    const canDelete = hasPermission(STOCK_PERMISSIONS.packingDelete)
    // Créer une catégorie à la volée exige les deux droits : classer ET
    // enrichir le référentiel (le même que Paramètres → Catégories).
    const canCreateCategory = canUpdate && hasPermission(STOCK_PERMISSIONS.settingsCreate)

    const packing = row.packing ?? null
    const list = usePackingList(packing?.id ?? null, onChanged)
    const onImported = useCallback(async () => {
        await onChanged()
    }, [onChanged])
    const importer = usePackingImport({ arrivageId: row.id, onImported })
    // Ce que le classement a appris, affiché LÀ où l'effort est fourni et plus
    // seulement dans Paramètres. Le hook tolère l'absence de service comme son
    // indisponibilité : ni l'un ni l'autre ne bloque la vérification.
    const learning = usePackingModelStats()

    const { categories, createCategory } = useReferentialContext()
    // Création immédiate, sans formulaire : le nom est le seul champ exigé.
    // `tag: ""` ne veut pas dire « sans tag » mais « déduis-le » — le service
    // en fabrique un à partir du nom, parce qu'une catégorie sans tag produit un
    // BIN tronqué à la première balle. Prix et poids, eux, se complètent bien
    // ensuite dans Paramètres → Catégories.
    // Le verrou évite deux catégories jumelles sur un double déclenchement.
    const creatingCategoryRef = useRef(false)
    const createCategoryAndAssign = async (name: string, assign: (categoryId: string) => void) => {
        if (creatingCategoryRef.current) return
        creatingCategoryRef.current = true
        try {
            // `null` : échec déjà signalé par le référentiel.
            const created = await createCategory({ name, tag: "", unit_price: 0, unit_weight: 0 })
            if (!created) return
            assign(created.id)
            // Le tag est affiché : c'est lui qui apparaîtra dans les BIN, et
            // c'est le seul moment où la personne peut constater ce qu'il vaut.
            toast.success(
                created.tag
                    ? `Catégorie « ${created.name} » (${created.tag}) créée et attribuée`
                    : `Catégorie « ${created.name} » créée et attribuée`,
            )
        } finally {
            creatingCategoryRef.current = false
        }
    }
    const categoryOptions: SearchSelectOption[] = useMemo(
        () =>
            [...categories]
                .sort((a, b) => a.name.localeCompare(b.name, "fr"))
                .map((c) => ({ value: c.id, label: c.name, subLabel: c.tag || undefined })),
        [categories],
    )
    const categoryName = useMemo(() => {
        const byId = new Map(categories.map((c) => [c.id, c.name]))
        return (id: string | null) => (id ? byId.get(id) ?? "Catégorie supprimée" : "Sans catégorie")
    }, [categories])

    const [filter, setFilter] = useState<PackingReviewFilter>("to_review")
    const [labelQuery, setLabelQuery] = useState("")
    const [sort, setSort] = useState<PackingSort>("risque")
    const [validating, setValidating] = useState(false)

    const gap = packingGap(row, packing)
    // Le fichier parle-t-il bien du conteneur de cet arrivage ? Une packing
    // juste mais attachée au mauvais arrivage reste une erreur d'inventaire,
    // et rien d'autre ne la détecte.
    //
    // C'est le n° INTERNE qui tranche : « CONTENEUR GR 153 » en tête du fichier
    // se rapproche de « GR 153 », pas du n° ISO du conteneur, qui n'y figure
    // jamais. Le confronter au seul `container_no` allumait l'alerte sur tous
    // les arrivages.
    const containerMatches = containerLabelMatches(packing?.container_label ?? null, {
        internalRef: row.conteneur_no_raw,
        containerNo: row.container_no,
    })

    /**
     * Ce que la validation va enseigner au tableau de correspondance, mesuré
     * AVANT de valider : après, les lignes sont rechargées et la distinction
     * entre « tranché à la main » et « repris du tableau » a disparu.
     *
     * Les clés déjà connues sont relues en base plutôt que déduites des groupes
     * `dictionary` affichés : un libellé reconnu puis corrigé à la main est
     * devenu `reviewed`, il a quitté cette liste, et on le compterait comme
     * nouveau.
     */
    const [teaching, setTeaching] = useState<PackingTeaching | null>(null)

    const requestValidate = async () => {
        const reviewed = list.groups.filter((g) => g.state === "reviewed")
        if (reviewed.length === 0) return handleValidate()

        setValidating(true)
        let known = new Set<string>()
        try {
            known = new Set((await fetchMappingsForKeys(reviewed.map((g) => g.key))).keys())
        } catch (error) {
            // Lecture d'agrément : son échec ne doit pas empêcher de valider.
            // Le décompte sera simplement optimiste sur les « nouvelles ».
            console.error("[PackingListSheet] dictionnaire:", error)
        } finally {
            setValidating(false)
        }

        const next = packingTeaching(list.groups, known)
        // Rien d'appris : pas de cérémonie vide, on valide.
        if (next.created === 0) return handleValidate()
        setTeaching(next)
    }

    const handleValidate = async () => {
        setTeaching(null)
        setValidating(true)
        try {
            await list.validate()
            toast.success("Packing list validée")
        } catch (error) {
            toast.error(error instanceof Error ? `Validation refusée : ${error.message}` : "Validation refusée")
            await list.fetchLignes()
        } finally {
            setValidating(false)
        }
    }

    const guarded = (action: () => Promise<void>, failure: string) => async () => {
        try {
            await action()
        } catch (error) {
            toast.error(failure)
            console.error("[PackingListSheet]", error)
        }
    }

    const replace = guarded(async () => {
        await list.remove()
        importer.reset()
    }, "La packing list n'a pas pu être supprimée")

    const status = packing?.status
    const reviewing = status === "a_verifier"

    // ── Corps selon l'état ──────────────────────────────────────────────────
    let body
    if (importer.step === "sending") {
        body = <PackingImportProgress phase="sending" fileName={importer.file?.name} />
    } else if (!packing) {
        body = canCreate ? (
            <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    Déposez le fichier Excel du fournisseur. Les libellés déjà validés sur un précédent
                    conteneur seront reconnus d'office ; vous n'aurez à classer que les nouveaux.
                </p>
                <PackingDropzone onFile={importer.start} error={importer.error} />
            </div>
        ) : (
            <EmptyState
                size="sm"
                icon={FileSpreadsheet}
                title="Aucune packing list"
                description="Cet arrivage n'a pas encore de packing list."
                className="rounded-xl border border-dashed border-border"
            />
        )
    } else if (status === "en_traitement") {
        body = <PackingImportProgress phase="processing" fileName={packing.source_filename} />
    } else if (status === "echec") {
        body = (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" aria-hidden />
                <div className="space-y-1 text-sm">
                    <p className="font-medium text-destructive">L'import n'a pas abouti</p>
                    <p className="text-muted-foreground">
                        {packing.error_message ?? "Le fichier n'a pas pu être lu."}
                    </p>
                </div>
            </div>
        )
    } else if (list.loading && list.lignes.length === 0) {
        body = (
            <div className="flex flex-col gap-2" role="status" aria-label="Chargement de la packing list">
                {SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className="h-20 w-full rounded-lg" />
                ))}
            </div>
        )
    } else if (reviewing) {
        body = (
            <PackingReviewPanel
                groups={list.groups}
                filter={filter}
                labelQuery={labelQuery}
                sort={sort}
                categoryOptions={categoryOptions}
                categoryName={categoryName}
                dictionaryLabels={list.dictionaryLabels}
                onAssignGroup={canUpdate ? list.assignGroup : undefined}
                onAcceptGroup={canUpdate ? list.acceptGroup : undefined}
                onAcceptMany={canUpdate ? list.acceptMany : undefined}
                onAssignLigne={canUpdate ? list.assignLigne : undefined}
                onCreateCategory={canCreateCategory ? createCategoryAndAssign : undefined}
                onUndo={canUpdate ? list.undo : undefined}
                undoLabels={list.undoLabels}
            />
        )
    } else {
        body = <PackingValidatedView summary={packing} lignes={list.lignes} categoryName={categoryName} />
    }

    // ── Pied ────────────────────────────────────────────────────────────────
    const canReplace = Boolean(packing) && canDelete && canCreate && status !== "en_traitement"
    const actions =
        packing && importer.step !== "sending" ? (
            <PackingSheetActions
                onReopen={status === "validee" && canUpdate ? guarded(list.reopen, "La vérification n'a pas pu être rouverte") : undefined}
                onReplace={canReplace ? replace : undefined}
                replaceLabel={status === "echec" ? "Réessayer avec un autre fichier" : undefined}
                onDelete={canDelete ? guarded(list.remove, "La packing list n'a pas pu être supprimée") : undefined}
            />
        ) : null
    const hasActions =
        packing !== null && (canDelete || (status === "validee" && canUpdate))

    return (
        <DetailSheet
            open
            onOpenChange={(value) => {
                if (!value) onClose()
            }}
            size="wide"
            icon={ClipboardList}
            title="Packing list"
            subtitle={
                <>
                    <span className="font-mono">{row.container_no}</span>
                    {packing?.source_filename && (
                        <span className="truncate">· {packing.source_filename}</span>
                    )}
                </>
            }
            badge={packing ? <PackingStatusBadge status={packing.status} /> : undefined}
            toolbar={
                reviewing && list.lignes.length > 0 && packing ? (
                    <PackingReviewToolbar
                        summary={packing}
                        progress={list.progress}
                        gap={gap}
                        containerMatches={containerMatches}
                        expectedContainerRef={row.conteneur_no_raw}
                        modelStats={learning.stats}
                        filter={filter}
                        onFilterChange={setFilter}
                        labelQuery={labelQuery}
                        onLabelQueryChange={setLabelQuery}
                        sort={sort}
                        onSortChange={setSort}
                        onValidate={canUpdate ? requestValidate : undefined}
                        validating={validating}
                    />
                ) : undefined
            }
            footer={hasActions ? actions : undefined}
        >
            {body}
            {!canUpdate && reviewing && <ArrivagePackingSheetFallback />}
            {teaching && (
                <PackingValidateDialog
                    open
                    onOpenChange={(value) => !value && setTeaching(null)}
                    teaching={teaching}
                    onConfirm={handleValidate}
                />
            )}

        </DetailSheet>
    )
}
