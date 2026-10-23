import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { PlanSvg } from "./PlanSvg"
import type { Rect } from "@/features/magasins/utils/planGeometry"

// jsdom ne calcule pas la géométrie SVG : 100 px à l'écran = 1 m sur le plan.
const proto = SVGElement.prototype as unknown as Record<string, unknown>
const saved: Record<string, unknown> = {}

beforeEach(() => {
    for (const k of ["getScreenCTM", "createSVGPoint", "setPointerCapture", "releasePointerCapture"]) saved[k] = proto[k]
    proto.getScreenCTM = () => ({ inverse: () => ({}) })
    proto.createSVGPoint = () => ({
        x: 0,
        y: 0,
        matrixTransform(this: { x: number; y: number }) {
            return { x: this.x / 100, y: this.y / 100 }
        },
    })
    proto.setPointerCapture = () => {}
    proto.releasePointerCapture = () => {}
})

afterEach(() => {
    for (const [k, v] of Object.entries(saved)) proto[k] = v
})

/** Plan dont le fond suit `onBackgroundChange`, comme la fiche magasin. */
function Harness({ adjusting, onChange, onSelect }: { adjusting: boolean; onChange: (r: Rect) => void; onSelect?: () => void }) {
    const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 20, h: 10 })
    return (
        <PlanSvg
            bounds={{ width: 30, depth: 20 }}
            items={[]}
            selectedKey={null}
            onSelect={onSelect ?? (() => {})}
            background={{ url: "blob:plan", rect, opacity: 0.5 }}
            adjustingBackground={adjusting}
            onBackgroundChange={(r) => {
                onChange(r)
                setRect(r)
            }}
        />
    )
}

function setup(adjusting = true, onSelect?: () => void) {
    const onChange = rstest.fn()
    const view = render(<Harness adjusting={adjusting} onChange={onChange} onSelect={onSelect} />)
    const svg = screen.getByRole("img", { name: "Plan 2D du magasin" })
    const image = () => view.container.querySelector("image") as Element
    return { svg, image, onChange }
}

test("glisser le plan importé le déplace, enregistré au relâcher", () => {
    const { image, onChange } = setup()
    fireEvent.pointerDown(image(), { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(image(), { clientX: 350, clientY: 150, pointerId: 1 })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(image(), { clientX: 350, clientY: 150, pointerId: 1 })

    expect(onChange).toHaveBeenCalledWith({ x: 2.5, y: 0.5, w: 20, h: 10 })
    expect(image().getAttribute("x")).toBe("2.5")
})

test("la poignée du coin agrandit le plan en gardant ses proportions", () => {
    const { onChange } = setup()
    const handle = screen.getByLabelText("Redimensionner le plan importé")
    fireEvent.pointerDown(handle, { clientX: 2000, clientY: 1000, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 2400, clientY: 1000, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientX: 2400, clientY: 1000, pointerId: 1 })

    expect(onChange).toHaveBeenCalledWith({ x: 0, y: 0, w: 24, h: 12 })
})

test("hors ajustement, le plan importé est inerte", () => {
    const { image, onChange } = setup(false)
    expect(screen.queryByLabelText("Redimensionner le plan importé")).toBeNull()
    expect(image().getAttribute("class")).toContain("pointer-events-none")
    expect(onChange).not.toHaveBeenCalled()
})

test("zoomer réduit la portion affichée ; « Voir tout le plan » revient à la vue entière", () => {
    const { svg } = setup(false)
    const full = svg.getAttribute("viewBox")
    expect(screen.getByText("100 %")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Zoomer"))
    expect(screen.getByText("150 %")).toBeInTheDocument()
    const [, , w] = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number)
    expect(w).toBeCloseTo(31.2 / 1.5)

    fireEvent.click(screen.getByLabelText("Voir tout le plan"))
    expect(svg.getAttribute("viewBox")).toBe(full)
})

test("glisser le fond déplace la vue zoomée ; un clic sans glisser désélectionne", () => {
    const onSelect = rstest.fn()
    const { svg } = setup(false, onSelect)
    fireEvent.click(screen.getByLabelText("Zoomer"))
    const x0 = Number((svg.getAttribute("viewBox") ?? "").split(" ")[0])

    fireEvent.pointerDown(svg, { clientX: 300, clientY: 300, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 299, clientY: 300, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: 299, clientY: 300, pointerId: 1 })
    expect(onSelect).toHaveBeenCalledWith(null)
    expect(Number((svg.getAttribute("viewBox") ?? "").split(" ")[0])).toBe(x0)

    fireEvent.pointerDown(svg, { clientX: 300, clientY: 300, pointerId: 2 })
    fireEvent.pointerMove(svg, { clientX: 298, clientY: 300, pointerId: 2 })
    fireEvent.pointerMove(svg, { clientX: 295, clientY: 300, pointerId: 2 })
    fireEvent.pointerUp(svg, { clientX: 295, clientY: 300, pointerId: 2 })
    // Glissé vers la gauche : la vue part vers la droite.
    expect(Number((svg.getAttribute("viewBox") ?? "").split(" ")[0])).toBeGreaterThan(x0)
    expect(onSelect).toHaveBeenCalledTimes(1)
})

test("zoomer ne grossit pas les traits : contour, grille et bords gardent leur épaisseur à l'écran", () => {
    const view = render(
        <PlanSvg
            bounds={{ width: 30, depth: 20 }}
            items={[]}
            selectedKey={null}
            onSelect={() => {}}
            contour={[[0, 0], [30, 0], [30, 10], [0, 20]]}
        />,
    )
    const contour = view.container.querySelector("polygon") as Element
    const grid = view.container.querySelector("g.stroke-border") as Element
    const at100 = { contour: Number(contour.getAttribute("stroke-width")), grid: Number(grid.getAttribute("stroke-width")) }

    fireEvent.click(screen.getByLabelText("Zoomer"))
    fireEvent.click(screen.getByLabelText("Zoomer"))
    // Zoom ×2,25 : l'épaisseur en mètres est divisée d'autant, celle à l'écran ne bouge pas.
    expect(Number(contour.getAttribute("stroke-width"))).toBeCloseTo(at100.contour / 2.25)
    expect(Number(grid.getAttribute("stroke-width"))).toBeCloseTo(at100.grid / 2.25)
})

test("la barre de zoom est sous le plan, pas par-dessus : aucun angle n'est caché derrière", () => {
    const view = render(<PlanSvg bounds={{ width: 30, depth: 20 }} items={[]} selectedKey={null} onSelect={() => {}} />)
    const controls = screen.getByLabelText("Zoomer").parentElement as HTMLElement
    expect(controls.className).not.toMatch(/\babsolute\b/)
    // Placée après le dessin, hors du SVG.
    const svg = view.container.querySelector("svg") as SVGSVGElement
    expect(svg.contains(controls)).toBe(false)
    expect(svg.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test("un escalier se dessine avec ses marches et une flèche de montée", () => {
    const item = {
        key: "q:esc",
        type: "equipement" as const,
        id: "esc",
        parentKey: null,
        kind: "escalier" as const,
        code: "ESC1",
        label: null,
        path: "ESC1",
        depth: 0,
        color: null,
        colorIndex: 0,
        is_active: true,
        geometry: { pos_x: 2, pos_y: 2, width: 1, height: 2.8, rotation: 0 },
        forme: null,
        groupe: null,
        groupLeader: true, descend: false,
    }
    const view = render(<PlanSvg bounds={{ width: 30, depth: 20 }} items={[item]} selectedKey={null} onSelect={() => {}} />)
    // 2,8 m / 28 cm = 10 marches, soit 9 nez de marche intérieurs.
    expect(view.container.querySelectorAll("g.stroke-foreground > line")).toHaveLength(9)
    expect(view.container.querySelectorAll("g.stroke-foreground > polyline")).toHaveLength(2)
    expect(screen.getByText("ESC1", { selector: "text" })).toBeInTheDocument()
})

test("les actions (Supprimer…) sont sous le plan, à droite, sur la ligne du zoom", () => {
    const view = render(
        <PlanSvg
            bounds={{ width: 30, depth: 20 }}
            items={[]}
            selectedKey={null}
            onSelect={() => {}}
            actions={<button type="button">Supprimer A</button>}
        />,
    )
    const remove = screen.getByRole("button", { name: "Supprimer A" })
    const zoom = screen.getByLabelText("Zoomer").parentElement as HTMLElement
    const row = remove.parentElement as HTMLElement
    // Même ligne que la barre de zoom, alignée à droite, hors du dessin.
    expect(row.contains(zoom)).toBe(true)
    expect(row.className).toContain("justify-end")
    expect((view.container.querySelector("svg") as SVGSVGElement).contains(remove)).toBe(false)
})

const caisse = {
    key: "q:c1",
    type: "equipement" as const,
    id: "c1",
    parentKey: null,
    kind: "caisse" as const,
    code: "C1",
    label: null,
    path: "C1",
    depth: 0,
    color: null,
    colorIndex: 0,
    is_active: true,
    geometry: { pos_x: 4, pos_y: 4, width: 2, height: 1, rotation: 0 },
    forme: null,
    groupe: null,
    groupLeader: true, descend: false,
}

test("un objet sélectionné en édition a huit poignées ; le côté gauche s'étire sans bouger le droit", () => {
    const onRectChange = rstest.fn()
    render(
        <PlanSvg
            bounds={{ width: 30, depth: 20 }}
            items={[caisse]}
            selectedKey="q:c1"
            onSelect={() => {}}
            editing
            onRectChange={onRectChange}
        />,
    )
    expect(screen.getAllByLabelText(/^Redimensionner C1 — /)).toHaveLength(8)
    const gauche = screen.getByLabelText("Redimensionner C1 — côté gauche")
    const svg = screen.getByRole("img", { name: "Plan 2D du magasin" })
    fireEvent.pointerDown(gauche, { clientX: 400, clientY: 450, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 450, pointerId: 1 })
    expect(onRectChange).toHaveBeenLastCalledWith(caisse, { x: 3, y: 4, w: 3, h: 1 })
})

test("pendant l'édition des angles, les poignées de redimensionnement s'effacent", () => {
    render(
        <PlanSvg
            bounds={{ width: 30, depth: 20 }}
            items={[caisse]}
            selectedKey="q:c1"
            onSelect={() => {}}
            editing
            handlesHiddenKey="q:c1"
        />,
    )
    expect(screen.queryAllByLabelText(/^Redimensionner C1/)).toHaveLength(0)
})

test("la poignée ronde tourne l'objet à n'importe quel angle ; Maj donne des pas de 15°", () => {
    const onRotationChange = rstest.fn()
    render(
        <PlanSvg
            bounds={{ width: 30, depth: 20 }}
            items={[caisse]}
            selectedKey="q:c1"
            onSelect={() => {}}
            editing
            onRectChange={() => {}}
            onRotationChange={onRotationChange}
        />,
    )
    const svg = screen.getByRole("img", { name: "Plan 2D du magasin" })
    fireEvent.pointerDown(screen.getByLabelText("Tourner C1"), { clientX: 500, clientY: 300, pointerId: 1 })
    // Centre de la caisse : (5 ; 4,5). Pointeur en biais, en bas à droite.
    fireEvent.pointerMove(svg, { clientX: 700, clientY: 600, pointerId: 1 })
    // atan2(1,5 ; 2) = 36,9° ; + 90° = 126,9° → 127° au degré près.
    expect(onRotationChange).toHaveBeenLastCalledWith(caisse, 127)
    // Avec Maj : le multiple de 15° le plus proche, 120°.
    fireEvent.pointerMove(svg, { clientX: 700, clientY: 600, pointerId: 1, shiftKey: true })
    expect(onRotationChange).toHaveBeenLastCalledWith(caisse, 120)
})
