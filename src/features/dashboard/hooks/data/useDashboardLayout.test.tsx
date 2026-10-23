import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook, waitFor } from "@testing-library/react"
import { LAYOUT_VERSION, PERSIST_DEBOUNCE_MS } from "../../constants"

/**
 * La cascade de résolution et la persistance.
 *
 * C'est la logique la plus métier du module — l'ordre personnel → rôle →
 * service → défaut, la priorité du rôle sur le service, le repli quand un
 * gabarit est illisible — et elle vivait sans aucun test : une refonte
 * pouvait en inverser la priorité sans que rien ne s'allume.
 *
 * Les tests portent aussi sur deux propriétés qui ne se voient pas à
 * l'écran mais dont dépend la fluidité du canevas : un geste sans effet ne
 * doit rien écrire, et les gestionnaires doivent garder leur identité
 * d'un geste à l'autre (sans quoi la mémoïsation de `WidgetCard` tombe).
 */

const mocks = rstest.hoisted(() => ({
    fetchUserLayout: rstest.fn(),
    fetchTemplatesFor: rstest.fn(),
    saveUserLayout: rstest.fn(),
    deleteUserLayout: rstest.fn(),
    toast: { success: rstest.fn(), error: rstest.fn() },
    auth: {
        user: {
            user_id: "u1",
            id: "db1",
            role_id: "role-1",
            service_id: "svc-1",
        } as Record<string, unknown> | null,
        hasPermission: () => true,
        permissionsLoaded: true,
    },
}))

rstest.mock("sonner", () => ({ toast: mocks.toast }))

rstest.mock("../../services/dashboardLayoutService", () => ({
    fetchUserLayout: mocks.fetchUserLayout,
    fetchTemplatesFor: mocks.fetchTemplatesFor,
    saveUserLayout: mocks.saveUserLayout,
    deleteUserLayout: mocks.deleteUserLayout,
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock de hook
    useAuth: () => mocks.auth,
}))

import { useDashboardLayout } from "./useDashboardLayout"

/** Une disposition valide au format courant, réduite au minimum. */
function layoutWith(widgetId: string) {
    return {
        version: LAYOUT_VERSION,
        items: [
            {
                instanceId: `inst-${widgetId}`,
                widgetId,
                x: 0,
                y: 0,
                w: 6,
                h: 4,
                settings: {},
            },
        ],
        bands: { announcements: true },
        density: "comfortable",
    }
}

/** Les deux modules du dashboard n'exigent aucune permission : ils
 *  survivent à `sanitizeLayout` quel que soit le profil de test. */
const SHORTCUTS = "dashboard.shortcuts"
const NOTES = "dashboard.notes"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.auth.user = {
        user_id: "u1",
        id: "db1",
        role_id: "role-1",
        service_id: "svc-1",
    }
    mocks.fetchUserLayout.mockResolvedValue(null)
    mocks.fetchTemplatesFor.mockResolvedValue([])
    mocks.saveUserLayout.mockResolvedValue(undefined)
    mocks.deleteUserLayout.mockResolvedValue(undefined)
})

async function mount() {
    const view = renderHook(() => useDashboardLayout())
    await waitFor(() => expect(view.result.current.loading).toBe(false))
    return view
}

/* ── Cascade de résolution ───────────────────────────────────────── */

test("la disposition personnelle prime sur tout le reste", async () => {
    mocks.fetchUserLayout.mockResolvedValue(layoutWith(NOTES))
    mocks.fetchTemplatesFor.mockResolvedValue([
        { id: "t1", role_id: "role-1", service_id: null, layout: layoutWith(SHORTCUTS) },
    ])

    const { result } = await mount()

    expect(result.current.source).toBe("user")
    expect(result.current.layout.items[0].widgetId).toBe(NOTES)
})

test("le gabarit du rôle prime sur celui du service", async () => {
    // Le rôle décrit le métier de la personne, le service son
    // rattachement : c'est le premier qui doit gagner.
    mocks.fetchTemplatesFor.mockResolvedValue([
        { id: "t-svc", role_id: null, service_id: "svc-1", layout: layoutWith(NOTES) },
        { id: "t-role", role_id: "role-1", service_id: null, layout: layoutWith(SHORTCUTS) },
    ])

    const { result } = await mount()

    expect(result.current.source).toBe("role")
    expect(result.current.layout.items[0].widgetId).toBe(SHORTCUTS)
})

test("sans gabarit de rôle, celui du service s'applique", async () => {
    mocks.fetchTemplatesFor.mockResolvedValue([
        { id: "t-svc", role_id: null, service_id: "svc-1", layout: layoutWith(NOTES) },
    ])

    const { result } = await mount()

    expect(result.current.source).toBe("service")
    expect(result.current.layout.items[0].widgetId).toBe(NOTES)
})

test("sans rien en base, la page par défaut vient des modules starter", async () => {
    const { result } = await mount()

    expect(result.current.source).toBe("default")
    // `dashboard.shortcuts` est le starter de rang 1 du registre.
    expect(
        result.current.layout.items.some((i) => i.widgetId === SHORTCUTS)
    ).toBe(true)
})

/* ── Robustesse des données venues de la base ────────────────────── */

test("une disposition personnelle illisible laisse la main au niveau suivant", async () => {
    // Écrite à la main, par une version antérieure, ou corrompue : elle
    // ne doit pas produire une page blanche.
    mocks.fetchUserLayout.mockResolvedValue({ version: 2, items: "pas-un-tableau" })
    const warnSpy = rstest.spyOn(console, "warn").mockImplementation(() => {})
    mocks.fetchTemplatesFor.mockResolvedValue([
        { id: "t-role", role_id: "role-1", service_id: null, layout: layoutWith(NOTES) },
    ])

    const { result } = await mount()

    expect(result.current.source).toBe("role")
    expect(result.current.layout.items[0].widgetId).toBe(NOTES)
    expect(warnSpy).toHaveBeenCalledWith(
        "[dashboard] disposition illisible, ignorée",
        expect.anything()
    )
    warnSpy.mockRestore()
})

test("un gabarit de rôle illisible n'empêche pas celui du service", async () => {
    mocks.fetchTemplatesFor.mockResolvedValue([
        { id: "t-role", role_id: "role-1", service_id: null, layout: { nawak: true } },
        { id: "t-svc", role_id: null, service_id: "svc-1", layout: layoutWith(NOTES) },
    ])

    const { result } = await mount()

    expect(result.current.source).toBe("service")
})

test("un échec de chargement retombe sur la page par défaut, pas sur du vide", async () => {
    mocks.fetchUserLayout.mockRejectedValue(new Error("réseau"))
    const errSpy = rstest.spyOn(console, "error").mockImplementation(() => {})

    const { result } = await mount()

    expect(result.current.source).toBe("default")
    expect(result.current.layout.items.length).toBeGreaterThan(0)
    expect(mocks.toast.error).toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalledWith("[useDashboardLayout] load:", expect.any(Error))
    errSpy.mockRestore()
})

/* ── Persistance ─────────────────────────────────────────────────── */

/** Laisse passer le debounce d'écriture, avec un peu de marge. */
function afterDebounce() {
    return new Promise((resolve) =>
        setTimeout(resolve, PERSIST_DEBOUNCE_MS + 150)
    )
}

test("un geste n'est écrit qu'une fois la main arrêtée", async () => {
    mocks.fetchUserLayout.mockResolvedValue(layoutWith(NOTES))
    const { result } = await mount()

    const id = result.current.layout.items[0].instanceId

    // Trois étapes d'un même glisser : une seule écriture attendue.
    act(() => result.current.placeItem(id, { x: 1, y: 0, w: 6, h: 4 }))
    act(() => result.current.placeItem(id, { x: 2, y: 0, w: 6, h: 4 }))
    act(() => result.current.placeItem(id, { x: 3, y: 0, w: 6, h: 4 }))

    expect(mocks.saveUserLayout).not.toHaveBeenCalled()

    await act(async () => {
        await afterDebounce()
    })

    expect(mocks.saveUserLayout).toHaveBeenCalledTimes(1)
    // C'est bien la dernière position qui part en base, pas la première.
    expect(mocks.saveUserLayout.mock.calls[0][1].items[0].x).toBe(3)
})

test("un geste qui ne déplace rien n'écrit pas", async () => {
    mocks.fetchUserLayout.mockResolvedValue(layoutWith(NOTES))
    const { result } = await mount()

    const item = result.current.layout.items[0]

    // Relâcher la carte dans sa propre case : ce que produit tout clic
    // un peu appuyé sur la poignée.
    act(() =>
        result.current.placeItem(item.instanceId, {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
        })
    )

    await act(async () => {
        await afterDebounce()
    })

    expect(mocks.saveUserLayout).not.toHaveBeenCalled()
})

test("réinitialiser supprime la ligne personnelle et recharge", async () => {
    mocks.fetchUserLayout.mockResolvedValue(layoutWith(NOTES))
    const { result } = await mount()
    expect(result.current.source).toBe("user")

    // Au rechargement, plus de disposition personnelle : le gabarit du
    // rôle reprend la main, et continuera d'évoluer avec lui.
    mocks.fetchUserLayout.mockResolvedValue(null)
    mocks.fetchTemplatesFor.mockResolvedValue([
        { id: "t-role", role_id: "role-1", service_id: null, layout: layoutWith(SHORTCUTS) },
    ])

    await act(async () => {
        await result.current.reset()
    })

    expect(mocks.deleteUserLayout).toHaveBeenCalledWith("u1")
    await waitFor(() => expect(result.current.source).toBe("role"))
})

/* ── Stabilité des gestionnaires ─────────────────────────────────── */

test("les gestionnaires gardent leur identité d'un geste à l'autre", async () => {
    // Ce n'est pas une coquetterie : ces fonctions descendent jusqu'à
    // chaque carte du canevas, où `WidgetCard` est mémoïsé. Si elles
    // changeaient à chaque changement de disposition, les quinze cartes
    // et leur contenu se re-rendraient à chaque case franchie.
    mocks.fetchUserLayout.mockResolvedValue(layoutWith(NOTES))
    const { result } = await mount()

    const before = {
        placeItem: result.current.placeItem,
        addWidget: result.current.addWidget,
        duplicate: result.current.duplicate,
        removeWidget: result.current.removeWidget,
        setItemSettings: result.current.setItemSettings,
        setDensity: result.current.setDensity,
        setBand: result.current.setBand,
    }

    const id = result.current.layout.items[0].instanceId
    act(() => {
        result.current.placeItem(id, { x: 4, y: 2, w: 6, h: 4 })
    })

    // La disposition a bien changé…
    expect(result.current.layout.items[0].x).toBe(4)
    // …mais pas les fonctions.
    expect(result.current.placeItem).toBe(before.placeItem)
    expect(result.current.addWidget).toBe(before.addWidget)
    expect(result.current.duplicate).toBe(before.duplicate)
    expect(result.current.removeWidget).toBe(before.removeWidget)
    expect(result.current.setItemSettings).toBe(before.setItemSettings)
    expect(result.current.setDensity).toBe(before.setDensity)
    expect(result.current.setBand).toBe(before.setBand)
})

test("les réglages d'un module n'écrasent pas ceux des autres", async () => {
    mocks.fetchUserLayout.mockResolvedValue(layoutWith(NOTES))
    const { result } = await mount()

    const id = result.current.layout.items[0].instanceId
    act(() => {
        result.current.setItemSettings(id, { text: "premier" })
    })
    act(() => {
        result.current.setItemSettings(id, { title: "Courses" })
    })

    expect(result.current.layout.items[0].settings).toEqual({
        text: "premier",
        title: "Courses",
    })
})
