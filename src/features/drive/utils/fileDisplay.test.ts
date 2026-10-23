import { expect, test } from "@rstest/core"

import { Folder } from "lucide-react"

import {
    downloadName,
    fileIcon,
    formatBytes,
    formatLabel,
    isPreviewable,
} from "./fileDisplay"
import type { DriveItem } from "../types"

const item = (over: Partial<DriveItem> = {}): DriveItem => ({
    id: "1",
    url: "https://api.test/files/abc123.pdf?token=xyz",
    title: "Rapport annuel",
    owner: "perso",
    owner_id: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    mime: "application/pdf",
    sizeBytes: 2_500_000,
    ...over,
})

test("formatBytes rend une taille lisible et signale l'inconnu", () => {
    expect(formatBytes(512)).toBe("512 o")
    expect(formatBytes(2048)).toBe("2,0 Ko")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 Mo")
    // 0 = taille inconnue pour les entrées antérieures à la migration 005.
    expect(formatBytes(0)).toBeNull()
    expect(formatBytes(undefined)).toBeNull()
})

test("downloadName conserve l'extension réelle du fichier", () => {
    // Le bug corrigé : la galerie renommait tout en .jpg ou .mp4.
    expect(downloadName(item())).toBe("Rapport_annuel.pdf")
    expect(downloadName(item({ title: undefined }))).toBe("fichier_1.pdf")
    // Titre et stockage concordent : rien n'est ajouté.
    expect(
        downloadName(
            item({ title: "archive.zip", url: "https://api.test/f/a.zip" })
        )
    ).toBe("archive.zip")
    // Casse différente : toujours pas de doublon d'extension.
    expect(
        downloadName(
            item({ title: "photo.JPG", url: "https://api.test/f/a.jpg" })
        )
    ).toBe("photo.JPG")
    // URL sans extension : on ne fabrique pas d'extension au hasard.
    expect(downloadName(item({ url: "https://api.test/files/abc123" }))).toBe(
        "Rapport_annuel"
    )
})

// Un renommage ne peut pas travestir la nature du fichier : c'est l'extension
// du fichier stocké — dérivée du contenu sniffé à l'upload — qui l'emporte.
// Sans cette règle, un exécutable partagé s'enregistrait chez le destinataire
// sous un nom de document.
test("downloadName : un titre menteur ne masque pas l'extension réelle", () => {
    expect(
        downloadName(
            item({ title: "facture.pdf", url: "https://api.test/f/a.exe" })
        )
    ).toBe("facture.pdf.exe")

    // Le titre n'est jamais amputé : un point qui n'est pas une extension
    // (numéro de version) doit survivre.
    expect(
        downloadName(
            item({ title: "sauvegarde v1.2", url: "https://api.test/f/a.zip" })
        )
    ).toBe("sauvegarde_v1.2.zip")
})

test("formatLabel donne l'extension, puis le sous-type MIME en secours", () => {
    expect(formatLabel(item())).toBe("PDF")
    expect(
        formatLabel(item({ url: "https://api.test/files/abc", mime: "video/mp4" }))
    ).toBe("MP4")
    expect(
        formatLabel(item({ url: "https://api.test/files/abc", mime: undefined }))
    ).toBeNull()
})

test("un dossier n'a ni badge de format ni aperçu", () => {
    const folder = item({
        isFolder: true,
        type: "folder",
        mime: "inode/directory",
        url: "",
        sizeBytes: 0,
    })
    expect(formatLabel(folder)).toBeNull()
    expect(isPreviewable(folder)).toBe(false)
    expect(fileIcon(folder)).toBe(Folder)
})
