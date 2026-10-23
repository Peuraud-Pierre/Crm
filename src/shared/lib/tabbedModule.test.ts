import { expect, test } from "@rstest/core"
import type { TabbedModuleConfig, TabDef } from "@/shared/types/tabbed-module.types"
import { resolveTabState, sectionToTab, tabPath, tabToSection } from "./tabbedModule"

/**
 * L'algorithme de canonicalisation était écrit deux fois — dans `Stock.tsx` et
 * dans `StockHandpick.tsx` — et testé deux fois, à l'identique, à travers un
 * routeur monté. Sorti de React, il se teste en table, et on peut y ajouter les
 * cas croisés qu'aucun des deux ne couvrait (alias historique combiné à un
 * onglet refusé, onglet par défaut lui-même gaté).
 *
 * Config fictive, jamais celle d'un module réel : un socle testé au travers
 * d'une feature se met à documenter cette feature plutôt que le socle.
 */

type Id = "alphaTab" | "betaTab" | "gammaTab"

const TABS: TabDef<Id>[] = [
    { id: "alphaTab", section: "alpha", devOnly: true },
    { id: "betaTab", section: "beta" },
    {
        id: "gammaTab",
        section: "gamma",
        permission: "demo.gamma.view",
        details: ["un", "deux"],
    },
]

const config: TabbedModuleConfig<Id> = {
    routeBase: "/demo",
    tabs: TABS,
    defaultTab: "betaTab",
    legacySections: { ancien: "beta" },
}

/** Par défaut, tout est visible : chaque test restreint ce dont il a besoin. */
function resolve(
    section: string | undefined,
    detail?: string,
    visibleTabs: readonly TabDef<Id>[] = TABS,
) {
    return resolveTabState({ config, visibleTabs, section, detail })
}

// ─── Tables dérivées ──────────────────────────────────────────────────────────

test("les tables section↔onglet sont dérivées des définitions", () => {
    expect(sectionToTab(TABS)).toEqual({
        alpha: "alphaTab",
        beta: "betaTab",
        gamma: "gammaTab",
    })
    expect(tabToSection(TABS)).toEqual({
        alphaTab: "alpha",
        betaTab: "beta",
        gammaTab: "gamma",
    })
})

// ─── Résolution nominale ──────────────────────────────────────────────────────

test("une section connue et visible ouvre son onglet", () => {
    expect(resolve("beta").activeTab).toBe("betaTab")
})

test("une section absente ouvre l'onglet par défaut", () => {
    expect(resolve(undefined)).toMatchObject({
        activeTab: "betaTab",
        canonicalSection: "beta",
        canonicalDetail: undefined,
    })
})

test("une section inconnue retombe sur l'onglet par défaut", () => {
    expect(resolve("nimportequoi").activeTab).toBe("betaTab")
})

// ─── Gating ───────────────────────────────────────────────────────────────────

test("une section non visible retombe sur l'onglet par défaut", () => {
    const visible = TABS.filter((tab) => tab.id !== "gammaTab")

    expect(resolve("gamma", undefined, visible).activeTab).toBe("betaTab")
})

test("l'onglet par défaut est servi même s'il n'est pas lui-même visible", () => {
    // Cas du handpick, dont l'onglet par défaut porte sa propre permission :
    // sans onglet servable, le module doit tout de même désigner une adresse
    // plutôt que de renvoyer `undefined` au composant de rendu.
    expect(resolve("gamma", undefined, []).activeTab).toBe("betaTab")
})

test("le clamp des sous-sections s'applique même quand l'onglet par défaut est gaté", () => {
    // `activeDef` est cherché parmi TOUTES les définitions : le chercher parmi
    // les seules visibles ferait sauter ce clamp en silence.
    const gated: TabbedModuleConfig<Id> = { ...config, defaultTab: "gammaTab" }

    expect(
        resolveTabState({ config: gated, visibleTabs: [], section: undefined, detail: undefined }),
    ).toMatchObject({ activeTab: "gammaTab", canonicalDetail: "un" })
})

// ─── Détail ───────────────────────────────────────────────────────────────────

test("un détail libre traverse intact", () => {
    expect(resolve("beta", "abc-123").canonicalDetail).toBe("abc-123")
})

test("une sous-section admise est conservée", () => {
    expect(resolve("gamma", "deux").canonicalDetail).toBe("deux")
})

test("une sous-section inconnue retombe sur la première", () => {
    expect(resolve("gamma", "nimportequoi").canonicalDetail).toBe("un")
})

test("une sous-section absente est remplacée par la première", () => {
    expect(resolve("gamma").canonicalDetail).toBe("un")
})

test("quitter un onglet à sous-sections ne réintroduit pas sa sous-section", () => {
    // Régression de référence (stock principal, août 2026) : `SettingsBoard` se
    // redirigeait lui-même vers `/stock/parametres/<section>` pendant la passe
    // de rendu supplémentaire que Radix Tabs accorde à un onglet devenu
    // inactif. L'utilisateur oscillait entre l'onglet cliqué et Paramètres,
    // sans erreur ni log. La canonicalisation vit désormais au seul endroit qui
    // voit les deux onglets à la fois, et le détail de `gammaTab` ne suit pas.
    expect(resolve("beta")).toMatchObject({
        activeTab: "betaTab",
        canonicalDetail: undefined,
    })
})

test("le détail d'un onglet refusé n'est pas reporté sur l'onglet retenu", () => {
    // Sans ce garde-fou, `/demo/gamma/deux` refusé glisserait vers
    // `/demo/beta/deux`, où « deux » serait lu comme un id.
    const visible = TABS.filter((tab) => tab.id !== "gammaTab")

    expect(resolve("gamma", "deux", visible)).toMatchObject({
        activeTab: "betaTab",
        canonicalDetail: undefined,
    })
})

// ─── Alias historiques ────────────────────────────────────────────────────────

test("un segment historique est traduit en conservant le détail", () => {
    // C'est LE cas qui casserait un lien de notification : le détail désigne la
    // ressource à ouvrir, le perdre renvoie l'utilisateur sur une liste sans
    // lui dire pourquoi.
    expect(resolve("ancien", "abc-123")).toMatchObject({
        activeTab: "betaTab",
        canonicalSection: "beta",
        canonicalDetail: "abc-123",
    })
})

test("un alias vers un onglet refusé perd son détail comme n'importe quel refus", () => {
    const aliased: TabbedModuleConfig<Id> = {
        ...config,
        legacySections: { ancien: "gamma" },
    }
    const visible = TABS.filter((tab) => tab.id !== "gammaTab")

    expect(
        resolveTabState({ config: aliased, visibleTabs: visible, section: "ancien", detail: "deux" }),
    ).toMatchObject({ activeTab: "betaTab", canonicalDetail: undefined })
})

test("sans table d'alias, le segment passe tel quel", () => {
    const bare: TabbedModuleConfig<Id> = { ...config, legacySections: undefined }

    expect(
        resolveTabState({ config: bare, visibleTabs: TABS, section: "ancien", detail: undefined }),
    ).toMatchObject({ activeTab: "betaTab", canonicalSection: "beta" })
})

// ─── Chemin ───────────────────────────────────────────────────────────────────

test("tabPath omet le segment de détail quand il n'y en a pas", () => {
    expect(tabPath("/demo", "beta")).toBe("/demo/beta")
    expect(tabPath("/demo", "gamma", "un")).toBe("/demo/gamma/un")
})
