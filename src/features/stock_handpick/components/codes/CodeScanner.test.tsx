import { expect, rstest, test } from "@rstest/core"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CodeScanner } from "./CodeScanner"

/**
 * Cycle de vie de la caméra : un dialog fermé avant que la caméra ait fini de
 * démarrer ne doit pas la laisser allumée, ni naviguer sur un code vu ensuite.
 */

const mocks = rstest.hoisted(() => {
    const instances: {
        resolveStart: () => void
        onSuccess: (text: string) => void
        stop: ReturnType<typeof rstest.fn>
        clear: ReturnType<typeof rstest.fn>
    }[] = []
    class Html5Qrcode {
        stop = rstest.fn(() => Promise.resolve())
        clear = rstest.fn()
        start(_camera: unknown, _config: unknown, onSuccess: (text: string) => void) {
            return new Promise<void>((resolve) => {
                instances.push({ resolveStart: resolve, onSuccess, stop: this.stop, clear: this.clear })
            })
        }
    }
    return {
        instances,
        Html5Qrcode,
        readCameraPermission: rstest.fn(() => Promise.resolve("granted")),
        requestCameraAccess: rstest.fn(() => Promise.resolve("granted")),
    }
})

rstest.mock("html5-qrcode", () => ({ Html5Qrcode: mocks.Html5Qrcode }))
rstest.mock("@/shared/lib/camera", () => ({
    readCameraPermission: mocks.readCameraPermission,
    requestCameraAccess: mocks.requestCameraAccess,
    watchCameraPermission: () => () => {},
    classifyCameraError: () => "denied",
    cameraHelp: () => ["Ouvrez les réglages du site."],
}))

const ID = "3f2b8c1e-9a4d-4e21-b7c5-0d6e8f9a1b2c"

test("fermé avant la fin du démarrage, la caméra est arrêtée dès qu'elle a démarré", async () => {
    mocks.instances.length = 0
    const onScan = rstest.fn()
    const props = { onOpenChange: rstest.fn(), onScan, onManual: () => false }
    const { rerender } = render(<CodeScanner open {...props} />)
    await waitFor(() => expect(mocks.instances).toHaveLength(1))
    const [camera] = mocks.instances

    rerender(<CodeScanner open={false} {...props} />)
    await act(async () => {
        camera.resolveStart()
    })

    await waitFor(() => expect(camera.stop).toHaveBeenCalled())
    // Un code passé devant l'objectif après la fermeture est ignoré.
    camera.onSuccess(`https://a.fr/stock-handpick/codes/${ID}`)
    expect(onScan).not.toHaveBeenCalled()
})

test("un code valide n'est pris en compte qu'une fois", async () => {
    mocks.instances.length = 0
    const onScan = rstest.fn()
    render(<CodeScanner open onOpenChange={rstest.fn()} onScan={onScan} onManual={() => false} />)
    await waitFor(() => expect(mocks.instances).toHaveLength(1))
    const [camera] = mocks.instances
    await act(async () => {
        camera.resolveStart()
    })

    camera.onSuccess(`https://a.fr/stock-handpick/codes/${ID}`)
    camera.onSuccess(`https://a.fr/stock-handpick/codes/${ID}`)
    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledWith(ID)
})

test("sans permission, la caméra attend le clic sur « Autoriser la caméra »", async () => {
    mocks.instances.length = 0
    mocks.readCameraPermission.mockResolvedValueOnce("prompt")
    render(<CodeScanner open onOpenChange={rstest.fn()} onScan={rstest.fn()} onManual={() => false} />)

    const button = await screen.findByRole("button", { name: /autoriser la caméra/i })
    expect(mocks.instances).toHaveLength(0)

    fireEvent.click(button)
    expect(mocks.requestCameraAccess).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mocks.instances).toHaveLength(1))
})

test("une caméra refusée affiche comment la réautoriser, sans démarrer", async () => {
    mocks.instances.length = 0
    mocks.readCameraPermission.mockResolvedValueOnce("denied")
    render(<CodeScanner open onOpenChange={rstest.fn()} onScan={rstest.fn()} onManual={() => false} />)

    expect(await screen.findByText("Caméra bloquée")).toBeInTheDocument()
    expect(screen.getByText("Ouvrez les réglages du site.")).toBeInTheDocument()
    expect(mocks.instances).toHaveLength(0)
})
