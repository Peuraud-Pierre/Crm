import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => ({
    getSession: rstest.fn(),
    fetchMock: rstest.fn(),
    env: { PUBLIC_SCAN_DOC_URL: "https://scan.test/" as string | undefined },
}))

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { auth: { getSession: mocks.getSession } },
}))

rstest.mock("@/shared/lib/env", () => ({
    get env() {
        return mocks.env
    },
}))

import { filenameFromDisposition, scanDocuments, ScanDocError } from "./scanDocService"

function jsonResponse(status: number, body: unknown) {
    return { ok: false, status, json: async () => body, headers: new Headers() }
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.env.PUBLIC_SCAN_DOC_URL = "https://scan.test/"
    globalThis.fetch = mocks.fetchMock as unknown as typeof fetch
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "tok-1" } } })
})

test("envoie chaque fichier dans un champ file, dans l'ordre, avec le jeton", async () => {
    const xlsx = new Blob(["xlsx"])
    mocks.fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => xlsx,
        headers: new Headers({ "Content-Disposition": 'attachment; filename="Stock_KS.xlsx"' }),
    })
    const a = new File(["a"], "a.pdf", { type: "application/pdf" })
    const b = new File(["b"], "b.jpg", { type: "image/jpeg" })

    const result = await scanDocuments([a, b])

    const [url, init] = mocks.fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://scan.test/scan")
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1")
    const names = (init.body as FormData).getAll("file").map((f) => (f as File).name)
    expect(names).toEqual(["a.pdf", "b.jpg"])
    expect(result).toEqual({ blob: xlsx, filename: "Stock_KS.xlsx" })
})

test("le message { error } du service est montré tel quel", async () => {
    mocks.fetchMock.mockResolvedValue(jsonResponse(400, { error: "image illisible : x.jpg" }))
    await expect(scanDocuments([new File(["x"], "x.jpg")])).rejects.toMatchObject({
        message: "image illisible : x.jpg",
        status: 400,
    })
})

test("401 et réponses sans corps lisible : message de repli", async () => {
    mocks.fetchMock.mockResolvedValue(jsonResponse(401, { error: "token is expired" }))
    await expect(scanDocuments([new File(["x"], "x.pdf")])).rejects.toThrow(/Session expirée/)

    mocks.fetchMock.mockResolvedValue({ ok: false, status: 504, json: async () => { throw new Error() }, headers: new Headers() })
    await expect(scanDocuments([new File(["x"], "x.pdf")])).rejects.toThrow(/trop de temps/)
})

test("sans session, pas d'appel au service", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    await expect(scanDocuments([new File(["x"], "x.pdf")])).rejects.toBeInstanceOf(ScanDocError)
    expect(mocks.fetchMock).not.toHaveBeenCalled()
})

test("service injoignable", async () => {
    mocks.fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(scanDocuments([new File(["x"], "x.pdf")])).rejects.toThrow(/injoignable/)
})

test("service non configuré", async () => {
    mocks.env.PUBLIC_SCAN_DOC_URL = undefined
    await expect(scanDocuments([new File(["x"], "x.pdf")])).rejects.toThrow(/PUBLIC_SCAN_DOC_URL/)
})

test("filenameFromDisposition lit filename* (UTF-8) puis filename", () => {
    expect(filenameFromDisposition("attachment; filename*=utf-8''Stock_%C3%89t%C3%A9.xlsx")).toBe("Stock_Été.xlsx")
    expect(filenameFromDisposition('attachment; filename="Stock_KS.xlsx"')).toBe("Stock_KS.xlsx")
    expect(filenameFromDisposition(null)).toBe("Stock.xlsx")
})
