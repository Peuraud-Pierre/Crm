import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

const mocks = rstest.hoisted(() => ({
    fetchUserPreferences: rstest.fn(),
    saveUserPreferences: rstest.fn(),
    setTheme: rstest.fn(),
    useTheme: rstest.fn(),
    useAuth: rstest.fn(),
    toast: { success: rstest.fn(), error: rstest.fn() },
}))

rstest.mock("sonner", () => ({ toast: mocks.toast }))
rstest.mock("next-themes", () => ({ useTheme: mocks.useTheme }))
rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))
rstest.mock("../../services/preferencesService", () => ({
    fetchUserPreferences: mocks.fetchUserPreferences,
    saveUserPreferences: mocks.saveUserPreferences,
}))

import {
    UserPreferencesProvider,
    useUserPreferencesContext,
} from "./UserPreferencesProvider"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs("[UserPreferences]")

const ROW = {
    user_id: "u1",
    theme: "dark" as const,
    push_enabled: true,
    notify_ticket: true,
    notify_message: true,
    notify_system: true,
}

function wrapper({ children }: { children: ReactNode }) {
    return <UserPreferencesProvider>{children}</UserPreferencesProvider>
}

/** Un déféré, pour piloter finement l'ordre lecture/écriture. */
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => {
        resolve = r
    })
    return { promise, resolve }
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.useAuth.mockReturnValue({ user: { user_id: "u1" } })
    // Reproduit le contrat de next-themes : `setTheme` est un useCallback
    // dépendant du thème courant, donc son identité change à chaque bascule.
    let currentTheme = "system"
    mocks.useTheme.mockImplementation(() => ({
        setTheme: (value: string) => {
            currentTheme = value
            mocks.setTheme(value)
        },
        theme: currentTheme,
    }))
    mocks.fetchUserPreferences.mockResolvedValue(null)
    mocks.saveUserPreferences.mockResolvedValue(undefined)
})

test("ne lit la base qu'une fois, quel que soit le nombre de consommateurs", async () => {
    function Consumer() {
        const { loading } = useUserPreferencesContext()
        return <span>{loading ? "chargement" : "prêt"}</span>
    }

    render(
        <UserPreferencesProvider>
            <Consumer />
            <Consumer />
            <Consumer />
        </UserPreferencesProvider>
    )

    await waitFor(() =>
        expect(screen.getAllByText("prêt")).toHaveLength(3)
    )
    expect(mocks.fetchUserPreferences).toHaveBeenCalledTimes(1)
})

test("changer de thème ne redéclenche PAS de lecture en base", async () => {
    // Non-régression : `setTheme` change d'identité à chaque bascule ; s'il
    // reste dans les dépendances de l'effet de chargement, chaque changement
    // relit la base et la réponse rétablit l'ancien thème.
    mocks.fetchUserPreferences.mockResolvedValue(ROW)
    const { result } = renderHook(() => useUserPreferencesContext(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.fetchUserPreferences).toHaveBeenCalledTimes(1)

    await act(async () => {
        await result.current.setThemeChoice("light")
    })
    await act(async () => {
        await result.current.setThemeChoice("dark")
    })

    expect(mocks.fetchUserPreferences).toHaveBeenCalledTimes(1)
    expect(result.current.preferences.theme).toBe("dark")
})

test("une écriture émise pendant la lecture initiale n'est pas écrasée", async () => {
    const read = deferred<typeof ROW>()
    mocks.fetchUserPreferences.mockReturnValue(read.promise)

    const { result } = renderHook(() => useUserPreferencesContext(), { wrapper })

    // L'utilisateur bascule avant que la lecture initiale n'ait répondu.
    await act(async () => {
        await result.current.setThemeChoice("light")
    })
    await act(async () => {
        read.resolve(ROW) // la base répondrait "dark"
        await read.promise
    })

    expect(result.current.preferences.theme).toBe("light")
    expect(mocks.setTheme).toHaveBeenLastCalledWith("light")
})

test("la base fait autorité sur le thème au chargement", async () => {
    mocks.fetchUserPreferences.mockResolvedValue(ROW)

    const { result } = renderHook(() => useUserPreferencesContext(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.preferences.theme).toBe("dark")
    expect(mocks.setTheme).toHaveBeenCalledWith("dark")
})

test("sans ligne en base, les valeurs par défaut s'appliquent", async () => {
    const { result } = renderHook(() => useUserPreferencesContext(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.preferences).toEqual({
        theme: "system",
        push_enabled: true,
        notify_ticket: true,
        notify_message: true,
        notify_system: true,
    })
    expect(mocks.setTheme).not.toHaveBeenCalled()
})

test("updatePreferences persiste le patch", async () => {
    const { result } = renderHook(() => useUserPreferencesContext(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
        await result.current.updatePreferences({ notify_message: false })
    })

    expect(mocks.saveUserPreferences).toHaveBeenCalledWith("u1", {
        notify_message: false,
    })
    expect(result.current.preferences.notify_message).toBe(false)
})

test("un échec d'écriture restaure l'état précédent", async () => {
    mocks.saveUserPreferences.mockRejectedValue(new Error("rls"))

    const { result } = renderHook(() => useUserPreferencesContext(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
        await result.current.setThemeChoice("dark")
    })

    expect(result.current.preferences.theme).toBe("system")
    expect(mocks.setTheme).toHaveBeenLastCalledWith("system")
    expect(mocks.toast.error).toHaveBeenCalled()
})

test("deux écritures rapprochées : la dernière gagne, la première n'annule rien", async () => {
    const firstWrite = deferred<void>()
    mocks.saveUserPreferences
        .mockReturnValueOnce(
            firstWrite.promise.then(() => {
                throw new Error("échec tardif")
            })
        )
        .mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useUserPreferencesContext(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let firstCall!: Promise<boolean>
    act(() => {
        firstCall = result.current.setThemeChoice("light")
    })
    await act(async () => {
        await result.current.setThemeChoice("dark")
    })
    await act(async () => {
        firstWrite.resolve()
        await firstCall
    })

    // L'échec de la première écriture ne doit pas rétablir "system".
    expect(result.current.preferences.theme).toBe("dark")
    expect(mocks.setTheme).toHaveBeenLastCalledWith("dark")
})

test("le hook exige son provider", () => {
    expect(() => renderHook(() => useUserPreferencesContext())).toThrow(
        /UserPreferencesProvider/
    )
})
