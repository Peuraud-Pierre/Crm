import { expect, test } from "@rstest/core"
import { fileDeTravail, livraisonEnPreparation } from "@/features/commandes/utils/fileDeTravail"
import type { CommandeBoutique, LivraisonBoutique } from "@/features/commandes/types/commande.types"

const TODAY = "2026-10-07"

const livraison = (over: Partial<LivraisonBoutique>) => ({
    id: "l", numero: 1, code: "LIV-0001", commande_id: null, statut: "planifiee",
    date_expedition_prevue: null, date_livraison_prevue: null, ...over,
}) as LivraisonBoutique
const commande = (over: Partial<CommandeBoutique>) => ({
    id: "c", numero: 1, code: "CMD-0001", statut: "ouverte", date_souhaitee: null, kg_reste: 0, ...over,
}) as CommandeBoutique

test("chaque élément tombe dans l'étape dont l'entrepôt doit s'occuper", () => {
    const commandes = [
        commande({ id: "neuve", numero: 3, kg_reste: 100 }),
        commande({ id: "en-prepa", numero: 2, kg_reste: 40, statut: "en_cours" }),
        commande({ id: "servie", numero: 1, kg_reste: 0, statut: "en_cours" }),
        commande({ id: "annulee", numero: 4, kg_reste: 50, statut: "annulee" }),
    ]
    const livraisons = [
        livraison({ id: "p", commande_id: "en-prepa", statut: "preparation" }),
        livraison({ id: "r", statut: "expediee" }),
        livraison({ id: "x", statut: "en_reception" }),
        livraison({ id: "lit", statut: "litige" }),
        livraison({ id: "ok", statut: "receptionnee" }),
        livraison({ id: "ann", statut: "annulee" }),
    ]
    const f = fileDeTravail(commandes, livraisons, TODAY)
    // Une commande dont une livraison est déjà en préparation n'est plus « à préparer ».
    expect(f.a_preparer.map((c) => c.id)).toEqual(["neuve"])
    expect(f.preparation.map((l) => l.id)).toEqual(["p"])
    expect(f.en_route.map((l) => l.id)).toEqual(["r", "x"])
    expect(f.a_regler.map((l) => l.id)).toEqual(["lit"])
})

test("urgence : en retard d'abord, puis la date d'expédition la plus proche", () => {
    const f = fileDeTravail([], [
        livraison({ id: "plus-tard", numero: 1, date_expedition_prevue: "2026-10-20" }),
        livraison({ id: "bientot", numero: 2, date_expedition_prevue: "2026-10-09" }),
        livraison({ id: "retard", numero: 3, date_expedition_prevue: "2026-10-01" }),
        livraison({ id: "sans-date", numero: 4 }),
    ], TODAY)
    expect(f.preparation.map((l) => l.id)).toEqual(["retard", "bientot", "plus-tard", "sans-date"])
})

test("commandes à préparer : la date souhaitée la plus proche d'abord", () => {
    const f = fileDeTravail([
        commande({ id: "b", numero: 1, kg_reste: 1, date_souhaitee: "2026-10-15" }),
        commande({ id: "a", numero: 2, kg_reste: 1, date_souhaitee: "2026-10-09" }),
        commande({ id: "c", numero: 3, kg_reste: 1 }),
    ], [], TODAY)
    expect(f.a_preparer.map((c) => c.id)).toEqual(["a", "b", "c"])
})

test("livraison en préparation d'une commande : pour « Continuer »", () => {
    const ls = [livraison({ id: "partie", commande_id: "c", statut: "expediee" }), livraison({ id: "prepa", commande_id: "c", statut: "planifiee" })]
    expect(livraisonEnPreparation("c", ls)?.id).toBe("prepa")
    expect(livraisonEnPreparation("autre", ls)).toBeNull()
})
