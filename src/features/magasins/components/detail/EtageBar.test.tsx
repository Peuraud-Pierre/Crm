import { expect, test } from "@rstest/core"
import { defaultEtageName } from "./EtageBar"

test("defaultEtageName nomme un niveau comme on le dit", () => {
    expect(defaultEtageName(0)).toBe("RDC")
    expect(defaultEtageName(1)).toBe("1er étage")
    expect(defaultEtageName(3)).toBe("3e étage")
    expect(defaultEtageName(-1)).toBe("Sous-sol")
    expect(defaultEtageName(-2)).toBe("Sous-sol 2")
})
