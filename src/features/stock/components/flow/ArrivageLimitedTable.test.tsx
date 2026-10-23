import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import {
    ARRIVAGE_MONTHS_PER_PAGE,
    STOCK_PERMISSIONS,
} from "@/features/stock/constants"

/**
 * Filet d'iso-comportement du tableau des arrivages.
 *
 * Ce fichier existe pour un refactor : `ArrivageLimitedTable` va être éclaté
 * (colonnes, badge, pagination, calcul de pages) au profit d'une primitive de
 * tableau partagée avec le stock handpick. Il n'avait aucun test — rien ne
 * prouvait donc que son rendu ne bougeait pas.
 *
 * Il fixe le rendu ACTUEL, y compris ce qui est discutable (l'ordre du ternaire
 * de teinte, la constante magique de colSpan) : c'est un point de comparaison,
 * pas une cible. À ne pas retoucher pendant le refactor — un test qu'on ajuste
 * pour faire passer un refactor ne prouve plus rien.
 *
 * Seule exception à ce jour, assumée : la section « Ouverture d'une ligne »
 * ci-dessous a été réécrite lors de l'ajout de la fiche de lecture d'un
 * arrivage. Ce n'était pas un refactor mais un changement de comportement
 * demandé — la ligne devient cliquable et ouvre la fiche, le crayon reste le
 * raccourci vers le formulaire, et sans le droit de modification le bouton
 * bascule en œil plutôt que de disparaître. Chaque test remplacé nomme celui
 * qu'il supersede.
 */

const mocks = rstest.hoisted(() => {
    const hasPermission = rstest.fn()
    const useAuth = rstest.fn(() => ({ hasPermission }))
    const useArrivageManuelContext = rstest.fn()
    return { hasPermission, useAuth, useArrivageManuelContext }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))

// Le contexte monte tout le module (providers, Supabase) : on n'injecte que les
// lignes, seule entrée réelle du tableau.
rstest.mock("@/features/stock/hooks/context/StockProvider", () => ({
    useArrivageManuelContext: mocks.useArrivageManuelContext,
}))

import ArrivageLimitedTable from "./ArrivageLimitedTable"

// ─── Fabrique de lignes ───────────────────────────────────────────────────────

/**
 * Le 15 du mois situé `k` mois dans le futur. Décalage de MOIS et non de jours :
 * un pas de 30 jours peut rester dans le même mois (1er janvier + 30 j = 31
 * janvier), ce qui fusionnerait deux groupes et rendrait la pagination par mois
 * dépendante de la date d'exécution.
 */
function monthsAhead(k: number): string {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + k, 15, 12, 0, 0).toISOString()
}

function daysAhead(k: number): string {
    return new Date(Date.now() + k * 24 * 60 * 60 * 1000).toISOString()
}

let seq = 0

function row(over: Partial<ArrivageManuelRow> = {}): ArrivageManuelRow {
    seq += 1
    return {
        id: `row-${seq}`,
        container_no: `MSCU000000${seq}`,
        conteneur_no_raw: `RAW-${seq}`,
        fournisseur_id: "f1",
        fournisseur: { id: "f1", name: "Fournisseur Un", siege_localisation: "Lomé" },
        status: "planifié",
        status_auto: false,
        transport_mode: "40'",
        departure_date: null,
        port_arrival_date: null,
        total_weight_kg: 1000,
        total_qty: 10,
        prev_dechargement_at: null,
        notes: null,
        // Une facture renseignée neutralise l'alerte : c'est le défaut, les
        // tests d'alerte la remettent à null explicitement.
        invoice_date: "2026-01-01",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...over,
    }
}

function renderWith(
    rows: ArrivageManuelRow[] | undefined,
    onOpen = rstest.fn(),
    onEdit = rstest.fn(),
) {
    mocks.useArrivageManuelContext.mockReturnValue({ rows })
    return render(<ArrivageLimitedTable onOpen={onOpen} onEdit={onEdit} />)
}

const grant = (...codes: string[]) => {
    mocks.hasPermission.mockImplementation((code: string) => codes.includes(code))
}

beforeEach(() => {
    rstest.clearAllMocks()
    seq = 0
    grant(STOCK_PERMISSIONS.arrivageUpdate)
})

// ─── Colonnes ─────────────────────────────────────────────────────────────────

test("les 12 colonnes sont rendues dans l'ordre", () => {
    renderWith([row({ prev_dechargement_at: monthsAhead(1) })])

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent?.trim())
    expect(headers).toEqual([
        "Statut",
        "Fournisseur",
        "Facture",
        "Départ",
        "Le Havre",
        "Mode",
        "N° Conteneur",
        "Déchargement",
        "Poids (kg)",
        "Quantité",
        "N° Interne",
        "",
    ])
})

// ─── Bannière de mois ─────────────────────────────────────────────────────────

test("la bannière de mois porte le compte et le poids total du groupe", () => {
    const at = monthsAhead(1)
    renderWith([
        row({ prev_dechargement_at: at, total_weight_kg: 1200 }),
        row({ prev_dechargement_at: at, total_weight_kg: 800 }),
    ])

    expect(screen.getByText("(2 arrivages)")).toBeInTheDocument()
    // `toLocaleString("fr-FR")` sépare les milliers par une espace insécable,
    // que le normalizer de testing-library ramène à une espace ordinaire. On
    // compare donc sur le texte débarrassé de toute espace, plutôt que de parier
    // sur l'une des deux formes.
    // `getAllBy` et non `getBy` : la cellule et le span qu'elle contient portent
    // tous deux ce texte, un matcher par textContent remonte donc les deux.
    expect(
        screen.getAllByText((_, el) => el?.textContent?.replace(/\s/g, "") === "2000kg"),
    ).not.toHaveLength(0)
})

test("un groupe d'une seule ligne reste au singulier", () => {
    renderWith([row({ prev_dechargement_at: monthsAhead(1) })])

    expect(screen.getByText("(1 arrivage)")).toBeInTheDocument()
})

// ─── Teintes de ligne ─────────────────────────────────────────────────────────

/** Les lignes de données, hors bannières de mois (qui ne portent pas de bordure gauche). */
const dataRows = (container: HTMLElement) =>
    [...container.querySelectorAll("tbody tr")].filter((tr) =>
        tr.className.includes("border-l-"),
    )

test("l'alerte facture l'emporte sur le surlignage des prochains arrivages", () => {
    // La ligne est SIMULTANÉMENT en alerte facture (déchargement à J+2 sans
    // facture) et parmi les 5 prochains arrivages. L'ordre du ternaire tranche :
    // le rouge gagne. C'est exactement ce qu'un refactor de teintes casserait
    // sans qu'aucun type ne s'en aperçoive.
    const { container } = renderWith([
        row({ prev_dechargement_at: daysAhead(2), invoice_date: null }),
    ])

    const [tr] = dataRows(container)
    expect(tr.className).toContain("border-l-red-500")
    expect(tr.className).not.toContain("border-l-amber-400")
})

test("un prochain arrivage facturé est en ambre", () => {
    const { container } = renderWith([
        row({ prev_dechargement_at: daysAhead(2), invoice_date: "2026-01-01" }),
    ])

    const [tr] = dataRows(container)
    expect(tr.className).toContain("border-l-amber-400")
    expect(tr.className).not.toContain("border-l-red-500")
})

test("une ligne passée sans alerte n'est pas teintée", () => {
    const { container } = renderWith([
        row({ prev_dechargement_at: daysAhead(-40), invoice_date: "2026-01-01" }),
    ])

    const [tr] = dataRows(container)
    expect(tr.className).toContain("border-l-transparent")
})

// ─── Pagination par mois ──────────────────────────────────────────────────────

test("une page affiche au plus ARRIVAGE_MONTHS_PER_PAGE mois", () => {
    renderWith([1, 2, 3, 4, 5].map((k) => row({ prev_dechargement_at: monthsAhead(k) })))

    expect(screen.getAllByText("(1 arrivage)")).toHaveLength(ARRIVAGE_MONTHS_PER_PAGE)
})

test("la page initiale est celle du prochain arrivage, pas la première", () => {
    // 8 mois futurs. Le tri est décroissant (le plus lointain en tête), mais les
    // « 5 prochains » sont les plus PROCHES : ils tombent dans les derniers
    // groupes, et la vue doit s'ouvrir sur eux plutôt que sur le début.
    //
    // Groupes (index) : k=8→0, k=7→1, k=6→2 | k=5→3, k=4→4, k=3→5 | k=2→6, k=1→7
    // Les 5 prochains sont k=1..5, soit les index 3 à 7 → page d'index 1.
    renderWith([1, 2, 3, 4, 5, 6, 7, 8].map((k) => row({ prev_dechargement_at: monthsAhead(k) })))

    expect(screen.getByRole("button", { current: "page" })).toHaveTextContent("2")
})

test("les pages contenant un prochain arrivage sont signalées", () => {
    renderWith([1, 2, 3, 4, 5, 6, 7, 8].map((k) => row({ prev_dechargement_at: monthsAhead(k) })))

    const badged = (label: string) =>
        screen.getByRole("button", { name: label }).querySelector(".animate-pulse") !== null

    expect(badged("Page 1")).toBe(false)
    expect(badged("Page 2")).toBe(true)
    expect(badged("Page 3")).toBe(true)
})

test("un seul mois : pas de barre de pagination", () => {
    renderWith([row({ prev_dechargement_at: monthsAhead(1) })])

    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument()
})

// ─── Ouverture d'une ligne ────────────────────────────────────────────────────

test("avec la permission, le crayon appelle onEdit avec la ligne", async () => {
    // Conservé de la version d'origine, à une nuance près : `onEdit` mène
    // toujours au formulaire, mais c'est désormais un RACCOURCI — le chemin
    // normal passe par le clic de ligne et la fiche de lecture.
    const onEdit = rstest.fn()
    const target = row({ prev_dechargement_at: monthsAhead(1) })
    renderWith([target], rstest.fn(), onEdit)

    await userEvent.setup().click(
        screen.getByRole("button", { name: /Modifier l'arrivage/ }),
    )

    expect(onEdit).toHaveBeenCalledWith(target)
})

test("sans stock.arrivage.update, le bouton devient un œil vers la fiche", () => {
    // Supersede « sans stock.arrivage.update, le crayon d'édition disparaît ».
    // Le crayon disparaît toujours, mais le bouton reste : une ligne de tableau
    // n'est pas focusable, le masquer priverait un lecteur au clavier de tout
    // accès au détail. La garantie de permission s'est déplacée sur le pied de
    // `ArrivageDetailSheet` et sur la garde de lien profond — voir
    // `FlowBoard.test.tsx`.
    grant()
    renderWith([row({ prev_dechargement_at: monthsAhead(1) })])

    expect(
        screen.queryByRole("button", { name: /Modifier l'arrivage/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Voir l'arrivage/ })).toBeInTheDocument()
})

test("sans la permission, le bouton appelle onOpen et non onEdit", async () => {
    grant()
    const onOpen = rstest.fn()
    const onEdit = rstest.fn()
    const target = row({ prev_dechargement_at: monthsAhead(1) })
    renderWith([target], onOpen, onEdit)

    await userEvent.setup().click(
        screen.getByRole("button", { name: /Voir l'arrivage/ }),
    )

    expect(onOpen).toHaveBeenCalledWith(target)
    expect(onEdit).not.toHaveBeenCalled()
})

test("cliquer la ligne appelle onOpen", async () => {
    // Nouveau point d'entrée : le tableau n'avait aucun clic de ligne.
    const onOpen = rstest.fn()
    const target = row({ prev_dechargement_at: monthsAhead(1) })
    const { container } = renderWith([target], onOpen)

    const dataRow = [...container.querySelectorAll("tbody tr")].find((tr) =>
        tr.className.includes("border-l-"),
    )
    await userEvent.setup({ pointerEventsCheck: 0 }).click(dataRow as Element)

    expect(onOpen).toHaveBeenCalledWith(target)
})

test("le crayon n'ouvre pas aussi la fiche de lecture", async () => {
    // La ligne entière est cliquable depuis ce changement : sans
    // `stopPropagation`, le clic sur le crayon déclencherait aussi celui de la
    // ligne, et les deux sheets se disputeraient l'écran. Le besoin n'existait
    // pas tant que la ligne était inerte.
    const onOpen = rstest.fn()
    const onEdit = rstest.fn()
    renderWith([row({ prev_dechargement_at: monthsAhead(1) })], onOpen, onEdit)

    await userEvent
        .setup({ pointerEventsCheck: 0 })
        .click(screen.getByRole("button", { name: /Modifier l'arrivage/ }))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
})

// ─── États de bord ────────────────────────────────────────────────────────────

test("rows indéfinies : squelette annoncé, pas d'état vide", () => {
    renderWith(undefined)

    expect(screen.getByRole("status", { name: /Chargement des arrivages/ })).toBeInTheDocument()
    expect(screen.queryByText("Aucun arrivage enregistré")).not.toBeInTheDocument()
})

test("rows vides : état vide, pas de squelette", () => {
    renderWith([])

    expect(screen.getByText("Aucun arrivage enregistré")).toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
})
