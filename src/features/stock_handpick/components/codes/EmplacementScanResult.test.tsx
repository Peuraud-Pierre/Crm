import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import type { Emplacement } from "@/features/stock_handpick/types/location.types"
import { EmplacementScanResult } from "./EmplacementScanResult"

/** Ce qu'affiche l'onglet Codes après le scan d'une étiquette. */

const emplacement = (is_active = true): Emplacement => ({
    id: "e1", zone_id: "z", code: "H1", label: null, capacity: null, notes: null, is_active,
    pos_x: null, pos_y: null, width: null, height: null, created_at: "", updated_at: "", created_by: null,
})
const balle = (id: string) =>
    ({ id, emplacement_id: "e1", raw_name: `Balle ${id}`, packing: 10, packing_mode: "kilos" }) as BalleHandpick

const handlers = () => ({ onClose: rstest.fn(), onOpenBalle: rstest.fn(), onShowInPlan: rstest.fn() })

test("affiche le chemin et les balles, chaque balle ouvre sa fiche", () => {
    const h = handlers()
    render(<EmplacementScanResult emplacement={emplacement()} path="B · R2 · E3 · H1" balles={[balle("aaaaaaaa-1")]} {...h} />)

    expect(screen.getByRole("heading", { name: "B · R2 · E3 · H1" })).toBeInTheDocument()
    screen.getByRole("button", { name: /Balle aaaaaaaa-1/ }).click()
    expect(h.onOpenBalle).toHaveBeenCalledWith("aaaaaaaa-1")
})

test("un emplacement vide le dit, et « Voir dans le plan » transmet son id", () => {
    const h = handlers()
    render(<EmplacementScanResult emplacement={emplacement()} path="A · SOL" balles={[]} {...h} />)

    expect(screen.getByText("Aucune balle à cet emplacement.")).toBeInTheDocument()
    screen.getByRole("button", { name: "Voir dans le plan" }).click()
    expect(h.onShowInPlan).toHaveBeenCalledWith("e1")
})

test("un emplacement désactivé est signalé comme retiré", () => {
    render(<EmplacementScanResult emplacement={emplacement(false)} path="B · R4 · E5 · H0" balles={[]} {...handlers()} />)

    expect(screen.getByText("Emplacement retiré")).toBeInTheDocument()
})

test("un id inconnu affiche « Code non reconnu », sans bouton plan", () => {
    render(<EmplacementScanResult emplacement={undefined} path={null} balles={[]} {...handlers()} />)

    expect(screen.getByRole("heading", { name: "Code non reconnu" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Voir dans le plan" })).toBeNull()
})
