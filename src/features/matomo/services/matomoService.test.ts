import { beforeEach, expect, rstest, test } from "@rstest/core";

import {
    bypassProxyCache,
    fetchChannels,
    fetchPages,
    fetchVisits,
    fetchVisitsLog,
    isVisitsLogDisabled,
    MatomoError,
} from "./matomoService";

const mockFetch = rstest.fn();

beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch as typeof fetch;
});

const respond = (body: unknown, status = 200) =>
    mockFetch.mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    });

const q = { siteId: "71", period: "day", from: "2026-09-05", to: "2026-10-04" };

test("un statut HTTP en échec lève une MatomoError lisible", async () => {
    respond({ error: "boom" }, 503);
    await expect(fetchVisits(q)).rejects.toThrow(MatomoError);
    await expect(fetchVisits(q)).rejects.toThrow(/ne répond pas correctement/);
});

test("une panne réseau devient un message de connexion", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchVisits(q)).rejects.toThrow(/Impossible de joindre Matomo/);
});

test("totaux en period=range sur dates explicites : uniques dédupliqués, une ligne par canal", async () => {
    respond([]);
    await fetchVisits(q);
    await fetchChannels(q);
    for (const [url] of mockFetch.mock.calls) {
        expect(url).toContain("period=range");
        expect(url).toContain("date=2026-09-05%2C2026-10-04");
    }
});

test("pages à plat (flat=1), top choisi sur les vues", async () => {
    respond([]);
    await fetchPages(q);
    expect(mockFetch.mock.calls[0][0]).toContain("flat=1");
    expect(mockFetch.mock.calls[0][0]).toContain("filter_sort_column=nb_hits");
});

test("« Rafraîchir » contourne le cache du proxy, juste après le clic", async () => {
    respond({});
    await fetchVisits(q);
    expect(mockFetch.mock.calls[0][0]).not.toContain("nocache");
    bypassProxyCache();
    await fetchVisits(q);
    expect(mockFetch.mock.calls[1][0]).toContain("nocache=1");
});

test("journal désactivé dans Matomo : 403 + code reconnu, distinct d'une panne", async () => {
    respond({ error: "visits_log_disabled", status: 403 }, 403);
    const err = await fetchVisitsLog(q, "20").catch((e) => e);
    expect(isVisitsLogDisabled(err)).toBe(true);

    respond({ error: "Erreur appel Matomo" }, 502);
    expect(isVisitsLogDisabled(await fetchVisitsLog(q, "20").catch((e) => e))).toBe(false);
});
