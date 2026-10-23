import { expect, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router"
import { useDetailDeepLink } from "./useDetailDeepLink"

/**
 * Cette garde décide de l'ouverture d'une sheet à partir de l'URL. Elle était
 * recopiée dans trois onglets, et son cas le plus important — un lien profond
 * ouvert à froid, avant que les données ne soient chargées — ne doit surtout
 * pas rediriger : c'est ce qui casserait tous les liens de notification.
 */

interface Row {
    id: string
}

const ROWS: Row[] = [{ id: "abc-123" }]

function Probe({
    detail,
    canCreate = true,
    canUpdate = true,
    canView,
    loaded = true,
}: {
    detail?: string
    canCreate?: boolean
    canUpdate?: boolean
    canView?: boolean
    loaded?: boolean
}) {
    const { creationOpen, editing, viewing } = useDetailDeepLink<Row>({
        detail,
        baseUrl: "/demo/flux",
        canCreate,
        canUpdate,
        canView,
        loaded,
        find: (id) => ROWS.find((row) => row.id === id) ?? null,
    })
    const { pathname } = useLocation()

    return (
        <>
            <span data-testid="path">{pathname}</span>
            <span data-testid="navtype">{useNavigationType()}</span>
            <span data-testid="creation">{String(creationOpen)}</span>
            <span data-testid="editing">{editing?.id ?? ""}</span>
            <span data-testid="viewing">{viewing?.id ?? ""}</span>
        </>
    )
}

function renderWith(props: Parameters<typeof Probe>[0], at = "/demo/flux/x") {
    return render(
        <MemoryRouter initialEntries={[at]}>
            <Routes>
                <Route path="/demo/flux/:detail?" element={<Probe {...props} />} />
            </Routes>
        </MemoryRouter>,
    )
}

const path = () => screen.getByTestId("path").textContent

// ─── Création ─────────────────────────────────────────────────────────────────

test("`new` ouvre la création quand le droit est là", () => {
    renderWith({ detail: "new" })

    expect(screen.getByTestId("creation")).toHaveTextContent("true")
    expect(path()).toBe("/demo/flux/x")
})

test("`new` sans droit de création nettoie l'URL", () => {
    renderWith({ detail: "new", canCreate: false })

    expect(screen.getByTestId("creation")).toHaveTextContent("false")
    expect(path()).toBe("/demo/flux")
})

// ─── Édition ──────────────────────────────────────────────────────────────────

test("un identifiant connu ouvre l'édition", () => {
    renderWith({ detail: "abc-123" })

    expect(screen.getByTestId("editing")).toHaveTextContent("abc-123")
})

test("un identifiant sans droit de modification nettoie l'URL", () => {
    // La permission se vérifie sur la SHEET : masquer le bouton d'édition ne
    // suffit pas, l'URL reste atteignable.
    renderWith({ detail: "abc-123", canUpdate: false })

    expect(screen.getByTestId("editing")).toBeEmptyDOMElement()
    expect(path()).toBe("/demo/flux")
})

test("un identifiant introuvable une fois chargé nettoie l'URL", () => {
    renderWith({ detail: "inexistant" })

    expect(path()).toBe("/demo/flux")
})

test("un identifiant introuvable AVANT chargement ne redirige pas", () => {
    // Le cas qui casserait tous les liens de notification : la sheet s'ouvre
    // sur une ressource pas encore chargée, l'absence n'est pas concluante.
    renderWith({ detail: "abc-123", loaded: false })

    expect(path()).toBe("/demo/flux/x")
})

// ─── Consultation ─────────────────────────────────────────────────────────────

test("sans `canView`, la consultation suit le droit de modification", () => {
    renderWith({ detail: "abc-123" })

    expect(screen.getByTestId("viewing")).toHaveTextContent("abc-123")
})

test("`canView` seul ouvre la fiche sans ouvrir l'édition", () => {
    // Le cas du lecteur : il consulte la balle, mais aucun formulaire ne doit
    // lui être proposé.
    renderWith({ detail: "abc-123", canUpdate: false, canView: true })

    expect(screen.getByTestId("viewing")).toHaveTextContent("abc-123")
    expect(screen.getByTestId("editing")).toBeEmptyDOMElement()
    expect(path()).toBe("/demo/flux/x")
})

test("ni lecture ni modification nettoie l'URL", () => {
    renderWith({ detail: "abc-123", canUpdate: false, canView: false })

    expect(screen.getByTestId("viewing")).toBeEmptyDOMElement()
    expect(path()).toBe("/demo/flux")
})

// ─── Sans détail ──────────────────────────────────────────────────────────────

test("sans segment de détail, rien n'est ouvert et rien n'est redirigé", () => {
    renderWith({ detail: undefined }, "/demo/flux")

    expect(screen.getByTestId("creation")).toHaveTextContent("false")
    expect(screen.getByTestId("editing")).toBeEmptyDOMElement()
    expect(screen.getByTestId("navtype")).toHaveTextContent("POP")
})

test("le nettoyage est en replace : il n'empile pas d'entrée morte", () => {
    renderWith({ detail: "inexistant" })

    expect(screen.getByTestId("navtype")).toHaveTextContent("REPLACE")
})
