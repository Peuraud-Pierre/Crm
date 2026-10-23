import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { authOutro, useAuthOutro } from "./outroStore"

const realMatchMedia = window.matchMedia

function setReducedMotion(reduce: boolean) {
    window.matchMedia = ((query: string) => ({
        matches: reduce && query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
    setReducedMotion(false)
    authOutro.finish()
    authOutro.disarm()
})

afterEach(() => {
    window.matchMedia = realMatchMedia
    rstest.restoreAllMocks()
})

test("a fresh sign-in arms the outro, a restored session does not", () => {
    expect(authOutro.isArmed()).toBe(false)
    authOutro.arm()
    expect(authOutro.isArmed()).toBe(true)
})

test("an arming left unused expires", () => {
    const now = rstest.spyOn(performance, "now").mockReturnValue(1_000)
    authOutro.arm()
    now.mockReturnValue(1_000 + 31_000)
    expect(authOutro.isArmed()).toBe(false)
})

test("leaving the MFA step disarms", () => {
    authOutro.arm()
    authOutro.disarm()
    expect(authOutro.isArmed()).toBe(false)
})

test("reduced motion never arms: the app opens directly", () => {
    setReducedMotion(true)
    authOutro.arm()
    expect(authOutro.isArmed()).toBe(false)
})

test("phases run exit → hold → land → idle, and readiness only counts during an outro", () => {
    const logo = document.createElement("div")
    authOutro.registerLogo(logo)
    const { result } = renderHook(() => useAuthOutro())

    // Hors outro, « prêt » ne compte pas.
    act(() => authOutro.markReady())
    expect(result.current).toMatchObject({ phase: "idle", ready: false })

    act(() => {
        authOutro.arm()
        authOutro.exit()
    })
    expect(result.current.phase).toBe("exiting")
    // La sortie consomme l'armement : un second passage ne rejoue rien.
    expect(authOutro.isArmed()).toBe(false)

    act(() => authOutro.takeOver())
    expect(result.current.phase).toBe("holding")
    expect(result.current.from).not.toBeNull()

    // L'atterrissage attend la phase d'attente ; « prêt » est retenu.
    act(() => authOutro.markReady())
    expect(result.current.ready).toBe(true)
    act(() => authOutro.land())
    expect(result.current.phase).toBe("landing")

    act(() => authOutro.finish())
    expect(result.current).toMatchObject({ phase: "idle", from: null, ready: false })
})

test("a second exit while an outro runs is ignored", () => {
    const { result } = renderHook(() => useAuthOutro())
    act(() => authOutro.exit())
    const startedAt = result.current.startedAt
    act(() => authOutro.exit())
    expect(result.current.startedAt).toBe(startedAt)
})

test("the landing target is notified once the logo has merged into it", () => {
    const onLanded = rstest.fn()
    const stop = authOutro.onLanded(onLanded)
    authOutro.notifyLanded()
    stop()
    authOutro.notifyLanded()
    expect(onLanded).toHaveBeenCalledTimes(1)
})
