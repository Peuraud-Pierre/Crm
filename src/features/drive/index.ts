/**
 * Exports publics de la feature Drive.
 * Stockage de fichiers de tout type, avec upload par chunks au-delà de la
 * limite de payload de Cloudflare.
 */

// Hooks
export { useDrive } from "./hooks/useDrive"

// Utils
export { ChunkedUploader } from "./utils/ChunkedUploader"
export { formatBytes } from "./utils/fileDisplay"

// Types
export type {
    DriveItem,
    DriveItemType,
    PathSegment,
    Contact,
} from "./types"
export { DRIVE_DRAG_TYPE } from "./types"

export type {
    UploadSession,
    ChunkUploadResponse,
    FinalizeResponse,
    UploadedFile,
    UploadProgress,
} from "./utils/ChunkedUploader"
