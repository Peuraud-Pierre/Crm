import { Button } from "@/shared/ui/atoms/button"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/ui/atoms/collapsible"
import type { MenuItem } from "@/shared/components/layout/menuItems"
import { cn } from "@/shared/lib/utils"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

interface CollapsibleSectionProps {
    title: string
    icon: React.ElementType
    items: MenuItem[]
    activeItem: string
    onItemClick: (href: string) => void
}

export function CollapsibleSection({
    title,
    icon: Icon,
    items,
    activeItem,
    onItemClick,
}: CollapsibleSectionProps) {
    const isAnyChildActive = items.some((item) => item.href === activeItem)
    // Override utilisateur (null = pas d'override, on suit l'état actif)
    const [userOpen, setUserOpen] = useState<boolean | null>(null)
    const open = userOpen ?? isAnyChildActive

    return (
        <Collapsible open={open} onOpenChange={setUserOpen}>
            <Button
                variant="ghost"
                className="w-full justify-between gap-3 h-12 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-muted/50 transition-colors duration-base"
                asChild
            >
                <CollapsibleTrigger>
                    <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="font-medium">{title}</span>
                    </div>
                    {open ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                </CollapsibleTrigger>
            </Button>

            <CollapsibleContent className="ml-4 space-y-1">
                {items.map((item) => {
                    // Actif si chemin exact OU sous-chemin (ex. /projects actif
                    // sur /projects/<id>/kanban). La frontière "/" évite que
                    // /content matche /contentlist. Même règle que Sidebar.tsx.
                    const isActive =
                        activeItem === item.href ||
                        activeItem.startsWith(item.href + "/")
                    const ItemIcon = item.icon
                    return (
                        <Button
                            key={item.href}
                            variant="ghost"
                            className={cn(
                                "w-full justify-start gap-3 h-10 text-sidebar-accent-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-muted/50 transition-colors duration-base",
                                isActive && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90 hover:text-sidebar-accent-foreground shadow-sm"
                            )}
                            onClick={() => onItemClick(item.href)}
                        >
                            <ItemIcon className="w-4 h-4 shrink-0" />
                            <span className="font-medium text-sm">{item.displayName}</span>
                        </Button>
                    )
                })}
            </CollapsibleContent>
        </Collapsible>
    )
}
