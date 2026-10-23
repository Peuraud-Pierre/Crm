import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import type { CodeGroup } from "@/features/stock_handpick/utils/emplacementGroups"
import { CodeRackCard } from "./CodeRackCard"

/** Carte d'un rack à étiqueter : une case par emplacement, dessinée comme le rack. */

const item = (bay: string, level: string) => ({
    id: `${bay}${level}`,
    path: `B · R2 · ${bay} · ${level}`,
    segments: ["B", "R2", bay, level],
    zoneLabel: "Bags",
})

// E1 est une palette au sol : H0 seul.
const group: CodeGroup = {
    key: "B/R2",
    label: "B · R2",
    subtitle: "Double haut",
    items: [item("E1", "H0"), item("E3", "H0"), item("E3", "H1")],
}

test("le rack affiche son nom, son surnom et le compte des cases cochées", () => {
    render(<CodeRackCard group={group} selected={new Set(["E3H1"])} onToggle={rstest.fn()} />)

    expect(screen.getByRole("heading", { name: "B · R2" })).toBeInTheDocument()
    expect(screen.getByText("Double haut")).toBeInTheDocument()
    expect(screen.getByText("1/3")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "B · R2 · E3 · H1" })).toHaveAttribute("aria-pressed", "true")
    // Pas de case pour E1/H1 (palette au sol).
    expect(screen.queryByRole("button", { name: "B · R2 · E1 · H1" })).toBeNull()
})

test("une case, une travée ou tout le rack se cochent d'un geste", () => {
    const onToggle = rstest.fn()
    render(<CodeRackCard group={group} selected={new Set()} onToggle={onToggle} />)

    screen.getByRole("button", { name: "B · R2 · E1 · H0" }).click()
    expect(onToggle).toHaveBeenLastCalledWith(["E1H0"], true)

    screen.getByRole("button", { name: "Cocher la travée E3" }).click()
    expect(onToggle).toHaveBeenLastCalledWith(["E3H1", "E3H0"], true)

    screen.getByRole("button", { name: "Tout" }).click()
    expect(onToggle).toHaveBeenLastCalledWith(["E1H0", "E3H0", "E3H1"], true)
})
