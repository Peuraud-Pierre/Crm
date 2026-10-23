import { Card, CardContent } from "@/shared/ui/atoms/card"
import { type JournalEntry } from "@/features/journal/hooks/Journal_hook/useJournalEntry"

export function BilanCard({
    bilan,
    onClick,
}: {
    bilan: { key: string; total: number; entries: JournalEntry[] }
    onClick?: () => void
}) {
    return (
        <Card
            onClick={onClick}
            variant="interactive"
            className="rounded-2xl"
        >
            <CardContent className="p-6 space-y-2">
                <p className="text-sm text-muted-foreground">{bilan.key}</p>
                <p className="text-3xl font-bold">
                    {bilan.total.toLocaleString()} €
                </p>
                <p className="text-xs text-muted-foreground">
                    {bilan.entries.length} vente(s)
                </p>
            </CardContent>
        </Card>
    )
}
