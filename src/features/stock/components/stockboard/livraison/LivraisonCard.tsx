import {
    Truck,
    Calendar,
    Scale,
    ChevronRight,
    Inbox,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { BalleType } from "@/features/stock/types/stock.types"
import { GESTION_THEME } from "@/features/stock/theme"
import { Card, CardHeader, CardContent, CardFooter } from "@/shared/ui/atoms/card"
import { Label } from "@/shared/ui/atoms/label"


interface DeliveryCardProps {
    din: string
    fournisseur?: string
    ballesCount?: number
    packing?: string
    deliveryDate?: string
    deliveryType?: BalleType
    className?: string
    onClick?: () => void
}

export default function DeliveryCard({
    din,
    fournisseur,
    ballesCount,
    packing,
    deliveryDate,
    className,
    onClick,
}: DeliveryCardProps) {
    // Habillage neutre : une livraison n'a pas de statut propre.
    const { card } = GESTION_THEME
    const theme = card.status.stocked

    return (
        <Card
            variant="interactive"
            onClick={onClick}
            className={cn(
                "group relative aspect-square p-0 border overflow-hidden flex flex-col select-none",
                "active:scale-98 motion-reduce:active:scale-100",
                card.surface,
                theme.border,
                className
            )}
        >
            {/* Animation hover */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <Truck
                    size={40}
                    className={cn(
                        "absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 transition-[left,opacity] duration-slower ease-in-out group-hover:left-1/4 group-hover:opacity-10",
                        theme.icon
                    )}
                />
            </div>

            {/* Header — DIN */}
            <CardHeader
                className={cn(
                    "p-2.5 space-y-0 flex flex-row items-center justify-between border-b z-10",
                    theme.footerBorder
                )}
            >
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <Inbox
                        size={12}
                        className={cn("shrink-0 opacity-50", card.text)}
                    />
                    <Label
                        className={cn(
                            "font-mono text-3xs font-bold tracking-tight truncate cursor-pointer",
                            card.text
                        )}
                    >
                        {din}
                    </Label>
                </div>
                <div
                    className={cn(
                        "h-2 w-2 rounded-full shrink-0 shadow-sm",
                        theme.statusDot
                    )}
                />
            </CardHeader>

            {/* Content */}
            <CardContent className="flex-1 flex flex-col items-center justify-center p-2 gap-1 z-10">
                {/* Nombre de balles */}
                <div
                    className={cn(
                        "flex items-baseline gap-0.5 transition-transform group-hover:scale-110 duration-slow",
                        card.text
                    )}
                >
                    <span className="text-3xl font-black tracking-tighter">
                        {ballesCount ?? 0}
                    </span>
                    <span className="text-3xs font-bold uppercase opacity-40">
                        balles
                    </span>
                </div>

                {/* Fournisseur */}
                <Label
                    className={cn(
                        "px-2 py-0.5 rounded-md text-3xs font-bold uppercase tracking-tight text-center line-clamp-1 border",
                        // Habillage neutre : c'est un fournisseur, pas un statut.
                        GESTION_THEME.badges.status.stocked
                    )}
                >
                    {fournisseur ?? "Inconnu"}
                </Label>

                {/* Meta */}
                <div className="flex items-center gap-3 mt-2 opacity-40 grayscale group-hover:grayscale-0 transition-[filter]">
                    <div className="flex items-center gap-1">
                        <Scale size={10} />
                        <span className="text-4xs font-bold uppercase tracking-tighter">
                            {packing != null ? Math.round(Number(packing) * 100) / 100 : "—"} kg
                        </span>
                    </div>
                    {deliveryDate && (
                        <div className="flex items-center gap-1 border-l pl-3 border-slate-300 dark:border-slate-700">
                            <Calendar size={10} />
                            <span className="text-4xs font-bold uppercase tracking-tighter">
                                {new Date(deliveryDate).toLocaleDateString(
                                    "fr-FR",
                                    {
                                        day: "2-digit",
                                        month: "2-digit",
                                    }
                                )}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Footer */}
            <CardFooter
                className={cn(
                    "hidden lg:flex",
                    "p-1.5 mt-auto border-t text-center items-center justify-center gap-1 transition-transform duration-slow",
                    "bg-card/90 dark:bg-slate-900/90 backdrop-blur-sm z-20",
                    "lg:absolute lg:bottom-0 lg:left-0 lg:right-0 translate-y-full group-hover:translate-y-0",
                    theme.footerBorder
                )}
            >
                <Label
                    className={cn(
                        "text-4xs font-black uppercase tracking-[0.2em] cursor-pointer flex items-center gap-1",
                        card.text
                    )}
                >
                    Détails{" "}
                    <ChevronRight
                        size={10}
                        className="group-hover:translate-x-0.5 transition-transform"
                    />
                </Label>
            </CardFooter>
        </Card>
    )
}
