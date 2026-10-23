import { beforeEach, expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"

const mocks = rstest.hoisted(() => ({
    useCameraPermission: rstest.fn(),
    request: rstest.fn(),
}))

rstest.mock("@/shared/hooks/useCameraPermission", () => ({
    useCameraPermission: mocks.useCameraPermission,
}))
rstest.mock("@/shared/lib/camera", () => ({
    cameraHelp: () => ["Ouvrez les réglages du site."],
}))
rstest.mock("@/shared/ui/organisms/code-scanner", () => ({
    CodeScanner: ({ open }: { open: boolean }) => (open ? <div data-testid="scanner" /> : null),
}))

import { CameraCard } from "./CameraCard"

function cameraState(state: string) {
    mocks.useCameraPermission.mockReturnValue({ state, requesting: false, request: mocks.request })
}

beforeEach(() => {
    rstest.clearAllMocks()
})

test("pas encore autorisée : le bouton lance la demande", () => {
    cameraState("prompt")
    render(<CameraCard />)
    fireEvent.click(screen.getByRole("button", { name: "Autoriser la caméra" }))
    expect(mocks.request).toHaveBeenCalledTimes(1)
})

test("bloquée : les étapes pour la réautoriser sont affichées", () => {
    cameraState("denied")
    render(<CameraCard />)
    expect(screen.getByText("Bloquée dans les réglages du navigateur.")).toBeInTheDocument()
    expect(screen.getByText("Ouvrez les réglages du site.")).toBeInTheDocument()
})

test("autorisée : la caméra peut être testée", () => {
    cameraState("granted")
    render(<CameraCard />)
    fireEvent.click(screen.getByRole("button", { name: "Tester la caméra" }))
    expect(screen.getByTestId("scanner")).toBeInTheDocument()
})

test("hors HTTPS : aucune action proposée", () => {
    cameraState("insecure")
    render(<CameraCard />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
})
