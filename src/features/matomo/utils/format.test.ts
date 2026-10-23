import { expect, test } from "@rstest/core";

import {
    fmtChannelLabel,
    fmtDuration,
    fmtInt,
    fmtPeriodKey,
    fmtRate,
    fmtReferrerType,
    fmtSpan,
    plural,
    pluralWord,
} from "./format";

// Intl insère des espaces insécables : on les normalise pour comparer.
const n = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");

test("fmtInt accepte nombres et chaînes, rejette l'absent", () => {
    expect(n(fmtInt(12345))).toBe("12 345");
    expect(n(fmtInt("12345"))).toBe("12 345");
    expect(fmtInt(undefined)).toBe("—");
    expect(fmtInt("")).toBe("—");
});

test("fmtDuration distingue zéro et absent", () => {
    expect(fmtDuration(0)).toBe("0 s");
    expect(fmtDuration(undefined)).toBe("—");
    expect(fmtDuration(185)).toBe("3 min 05 s");
    expect(fmtDuration(4320)).toBe("1 h 12 min");
});

test("fmtRate accepte la forme formatée de Matomo", () => {
    expect(n(fmtRate("42%"))).toBe("42 %");
    expect(n(fmtRate(37.5))).toBe("37,5 %");
});

test("fmtPeriodKey couvre jour, semaine et mois", () => {
    expect(fmtPeriodKey("2026-09-30")).toBe("30 sept.");
    expect(fmtPeriodKey("2026-09-28,2026-10-04")).toBe("sem. du 28 sept.");
    expect(fmtPeriodKey("2026-09")).toBe("sept. 2026");
    expect(fmtPeriodKey("autre")).toBe("autre");
});

test("plural et référents", () => {
    expect(plural(1, "visiteur")).toBe("1 visiteur");
    expect(plural(0, "visiteur")).toBe("0 visiteur");
    expect(plural(3, "visiteur")).toBe("3 visiteurs");
    expect(fmtReferrerType("search")).toBe("Moteur de recherche");
    expect(fmtReferrerType("inconnu")).toBe("inconnu");
});

test("fmtSpan : une année quand elle est commune, un seul jour sans flèche", () => {
    expect(n(fmtSpan("2026-09-05", "2026-10-04"))).toBe("5 sept. → 4 oct. 2026");
    expect(n(fmtSpan("2025-10-01", "2026-09-30"))).toBe("1 oct. 2025 → 30 sept. 2026");
    expect(n(fmtSpan("2026-10-04", "2026-10-04"))).toBe("4 oct. 2026");
});

test("pluralWord et canaux traduits", () => {
    expect(pluralWord(1, "visite")).toBe("visite");
    expect(pluralWord(2, "objectif converti", "objectifs convertis")).toBe("objectifs convertis");
    expect(fmtChannelLabel("Search Engines")).toBe("Moteurs de recherche");
    expect(fmtChannelLabel("Inconnu")).toBe("Inconnu");
});
