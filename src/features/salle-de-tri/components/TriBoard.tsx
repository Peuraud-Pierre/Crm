import { useCallback, useMemo, useRef, useState, type ComponentType } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { BarChart3, ClipboardList, LayoutGrid, List, Plus, Users, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { BoardHeader } from "@/shared/ui/molecules/board-header"
import { VueToggle } from "@/shared/ui/molecules/vue-toggle"
import { TabButton, TabButtonGroup } from "@/shared/ui/molecules/tab-button-group"
import { ExportButton } from "@/shared/ui/organisms/export-button"
import { useDetailDeepLink } from "@/shared/hooks/useDetailDeepLink"
import { useResolvedDetail } from "@/shared/hooks/useResolvedDetail"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { GESTION_THEME } from "@/features/stock"
import { TRI_PERMISSIONS, TRI_ROUTE } from "@/features/salle-de-tri/constants"
import {
    TRI_AFFICHAGES,
    TRI_VUES,
    type FicheTriComplete,
    type TriAffichage,
    type TriVue,
} from "@/features/salle-de-tri/types/tri.types"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { exportTri, filterTriByRange } from "@/features/salle-de-tri/utils/triExport"
import { TriFilterBar } from "./TriFilterBar"
import { TriKpis } from "./TriKpis"
import { TriTable } from "./TriTable"
import { TriStats } from "./TriStats"
import { TriReferentiel } from "./TriReferentiel"
import { FicheTriSheet } from "./FicheTriSheet"
import { FicheTriDetailSheet, type FicheNav } from "./FicheTriDetailSheet"
import { TriOnboarding } from "./TriOnboarding"

interface VueProps {
    onOpen: (fiche: FicheTriComplete) => void
    onCreate?: () => void
    affichage: TriAffichage
}

interface VueDef {
    id: TriVue
    label: string
    shortLabel: string
    icon: LucideIcon
    /**
     * Vue d'analyse de la sélection : filtres, indicateurs et export
     * s'affichent au-dessus. Un référentiel n'en a pas besoin.
     */
    analytique: boolean
    /** La vue sait s'afficher en liste ou en cartes : la bascule apparaît. */
    affichages: boolean
    component: ComponentType<VueProps>
}

/**
 * Les vues de la page, déclarées une fois : ajouter une vue = une entrée ici
 * (et son id dans `TRI_VUES`). L'onglet, l'URL (`?vue=`) et la mise en page
 * en découlent.
 */
const VUES: readonly VueDef[] = [
    { id: "fiches", label: "Fiches de tri", shortLabel: "Fiches", icon: ClipboardList, analytique: true, affichages: true, component: TriTable },
    { id: "statistiques", label: "Statistiques", shortLabel: "Stats", icon: BarChart3, analytique: true, affichages: false, component: TriStats },
    { id: "referentiel", label: "Trieurs et types", shortLabel: "Trieurs", icon: Users, analytique: false, affichages: false, component: TriReferentiel },
]

const isVue = (v: string | null): v is TriVue => TRI_VUES.some((x) => x === v)

/**
 * Affichage préféré, gardé dans ce navigateur. Un stockage indisponible
 * (navigation privée) retombe sur la liste, sans erreur.
 */
const AFFICHAGE_KEY = "salle-de-tri.affichage"

function readAffichage(): TriAffichage {
    try {
        const stored = localStorage.getItem(AFFICHAGE_KEY)
        return TRI_AFFICHAGES.find((a) => a === stored) ?? "liste"
    } catch {
        return "liste"
    }
}

function useAffichage(): [TriAffichage, (next: TriAffichage) => void] {
    const [affichage, setAffichage] = useState<TriAffichage>(readAffichage)
    const set = useCallback((next: TriAffichage) => {
        setAffichage(next)
        try {
            localStorage.setItem(AFFICHAGE_KEY, next)
        } catch {
            // Préférence non retenue : sans conséquence.
        }
    }, [])
    return [affichage, set]
}

interface TriBoardProps {
    /** Segment `detail` : `new` ou l'id d'une fiche. */
    detail?: string
}

/**
 * Page Salle de tri : l'historique des feuilles de tri saisies par le
 * responsable, ses statistiques et son référentiel.
 *
 * URL : `/salle-de-tri/:detail?` + `?vue=`. Une valeur de vue inconnue
 * retombe simplement sur « fiches », sans redirection.
 */
export default function TriBoard({ detail }: TriBoardProps) {
    const { hasPermission } = useAuth()
    const navigate = useNavigate()
    const [params, setParams] = useSearchParams()
    const { filtered, fiches, loading, fetchFiche, categoryName, sorties, trieurs } = useTriContext()

    const vueParam = params.get("vue")
    const vueId: TriVue = isVue(vueParam) ? vueParam : "fiches"
    const vue = VUES.find((v) => v.id === vueId) ?? VUES[0]
    const search = vue.id === "fiches" ? "" : `?vue=${vue.id}`

    const canCreate = hasPermission(TRI_PERMISSIONS.create)
    const canUpdate = hasPermission(TRI_PERMISSIONS.update)
    const canDelete = hasPermission(TRI_PERMISSIONS.delete)

    // Une fiche hors de la période chargée (lien partagé, journal) est lue à
    // l'unité plutôt que traitée en lien mort.
    const resolved = useResolvedDetail({
        detail,
        items: fiches,
        loaded: !loading,
        fetchOne: useCallback((id: string) => fetchFiche(id), [fetchFiche]),
    })
    const { creationOpen, editing, viewing } = useDetailDeepLink<FicheTriComplete>({
        detail,
        baseUrl: `${TRI_ROUTE}${search}`,
        canCreate,
        canUpdate,
        canView: true,
        loaded: resolved.loaded,
        find: resolved.find,
    })
    // Lire ou modifier n'est pas une adresse : l'URL désigne la fiche, ce
    // drapeau dit quelle sheet la montre.
    const [editMode, setEditMode] = useState(false)
    const [affichage, setAffichage] = useAffichage()
    const affichageRef = useRef<HTMLDivElement>(null)

    // Sans type de sortie ni trieur actif, une fiche ne peut pas aboutir :
    // la page guide vers le référentiel plutôt que d'ouvrir la saisie.
    const sortiesActives = sorties.filter((s) => s.actif).length
    const trieursActifs = trieurs.filter((t) => t.actif).length
    const pret = sortiesActives > 0 && trieursActifs > 0
    const onboarding = vue.id === "fiches" && !loading && !pret && filtered.length === 0

    const close = () => {
        setEditMode(false)
        navigate(`${TRI_ROUTE}${search}`)
    }
    const open = (fiche: FicheTriComplete) => navigate(`${TRI_ROUTE}/${fiche.id}${search}`)
    const setVue = (next: TriVue) => setParams(next === "fiches" ? {} : { vue: next })
    const create = !canCreate ? undefined : pret
        ? () => navigate(`${TRI_ROUTE}/new${search}`)
        : () => {
            toast.info("Ajoutez d'abord les types de sortie et les trieurs", {
                description: "Une fiche se saisit pour un trieur, et ses kilos se répartissent entre les types.",
            })
            setVue("referentiel")
        }

    // Fiche voisine dans l'ordre affiché (filtres compris). Une fiche ouverte
    // hors de la liste (lien partagé, autre période) n'a pas de voisines.
    const viewingIndex = viewing ? filtered.findIndex((f) => f.id === viewing.id) : -1
    const goTo = (index: number) => navigate(`${TRI_ROUTE}/${filtered[index].id}${search}`, { replace: true })
    const nav: FicheNav | undefined = viewingIndex < 0 ? undefined : {
        position: viewingIndex + 1,
        total: filtered.length,
        onPrev: viewingIndex > 0 ? () => goTo(viewingIndex - 1) : undefined,
        onNext: viewingIndex < filtered.length - 1 ? () => goTo(viewingIndex + 1) : undefined,
    }

    const lookups = useMemo(() => ({ categoryName, sorties }), [categoryName, sorties])
    const toggle = <VueToggle vues={VUES} value={vue.id} onChange={setVue} />
    const Vue = vue.component

    return (
        <div className="flex flex-col gap-4 p-4">
            <BoardHeader
                title="Salle de tri"
                theme={GESTION_THEME.section}
                description={loading ? "Chargement…" : "Les feuilles des trieurs : balles ouvertes, répartition de leurs kilos, écarts à vérifier."}
                trailing={
                    vue.analytique && !onboarding && (
                        <ExportButton
                            rows={filtered}
                            onExport={(rows, suffix) => exportTri(rows, lookups, suffix)}
                            filterByRange={filterTriByRange}
                            rangeHint="Date du tri, parmi les fiches affichées"
                        />
                    )
                }
                action={create ? { label: "Nouvelle fiche", onClick: create, icon: Plus } : undefined}
            />

            {onboarding ? (
                <>
                    {toggle}
                    <TriOnboarding
                        sortiesActives={sortiesActives}
                        trieursActifs={trieursActifs}
                        onReferentiel={() => setVue("referentiel")}
                        onCreate={create}
                    />
                </>
            ) : vue.analytique ? (
                <>
                    <TriFilterBar
                        leading={toggle}
                        trailing={vue.affichages && (
                            <TabButtonGroup
                                containerRef={affichageRef}
                                className={`${GESTION_THEME.filterBar.tabToggle} shrink-0`}
                                role="group"
                                aria-label="Affichage des fiches"
                            >
                                <TabButton id="liste" title="Liste" icon={List} active={affichage} set={() => setAffichage("liste")} />
                                <TabButton id="cartes" title="Cartes" icon={LayoutGrid} active={affichage} set={() => setAffichage("cartes")} />
                            </TabButtonGroup>
                        )}
                    />
                    <TriKpis />
                </>
            ) : toggle}

            {!onboarding && <Vue onOpen={open} onCreate={create} affichage={affichage} />}

            <FicheTriSheet
                open={creationOpen || (editMode && editing !== null)}
                fiche={creationOpen ? null : editing}
                onClose={() => (creationOpen ? close() : setEditMode(false))}
                onSaved={(id) => {
                    setEditMode(false)
                    // Après une saisie, montrer la fiche résumé de ce qui vient
                    // d'être enregistré : c'est la vérification naturelle.
                    navigate(`${TRI_ROUTE}/${id}${search}`, { replace: creationOpen })
                }}
            />

            <FicheTriDetailSheet
                fiche={!creationOpen && !editMode ? viewing : null}
                onClose={close}
                onEdit={editing ? () => setEditMode(true) : undefined}
                onDeleted={close}
                canDelete={canDelete}
                nav={nav}
            />
        </div>
    )
}
