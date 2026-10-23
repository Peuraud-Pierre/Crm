import { expect, test } from "@rstest/core"
import { classifyRdvType } from "./AnalyticsContext"

test("classifyRdvType flags achat only for the physique achat type", () => {
    expect(classifyRdvType("rdv physique achat")).toEqual({
        achat: true,
        decouverte: false,
        visio: false,
    })
})

test("classifyRdvType flags decouverte only for the physique decouverte type", () => {
    expect(classifyRdvType("rdv physique decouverte")).toEqual({
        achat: false,
        decouverte: true,
        visio: false,
    })
})

test("classifyRdvType flags visio (exclusively) for both visio types, regardless of achat/decouverte", () => {
    expect(classifyRdvType("rdv visio achat")).toEqual({
        achat: false,
        decouverte: false,
        visio: true,
    })
    expect(classifyRdvType("rdv decouverte visio")).toEqual({
        achat: false,
        decouverte: false,
        visio: true,
    })
})

test("classifyRdvType returns all-false for unknown or missing type", () => {
    expect(classifyRdvType("appel")).toEqual({
        achat: false,
        decouverte: false,
        visio: false,
    })
    expect(classifyRdvType(null)).toEqual({
        achat: false,
        decouverte: false,
        visio: false,
    })
    expect(classifyRdvType(undefined)).toEqual({
        achat: false,
        decouverte: false,
        visio: false,
    })
})
