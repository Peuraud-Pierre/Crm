import {
    File,
    Folder,
    FileArchive,
    FileAudio,
    FileCode,
    FileSpreadsheet,
    FileText,
    FileVideo,
    Image as ImageIcon,
    type LucideIcon,
} from "lucide-react"

import type { DriveItem } from "@/features/drive/types"

/**
 * MIME exacts qui méritent une icône dédiée. Tout le reste retombe sur la
 * famille du type (`image/`, `video/`…), puis sur une icône générique : un
 * type inconnu doit toujours produire une icône, jamais un blanc.
 */
const ICON_BY_MIME: Record<string, LucideIcon> = {
    "application/pdf": FileText,
    "application/zip": FileArchive,
    "application/x-7z-compressed": FileArchive,
    "application/x-tar": FileArchive,
    "application/gzip": FileArchive,
    "application/vnd.ms-excel": FileSpreadsheet,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        FileSpreadsheet,
    "text/csv": FileSpreadsheet,
    "application/msword": FileText,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        FileText,
    "text/plain": FileText,
    "application/json": FileCode,
    "text/html": FileCode,
    "application/xml": FileCode,
}

export function fileIcon(item: DriveItem): LucideIcon {
    if (item.isFolder || item.type === "folder") return Folder

    const mime = item.mime?.toLowerCase()
    if (mime && ICON_BY_MIME[mime]) return ICON_BY_MIME[mime]

    if (mime?.startsWith("image/")) return ImageIcon
    if (mime?.startsWith("video/")) return FileVideo
    if (mime?.startsWith("audio/")) return FileAudio

    // Entrées antérieures à la migration 005 : pas de MIME, seul le type
    // déduit par l'API est disponible.
    switch (item.type) {
        case "image":
            return ImageIcon
        case "video":
            return FileVideo
        case "audio":
            return FileAudio
        default:
            return File
    }
}

/** true si le fichier peut être rendu directement dans une vignette. */
export function isPreviewable(item: DriveItem): boolean {
    if (item.isFolder) return false

    const mime = item.mime?.toLowerCase()
    if (mime) return mime.startsWith("image/") || mime.startsWith("video/")
    return item.type === "image" || item.type === "video"
}

const UNITS = ["o", "Ko", "Mo", "Go", "To"]

/** Taille lisible. Renvoie null quand elle est inconnue (0 ou absente). */
export function formatBytes(bytes: number | undefined): string | null {
    if (!bytes || bytes <= 0) return null

    let value = bytes
    let unit = 0
    while (value >= 1024 && unit < UNITS.length - 1) {
        value /= 1024
        unit++
    }
    // Pas de décimale pour les octets : « 512,0 o » n'a pas de sens.
    const digits = unit === 0 ? 0 : 1
    return `${value.toFixed(digits).replace(".", ",")} ${UNITS[unit]}`
}

/**
 * Étiquette courte du format, pour le badge de la vignette : l'extension du
 * fichier stocké, à défaut le sous-type MIME.
 */
export function formatLabel(item: DriveItem): string | null {
    if (item.isFolder) return null

    const ext = item.url.split("?")[0].match(/\.([a-z0-9]{1,10})$/i)?.[1]
    if (ext) return ext.toUpperCase()

    const subtype = item.mime?.split("/")[1]
    return subtype ? subtype.toUpperCase() : null
}

/**
 * Nom sous lequel le fichier est enregistré sur le disque.
 *
 * C'est l'extension du fichier STOCKÉ qui fait foi, jamais celle du titre. Le
 * serveur fige la première à l'upload (SafeExtension) et ne la rouvre jamais,
 * alors que le titre reste librement renommable : s'y fier laisserait un
 * exécutable s'enregistrer sous un nom de document, ce qui compte surtout pour
 * le destinataire d'un partage, qui n'a pas envoyé le fichier lui-même.
 *
 * Le titre n'est donc jamais amputé — on lui ajoute l'extension réelle quand
 * elle manque ou qu'elle diffère. « facture.pdf » stocké en .exe devient
 * « facture.pdf.exe » : rien n'est perdu, et c'est le dernier suffixe, celui
 * que le système d'exploitation retient, qui dit la vérité.
 *
 * Deviner l'extension d'après le type — ce que faisait la galerie — renommait
 * un PDF en .jpg dès que le Drive a cessé d'être limité aux médias.
 */
export function downloadName(item: DriveItem): string {
    const base = (item.title || `fichier_${item.id}`).replace(/\s+/g, "_")
    const storedExt =
        item.url.split("?")[0].match(/\.[a-z0-9]{1,10}$/i)?.[0] ?? ""

    // URL sans extension : on ne fabrique rien au hasard.
    if (!storedExt) return base
    if (base.toLowerCase().endsWith(storedExt.toLowerCase())) return base
    return `${base}${storedExt}`
}
