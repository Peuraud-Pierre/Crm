import { expect, test } from "@rstest/core";

import { topSources } from "./sources";

test("topSources : tri par visites, top N, longue traîne résumée", () => {
    const { rows, others } = topSources(
        [
            { label: "Facebook", nb_visits: 27 },
            { label: "Instagram", nb_visits: 903 },
            { label: "LinkedIn", nb_visits: 3 },
            { label: "Snapchat", nb_visits: 1 },
            { label: "Vide", nb_visits: 0 },
        ],
        2
    );
    expect(rows.map((r) => r.label)).toEqual(["Instagram", "Facebook"]);
    expect(Math.round(rows[0].share)).toBe(97); // 903 / 934
    expect(others).toEqual({ count: 2, visits: 4 });
});

test("topSources : pas de ligne « autres » quand tout tient", () => {
    expect(topSources([{ label: "ChatGPT", nb_visits: 822 }]).others).toBeNull();
    expect(topSources(undefined)).toEqual({ rows: [], others: null });
});
