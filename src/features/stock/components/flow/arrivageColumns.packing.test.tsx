import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import type { PackingListSummary } from "@/features/stock/types/packing-list.types"

/**
 * Icône packing list du tableau des arrivages.
 *
 * Fichier séparé de `ArrivageLimitedTable.test.tsx` à dessein : celui-ci est
 * un filet d'iso-comportement qui fixe le rendu d'avant, on ne l'étend pas
 * pour un comportement nouveau.
 */

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    return {
        hasPermission,
        useAuth: rstest.fn(() => ({ hasPermission })),
        useArrivageManuelContext: rstest.fn(),
    }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({ useAuth: mocks.useAuth }))
rstest.mock("@/features/stock/hooks/context/StockProvider", () => ({
    useArrivageManuelContext: mocks.useArrivageManuelContext,
}))

import ArrivageLimitedTable from "./ArrivageLimitedTable"

function row(over: Partial<ArrivageManuelRow> = {}): ArrivageManuelRow {
    const now = new Date()
    return {
        id: "row-1",
        container_no: "MSCU0000001",
        conteneur_no_raw: null,
        fournisseur_id: null,
        status: "planifié",
        status_auto: false,
        transport_mode: null,
        departure_date: null,
        port_arrival_date: null,
        total_weight_kg: 1000,
        total_qty: 10,
        prev_dechargement_at: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString(),
        notes: null,
        invoice_date: "2026-01-01",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...over,
    }
}

const packing = (status: PackingListSummary["status"], over: Partial<PackingListSummary> = {}) =>
    ({
        id: "p1",
        arrivage_manuel_id: "row-1",
        status,
        line_count: 3,
        total_packages: 10,
        total_pieces: 2000,
        total_weight_kg: 1000,
        package_count_gap: 0,
        rows_failing_math: 0,
        ...over,
    }) as PackingListSummary

/** `null` = pas de callback. `undefined` déclencherait la valeur par défaut. */
function renderWith(target: ArrivageManuelRow, onPacking: ((r: ArrivageManuelRow) => void) | null = rstest.fn()) {
    const onOpen = rstest.fn()
    mocks.useArrivageManuelContext.mockReturnValue({ rows: [target] })
    render(<ArrivageLimitedTable onOpen={onOpen} onEdit={rstest.fn()} onPacking={onPacking ?? undefined} />)
    return { onOpen, onPacking }
}

const grant = (...codes: string[]) =>
    mocks.hasPermission.mockImplementation((code: string) => codes.includes(code))

beforeEach(() => {
    rstest.clearAllMocks()
    grant(STOCK_PERMISSIONS.packingView, STOCK_PERMISSIONS.packingCreate)
})

test("pas de packing et droit d'import : l'icône propose l'import", async () => {
    const target = row({ packing: null })
    const { onPacking, onOpen } = renderWith(target)

    await userEvent
        .setup({ pointerEventsCheck: 0 })
        .click(screen.getByRole("button", { name: "Importer la packing list de l'arrivage MSCU0000001" }))

    expect(onPacking).toHaveBeenCalledWith(target)
    // stopPropagation : la ligne ne doit pas ouvrir la fiche en même temps.
    expect(onOpen).not.toHaveBeenCalled()
})

test("packing présente : l'icône l'ouvre et annonce son statut", () => {
    renderWith(row({ packing: packing("a_verifier") }))

    expect(
        screen.getByRole("button", { name: "Packing list de l'arrivage MSCU0000001 (à vérifier)" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Importer la packing list/ })).not.toBeInTheDocument()
})

test("sans droit d'import, pas d'icône sur un arrivage sans packing", () => {
    grant(STOCK_PERMISSIONS.packingView)
    renderWith(row({ packing: null }))

    expect(screen.queryByRole("button", { name: /packing list/i })).not.toBeInTheDocument()
})

test("sans droit de lecture, pas d'icône sur une packing existante", () => {
    grant(STOCK_PERMISSIONS.packingCreate)
    renderWith(row({ packing: packing("validee") }))

    expect(screen.queryByRole("button", { name: /packing list/i })).not.toBeInTheDocument()
})

test("synthèses non chargées : aucune icône, pour ne pas proposer un import en doublon", () => {
    renderWith(row({ packing: undefined }))

    expect(screen.queryByRole("button", { name: /packing list/i })).not.toBeInTheDocument()
})

test("sans onPacking, le tableau reste tel qu'avant", () => {
    renderWith(row({ packing: null }), null)

    expect(screen.queryByRole("button", { name: /packing list/i })).not.toBeInTheDocument()
})

test("une packing à vérifier reste visible sans survol, une validée non", () => {
    renderWith(row({ packing: packing("a_verifier") }))
    const pending = screen.getByRole("button", { name: /\(à vérifier\)/ })
    expect(pending.className).not.toContain("sm:opacity-0")
})

test("une packing validée n'apparaît qu'au survol", () => {
    renderWith(row({ packing: packing("validee") }))
    const validated = screen.getByRole("button", { name: /\(validée\)/ })
    expect(validated.className).toContain("sm:opacity-0")
})
