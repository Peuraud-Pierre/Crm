import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import { SketchLayer } from "./SketchLayer"

// 100 px à l'écran = 1 m sur le plan.
const context = { toPlan: (e: { clientX: number; clientY: number }) => ({ x: e.clientX / 100, y: e.clientY / 100 }), zoom: 1 }
const bounds = { width: 10, depth: 8 }

function setup() {
    const onFinish = rstest.fn()
    render(
        <svg>
            <SketchLayer context={context} bounds={bounds} onFinish={onFinish} />
        </svg>,
    )
    const surface = screen.getByTestId("sketch-surface")
    const click = (x: number, y: number) => fireEvent.pointerDown(surface, { clientX: x, clientY: y })
    return { onFinish, surface, click }
}

test("cliquer le premier point ferme la forme, au pas de 10 cm", () => {
    const { onFinish, click } = setup()
    click(100, 100)
    click(404, 100)
    click(400, 297)
    click(102, 102) // près du premier point
    expect(onFinish).toHaveBeenCalledWith([[1, 1], [4, 1], [4, 3]])
})

test("double-clic ou Entrée termine ; moins de trois points ne crée rien", () => {
    const { onFinish, surface, click } = setup()
    click(100, 100)
    click(300, 100)
    fireEvent.doubleClick(surface)
    expect(onFinish).not.toHaveBeenCalled()

    click(100, 100)
    click(300, 100)
    click(300, 300)
    fireEvent.keyDown(window, { key: "Enter" })
    expect(onFinish).toHaveBeenCalledWith([[1, 1], [3, 1], [3, 3]])
})

test("Retour arrière retire le dernier point, mais pas dans un champ de saisie", () => {
    const { onFinish, click } = setup()
    click(100, 100)
    click(300, 100)
    click(900, 900)
    fireEvent.keyDown(window, { key: "Backspace" })
    const input = document.createElement("input")
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: "Backspace" })
    click(300, 300)
    fireEvent.keyDown(window, { key: "Enter" })
    expect(onFinish).toHaveBeenCalledWith([[1, 1], [3, 1], [3, 3]])
})

function setupWall() {
    const onFinish = rstest.fn()
    render(
        <svg>
            <SketchLayer context={context} bounds={bounds} onFinish={onFinish} closed={false} />
        </svg>,
    )
    const surfaces = screen.getAllByTestId("sketch-surface")
    const surface = surfaces[surfaces.length - 1]
    const click = (x: number, y: number, shiftKey = false) => fireEvent.pointerDown(surface, { clientX: x, clientY: y, shiftKey })
    return { onFinish, surface, click }
}

test("mur : deux points suffisent, Maj l'aligne à l'horizontale", () => {
    const { onFinish, click } = setupWall()
    click(100, 100)
    click(600, 130, true) // presque horizontal, redressé par Maj
    fireEvent.keyDown(window, { key: "Enter" })
    expect(onFinish).toHaveBeenCalledWith([[1, 1], [6, 1]])
})

test("mur : cliquer le premier point referme le mur en répétant ce point", () => {
    const { onFinish, click } = setupWall()
    click(100, 100)
    click(500, 100)
    click(500, 400)
    click(101, 101)
    expect(onFinish).toHaveBeenCalledWith([[1, 1], [5, 1], [5, 4], [1, 1]])
})

test("pendant le tracé, la cote du segment en cours s'affiche près du curseur", () => {
    const { click, surface } = setupWall()
    click(100, 100)
    fireEvent.pointerMove(surface, { clientX: 400, clientY: 500 })
    expect(screen.getByText("5 m · 53°")).toBeInTheDocument()
})

test("mur droit : le second clic termine le mur, sans Entrée", () => {
    const onFinish = rstest.fn()
    render(
        <svg>
            <SketchLayer context={context} bounds={bounds} onFinish={onFinish} closed={false} maxPoints={2} />
        </svg>,
    )
    const surfaces = screen.getAllByTestId("sketch-surface")
    const surface = surfaces[surfaces.length - 1]
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 100 })
    expect(onFinish).not.toHaveBeenCalled()
    fireEvent.pointerDown(surface, { clientX: 500, clientY: 300 })
    expect(onFinish).toHaveBeenCalledWith([[1, 1], [5, 3]])
})
