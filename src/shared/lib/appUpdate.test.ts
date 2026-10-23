import { afterEach, expect, rstest, test } from "@rstest/core"

import {
    __resetAppUpdate,
    hasUnsavedWork,
    notifyUpdateAvailable,
    setUnsavedWork,
} from "./appUpdate"

const reload = rstest.fn()

// jsdom verrouille window.location et location.reload (non configurables) :
// on remplace `reload` sur l'implémentation interne, que le wrapper appelle.
const locationImpl = Object.getOwnPropertySymbols(window.location)
    .map((key) => (window.location as unknown as Record<symbol, unknown>)[key])
    .find(
        (value): value is { reload: () => void } =>
            typeof (value as { reload?: unknown } | null)?.reload === "function"
    )
if (!locationImpl) throw new Error("implémentation jsdom de location introuvable")
locationImpl.reload = reload

afterEach(() => {
    __resetAppUpdate()
    reload.mockClear()
})

test("sans saisie en cours, la mise à jour recharge tout de suite", () => {
    notifyUpdateAvailable()
    expect(reload).toHaveBeenCalledTimes(1)
})

test("une saisie en cours retient le rechargement", () => {
    setUnsavedWork("brief:1", true)
    notifyUpdateAvailable()
    expect(reload).not.toHaveBeenCalled()
})

test("le rechargement part dès que le dernier formulaire est propre", () => {
    setUnsavedWork("brief:1", true)
    setUnsavedWork("devis:7", true)
    notifyUpdateAvailable()
    expect(reload).not.toHaveBeenCalled()

    // Un seul des deux libéré : il en reste un, on attend toujours.
    setUnsavedWork("brief:1", false)
    expect(reload).not.toHaveBeenCalled()

    setUnsavedWork("devis:7", false)
    expect(reload).toHaveBeenCalledTimes(1)
})

test("libérer une saisie sans mise à jour en attente ne recharge pas", () => {
    setUnsavedWork("brief:1", true)
    setUnsavedWork("brief:1", false)
    expect(reload).not.toHaveBeenCalled()
    expect(hasUnsavedWork()).toBe(false)
})

test("notifier deux fois ne recharge qu'une fois", () => {
    notifyUpdateAvailable()
    notifyUpdateAvailable()
    expect(reload).toHaveBeenCalledTimes(1)
})
