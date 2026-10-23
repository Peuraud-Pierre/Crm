import { Calendar } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { AppleConnectionButton } from "@/features/calendar-integrations/apple/components/AppleConnectionButton"

export function CalendarIntegrationsCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Calendrier
                </CardTitle>
                <CardDescription>
                    Connectez votre calendrier pour synchroniser vos événements.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <h3 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Apple iCloud Calendar
                    </h3>
                    <AppleConnectionButton />
                </div>
            </CardContent>
        </Card>
    )
}
