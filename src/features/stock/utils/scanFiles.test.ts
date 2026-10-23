import { expect, test } from "@rstest/core"
import { classifyScanFile } from "./scanFiles"

const file = (name: string, type = "") => new File(["x"], name, { type })

test("classifyScanFile reconnaît PDF et photos, par type ou par extension", () => {
    expect(classifyScanFile(file("fiche.pdf", "application/pdf"))).toEqual({ kind: "pdf" })
    expect(classifyScanFile(file("FICHE.PDF"))).toEqual({ kind: "pdf" })
    expect(classifyScanFile(file("p.jpg", "image/jpeg"))).toEqual({ kind: "image" })
    expect(classifyScanFile(file("p.JPEG"))).toEqual({ kind: "image" })
    expect(classifyScanFile(file("p.png", "image/png"))).toEqual({ kind: "image" })
})

test("classifyScanFile refuse le HEIC avec la marche à suivre", () => {
    const check = classifyScanFile(file("IMG_0001.HEIC", "image/heic"))
    expect(check).toEqual({ error: expect.stringContaining("exportez-les en JPEG") })
})

test("classifyScanFile refuse les autres formats en nommant le fichier", () => {
    expect(classifyScanFile(file("notes.docx"))).toEqual({ error: expect.stringContaining("notes.docx") })
})
