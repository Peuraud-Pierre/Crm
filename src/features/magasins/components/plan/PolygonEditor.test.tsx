import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import type { Point } from "@/features/magasins/types/magasin.types"
import { rectContour } from "@/features/magasins/utils/contour"
import { PolygonEditor } from "./PolygonEditor"

// 100 px à l'écran = 1 m sur le plan ; jsdom n'a pas la capture du pointeur.
const context = { toPlan: (e: { clientX: number; clientY: number }) => ({ x: e.clientX / 100, y: e.clientY / 100 }), zoom: 1 }
const proto = Element.prototype as unknown as Record<string, unknown>
proto.setPointerCapture ??= () => {}
proto.releasePointerCapture ??= () => {}

const bounds = { width: 10, depth: 8 }

function setup(points: Point[] = rectContour(bounds)) {
    const onChange = rstest.fn()
    render(
        <svg>
            <PolygonEditor context={context} bounds={bounds} points={points} onChange={onChange} />
        </svg>,
    )
    return onChange
}

test("glisser un angle le déplace au pas de 10 cm", () => {
    const onChange = setup()
    const corner = screen.getByLabelText("Sommet 3")
    fireEvent.pointerDown(corner, { clientX: 1000, clientY: 800, pointerId: 1 })
    fireEvent.pointerMove(corner, { clientX: 512, clientY: 796, pointerId: 1 })
    fireEvent.pointerUp(corner, { clientX: 512, clientY: 796, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith([[0, 0], [10, 0], [5.1, 8], [0, 8]])
})

test("tirer le milieu d'un mur ajoute un angle", () => {
    const onChange = setup()
    const mid = screen.getByLabelText("Ajouter un sommet sur le côté 2")
    fireEvent.pointerDown(mid, { clientX: 1000, clientY: 400, pointerId: 1 })
    fireEvent.pointerMove(mid, { clientX: 700, clientY: 400, pointerId: 1 })
    fireEvent.pointerUp(mid, { clientX: 700, clientY: 400, pointerId: 1 })
    expect(onChange).toHaveBeenCalledWith([[0, 0], [10, 0], [7, 4], [10, 8], [0, 8]])
})

test("double-cliquer un angle le retire, jamais sous trois", () => {
    const onChange = setup()
    fireEvent.doubleClick(screen.getByLabelText("Sommet 2"))
    expect(onChange).toHaveBeenCalledWith([[0, 0], [10, 8], [0, 8]])

    const triangle = setup([[0, 0], [10, 0], [0, 8]])
    fireEvent.doubleClick(screen.getAllByLabelText("Sommet 1")[1])
    expect(triangle).not.toHaveBeenCalled()
})

test("mur (ligne ouverte) : pas de côté entre le dernier point et le premier, deux points au minimum", () => {
    const onChange = rstest.fn()
    render(
        <svg>
            <PolygonEditor context={context} bounds={bounds} points={[[0, 0], [5, 0], [5, 4]]} onChange={onChange} closed={false} />
        </svg>,
    )
    expect(screen.getAllByLabelText(/Ajouter un sommet/)).toHaveLength(2)
    expect(screen.queryByLabelText("Ajouter un sommet sur le côté 3")).toBeNull()

    const firsts = screen.getAllByLabelText("Sommet 1")
    fireEvent.doubleClick(firsts[firsts.length - 1])
    expect(onChange).toHaveBeenCalledWith([[5, 0], [5, 4]])
})

test("Maj en glissant un angle : le côté depuis l'angle précédent prend un angle multiple de 15°", () => {
    const onChange = rstest.fn()
    render(
        <svg>
            <PolygonEditor context={context} bounds={{ width: 20, depth: 20 }} points={[[0, 0], [10, 0], [10, 8], [0, 8]]} onChange={onChange} />
        </svg>,
    )
    const corners = screen.getAllByLabelText("Sommet 3")
    const corner = corners[corners.length - 1]
    fireEvent.pointerDown(corner, { clientX: 1000, clientY: 800, pointerId: 1 })
    fireEvent.pointerMove(corner, { clientX: 500, clientY: 310, pointerId: 1, shiftKey: true })
    // Cote affichée pendant le glisser.
    expect(screen.getByText(/m · 150°$/)).toBeInTheDocument()
    fireEvent.pointerUp(corner, { clientX: 500, clientY: 310, pointerId: 1 })
    const [, , moved] = onChange.mock.calls[0][0] as [number, number][]
    // Depuis (10 ; 0), à 150° : une diagonale nette.
    expect(Math.round((Math.atan2(moved[1] - 0, moved[0] - 10) * 180) / Math.PI)).toBe(150)
})
