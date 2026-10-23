// Les couleurs de type de fichier forment une série catégorielle : elles
// passent par les tokens `--chart-*` prévus pour ça (DESIGN_SYSTEM.md §12.4)
// plutôt que par la palette Tailwind, qui ne suit pas le thème.
import type { FileIconMap } from "../../utils/messageFiles"
import { FileIcon } from "./FileIcon"

export const fileIconMap: FileIconMap = {
    file: (className) => (
        <FileIcon
            className={className ?? "h-4 w-4 text-muted-foreground md:h-5 md:w-5"}
        >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
        </FileIcon>
    ),
    image: (className) => (
        <FileIcon
            className={className ?? "h-4 w-4 text-chart-1 md:h-5 md:w-5"}
        >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="8" cy="10" r="1.5" />
            <path d="M21 17l-5-5-4 4-2-2-5 5" />
        </FileIcon>
    ),
    pdf: (className) => (
        <FileIcon
            className={className ?? "h-4 w-4 text-chart-4 md:h-5 md:w-5"}
        >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
            <path d="M8 13h8" />
            <path d="M8 17h5" />
        </FileIcon>
    ),
    audio: (className) => (
        <FileIcon
            className={className ?? "h-4 w-4 text-chart-3 md:h-5 md:w-5"}
        >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="2" />
            <circle cx="18" cy="16" r="2" />
        </FileIcon>
    ),
    video: (className) => (
        <FileIcon
            className={className ?? "h-4 w-4 text-chart-2 md:h-5 md:w-5"}
        >
            <rect x="3" y="6" width="14" height="12" rx="2" />
            <path d="M17 10l4 2-4 2z" />
        </FileIcon>
    ),
    archive: (className) => (
        <FileIcon
            className={className ?? "h-4 w-4 text-muted-foreground md:h-5 md:w-5"}
        >
            <rect x="3" y="3" width="18" height="6" rx="1" />
            <path d="M5 9v11h14V9" />
            <path d="M10 13h4" />
        </FileIcon>
    ),
    doc: (className) => (
        <FileIcon className={className ?? "h-4 w-4 text-chart-5 md:h-5 md:w-5"}>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
            <path d="M8 13h8" />
            <path d="M8 17h8" />
        </FileIcon>
    ),
    sheet: (className) => (
        <FileIcon
            className={className ?? "h-4 w-4 text-chart-1 md:h-5 md:w-5"}
        >
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <path d="M8 5v14" />
            <path d="M12 5v14" />
            <path d="M4 9h16" />
            <path d="M4 13h16" />
        </FileIcon>
    ),
    slides: (className) => (
        <FileIcon
            className={className ?? "h-4 w-4 text-chart-3 md:h-5 md:w-5"}
        >
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8" />
            <path d="M12 16v4" />
        </FileIcon>
    ),
}
