import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EMPLACEMENTS, ZONES, equipement } from "../../__fixtures__/plan"
import { buildPlanItems } from "@/features/magasins/utils/planTree"
import type { PlanMagasinApi } from "@/features/magasins/hooks/data/usePlanMagasin"
import { deleteTargetFor } from "@/features/magasins/hooks/ui/usePlanDeletion"
import type { Mur } from "@/features/magasins/types/magasin.types"
import { PlanItemDelete } from "./PlanItemDelete"

const items = buildPlanItems(ZONES, EMPLACEMENTS, [equipement("c1", "C1", "caisse")])
const mur = { id: "w1", points: [[0, 5], [8, 5], [8, 9]], epaisseur: 0.15, hauteur: 2.5 } as Mur

function makePlan(ok = true) {
    return {
        zones: ZONES,
        emplacements: EMPLACEMENTS,
        murs: [mur],
        removeZone: rstest.fn(async () => ok),
        removeEmplacement: rstest.fn(async () => ok),
        removeEquipement: rstest.fn(async () => ok),
        removeMur: rstest.fn(async () => ok),
    } as unknown as PlanMagasinApi
}

function setup(key: string, ok = true) {
    const plan = makePlan(ok)
    const onDeleted = rstest.fn()
    render(<PlanItemDelete target={deleteTargetFor(key, items, plan)} onClose={() => {}} onDeleted={onDeleted} />)
    return { plan, onDeleted }
}

const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))

test("supprimer une zone annonce la cascade et appelle la bonne suppression", async () => {
    const { plan, onDeleted } = setup("z:a")
    expect(screen.getByText(/Seront aussi supprimés : 2 sous-niveaux/)).toBeInTheDocument()
    confirm()
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(plan.removeZone).toHaveBeenCalledWith("a")
    expect(plan.removeEquipement).not.toHaveBeenCalled()
})

test("un équipement passe par la suppression des équipements", async () => {
    const { plan } = setup("q:c1")
    confirm()
    await waitFor(() => expect(plan.removeEquipement).toHaveBeenCalledWith("c1"))
})

test("un emplacement passe par la suppression des emplacements", async () => {
    const { plan } = setup("e:h1")
    confirm()
    await waitFor(() => expect(plan.removeEmplacement).toHaveBeenCalledWith("h1"))
})

test("un mur se supprime aussi, nommé par sa longueur", async () => {
    const { plan } = setup("m:w1")
    expect(screen.getByText("Supprimer ce mur de 12 m ?")).toBeInTheDocument()
    confirm()
    await waitFor(() => expect(plan.removeMur).toHaveBeenCalledWith("w1"))
})

test("un échec garde le dialogue ouvert et ne déclare rien supprimé", async () => {
    const { plan, onDeleted } = setup("z:a", false)
    confirm()
    await waitFor(() => expect(plan.removeZone).toHaveBeenCalled())
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
})

test("rien de sélectionné, ou une clé inconnue : pas de cible", () => {
    const plan = makePlan()
    expect(deleteTargetFor(null, items, plan)).toBeNull()
    expect(deleteTargetFor("m:absent", items, plan)).toBeNull()
})
