import { expect, test } from "@rstest/core"
import { render, screen, within } from "@testing-library/react"
import type { ActivityLog, LogGroup } from "@/features/stock/types/history.types"
import { GroupDetailSheet } from "./GroupDetailSheet"

/**
 * Filet d'iso-comportement de la sheet de détail du stock principal.
 *
 * Comme le feed, c'est la RÉFÉRENCE : le stock handpick va adopter ce dessin en
 * montant sur un organisme partagé. Le tableau de diff en est la partie
 * délicate — il distingue trois formes de `changes` (diff avant/après, valeur
 * nue sur création, valeur nue sur suppression) et masque les colonnes
 * techniques. Rien ne le couvrait.
 *
 * À ne pas retoucher pendant le refactor.
 */

let seq = 0

function logEntry(over: Partial<ActivityLog> = {}): ActivityLog {
    seq += 1
    return {
        id: `log-${seq}`,
        created_at: "2026-03-04T10:30:00.000Z",
        user_id: "u1",
        entity_type: "balle",
        entity_id: `e-${seq}`,
        entity_label: `BIN-${seq}`,
        action: "update",
        description: null,
        changes: null,
        ...over,
    }
}

function group(logs: ActivityLog[], over: Partial<LogGroup> = {}): LogGroup {
    return {
        key: logs[0].id,
        action: logs[0].action,
        entity_type: logs[0].entity_type,
        user_id: logs[0].user_id,
        count: logs.length,
        logs,
        created_at: logs[0].created_at,
        entity_label: logs[0].entity_label,
        description: logs[0].description,
        ...over,
    }
}

const userMap = new Map([["u1", "Alice Martin"]])

function show(g: LogGroup) {
    return render(<GroupDetailSheet group={g} userMap={userMap} open onClose={() => {}} />)
}

const dialog = () => screen.getByRole("dialog")

// ─── En-tête ──────────────────────────────────────────────────────────────────

test("l'en-tête porte l'action, l'entité et l'auteur", () => {
    show(group([logEntry()]))

    expect(within(dialog()).getByText("Modifié")).toBeInTheDocument()
    expect(within(dialog()).getByText("Balle")).toBeInTheDocument()
    expect(within(dialog()).getByText("Alice Martin")).toBeInTheDocument()
})

test("le compte n'est affiché qu'au-delà d'une entrée", () => {
    show(group([logEntry()]))
    expect(within(dialog()).queryByText("×1")).not.toBeInTheDocument()
})

test("un groupe multiple affiche son compte", () => {
    show(group([logEntry(), logEntry()]))
    expect(within(dialog()).getByText("×2")).toBeInTheDocument()
})

test("rien n'est rendu sans groupe", () => {
    render(<GroupDetailSheet group={null} userMap={userMap} open onClose={() => {}} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

// ─── Tableau de diff ──────────────────────────────────────────────────────────

test("un diff affiche l'ancienne valeur barrée puis la nouvelle", () => {
    show(group([logEntry({ changes: { status: { before: "stocked", after: "used" } } })]))

    const cell = within(dialog()).getByText("used")
    expect(cell).toBeInTheDocument()
    expect(within(dialog()).getByText("stocked").className).toContain("line-through")
})

test("les noms de colonnes sont traduits quand un libellé existe", () => {
    show(
        group([
            logEntry({
                changes: {
                    container_no: { before: "A", after: "B" },
                    colonne_inconnue: { before: "A", after: "B" },
                },
            }),
        ]),
    )

    expect(within(dialog()).getByText("Conteneur")).toBeInTheDocument()
    // Faute de libellé, le nom brut vaut mieux qu'une colonne masquée.
    expect(within(dialog()).getByText("colonne_inconnue")).toBeInTheDocument()
})

test("les colonnes techniques sont masquées", () => {
    show(
        group([
            logEntry({
                changes: {
                    id: { before: "1", after: "2" },
                    created_at: { before: "x", after: "y" },
                    updated_at: { before: "x", after: "y" },
                    status: { before: "stocked", after: "used" },
                },
            }),
        ]),
    )

    expect(within(dialog()).queryByText("created_at")).not.toBeInTheDocument()
    expect(within(dialog()).getByText("Statut")).toBeInTheDocument()
})

test("un diff sans changement réel n'est pas affiché", () => {
    show(group([logEntry({ changes: { status: { before: "used", after: "used" } } })]))

    expect(within(dialog()).queryByText("Statut")).not.toBeInTheDocument()
})

test("une création affiche ses valeurs nues, sans flèche", () => {
    show(
        group([
            logEntry({ action: "create", changes: { status: "stocked", notes: "" } }),
        ]),
    )

    expect(within(dialog()).getByText("stocked")).toBeInTheDocument()
    // Les valeurs vides ne méritent pas une ligne.
    expect(within(dialog()).queryByText("Notes")).not.toBeInTheDocument()
    expect(within(dialog()).queryByText("→")).not.toBeInTheDocument()
})

test("un booléen est rendu en oui/non", () => {
    show(group([logEntry({ action: "create", changes: { status_auto: true } })]))

    expect(within(dialog()).getByText("Oui")).toBeInTheDocument()
})

// ─── Entrées ──────────────────────────────────────────────────────────────────

test("chaque entrée porte son libellé et son horodatage complet", () => {
    show(group([logEntry({ entity_label: "BIN-0042" })]))

    expect(within(dialog()).getByText("BIN-0042")).toBeInTheDocument()
    expect(within(dialog()).getByText(/04\/03\/2026/)).toBeInTheDocument()
})

test("une entrée sans libellé affiche un tiret plutôt qu'un vide", () => {
    show(group([logEntry({ entity_label: null })]))

    expect(within(dialog()).getByText("—")).toBeInTheDocument()
})

test("la description d'une entrée est affichée quand elle existe", () => {
    show(group([logEntry({ description: "Balle transférée en zone B" })]))

    expect(within(dialog()).getByText("Balle transférée en zone B")).toBeInTheDocument()
})
