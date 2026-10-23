import { expect, test } from "@rstest/core";

import { isPageBlock } from "./useMatomo";

test("« Rafraîchir » ne suit que les blocs de la page", () => {
    expect(isPageBlock(["matomo", "visits", {}])).toBe(true);
    expect(isPageBlock(["matomo", "countries", {}])).toBe(true);
    // Relu seul chaque minute / propre à la modale : ne doit pas faire tourner le bouton.
    expect(isPageBlock(["matomo", "live", {}])).toBe(false);
    expect(isPageBlock(["matomo", "profile", "71", "abc"])).toBe(false);
    // Gestes locaux (« Voir plus », dépliage des moteurs) : pas l'indicateur de toute la page.
    expect(isPageBlock(["matomo", "log", {}, "50"])).toBe(false);
    expect(isPageBlock(["matomo", "search-engines", {}])).toBe(false);
    expect(isPageBlock(["autre", "visits"])).toBe(false);
});
