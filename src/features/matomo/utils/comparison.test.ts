import { expect, test } from "@rstest/core";

import { compareKpi, periodRanges } from "./comparison";

// Lundi 5 octobre 2026.
const TODAY = new Date(2026, 9, 5);

test("periodRanges : périodes complètes s'arrêtant hier, précédente contiguë", () => {
    expect(periodRanges("day:today", TODAY)).toEqual({
        period: "day",
        current: { from: "2026-10-05", to: "2026-10-05" },
        previous: null,
    });
    expect(periodRanges("day:yesterday", TODAY)).toEqual({
        period: "day",
        current: { from: "2026-10-04", to: "2026-10-04" },
        previous: { from: "2026-10-03", to: "2026-10-03" },
    });
    // 7 jours complets : 28 sept. → 4 oct. ; précédents : 21 → 27 sept.
    expect(periodRanges("day:last7", TODAY)).toEqual({
        period: "day",
        current: { from: "2026-09-28", to: "2026-10-04" },
        previous: { from: "2026-09-21", to: "2026-09-27" },
    });
    expect(periodRanges("day:last30", TODAY)).toEqual({
        period: "day",
        current: { from: "2026-09-05", to: "2026-10-04" },
        previous: { from: "2026-08-06", to: "2026-09-04" },
    });
    // 12 semaines closes (lundi → dimanche) avant la semaine en cours.
    expect(periodRanges("week:last12", TODAY)).toEqual({
        period: "week",
        current: { from: "2026-07-13", to: "2026-10-04" },
        previous: { from: "2026-04-20", to: "2026-07-12" },
    });
    // 12 mois clos : oct. 2025 → sept. 2026 ; précédents : oct. 2024 → sept. 2025.
    expect(periodRanges("month:last12", TODAY)).toEqual({
        period: "month",
        current: { from: "2025-10-01", to: "2026-09-30" },
        previous: { from: "2024-10-01", to: "2025-09-30" },
    });
});

test("compareKpi : sens, seuil de stabilité et cas limites", () => {
    expect(compareKpi(112, 100)).toEqual({ tone: "good", text: "+12 %", direction: "up" });
    expect(compareKpi(90, 100)?.tone).toBe("bad");
    expect(compareKpi(101, 100)?.text).toBe("stable");
    expect(compareKpi(5, 0)?.text).toBe("aucune donnée avant");
    expect(compareKpi(0, 0)?.tone).toBe("flat");
    expect(compareKpi(undefined, 100)).toBeNull();
});

test("compareKpi : le rebond se lit en points et baisser est bon", () => {
    const d = compareKpi("38,8%".replace(",", "."), "42%", { higherIsBetter: false, points: true });
    expect(d).toEqual({ tone: "good", text: "−3,2 pts", direction: "down" });
});
