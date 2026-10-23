import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Plus, Weight } from "lucide-react"
import { useArrivageManuelContext } from "@/features/stock/hooks/context/StockProvider"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import ArrivageLimitedTable from "./ArrivageLimitedTable"
import ArrivageLimitedCreationSheet from "./ArrivageLimitedCreationSheet"
import ArrivageLimitedEditSheet from "./ArrivageLimitedEditSheet"
import { ArrivageDetailSheet } from "./ArrivageDetailSheet"
import ExportArrivageButton from "./ExportArrivageButton"
import PrintArrivageButton from "./print/PrintArrivageButton"
import { PackingListSheet } from "./packing/PackingListSheet"
import { STOCK_ROUTE_BASE } from "@/features/stock/types/ui.types"
import { GESTION_THEME } from "@/features/stock/theme"
import { BoardHeader } from "@/shared/ui/molecules/board-header"
import { useDetailDeepLink } from "@/shared/hooks/useDetailDeepLink"

/** L'onglet s'appelle Flux ; « Arrivages » est le titre de sa section. */
const FLUX_URL = `${STOCK_ROUTE_BASE}/flux`

/**
 * Ce qui montre l'arrivage désigné par l'URL : sa fiche, son formulaire, ou
 * sa packing list. Une seule sheet à la fois — les empiler se referme mal.
 */
type Panel = "detail" | "edit" | "packing"

interface FlowBoardProps {
    detail?: string
}

export default function FlowBoard({ detail }: FlowBoardProps) {
    const { rows, fetchAll } = useArrivageManuelContext()
    const { hasPermission } = useAuth()
    const navigate = useNavigate()

    const canView   = hasPermission(STOCK_PERMISSIONS.arrivageView)
    const canCreate = hasPermission(STOCK_PERMISSIONS.arrivageCreate)
    const canUpdate = hasPermission(STOCK_PERMISSIONS.arrivageUpdate)
    const canPackingView   = hasPermission(STOCK_PERMISSIONS.packingView)
    const canPackingCreate = hasPermission(STOCK_PERMISSIONS.packingCreate)

    // Garde des liens profonds : partagée avec les autres modules de stock.
    // Le détail de son raisonnement (permission sur la sheet et non sur le
    // bouton, nettoyage en replace) est dans le docblock du hook.
    const { creationOpen, editing: editRow, viewing } = useDetailDeepLink({
        detail,
        baseUrl: FLUX_URL,
        canCreate,
        canUpdate,
        // Le détail s'ouvre désormais sur une fiche de LECTURE : le gater sur le
        // droit de modification renvoyait un lecteur vers la liste, alors que
        // `canView` était déjà calculé juste au-dessus pour l'écran entier.
        canView,
        loaded: rows !== undefined,
        find: (id) => rows?.find((r) => r.id === id) ?? null,
    })

    // Lecture, édition ou packing n'est pas une adresse mais une action :
    // l'URL désigne l'arrivage ouvert, ce drapeau dit quelle sheet le montre.
    const [panel, setPanel] = useState<Panel>("detail")

    /**
     * La packing d'un arrivage s'ouvre pour la LIRE (elle existe) ou pour
     * l'IMPORTER (elle n'existe pas) — deux droits différents. Synthèses non
     * chargées (`packing` indéfini) : on ne sait pas lequel s'applique.
     *
     * Gardé ici ET sur l'icône du tableau, pour la même raison que le crayon :
     * masquer une entrée ne protège pas sa destination.
     */
    const canOpenPacking = useCallback(
        (row: ArrivageManuelRow) =>
            row.packing === undefined ? false : row.packing ? canPackingView : canPackingCreate,
        [canPackingView, canPackingCreate],
    )

    const closeSheet = () => {
        setPanel("detail")
        navigate(FLUX_URL)
    }
    /** Refermer le formulaire ou la packing ramène à la fiche, pas à la liste. */
    const closeForm = () => {
        if (panel !== "detail") setPanel("detail")
        else closeSheet()
    }
    const openCreation = () => navigate(`${FLUX_URL}/new`)
    const openRow = (row: ArrivageManuelRow) => navigate(`${FLUX_URL}/${row.id}`)

    /**
     * Raccourci du tableau : ouvrir un arrivage DIRECTEMENT en édition, sans
     * passer par sa fiche. L'URL désigne toujours l'arrivage — seul le drapeau
     * d'édition est posé d'avance, si bien que refermer le formulaire ramène à
     * la fiche comme partout ailleurs.
     */
    const openEdit = (row: ArrivageManuelRow) => {
        if (!canUpdate) return
        setPanel("edit")
        navigate(`${FLUX_URL}/${row.id}`)
    }

    /** Même raccourci pour la packing list, depuis l'icône du tableau. */
    const openPacking = (row: ArrivageManuelRow) => {
        if (!canOpenPacking(row)) return
        setPanel("packing")
        navigate(`${FLUX_URL}/${row.id}`)
    }

    // Un droit perdu ou une synthèse devenue indisponible pendant que la
    // packing est ouverte retombe sur la fiche plutôt que sur un écran vide.
    const activePanel: Panel =
        panel === "packing" && !(viewing && canOpenPacking(viewing)) ? "detail" : panel

    const totalPoids = useMemo(
        () => rows?.reduce((acc, r) => acc + (r.total_weight_kg ?? 0), 0) ?? 0,
        [rows]
    )

    // Sans la permission de lecture, la RLS renvoie un résultat vide (pas
    // d'erreur) : on affiche un état explicite plutôt qu'un tableau vide.
    if (!canView) {
        return (
            <div className="p-6 text-sm text-muted-foreground">
                Vous n'avez pas la permission de consulter le tableau des arrivages.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            {/* « Arrivages » est le titre de la section, pas de l'onglet :
                celui-ci s'appelle Flux dans les deux modules de stock, et
                accueillera les départs le jour où le stock principal en aura. */}
            <BoardHeader
                title="Arrivages"
                theme={GESTION_THEME.section}
                description={
                    <span className="flex items-center gap-3">
                        <span>
                            {rows == null
                                ? "Chargement…"
                                : `${rows.length} arrivage${rows.length > 1 ? "s" : ""} enregistré${rows.length > 1 ? "s" : ""}`}
                        </span>
                        {totalPoids > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <Weight size={11} className="opacity-60" />
                                {totalPoids.toLocaleString("fr-FR")} kg total
                            </span>
                        )}
                    </span>
                }
                trailing={
                    <>
                        <PrintArrivageButton />
                        <ExportArrivageButton />
                    </>
                }
                action={
                    canCreate
                        ? { label: "Nouvel arrivage", onClick: openCreation, icon: Plus }
                        : undefined
                }
            />

            <ArrivageLimitedTable onOpen={openRow} onEdit={openEdit} onPacking={openPacking} />

            <ArrivageLimitedCreationSheet
                open={creationOpen}
                onClose={closeSheet}
            />

            <ArrivageDetailSheet
                open={viewing !== null && activePanel === "detail"}
                row={viewing}
                onClose={closeSheet}
                onEdit={editRow ? () => setPanel("edit") : undefined}
                onOpenPacking={
                    viewing && canOpenPacking(viewing) ? () => setPanel("packing") : undefined
                }
            />

            {editRow && activePanel === "edit" && (
                <ArrivageLimitedEditSheet
                    row={editRow}
                    onClose={closeForm}
                />
            )}

            <PackingListSheet
                open={activePanel === "packing"}
                row={viewing}
                onClose={closeForm}
                onChanged={fetchAll}
            />

        </div>
    )
}
