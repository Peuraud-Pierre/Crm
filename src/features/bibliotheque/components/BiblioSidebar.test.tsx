// ── BiblioSidebar.test.tsx ────────────────────────────────────────────────────
// Tests unitaires de BiblioSidebar — jusqu'ici sans aucun test malgré des
// responsabilités réelles : sélection de la thématique active (y compris le
// cas particulier "Brief général" = aucune sélection), affichage du bon
// compteur par thématique, et déclenchement des dialogs de création/renommage/
// suppression via ThematiqueItem.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { Thematique } from "../types"

const mocks = rstest.hoisted(() => ({
    canManage: true,
    thematiques: [] as Thematique[],
    countByThematique: {} as Record<string, number>,
    activeId: "",
    setActiveId: rstest.fn(),
    openRenameThematique: rstest.fn(),
    openDeleteThematique: rstest.fn(),
    openCreateThematique: rstest.fn(),
    resolveThematiqueMediaUrl: rstest.fn((v: string) => v),
}))

function mockBiblioContextValue() {
    return {
        data: { thematiques: mocks.thematiques, countByThematique: mocks.countByThematique },
        perms: { canManage: mocks.canManage },
        nav: { activeId: mocks.activeId, setActiveId: mocks.setActiveId, lang: "fr" as const, ui: UI_TEXT.fr },
        dialogs: {
            openRenameThematique: mocks.openRenameThematique,
            openDeleteThematique: mocks.openDeleteThematique,
            openCreateThematique: mocks.openCreateThematique,
        },
        handlers: { resolveThematiqueMediaUrl: mocks.resolveThematiqueMediaUrl },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { BiblioSidebar } from "./BiblioSidebar"

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.canManage = true
    mocks.thematiques = []
    mocks.countByThematique = {}
    mocks.activeId = ""
})

describe("BiblioSidebar — rendu de la liste", () => {
    test("affiche une entrée par thématique avec son compteur de Q&R", () => {
        mocks.thematiques = [mkThematique({ id: "t1", label: "Livraison" }), mkThematique({ id: "t2", label: "Retours" })]
        mocks.countByThematique = { t1: 3, t2: 0 }
        render(<BiblioSidebar />)
        expect(screen.getByText("Livraison")).toBeInTheDocument()
        expect(screen.getByText("Retours")).toBeInTheDocument()
        expect(screen.getByText("3")).toBeInTheDocument()
    })

    test("le bouton Brief général est toujours affiché, même sans thématique", () => {
        render(<BiblioSidebar />)
        expect(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.briefNav, "i") })).toBeInTheDocument()
    })
})

describe("BiblioSidebar — sélection", () => {
    test("le bouton Brief général a aria-current quand activeId est vide (rien de sélectionné)", () => {
        mocks.activeId = ""
        render(<BiblioSidebar />)
        expect(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.briefNav, "i") })).toHaveAttribute("aria-current")
    })

    test("clic sur Brief général appelle setActiveId('')", async () => {
        const user = userEvent.setup()
        mocks.activeId = "t1"
        render(<BiblioSidebar />)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.briefNav, "i") }))
        expect(mocks.setActiveId).toHaveBeenCalledWith("")
    })

    test("clic sur une thématique appelle setActiveId avec son id", async () => {
        const user = userEvent.setup()
        mocks.thematiques = [mkThematique({ id: "t1", label: "Livraison" })]
        render(<BiblioSidebar />)
        await user.click(screen.getByRole("button", { name: /livraison/i }))
        expect(mocks.setActiveId).toHaveBeenCalledWith("t1")
    })
})

describe("BiblioSidebar — actions", () => {
    test("le bouton Nouvelle thématique appelle openCreateThematique", async () => {
        const user = userEvent.setup()
        render(<BiblioSidebar />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.newTopic }))
        expect(mocks.openCreateThematique).toHaveBeenCalledTimes(1)
    })

    test("renommer une thématique appelle openRenameThematique avec l'objet thématique", async () => {
        const user = userEvent.setup()
        const t = mkThematique({ id: "t1", label: "Livraison" })
        mocks.thematiques = [t]
        render(<BiblioSidebar />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.renameTopic }))
        expect(mocks.openRenameThematique).toHaveBeenCalledWith(t)
    })

    test("supprimer une thématique appelle openDeleteThematique avec l'objet thématique", async () => {
        const user = userEvent.setup()
        const t = mkThematique({ id: "t1", label: "Livraison" })
        mocks.thematiques = [t]
        render(<BiblioSidebar />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.deleteTopic }))
        expect(mocks.openDeleteThematique).toHaveBeenCalledWith(t)
    })
})

describe("BiblioSidebar — permission bibliotheque.manage", () => {
    test("sans la permission, ni « Nouvelle thématique » ni les icônes d'action", () => {
        mocks.canManage = false
        mocks.thematiques = [mkThematique({ id: "t1", label: "Livraison" })]
        render(<BiblioSidebar />)
        expect(
            screen.queryByRole("button", { name: UI_TEXT.fr.newTopic })
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: UI_TEXT.fr.renameTopic })
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole("button", { name: UI_TEXT.fr.deleteTopic })
        ).not.toBeInTheDocument()
    })

    test("sans la permission, la navigation entre thématiques reste possible", async () => {
        mocks.canManage = false
        mocks.thematiques = [mkThematique({ id: "t1", label: "Livraison" })]
        const user = userEvent.setup()
        render(<BiblioSidebar />)
        await user.click(screen.getByRole("button", { name: /Livraison/ }))
        expect(mocks.setActiveId).toHaveBeenCalledWith("t1")
    })
})
