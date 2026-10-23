import { useState } from "react"
import { Mail } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Separator } from "@/shared/ui/atoms/separator"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { useNewsletterSubscription } from "@/features/profile/hooks/data/useNewsletterSubscription"

export function NewsletterCard() {
    const {
        allowedColumns,
        isSubscribed,
        selected,
        loading,
        saving,
        toggleColumn,
        subscribe,
        unsubscribe,
    } = useNewsletterSubscription()

    const [invitationCode, setInvitationCode] = useState("")

    const handleSubscribe = async () => {
        const ok = await subscribe(invitationCode)
        if (ok) setInvitationCode("")
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Newsletter
                    </CardTitle>
                    {!loading && (
                        <Badge variant={isSubscribed ? "default" : "secondary"}>
                            {isSubscribed ? "Abonné" : "Non abonné"}
                        </Badge>
                    )}
                </div>
                <CardDescription>
                    Recevez automatiquement le tableau des arrivages après
                    chaque modification. Choisissez les colonnes à inclure dans
                    votre Excel.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {loading ? (
                    <Skeleton className="h-32 w-full" />
                ) : allowedColumns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Aucune colonne disponible avec vos permissions
                        actuelles.
                    </p>
                ) : (
                    <>
                        <div className="space-y-2">
                            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Colonnes dans l'Excel
                            </p>
                            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                                {allowedColumns.map((column) => (
                                    <div
                                        key={column.key}
                                        className="flex items-center gap-2"
                                    >
                                        <Checkbox
                                            id={`col-${column.key}`}
                                            checked={selected.has(column.key)}
                                            onCheckedChange={() =>
                                                toggleColumn(column.key)
                                            }
                                            disabled={saving}
                                        />
                                        <Label
                                            htmlFor={`col-${column.key}`}
                                            className="cursor-pointer text-sm font-normal"
                                        >
                                            {column.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* Le code d'invitation ne sert qu'à la création. */}
                        {!isSubscribed && (
                            <div className="space-y-2">
                                <Label htmlFor="invitation-code">
                                    Code d'invitation
                                </Label>
                                <Input
                                    id="invitation-code"
                                    placeholder="ARV-XXXXXXXX"
                                    value={invitationCode}
                                    onChange={(e) =>
                                        setInvitationCode(
                                            e.target.value.toUpperCase()
                                        )
                                    }
                                    className="max-w-xs"
                                    disabled={saving}
                                />
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                onClick={handleSubscribe}
                                disabled={selected.size === 0}
                                loading={saving}
                            >
                                {isSubscribed ? "Mettre à jour" : "S'abonner"}
                            </Button>
                            {isSubscribed && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={unsubscribe}
                                    disabled={saving}
                                >
                                    Se désabonner
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
