import { expect, rstest, test } from "@rstest/core"
import { render as rtlRender, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"

const mocks = rstest.hoisted(() => ({
    layout: {
        version: 2,
        items: [
            {
                instanceId: "i1",
                widgetId: "dashboard.shortcuts",
                x: 0,
                y: 0,
                w: 6,
                h: 4,
                settings: {},
            },
        ],
        bands: { announcements: true },
        density: "comfortable" as string,
    },
    source: "default" as string,
    loading: false,
}))

rstest.mock("../hooks/data/useDashboardLayout", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de hook
    useDashboardLayout: () => ({
        layout: mocks.layout,
        source: mocks.source,
        loading: mocks.loading,
        availableWidgets: [],
        placeItem: rstest.fn(),
        addWidget: rstest.fn(),
        duplicate: rstest.fn(),
        removeWidget: rstest.fn(),
        patchItem: rstest.fn(),
        setItemSettings: rstest.fn(),
        setBand: rstest.fn(),
        setDensity: rstest.fn(),
        reset: rstest.fn(),
    }),
}))

rstest.mock("../components/canvas/WidgetCanvas", () => ({
    WidgetCanvas: ({ editing }: { editing: boolean }) => (
        <div>{editing ? "canevas-edition" : "canevas-lecture"}</div>
    ),
}))

rstest.mock("../components/catalog/WidgetCatalog", () => ({
    WidgetCatalog: () => null,
}))

rstest.mock("../components/settings/WidgetSettingsSheet", () => ({
    WidgetSettingsSheet: () => null,
}))

rstest.mock("../decor/BioModeOverlay", () => ({
    BioModeOverlay: () => null,
}))

rstest.mock("@/features/announcements", () => ({
    AnnouncementBand: () => <div>bandeau-annonces</div>,
}))

rstest.mock("@/features/changelog", () => ({
    ChangelogRail: () => <div>ourlet-nouveautes</div>,
}))

import Dashboard from "./Dashboard"

/**
 * `TooltipProvider` est monté une fois pour toute l'application dans
 * `AppProviders` ; la barre d'outils compte dessus. Le rendu isolé doit
 * donc le fournir, sinon Radix lève dès la première infobulle.
 */
function render() {
    return rtlRender(
        <TooltipProvider>
            <Dashboard />
        </TooltipProvider>
    )
}

test("les deux zones imposées encadrent le canevas", () => {
    render()

    expect(screen.getByText("bandeau-annonces")).toBeInTheDocument()
    expect(screen.getByText("canevas-lecture")).toBeInTheDocument()
    expect(screen.getByText("ourlet-nouveautes")).toBeInTheDocument()
})

test("le canevas n'est pas éditable tant qu'on n'a pas cliqué « Personnaliser »", () => {
    // Sur une page traversée plusieurs fois par jour, un glisser
    // accidentel serait fréquent : l'édition doit être un geste explicite.
    render()

    expect(screen.getByText("canevas-lecture")).toBeInTheDocument()
    expect(
        screen.getByRole("button", { name: /Personnaliser/ })
    ).toBeInTheDocument()
    expect(
        screen.queryByRole("button", { name: /Ajouter un module/ })
    ).toBeNull()
})

test("« Personnaliser » ouvre le mode édition et ses outils", async () => {
    render()

    await userEvent.click(
        screen.getByRole("button", { name: /Personnaliser/ })
    )

    expect(screen.getByText("canevas-edition")).toBeInTheDocument()
    expect(
        screen.getByRole("button", { name: /Ajouter un module/ })
    ).toBeInTheDocument()
})

test("« Réinitialiser » est masqué sans disposition personnelle", async () => {
    mocks.source = "default"
    render()

    await userEvent.click(
        screen.getByRole("button", { name: /Personnaliser/ })
    )

    expect(screen.queryByRole("button", { name: /Réinitialiser/ })).toBeNull()
})
