import { beforeEach, expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Carton, LivraisonBoutique } from "@/features/commandes/types/commande.types"

/**
 * Écran de réception (la boutique, simulée en V1). Ce qui compte : chaque
 * scan qui ne mène pas à une réception le DIT en clair, et la validation
 * transmet à la RPC ce qui a été constaté.
 *
 * La caméra est remplacée par un bouton : « scanner », c'est appeler
 * `onScan` avec le prochain code de `mocks.state.nextScan`.
 */

const mocks = rstest.hoisted(() => {
    const state = {
        nextScan: "",
        cartons: [] as unknown[],
        ctx: {} as Record<string, unknown>,
    }
    return {
        state,
        useCommandeContext: rstest.fn(() => state.ctx),
        useLivraisonDetail: rstest.fn(() => ({ palettes: [], cartons: state.cartons, loading: false })),
    }
})

rstest.mock("@/shared/ui/organisms/code-scanner", () => ({
    CodeScanner: ({ open, onScan, parse, texts }: {
        open: boolean
        onScan: (v: string) => void
        parse: (raw: string) => string | null
        texts: { title: string }
    }) => open
        ? <button type="button" data-testid={`scan:${texts.title}`} onClick={() => {
            const value = parse(mocks.state.nextScan)
            if (value) onScan(value)
        }}>scan</button>
        : null,
}))

rstest.mock("@/features/commandes/hooks/context/CommandeContext", () => ({
    useCommandeContext: mocks.useCommandeContext,
}))

rstest.mock("@/features/commandes/hooks/data/useCommandes", () => ({
    useLivraisonDetail: mocks.useLivraisonDetail,
}))

import { ReceptionView } from "./ReceptionView"

function livraison(over: Partial<LivraisonBoutique>): LivraisonBoutique {
    return {
        id: "liv1", numero: 1, code: "LIV-0001", commande_id: null, commande_code: null,
        boutique_id: "b1", boutique_nom: "Vintage Lyon", boutique_code: "LYO", statut: "expediee",
        date_preparation_prevue: null, date_expedition_prevue: null, date_livraison_prevue: null,
        expediee_at: "2026-10-05T08:00:00Z", expediee_par: null, receptionnee_at: null, note: null, created_by: null,
        created_at: "", updated_at: "", nb_palettes: 1, nb_cartons: 2, nb_recus: 0, nb_ecarts: 0,
        kg_prevu: 50, kg_recu: 0, kg_ecart: 0,
        ...over,
    }
}

function carton(over: Partial<Carton>): Carton {
    return {
        id: "c1", livraison_id: "liv1", palette_id: null, numero: 1, code: "LIV-0001-C01", palette_code: null, palette_numero: null,
        livraison_numero: 1, livraison_statut: "expediee", boutique_id: "b1", commande_id: null,
        category_id: "jean", category_nom: "Jeans femme", poids_kg_prevu: 25,
        statut: "expedie", etat: null, poids_kg_recu: null, recu_at: null, recu_par: null,
        note_reception: null, ecart_kg: 0, created_at: "",
        ...over,
    }
}

const LIV1 = livraison({})
const LIV2 = livraison({ id: "liv2", numero: 2, code: "LIV-0002" })

let findCartonByCode: ReturnType<typeof rstest.fn>
let receptionnerCarton: ReturnType<typeof rstest.fn>

beforeEach(() => {
    findCartonByCode = rstest.fn()
    receptionnerCarton = rstest.fn(async () => "conforme")
    mocks.state.cartons = [carton({})]
    mocks.state.ctx = {
        livraisons: [LIV1, LIV2],
        boutiqueById: new Map([["b1", { id: "b1", nom: "Vintage Lyon" }], ["b2", { id: "b2", nom: "Vintage Paris" }]]),
        version: 0,
        findCartonByCode,
        receptionnerCarton,
        cloturerLivraison: rstest.fn(async () => true),
    }
})

/** Ouvre le scanner de cartons et « lit » `code`. */
function scanCarton(code: string) {
    mocks.state.nextScan = code
    fireEvent.click(screen.getByRole("button", { name: /scanner (un|le) carton/i }))
    fireEvent.click(screen.getByTestId("scan:Scanner un carton"))
}

test("un carton inconnu est signalé", async () => {
    findCartonByCode.mockResolvedValue(null)
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    scanCarton("LIV-0001-C09")

    expect(await screen.findByRole("alert")).toHaveTextContent("Carton LIV-0001-C09 inconnu")
    expect(findCartonByCode).toHaveBeenCalledWith({ livraisonNumero: 1, cartonNumero: 9 })
})

test("un carton d'une autre livraison est refusé, avec la livraison d'origine", async () => {
    findCartonByCode.mockResolvedValue(carton({ id: "x", livraison_id: "liv2", code: "LIV-0002-C01" }))
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    scanCarton("LIV-0002-C01")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Ce carton n'est pas de LIV-0001")
    expect(alert).toHaveTextContent("LIV-0002 (Vintage Lyon)")
    expect(screen.queryByRole("heading", { name: "Jeans femme" })).not.toBeInTheDocument()
})

test("un carton destiné à une autre boutique est refusé", async () => {
    findCartonByCode.mockResolvedValue(carton({ id: "x", livraison_id: "liv9", boutique_id: "b2", code: "LIV-0009-C01" }))
    render(<ReceptionView boutiqueId="b1" livraisonId={null} onSelect={() => {}} />)

    scanCarton("LIV-0009-C01")

    expect(await screen.findByRole("alert")).toHaveTextContent("LIV-0009-C01 est destiné à Vintage Paris")
})

test("un carton déjà reçu n'est pas réceptionné deux fois", async () => {
    findCartonByCode.mockResolvedValue(carton({ statut: "recu_conforme", etat: "conforme", recu_at: "2026-10-06T09:30:00Z" }))
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    scanCarton("LIV-0001-C01")

    expect(await screen.findByRole("alert")).toHaveTextContent("LIV-0001-C01 déjà traité")
})

test("un carton pas encore expédié est signalé", async () => {
    findCartonByCode.mockResolvedValue(carton({ statut: "prepare" }))
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    scanCarton("LIV-0001-C01")

    expect(await screen.findByRole("alert")).toHaveTextContent("n'est pas encore parti")
})

test("pas la bonne catégorie : annoncé, transmis à la RPC avec le constat", async () => {
    findCartonByCode.mockResolvedValue(carton({}))
    receptionnerCarton.mockResolvedValue("mauvaise_categorie")
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    scanCarton("liv 1 c1")
    expect(await screen.findByRole("heading", { name: "Jeans femme" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /pas la bonne catégorie/i }))
    expect(screen.getByText("Mauvaise catégorie")).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(/ce que vous constatez/i), { target: { value: "des pulls" } })
    fireEvent.click(screen.getByRole("button", { name: /valider avec écart/i }))

    await waitFor(() => expect(receptionnerCarton).toHaveBeenCalledWith("c1", {
        poidsRecu: null, endommage: false, mauvaiseCategorie: true, note: "des pulls",
    }))
})

test("un poids dans la tolérance : conforme ; sans pesée, le prévu fait foi", async () => {
    findCartonByCode.mockResolvedValue(carton({}))
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    scanCarton("LIV-0001-C01")
    await screen.findByRole("heading", { name: "Jeans femme" })
    expect(screen.getByText("Conforme")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/poids pesé/i), { target: { value: "25,3" } })
    fireEvent.click(screen.getByRole("button", { name: /valider : conforme/i }))

    await waitFor(() => expect(receptionnerCarton).toHaveBeenCalledWith("c1", {
        poidsRecu: 25.3, endommage: false, mauvaiseCategorie: false, note: null,
    }))
})

test("hors tolérance : écart de poids annoncé avant validation", async () => {
    findCartonByCode.mockResolvedValue(carton({}))
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    scanCarton("LIV-0001-C01")
    await screen.findByRole("heading", { name: "Jeans femme" })
    fireEvent.change(screen.getByLabelText(/poids pesé/i), { target: { value: "23" } })

    expect(screen.getByText(/23 kg au lieu de 25, au-delà de 2 %/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /valider avec écart/i })).toBeInTheDocument()
})

test("les cartons de la livraison sont cochés au fil des scans", () => {
    mocks.state.cartons = [
        carton({ id: "c1", code: "LIV-0001-C01", statut: "recu_conforme", etat: "conforme" }),
        carton({ id: "c2", numero: 2, code: "LIV-0001-C02", category_nom: "Pulls" }),
    ]
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    expect(screen.getByRole("heading", { name: "À scanner · 1" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Traités · 1" })).toBeInTheDocument()
    expect(screen.getByLabelText("Reçu")).toBeInTheDocument()
})

test("livraison validée : écran de fin plutôt que le scanner", () => {
    mocks.state.ctx = { ...mocks.state.ctx, livraisons: [livraison({ statut: "receptionnee", nb_recus: 2, kg_recu: 50 })] }
    render(<ReceptionView boutiqueId="b1" livraisonId="liv1" onSelect={() => {}} />)

    expect(screen.getByRole("status")).toHaveTextContent("Livraison validée")
    expect(screen.queryByRole("button", { name: /scanner un carton/i })).not.toBeInTheDocument()
})
