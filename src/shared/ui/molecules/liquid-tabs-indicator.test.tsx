import { afterEach, beforeEach, expect, test } from "@rstest/core"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"

/**
 * jsdom ne fait pas de layout : `offsetLeft` et `offsetWidth` valent 0 pour
 * tout le monde. Sans ce stub, la pastille mesure {0,0}, ne rend rien, et le
 * test passerait en n'assertant rien du tout.
 */
const originals = {
    left: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetLeft"),
    width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
}

function fakeLayout() {
    Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
        configurable: true,
        get(this: HTMLElement) {
            return Number(this.dataset.testLeft ?? 0)
        },
    })
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        get(this: HTMLElement) {
            return Number(this.dataset.testWidth ?? 0)
        },
    })
}

beforeEach(fakeLayout)

afterEach(() => {
    if (originals.left) {
        Object.defineProperty(HTMLElement.prototype, "offsetLeft", originals.left)
    }
    if (originals.width) {
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", originals.width)
    }
})

function Fixture() {
    return (
        <Tabs defaultValue="a">
            <TabsList indicator>
                <TabsTrigger value="a" data-test-left="0" data-test-width="100">
                    Onglet A
                </TabsTrigger>
                <TabsTrigger value="b" data-test-left="100" data-test-width="140">
                    Onglet B
                </TabsTrigger>
            </TabsList>
            <TabsContent value="a">A</TabsContent>
            <TabsContent value="b">B</TabsContent>
        </Tabs>
    )
}

function indicator(container: HTMLElement) {
    return container.querySelector<HTMLElement>('[aria-hidden="true"]')
}

test("se cale sur l'onglet actif dès le premier rendu", () => {
    const { container } = render(<Fixture />)
    const pastille = indicator(container)
    expect(pastille).toBeTruthy()
    expect(pastille?.style.width).toBe("100px")
    expect(pastille?.style.transform).toBe("translateX(0px)")
})

test("glisse vers le nouvel onglet actif", async () => {
    const user = userEvent.setup()
    const { container } = render(<Fixture />)

    await user.click(screen.getByRole("tab", { name: "Onglet B" }))

    // La remesure passe par un MutationObserver + requestAnimationFrame.
    await waitFor(() => {
        expect(indicator(container)?.style.transform).toBe("translateX(100px)")
    })
    expect(indicator(container)?.style.width).toBe("140px")
})

test("ne mesure plus après démontage", async () => {
    const { container, unmount } = render(<Fixture />)
    const list = container.querySelector('[role="tablist"]')!
    const triggerB = screen.getByRole("tab", { name: "Onglet B" })

    unmount()

    // Une mutation postérieure au démontage ne doit déclencher aucune mesure :
    // la frame planifiée est annulée en même temps que l'observer.
    await act(async () => {
        triggerB.setAttribute("data-state", "active")
        list.appendChild(triggerB)
        await new Promise((r) => setTimeout(r, 50))
    })

    expect(indicator(container as HTMLElement)).toBeNull()
})
