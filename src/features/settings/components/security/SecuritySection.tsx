import { KeyRound } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import MfaSection from "@/features/mfa/routes/MfaSection"
import type { AppUser } from "@/features/auth/hooks/useAuth/types"
import { useProfileDetails } from "@/features/profile/hooks/data/useProfileDetails"
import { PasswordForm } from "./PasswordForm"
import { PrivacyConsentCard } from "./PrivacyConsentCard"

interface SecurityTabProps {
    user: NonNullable<AppUser>
}

export function SecuritySection({ user }: SecurityTabProps) {
    const { details, loading } = useProfileDetails()

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5" />
                        Mot de passe
                    </CardTitle>
                    <CardDescription>
                        Connecté en tant que {user.email}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PasswordForm />
                </CardContent>
            </Card>

            <MfaSection />

            <PrivacyConsentCard
                acceptedAt={details.privacy_accepted_at}
                acceptedVersion={details.privacy_accepted_version}
                loading={loading}
            />
        </div>
    )
}
