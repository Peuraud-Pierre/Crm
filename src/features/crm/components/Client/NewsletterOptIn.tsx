import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Switch } from "@/shared/ui/atoms/switch"
import { Label } from "@/shared/ui/atoms/label"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import { useClientNewsletterOptIn } from "@/features/crm/hooks/data/useClientNewsletterOptIn"
import type { Client } from "@/features/crm/types/client"
import { cn } from "@/shared/lib/utils"

interface NewsletterOptInProps {
    client: Client | null | undefined
    className?: string
}

/** Case « Abonné à la newsletter » de la fiche client. */
export function NewsletterOptIn({ client, className }: NewsletterOptInProps) {
    const { checked, updatedAt, saving, ready, toggle } =
        useClientNewsletterOptIn(client)
    const hasMail = !!client?.mail?.trim()
    const id = `newsletter-optin-${client?.id ?? "none"}`

    const control = (
        <div className="flex items-center gap-2">
            <Switch
                id={id}
                checked={checked}
                disabled={!hasMail || !ready || saving || !client?.id}
                onCheckedChange={v => void toggle(v)}
            />
            <Label htmlFor={id} className="text-sm font-medium">
                Abonné à la newsletter
            </Label>
        </div>
    )

    return (
        <div
            className={cn(
                "flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2",
                className
            )}
        >
            {hasMail ? (
                control
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>{control}</div>
                    </TooltipTrigger>
                    <TooltipContent>Ajoutez un email pour abonner ce client</TooltipContent>
                </Tooltip>
            )}
            {updatedAt && (
                <span className="text-xs text-muted-foreground">
                    modifié le {format(new Date(updatedAt), "dd/MM/yyyy", { locale: fr })}
                </span>
            )}
        </div>
    )
}
