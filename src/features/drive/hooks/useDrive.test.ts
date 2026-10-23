import { expect, test } from "@rstest/core"

import { toDriveItem } from "./useDrive"
import type { UploadedFile } from "../utils/ChunkedUploader"

const file: UploadedFile = {
    id: "f1",
    url: "https://api.test/files/abc.pdf?token=x",
    title: "rapport.pdf",
    owner_id: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    type: "file",
    mime: "application/pdf",
    sizeBytes: 1024,
    sizeMB: "0.00",
}

test("un fichier est normalisé avec son url", () => {
    const item = toDriveItem(file)
    expect(item.id).toBe("f1")
    expect(item.url).toBe(file.url)
    expect(item.owner).toBe("perso")
})

// Régression : un dossier n'a pas d'URL — le backend n'émet pas de jeton de
// lien pour lui. Exiger une url faisait échouer toute création de dossier.
test("un dossier est accepté sans url", () => {
    const folder = toDriveItem({
        ...file,
        id: "d1",
        url: "",
        title: "Factures 2026",
        type: "folder",
        mime: "inode/directory",
        sizeBytes: 0,
        isFolder: true,
        parentId: "parent-1",
    })

    expect(folder.id).toBe("d1")
    expect(folder.isFolder).toBe(true)
    expect(folder.url).toBe("")
    expect(folder.parentId).toBe("parent-1")
})

test("une réponse inutilisable est rejetée", () => {
    expect(() => toDriveItem(undefined)).toThrow()
    // Un fichier sans url ne peut être ni affiché ni téléchargé.
    expect(() => toDriveItem({ ...file, url: "" })).toThrow()
    expect(() => toDriveItem({ ...file, id: "" })).toThrow()
})
