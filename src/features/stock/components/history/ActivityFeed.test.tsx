import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ActivityLog, LogGroup } from "@/features/stock/types/history.types"

/**
 * La sheet de détail est remplacée par une sonde. Deux raisons :
 *
 *  • son RENDU a son propre fichier (`GroupDetailSheet.test.tsx`, 13 tests) —
 *    le monter ici testerait deux fois la même chose ;
 *  • `rstest.config.ts` tourne en `isolate: false`, et monter un overlay Radix
 *    dans un environnement jsdom partagé échouait par intermittence
 *    (`AggregateError` au rendu) selon le fichier exécuté juste avant.
 *
 * Ce que ce fichier doit prouver, c'est que cliquer une ligne SÉLECTIONNE le bon
 * groupe — ce que la sonde vérifie plus précisément que ne le faisait la
 * présence d'un dialogue.
 */
const sheet = rstest.hoisted(() => ({ lastGroupKey: null as string | null }))

rstest.mock("./GroupDetailSheet", () => ({
    GroupDetailSheet: ({ group, open }: { group: { key: string } | null; open: boolean }) => {
        sheet.lastGroupKey = open && group ? group.key : null
        return open && group ? <div data-testid="detail" data-group={group.key} /> : null
    },
}))

import { ActivityFeed } from "./ActivityFeed"

/**
 * Filet d'iso-comportement du feed d'activité du stock principal.
 *
 * Ce feed est la RÉFÉRENCE de la convergence : c'est son dessin que le stock
 * handpick va adopter, en montant tous deux sur un organisme partagé. Il ne
 * doit donc pas bouger d'un pixel au passage — et il n'avait aucun test.
 *
 * À ne pas retoucher pendant le refactor.
 */

let seq = 0

function logEntry(over: Partial<ActivityLog> = {}): ActivityLog {
    seq += 1
    return {
        id: `log-${seq}`,
        created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
        user_id: "u1",
        entity_type: "balle",
        entity_id: `e-${seq}`,
        entity_label: `BIN-${seq}`,
        action: "create",
        description: `Description ${seq}`,
        changes: null,
        ...over,
    }
}

function group(over: Partial<LogGroup> = {}): LogGroup {
    const entries = over.logs ?? [logEntry()]
    return {
        key: entries[0].id,
        action: entries[0].action,
        entity_type: entries[0].entity_type,
        user_id: entries[0].user_id,
        count: entries.length,
        logs: entries,
        created_at: entries[0].created_at,
        entity_label: entries[0].entity_label,
        description: entries[0].description,
        ...over,
    }
}

const userMap = new Map([["u1", "Alice Martin"]])

const rows = () => screen.getAllByRole("button")


// ─── États de bord ────────────────────────────────────────────────────────────

test("pendant le chargement, six squelettes tiennent la place", () => {
    const { container } = render(<ActivityFeed groups={[]} userMap={userMap} loading />)

    expect(container.querySelectorAll(".h-14.rounded-xl")).toHaveLength(6)
    expect(screen.queryByText("Aucune activité enregistrée")).not.toBeInTheDocument()
})

test("sans groupe, un état vide explique d'où vient le journal", () => {
    render(<ActivityFeed groups={[]} userMap={userMap} loading={false} />)

    expect(screen.getByText("Aucune activité enregistrée")).toBeInTheDocument()
})

// ─── Ligne de groupe ──────────────────────────────────────────────────────────

test("un groupe d'une seule entrée montre son libellé et sa description", () => {
    const single = group({ logs: [logEntry({ entity_label: "BIN-0042", description: "Balle créée" })] })
    render(<ActivityFeed groups={[single]} userMap={userMap} loading={false} />)

    expect(screen.getByText("BIN-0042")).toBeInTheDocument()
    expect(screen.getByText("Balle créée")).toBeInTheDocument()
    expect(screen.queryByText(/^×/)).not.toBeInTheDocument()
})

test("un groupe multiple affiche son compte et masque le détail de l'entrée", () => {
    // Le libellé et la description d'une seule entrée ne représenteraient pas
    // les autres : au-delà d'une entrée, seul le compte est montré.
    const multiple = group({ logs: [logEntry(), logEntry(), logEntry()] })
    render(<ActivityFeed groups={[multiple]} userMap={userMap} loading={false} />)

    expect(screen.getByText("×3")).toBeInTheDocument()
    expect(screen.queryByText(/^Description /)).not.toBeInTheDocument()
})

test("l'action et le type d'entité sont affichés par leurs libellés", () => {
    const deleted = group({ logs: [logEntry({ action: "delete", entity_type: "delivery" })] })
    render(<ActivityFeed groups={[deleted]} userMap={userMap} loading={false} />)

    expect(screen.getByText("Supprimé")).toBeInTheDocument()
    expect(screen.getByText("Livraison")).toBeInTheDocument()
})

test("l'auteur est résolu depuis la table des utilisateurs", () => {
    render(<ActivityFeed groups={[group()]} userMap={userMap} loading={false} />)

    expect(screen.getByText("Alice Martin")).toBeInTheDocument()
})

test("un auteur inconnu n'affiche aucun nom plutôt qu'un identifiant brut", () => {
    const orphan = group({ logs: [logEntry({ user_id: "inconnu" })] })
    render(<ActivityFeed groups={[orphan]} userMap={userMap} loading={false} />)

    expect(screen.queryByText("inconnu")).not.toBeInTheDocument()
})

test("l'horodatage est relatif", () => {
    const recent = group({
        logs: [logEntry({ created_at: new Date(Date.now() - 5 * 60_000).toISOString() })],
    })
    render(<ActivityFeed groups={[recent]} userMap={userMap} loading={false} />)

    expect(screen.getByText("5m")).toBeInTheDocument()
})

test("chaque ligne est une carte à part entière", () => {
    render(
        <ActivityFeed
            groups={[group(), group({ key: "second" })]}
            userMap={userMap}
            loading={false}
        />,
    )

    // Les lignes se fondaient dans l'arrière-plan de la page : un simple
    // séparateur les séparait l'une de l'autre, sans surface propre. Chacune
    // porte désormais la carte du thème (`activity.row`).
    for (const row of rows()) {
        expect(row.className).toContain("border-border")
        expect(row.className).toContain("bg-card")
    }
})

// ─── Ouverture du détail ──────────────────────────────────────────────────────

test("cliquer une ligne ouvre le détail du groupe cliqué", () => {
    const first = group()
    const second = group({ key: "second" })
    render(<ActivityFeed groups={[first, second]} userMap={userMap} loading={false} />)

    fireEvent.click(rows()[1])

    expect(screen.getByTestId("detail")).toHaveAttribute("data-group", "second")
})

test("la ligne s'active au clavier", () => {
    // La ligne est un `div role="button"` : sans gestionnaire clavier explicite,
    // elle serait annoncée comme un bouton par les lecteurs d'écran tout en
    // restant inactionnable autrement qu'à la souris.
    render(<ActivityFeed groups={[group()]} userMap={userMap} loading={false} />)

    fireEvent.keyDown(rows()[0], { key: "Enter" })

    expect(screen.getByTestId("detail")).toBeInTheDocument()
})

test("un groupe multiple est transmis entier au détail", () => {
    const multiple = group({
        logs: [logEntry({ entity_label: "BIN-A" }), logEntry({ entity_label: "BIN-B" })],
    })
    render(<ActivityFeed groups={[multiple]} userMap={userMap} loading={false} />)

    fireEvent.keyDown(rows()[0], { key: "Enter" })

    // Le contenu de la sheet est vérifié par `GroupDetailSheet.test.tsx` ; ici
    // on prouve seulement que c'est bien ce groupe-là qui lui est passé.
    expect(sheet.lastGroupKey).toBe(multiple.key)
})

test("aucune sheet n'est ouverte tant qu'aucune ligne n'est cliquée", () => {
    render(<ActivityFeed groups={[group()]} userMap={userMap} loading={false} />)

    expect(screen.queryByTestId("detail")).not.toBeInTheDocument()
})

test("le feed ne monte aucune sheet quand il est vide", () => {
    render(<ActivityFeed groups={[]} userMap={userMap} loading={false} />)

    expect(screen.queryByTestId("detail")).not.toBeInTheDocument()
})
