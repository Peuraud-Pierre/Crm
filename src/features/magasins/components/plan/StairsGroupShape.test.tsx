import { expect, test } from "@rstest/core"
import { render } from "@testing-library/react"
import { equipement } from "../../__fixtures__/plan"
import { buildPlanItems } from "@/features/magasins/utils/planTree"
import { PlanItemShape } from "./PlanItemShape"

const flight = (id: string, code: string, x: number) => ({
    ...equipement(id, code, "escalier"),
    pos_x: x,
    pos_y: 1,
    width: 2,
    height: 1,
    groupe: "g",
})
const items = buildPlanItems([], [], [flight("a", "ESC1", 1), flight("b", "ESC2", 3)])

function draw(merged: boolean) {
    const noop = () => {}
    return render(
        <svg>
            {items.map((item) => (
                <PlanItemShape
                    key={item.key}
                    item={item}
                    bounds={{ width: 10, depth: 10 }}
                    selected={false}
                    editing={false}
                    inert={false}
                    zoom={1}
                    onMoveStart={noop}
                    onResizeStart={noop}
                    merged={merged ? items : null}
                />
            ))}
        </svg>,
    )
}

test("des volées fusionnées se dessinent d'un seul tenant, avec un seul code", () => {
    const { container } = draw(true)
    // Un contour commun, masqué par l'intérieur des volées.
    expect(container.querySelectorAll("mask")).toHaveLength(1)
    // Les volées elles-mêmes n'ont plus de trait propre.
    const own = [...container.querySelectorAll("g.cursor-pointer > rect")]
    expect(own.every((r) => r.getAttribute("stroke") === "none")).toBe(true)
    expect([...container.querySelectorAll("text")].map((t) => t.textContent)).toEqual(["ESC1", "▲ monte"])
})

test("sans fusion, chaque volée garde son contour", () => {
    const { container } = draw(false)
    expect(container.querySelectorAll("mask")).toHaveLength(0)
    const own = [...container.querySelectorAll("g.cursor-pointer > rect")]
    expect(own.some((r) => r.getAttribute("stroke") === "none")).toBe(false)
})

test("un escalier qui descend se lit « descend », en pointillés", () => {
    const [down] = buildPlanItems([], [], [{ ...flight("d", "ESC9", 1), groupe: null, descend: true }])
    const { container } = render(
        <svg>
            <PlanItemShape
                item={down}
                bounds={{ width: 10, depth: 10 }}
                selected={false}
                editing={false}
                inert={false}
                zoom={1}
                onMoveStart={() => {}}
                onResizeStart={() => {}}
            />
        </svg>,
    )
    expect(container.textContent).toContain("▼ descend")
    expect(container.querySelector("rect")?.getAttribute("stroke-dasharray")).toBeTruthy()
})

test("un mannequin se dessine vu de dessus : épaules, tête et nez", () => {
    const [mq] = buildPlanItems([], [], [{ ...equipement("m", "MQ1", "mannequin"), pos_x: 1, pos_y: 1, width: 0.5, height: 0.35 }])
    const { container } = render(
        <svg>
            <PlanItemShape
                item={mq}
                bounds={{ width: 10, depth: 10 }}
                selected={false}
                editing={false}
                inert={false}
                zoom={1}
                onMoveStart={() => {}}
                onResizeStart={() => {}}
            />
        </svg>,
    )
    expect(container.querySelector("circle")).not.toBeNull()
    expect(container.querySelector("polygon")).not.toBeNull()
    expect(container.textContent).not.toContain("monte")
})
