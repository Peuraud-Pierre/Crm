import { Card, CardHeader, CardTitle, CardDescription } from "@/shared/ui/atoms/card"
import { cn } from "@/shared/lib/utils"
import { Ban, Wrench } from "lucide-react"

export function ToolCard({
    title,
    description,
    color = "bg-green-600 hover:bg-green-700",
    onClick,
    disabled = false,
    reason = "Module indisponible pour le moment",
}: {
    title: string
    description: string
    color?: string
    onClick?: () => void
    disabled?: boolean
    reason?: string
}) {
    return (
        <Card
            variant={disabled ? "default" : "interactive"}
            onClick={!disabled ? onClick : undefined}
            className={cn(
                "relative overflow-hidden text-muted-foreground flex flex-col justify-center items-start p-6 h-40 rounded-2xl border border-transparent",
                disabled
                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                    : "active:scale-98 motion-reduce:active:scale-100",
                !disabled && color
            )}
        >
            <CardHeader className="p-0">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    {disabled && <Wrench className="h-4 w-4 text-muted-foreground" />}
                    {title}
                </CardTitle>
                <CardDescription
                    className={cn(
                        "mt-1",
                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                        disabled ? "text-muted-foreground/80" : "text-white/80"
                    )}
                >
                    {description}
                </CardDescription>
            </CardHeader>

            {/* Badge d’état si désactivé */}
            {disabled && (
                <div className="absolute inset-0 flex flex-col justify-center items-center bg-background/80 backdrop-blur-sm text-center p-4 rounded-2xl">
                    <Ban className="h-6 w-6 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{reason}</p>
                </div>
            )}
        </Card>
    )
}