import { expect, test } from "@rstest/core"

import { formatDate, formatDateRange, hashToColor } from "./utils"

test("formatDate handles empty and invalid values", () => {
    expect(formatDate("")).toBe("Date à définir")
    expect(formatDate("not-a-date")).toBe("not-a-date")
})

test("formatDateRange uses fallback phrasing", () => {
    const start = "2025-01-02"
    const end = "2025-02-03"

    expect(formatDateRange(start, end)).toBe(
        `${formatDate(start)} → ${formatDate(end)}`
    )
    expect(formatDateRange(start, "")).toBe(`À partir du ${formatDate(start)}`)
    expect(formatDateRange("", end)).toBe(`Jusqu'au ${formatDate(end)}`)
    expect(formatDateRange("", "")).toBe("Dates à définir")
})

test("hashToColor returns stable palette value", () => {
    const first = hashToColor("alpha")
    const second = hashToColor("alpha")
    expect(first).toBe(second)
    // La palette est désormais tokenisée (design system §12.4) : les couleurs
    // sont des `hsl(var(--chart-N))` résolus par le navigateur, plus des hex.
    expect(first).toMatch(/^hsl\(var\(--chart-\d\)\)$/)
    expect(hashToColor(undefined)).toBe("hsl(var(--muted-foreground))")
})
