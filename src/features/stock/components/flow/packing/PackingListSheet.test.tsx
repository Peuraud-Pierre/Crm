import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import type {
    PackingListStatus,
    PackingListSummary,
} from "@/features/stock/types/packing-list.types"

/**
 * Sheet packing — ce qu'elle montre selon le statut en base, et ce qu'elle
 * propose selon les droits. Les hooks de données sont remplacés : on observe
 * l'aiguillage, pas Supabase.
 */

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    return {
        hasPermission,
        useAuth: rstest.fn(() => ({ hasPermission })),
        list: {
            lignes: [] as unknown[],
            groups: [] as unknown[],
            progress: {
                groupCount: 0,
                unmatchedGroups: 0,
                dictionaryGroups: 0,
                reviewedGroups: 0,
                unmatchedLines: 0,
                canValidate: false,
            },
            dictionaryLabels: new Map<string, string | null>(),
            loading: false,
            fetchLignes: rstest.fn(),
            assignGroup: rstest.fn(),
            acceptGroup: rstest.fn(),
            acceptMany: rstest.fn(),
            assignLigne: rstest.fn(),
            validate: rstest.fn(),
            reopen: rstest.fn(),
            remove: rstest.fn(),
        },
        fetchMappingsForKeys: rstest.fn(async () => new Map()),
        importer: {
            step: "idle" as "idle" | "sending" | "error",
            error: null as string | null,
            file: null as File | null,
            start: rstest.fn(),
            reset: rstest.fn(),
            busy: false,
        },
    }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({ useAuth: mocks.useAuth }))
rstest.mock("@/features/stock/hooks/context/StockProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de hook
    useReferentialContext: () => ({ categories: [] }),
}))
rstest.mock("@/features/stock/hooks/data/usePackingList", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de hook
    usePackingList: () => mocks.list,
}))
rstest.mock("@/features/stock/services/packingLabelDictionaryService", () => ({
    fetchMappingsForKeys: mocks.fetchMappingsForKeys,
}))
rstest.mock("@/features/stock/hooks/data/usePackingModelStats", () => ({
    // Sans ce mock, le chargement async des stats met à jour l'état après le
    // rendu, hors `act` : un warning par test.
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de hook
    usePackingModelStats: () => ({ stats: null, loading: false, error: false, refresh: rstest.fn() }),
}))
rstest.mock("@/features/stock/hooks/ui/usePackingImport", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de hook
    usePackingImport: () => mocks.importer,
}))

import { PackingListSheet } from "./PackingListSheet"

function summary(status: PackingListStatus, over: Partial<PackingListSummary> = {}): PackingListSummary {
    return {
        id: "p1",
        arrivage_manuel_id: "a1",
        status,
        source_filename: "PL-MSCU.xlsx",
        error_message: null,
        imported_by: null,
        imported_at: "2026-09-15T00:00:00Z",
        validated_by: null,
        validated_at: status === "validee" ? "2026-09-15T00:00:00Z" : null,
        created_at: "2026-09-15T00:00:00Z",
        updated_at: "2026-09-15T00:00:00Z",
        container_label: "CONTENEUR MSCU1234567",
        source_sheet: "Invoice",
        declared_package_count: null,
        line_count: 0,
        lines_unmatched: 0,
        lines_from_dictionary: 0,
        lines_from_model: 0,
        lines_reviewed: 0,
        total_packages: 0,
        total_pieces: 0,
        total_weight_kg: 0,
        rows_failing_math: 0,
        package_count_gap: null,
        ...over,
    }
}

const ROW = { id: "a1", container_no: "MSCU1234567", total_weight_kg: 1000, total_qty: 10 } as ArrivageManuelRow

const renderSheet = (packing: PackingListSummary | null) =>
    render(
        <PackingListSheet open row={{ ...ROW, packing }} onClose={rstest.fn()} onChanged={rstest.fn()} />,
    )

const grant = (...codes: string[]) =>
    mocks.hasPermission.mockImplementation((code: string) => codes.includes(code))

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.importer.step = "idle"
    mocks.importer.error = null
    mocks.list.lignes = []
    mocks.list.groups = []
    mocks.list.progress = {
        groupCount: 0,
        unmatchedGroups: 0,
        dictionaryGroups: 0,
        reviewedGroups: 0,
        unmatchedLines: 0,
        canValidate: false,
    }
    mocks.fetchMappingsForKeys.mockImplementation(async () => new Map())
    grant()
})

/** Groupe minimal : seuls sa clé et son état comptent pour ces tests. */
const group = (key: string, state: "reviewed" | "dictionary" | "model") => ({
    key,
    rawLabel: key.toUpperCase(),
    lignes: [{ id: `${key}-1` }],
    state,
    categoryId: "pull",
    suggestedCategoryId: null,
    confidence: null,
    mixed: false,
    totalPackages: 4,
    totalPieces: 0,
    totalWeightKg: 0,
})

/** Packing prête à valider, avec les groupes donnés. */
function readyToValidate(groups: ReturnType<typeof group>[]) {
    grant(STOCK_PERMISSIONS.packingView, STOCK_PERMISSIONS.packingUpdate)
    mocks.list.lignes = groups.map((g) => g.lignes[0])
    mocks.list.groups = groups
    mocks.list.progress = {
        groupCount: groups.length,
        unmatchedGroups: 0,
        dictionaryGroups: groups.filter((g) => g.state === "dictionary").length,
        reviewedGroups: groups.filter((g) => g.state === "reviewed").length,
        unmatchedLines: 0,
        canValidate: true,
    }
    renderSheet(summary("a_verifier", { line_count: groups.length }))
}

// ─── Aucune packing ───────────────────────────────────────────────────────────

test("sans packing et avec le droit d'import, la zone de dépôt est proposée", () => {
    grant(STOCK_PERMISSIONS.packingCreate)
    renderSheet(null)

    expect(screen.getByRole("button", { name: /Glissez la packing list ici/ })).toBeInTheDocument()
})

test("sans packing ni droit d'import, un état vide et aucune zone de dépôt", () => {
    grant(STOCK_PERMISSIONS.packingView)
    renderSheet(null)

    expect(screen.getByText("Aucune packing list")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Glissez la packing list ici/ })).not.toBeInTheDocument()
})

test("un refus de fichier s'affiche sous la zone de dépôt", () => {
    grant(STOCK_PERMISSIONS.packingCreate)
    mocks.importer.step = "error"
    mocks.importer.error = "Format non pris en charge"
    renderSheet(null)

    expect(screen.getByRole("alert")).toHaveTextContent("Format non pris en charge")
})

// ─── Validation ───────────────────────────────────────────────────────────────

test("valider annonce ce que ce conteneur enseigne, et n'écrit qu'après confirmation", async () => {
    // C'est le seul instant où la distinction « tranché à la main » / « repris
    // du tableau » existe encore : après validation, les lignes sont rechargées.
    const user = userEvent.setup()
    readyToValidate([group("blouson jean", "reviewed"), group("polo", "reviewed")])

    await user.click(screen.getByRole("button", { name: /Valider la packing list/ }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Valider et enregistrer 2 nouvelles correspondances ?")
    expect(mocks.list.validate).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Valider la packing list" }))
    await waitFor(() => expect(mocks.list.validate).toHaveBeenCalledTimes(1))
})

test("un libellé déjà dans le tableau compte comme mise à jour, pas comme nouveauté", async () => {
    const user = userEvent.setup()
    mocks.fetchMappingsForKeys.mockImplementation(
        async () => new Map([["polo", { category_id: "pull" }]]),
    )
    readyToValidate([group("blouson jean", "reviewed"), group("polo", "reviewed")])

    await user.click(screen.getByRole("button", { name: /Valider la packing list/ }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Valider et enregistrer 1 nouvelle correspondance ?")
    expect(dialog).toHaveTextContent("1 met à jour une correspondance existante")
})

test("un conteneur qui n'enseigne rien se valide sans cérémonie", async () => {
    // Tout venait du tableau de correspondance : il n'y a rien à annoncer.
    const user = userEvent.setup()
    readyToValidate([group("blouson jean", "dictionary"), group("polo", "dictionary")])

    await user.click(screen.getByRole("button", { name: /Valider la packing list/ }))

    await waitFor(() => expect(mocks.list.validate).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
})

// ─── Statuts ──────────────────────────────────────────────────────────────────

test("pendant l'envoi, la progression remplace la zone de dépôt", () => {
    grant(STOCK_PERMISSIONS.packingCreate)
    mocks.importer.step = "sending"
    renderSheet(null)

    expect(screen.getByText("Envoi et lecture du fichier")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Glissez la packing list ici/ })).not.toBeInTheDocument()
})

test("en_traitement : la progression survit à la réouverture de la sheet", () => {
    grant(STOCK_PERMISSIONS.packingView)
    renderSheet(summary("en_traitement"))

    expect(screen.getByText(/Le traitement continue même si vous fermez/)).toBeInTheDocument()
})

test("echec : le message du service d'import est affiché", () => {
    grant(STOCK_PERMISSIONS.packingView)
    renderSheet(summary("echec", { error_message: "Colonne poids introuvable" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Colonne poids introuvable")
})

test("validee : lecture par catégorie, sans barre de validation", () => {
    grant(STOCK_PERMISSIONS.packingView)
    renderSheet(summary("validee"))

    expect(screen.getByText(/Vérifiée et validée le/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Valider la packing list/ })).not.toBeInTheDocument()
})

// ─── Actions selon les droits ─────────────────────────────────────────────────

test("sans stock.packing.delete, ni Supprimer ni Remplacer", () => {
    grant(STOCK_PERMISSIONS.packingView, STOCK_PERMISSIONS.packingCreate, STOCK_PERMISSIONS.packingUpdate)
    renderSheet(summary("validee"))

    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Remplacer le fichier/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Rouvrir la vérification/ })).toBeInTheDocument()
})

test("remplacer exige delete ET create", () => {
    grant(STOCK_PERMISSIONS.packingView, STOCK_PERMISSIONS.packingDelete)
    renderSheet(summary("validee"))

    expect(screen.getByRole("button", { name: "Supprimer" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Remplacer le fichier/ })).not.toBeInTheDocument()
})

test("après un échec, remplacer devient « Réessayer avec un autre fichier »", () => {
    grant(STOCK_PERMISSIONS.packingView, STOCK_PERMISSIONS.packingCreate, STOCK_PERMISSIONS.packingDelete)
    renderSheet(summary("echec"))

    expect(screen.getByRole("button", { name: /Réessayer avec un autre fichier/ })).toBeInTheDocument()
})

test("sans stock.packing.update, une packing validée ne se rouvre pas", () => {
    grant(STOCK_PERMISSIONS.packingView)
    renderSheet(summary("validee"))

    expect(screen.queryByRole("button", { name: /Rouvrir la vérification/ })).not.toBeInTheDocument()
})
