import { useUserPreferences } from "@/features/profile/hooks/data/useUserPreferences"
import { AppearanceCard } from "./AppearanceCard"
import { CameraCard } from "./CameraCard"
import { NotificationsCard } from "./NotificationsCard"

export function PreferencesSection() {
    const { preferences, loading, updatePreferences, setThemeChoice } =
        useUserPreferences()

    return (
        <div className="space-y-6">
            <AppearanceCard
                theme={preferences.theme}
                disabled={loading}
                onChange={setThemeChoice}
            />
            <NotificationsCard
                preferences={preferences}
                disabled={loading}
                onChange={updatePreferences}
            />
            <CameraCard />
        </div>
    )
}
