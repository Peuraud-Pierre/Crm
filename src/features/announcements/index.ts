// Public API de la feature annonces — seuls ces exports peuvent être
// utilisés hors de announcements/ (docs/Architecture_Feature.pdf §4).

export { ANNOUNCEMENT_PERMISSIONS } from "./constants"

export type {
    Announcement,
    AnnouncementDraft,
    AnnouncementStatus,
    AnnouncementType,
} from "./types/announcement.types"

export { useAnnouncements } from "./hooks/data/useAnnouncements"

/** Zone fixe en tête du dashboard — voir features/dashboard. */
export { AnnouncementBand } from "./components/band/AnnouncementBand"

export { AnnouncementsAdmin } from "./components/admin/AnnouncementsAdmin"

export { getAnnouncementStatus } from "./utils/announcementStatus"
