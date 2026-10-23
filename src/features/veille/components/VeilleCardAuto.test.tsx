import { expect, rstest, describe, it } from "@rstest/core"
import { render } from "@testing-library/react"
import { VeilleCardAuto } from "./VeilleCardAuto"
import type { VeilleItem } from "../types/veille.types"
rstest.mock("./VeilleCard", () => ({
    VeilleCard: ({ item }: { item: VeilleItem }) => (
        <div data-testid="veille-card-structured">{item.id}</div>
    ),
}))

rstest.mock("./VeilleCardSimple", () => ({
    VeilleCardSimple: ({ item }: { item: VeilleItem }) => (
        <div data-testid="veille-card-simple">{item.id}</div>
    ),
}))

const baseItem: VeilleItem = {
    id: "test-id",
    created_at: "2026-02-10T08:35:52.934Z",
    period_start: null,
    period_end: null,
    topic: "test topic",
    title: null,
    frequency: "weekly",
    source_model: "test-model",
    analysis_model: "test-analysis",
    raw_research: null,
    executive_summary: null,
    risks: null,
    opportunities: null,
    recommended_actions: null,
    importance_score: 3,
    tags: null,
    metadata: null,
}

describe("VeilleCardAuto", () => {
    it("utilise VeilleCard pour un executive_summary JSON structuré", () => {
        const item: VeilleItem = {
            ...baseItem,
            executive_summary: JSON.stringify({
                date_veille: "2026-02-10",
                periode: "7 derniers jours",
                secteurs_cibles: ["Test"],
                actualites_principales: [],
                sections: [],
            }),
        }

        const { getByTestId } = render(<VeilleCardAuto item={item} defaultOpen />)
        expect(getByTestId("veille-card-structured")).toBeInTheDocument()
    })

    it("utilise VeilleCardSimple pour un executive_summary texte", () => {
        const item: VeilleItem = {
            ...baseItem,
            executive_summary: "Ceci est un résumé en texte simple",
        }

        const { getByTestId } = render(<VeilleCardAuto item={item} defaultOpen />)
        expect(getByTestId("veille-card-simple")).toBeInTheDocument()
    })

    it("utilise VeilleCardSimple si des champs texte sont remplis", () => {
        const item: VeilleItem = {
            ...baseItem,
            risks: "Risques identifiés",
            opportunities: "Opportunités identifiées",
        }

        const { getByTestId } = render(<VeilleCardAuto item={item} defaultOpen />)
        expect(getByTestId("veille-card-simple")).toBeInTheDocument()
    })

    it("retourne null si aucune donnée n'est disponible", () => {
        const item: VeilleItem = {
            ...baseItem,
            executive_summary: null,
            risks: null,
            opportunities: null,
            recommended_actions: null,
            raw_research: null,
        }

        const { container } = render(<VeilleCardAuto item={item} />)
        expect(container.firstChild).toBeNull()
    })

    it("gère les JSON invalides en utilisant VeilleCardSimple", () => {
        const item: VeilleItem = {
            ...baseItem,
            executive_summary: "{ invalid json",
            risks: "Risques",
        }

        const { getByTestId } = render(<VeilleCardAuto item={item} defaultOpen />)
        expect(getByTestId("veille-card-simple")).toBeInTheDocument()
    })
})
