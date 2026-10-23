import { beforeEach, expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"

// Le vrai service est chargé (pour `ScanDocError`), sans Supabase ni env :
// l'envoi est injecté dans le hook.
rstest.mock("@/integrations/supabase/client", () => ({ supabase: {} }))
rstest.mock("@/shared/lib/env", () => ({ env: {} }))

import { ScanDocError } from "@/features/stock/services/scanDocService"
import { useScanDoc } from "./useScanDoc"

const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" })
const jpg = (name: string) => new File(["jpg"], name, { type: "image/jpeg" })

function setup() {
    const compress = rstest.fn(async (f: File) => new File(["small"], f.name, { type: "image/jpeg" }))
    const scan = rstest.fn(async () => ({ blob: new Blob(["x"]), filename: "Stock_KS.xlsx" }))
    const download = rstest.fn()
    const hook = renderHook(() => useScanDoc({ compress, scan, download }))
    return { hook, compress, scan, download }
}

beforeEach(() => {
    URL.createObjectURL = rstest.fn(() => "blob:preview")
    URL.revokeObjectURL = rstest.fn()
})

test("ajoute les fichiers valides et liste les refusés", () => {
    const { hook } = setup()
    act(() => hook.result.current.addFiles([pdf("a.pdf"), new File(["h"], "b.heic"), jpg("c.jpg")]))

    expect(hook.result.current.items.map((i) => i.file.name)).toEqual(["a.pdf", "c.jpg"])
    expect(hook.result.current.items[1].previewUrl).toBe("blob:preview")
    expect(hook.result.current.rejected).toHaveLength(1)
    expect(hook.result.current.rejected[0]).toContain("b.heic")
})

test("move et remove réordonnent la liste", () => {
    const { hook } = setup()
    act(() => hook.result.current.addFiles([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")]))
    const [a, , c] = hook.result.current.items

    act(() => hook.result.current.move(c.id, -1))
    expect(hook.result.current.items.map((i) => i.file.name)).toEqual(["a.pdf", "c.pdf", "b.pdf"])

    act(() => hook.result.current.move(a.id, -1)) // déjà en tête : rien
    act(() => hook.result.current.remove(a.id))
    expect(hook.result.current.items.map((i) => i.file.name)).toEqual(["c.pdf", "b.pdf"])
})

test("submit compresse les photos, envoie dans l'ordre et télécharge", async () => {
    const { hook, compress, scan, download } = setup()
    act(() => hook.result.current.addFiles([pdf("a.pdf"), jpg("b.jpg")]))

    await act(() => hook.result.current.submit())

    expect(compress).toHaveBeenCalledTimes(1)
    const sent = scan.mock.calls[0][0] as File[]
    expect(sent.map((f) => f.name)).toEqual(["a.pdf", "b.jpg"])
    expect(await sent[1].text()).toBe("small")
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "Stock_KS.xlsx")
    expect(hook.result.current.step).toBe("done")
})

test("une erreur du service est affichée et la liste conservée", async () => {
    const { hook, scan } = setup()
    scan.mockRejectedValueOnce(new ScanDocError("PDF illisible : a.pdf"))
    act(() => hook.result.current.addFiles([pdf("a.pdf")]))

    await act(() => hook.result.current.submit())

    expect(hook.result.current.step).toBe("error")
    expect(hook.result.current.error).toBe("PDF illisible : a.pdf")
    expect(hook.result.current.items).toHaveLength(1)
})

test("une photo indécodable arrête avant l'envoi", async () => {
    const { hook, compress, scan } = setup()
    compress.mockRejectedValueOnce(new Error("decode"))
    act(() => hook.result.current.addFiles([jpg("floue.jpg")]))

    await act(() => hook.result.current.submit())

    expect(scan).not.toHaveBeenCalled()
    expect(hook.result.current.error).toContain("floue.jpg")
})
