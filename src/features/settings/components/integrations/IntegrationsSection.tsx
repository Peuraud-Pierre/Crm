import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { PROFILE_PERMISSIONS } from "@/features/profile/constants"
import { CalendarIntegrationsCard } from "./CalendarIntegrationsCard"
import { NewsletterCard } from "./NewsletterCard"

export function IntegrationsSection() {
    const { hasPermission } = useAuth()

    return (
        <div className="space-y-6">
            <CalendarIntegrationsCard />
            {hasPermission(PROFILE_PERMISSIONS.newsletterView) && (
                <NewsletterCard />
            )}
        </div>
    )
}
