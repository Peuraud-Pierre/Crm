import { afterEach, expect, rstest, test } from "@rstest/core"
import { classifyCameraError, readCameraPermission, requestCameraAccess } from "./camera"

/**
 * Lecture et traduction de l'accès caméra : un navigateur qui ne sait pas
 * répondre ne doit pas bloquer le scan, et chaque refus doit être nommé.
 */

const original = {
    secure: Object.getOwnPropertyDescriptor(window, "isSecureContext"),
    mediaDevices: Object.getOwnPropertyDescriptor(navigator, "mediaDevices"),
    permissions: Object.getOwnPropertyDescriptor(navigator, "permissions"),
}

function setup({ secure = true, media = true, query }: {
    secure?: boolean
    media?: boolean
    query?: () => Promise<{ state: string }>
}) {
    Object.defineProperty(window, "isSecureContext", { value: secure, configurable: true })
    Object.defineProperty(navigator, "mediaDevices", {
        value: media ? { getUserMedia: rstest.fn() } : undefined,
        configurable: true,
    })
    Object.defineProperty(navigator, "permissions", {
        value: query ? { query } : undefined,
        configurable: true,
    })
}

afterEach(() => {
    for (const [target, key, desc] of [
        [window, "isSecureContext", original.secure],
        [navigator, "mediaDevices", original.mediaDevices],
        [navigator, "permissions", original.permissions],
    ] as const) {
        if (desc) Object.defineProperty(target, key, desc)
        else delete (target as unknown as Record<string, unknown>)[key]
    }
})

test("hors HTTPS, la caméra est déclarée non sécurisée", async () => {
    setup({ secure: false })
    expect(await readCameraPermission()).toBe("insecure")
})

test("sans API caméra, elle est non prise en charge", async () => {
    setup({ media: false })
    expect(await readCameraPermission()).toBe("unsupported")
})

test("un navigateur qui ne sait pas interroger la caméra renvoie « prompt »", async () => {
    setup({ query: () => Promise.reject(new TypeError("camera is not a valid PermissionName")) })
    expect(await readCameraPermission()).toBe("prompt")
    setup({})
    expect(await readCameraPermission()).toBe("prompt")
})

test("l'état du navigateur est relayé tel quel", async () => {
    setup({ query: () => Promise.resolve({ state: "denied" }) })
    expect(await readCameraPermission()).toBe("denied")
})

test("les erreurs de getUserMedia et de html5-qrcode sont nommées", () => {
    expect(classifyCameraError(new DOMException("x", "NotAllowedError"))).toBe("denied")
    expect(classifyCameraError("NotAllowedError: Permission denied")).toBe("denied")
    expect(classifyCameraError(new DOMException("x", "NotFoundError"))).toBe("no-camera")
    expect(classifyCameraError(new DOMException("x", "NotReadableError"))).toBe("busy")
    expect(classifyCameraError(new DOMException("x", "SecurityError"))).toBe("insecure")
})

test("la demande rend la caméra aussitôt accordée", async () => {
    setup({})
    const stop = rstest.fn()
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof rstest.fn>).mockResolvedValue({
        getTracks: () => [{ stop }],
    })
    expect(await requestCameraAccess()).toBe("granted")
    expect(stop).toHaveBeenCalled()
})

test("un refus à la demande est rapporté comme tel", async () => {
    setup({})
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof rstest.fn>).mockRejectedValue(
        new DOMException("x", "NotAllowedError"),
    )
    rstest.spyOn(console, "error").mockImplementation(() => {})
    expect(await requestCameraAccess()).toBe("denied")
})
