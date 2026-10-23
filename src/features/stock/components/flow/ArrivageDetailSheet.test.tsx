import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import type { PackingListSummary } from "@/features/stock/types/packing-list.types"

/**
 * Fiche de lecture d'un arrivage — ce qu'elle doit garantir.
 *
 * Elle porte la garantie de permission que le tableau ne porte plus : son bouton
 * d'action est offert à tous (c'est le seul point d'entrée clavier d'une ligne),
 * et c'est ici que « Modifier » disparaît pour un compte n'ayant que
 * `stock.arrivage.view`. Voir la note de reprise dans
 * `ArrivageLimitedTable.test.tsx`.
 *
 * Jumelle de `FluxDetailSheet` du stock handpick, sans liste de colisage.
 */

import { ArrivageDetailSheet } from "./ArrivageDetailSheet"

/** Déchargement à N jours, pour piloter l'alerte facture. */
function daysAhead(n: number): string {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
}

function row(over: Partial<ArrivageManuelRow> = {}): ArrivageManuelRow {
    return {
        id: "11111111-2222-3333-4444-555555555555",
        container_no: "MSCU1234567",
        conteneur_no_raw: "INT-42",
        fournisseur_id: "f1",
        fournisseur: { id: "f1", name: "Fournisseur Un" },
        status: "planifié",
        status_auto: false,
        transport_mode: "40'",
        departure_date: "2026-01-05",
        port_arrival_date: null,
        total_weight_kg: 1000,
        total_qty: 40,
        prev_dechargement_at: null,
        notes: null,
        invoice_date: "2026-01-10",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        ...over,
    }
}

const renderSheet = (over: Partial<ArrivageManuelRow> = {}, onEdit?: () => void) =>
    render(
        <ArrivageDetailSheet
            open
            row={row(over)}
            onClose={rstest.fn()}
            onEdit={onEdit}
        />,
    )

// ─── Pied d'action ────────────────────────────────────────────────────────────

test("sans onEdit, la fiche n'offre aucun bouton Modifier", () => {
    // Convention posée par `BalleDetailSheet` : pas de bouton désactivé pour un
    // lecteur seul, pas de pied du tout.
    renderSheet()

    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument()
})

test("avec onEdit, le bouton Modifier le déclenche", () => {
    const onEdit = rstest.fn()
    renderSheet({}, onEdit)

    screen.getByRole("button", { name: "Modifier" }).click()

    expect(onEdit).toHaveBeenCalledTimes(1)
})

// ─── Contenu ──────────────────────────────────────────────────────────────────

test("le n° de conteneur titre la fiche", () => {
    renderSheet()

    expect(screen.getByRole("heading", { name: "MSCU1234567" })).toBeInTheDocument()
})

test("les totaux saisis sont affichés", () => {
    renderSheet()

    expect(screen.getByText("1 000")).toBeInTheDocument()
    expect(screen.getByText("40")).toBeInTheDocument()
})

test("un total absent s'affiche en tiret et non en zéro", () => {
    renderSheet({ total_weight_kg: null, total_qty: null })

    expect(screen.queryByText("0")).not.toBeInTheDocument()
})

test("un fournisseur non résolu retombe sur son identifiant", () => {
    // Aucune clé étrangère en base : la jointure est résolue côté client et
    // peut manquer. Même repli que la colonne du tableau.
    renderSheet({ fournisseur: null })

    expect(screen.getByText("f1")).toBeInTheDocument()
})

// ─── Alerte facture ───────────────────────────────────────────────────────────

test("un déchargement proche sans facture est signalé", () => {
    renderSheet({ invoice_date: null, prev_dechargement_at: daysAhead(2) })

    expect(screen.getByText("Facture manquante")).toBeInTheDocument()
    // L'échéance motive l'alerte : une date brute ne dit pas qu'elle est proche.
    expect(screen.getByText(/Déchargement dans 2 jours/)).toBeInTheDocument()
})

test("une facture manquante sans déchargement proche n'alerte pas", () => {
    renderSheet({ invoice_date: null, prev_dechargement_at: null })

    expect(screen.queryByText("Facture manquante")).not.toBeInTheDocument()
    expect(screen.getByText("Non facturé")).toBeInTheDocument()
})

// ─── Packing list ─────────────────────────────────────────────────────────────
// Ajout du 2026-09-15 : la section remplace l'emplacement réservé. Les tests
// ci-dessus sont inchangés — une ligne sans `packing` rend la fiche d'avant.

const packingSummary = (over: Partial<PackingListSummary> = {}): PackingListSummary =>
    ({
        id: "p1",
        arrivage_manuel_id: "11111111-2222-3333-4444-555555555555",
        status: "a_verifier",
        source_filename: "PL-MSCU1234567.xlsx",
        container_label: "CONTENEUR MSCU1234567",
        line_count: 14,
        lines_unmatched: 3,
        lines_from_dictionary: 0,
        lines_from_model: 0,
        lines_reviewed: 11,
        total_packages: 40,
        total_pieces: 8000,
        total_weight_kg: 1000,
        rows_failing_math: 0,
        package_count_gap: 0,
        ...over,
    }) as PackingListSummary

/** `onOpenPacking` à `null` = absent. `undefined` déclencherait la valeur par défaut. */
const renderWithPacking = (
    packing: PackingListSummary | null | undefined,
    onOpenPacking: (() => void) | null = rstest.fn(),
    over: Partial<ArrivageManuelRow> = {},
) =>
    render(
        <ArrivageDetailSheet
            open
            row={row({ packing, ...over })}
            onClose={rstest.fn()}
            onOpenPacking={onOpenPacking ?? undefined}
        />,
    )

/** Texte débarrassé de toute espace : `fr-FR` sépare les milliers par une insécable. */
const compact = (text: string) => (_: string, el: Element | null) =>
    el?.tagName === "SPAN" && el.textContent?.replace(/\s/g, "") === text

test("sans onOpenPacking, pas de section packing", () => {
    renderWithPacking(null, null)

    expect(screen.queryByRole("heading", { name: "Packing list" })).not.toBeInTheDocument()
})

test("sans packing, la section propose l'import", () => {
    const onOpenPacking = rstest.fn()
    renderWithPacking(null, onOpenPacking)

    screen.getByRole("button", { name: "Importer une packing list" }).click()

    expect(onOpenPacking).toHaveBeenCalledTimes(1)
})

test("une packing à vérifier dit combien de lignes restent à classer", () => {
    // Le travail RESTANT, pas le volume total : « 3 lignes à classer » sur un
    // fichier de 14 lignes dit ce qu'il y a à faire.
    renderWithPacking(packingSummary())

    expect(screen.getByRole("button", { name: "Vérifier (3 lignes à classer)" })).toBeInTheDocument()
    expect(screen.getByText("PL-MSCU1234567.xlsx")).toBeInTheDocument()
})

test("une packing dit aussi ce qui a été reconnu tout seul", () => {
    renderWithPacking(packingSummary({ lines_from_dictionary: 9 }))

    expect(screen.getByText(/9 lignes déjà reconnues automatiquement/)).toBeInTheDocument()
})

test("une packing validée s'ouvre en consultation", () => {
    renderWithPacking(packingSummary({ status: "validee", lines_unmatched: 0 }))

    expect(screen.getByRole("button", { name: "Voir la packing list" })).toBeInTheDocument()
})

test("les totaux affichent l'écart avec la packing, signé", () => {
    renderWithPacking(packingSummary({ total_weight_kg: 1200, total_packages: 40 }))

    expect(screen.getByText(compact("Packing:1200kg(+200)"))).toBeInTheDocument()
    // Colis identiques : pas d'écart entre parenthèses.
    expect(screen.getByText(compact("Packing:40colis"))).toBeInTheDocument()
})

test("une packing sans poids n'affiche pas d'écart de poids", () => {
    // Cas courant : le fournisseur ne compte qu'en pièces. « 0 kg » se lirait
    // comme un fait, et l'écart de −1000 kg serait une fausse alerte.
    renderWithPacking(packingSummary({ total_weight_kg: 0 }))

    expect(screen.queryByText(/Packing\s*:\s*0\s*kg/)).not.toBeInTheDocument()
})

test("un écart hors tolérance est teinté en avertissement", () => {
    renderWithPacking(packingSummary({ total_weight_kg: 1200 }))

    expect(screen.getByText(compact("Packing:1200kg(+200)")).className).toContain("text-warning")
})
