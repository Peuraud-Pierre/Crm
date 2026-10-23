import React, { useState, useRef, useEffect } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/atoms/tooltip"
import { type LucideIcon, Info } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"

interface InfoTooltipProps {
    content: React.ReactNode
    icon?: LucideIcon
    size?: number
    side?: "top" | "right" | "bottom" | "left"
    className?: string
}

/**
 * Pastille d'aide contextuelle à côté d'un libellé de champ.
 *
 * Vit dans le design system depuis la convergence UI des stocks : il n'a
 * jamais connu d'entité métier, mais résidait sous `features/stock`, d'où
 * aucune autre feature ne pouvait l'importer.
 *
 * Gère explicitement le tactile : sur un écran sans survol, un Tooltip Radix
 * s'ouvrirait au focus et ne se refermerait jamais. On bascule donc en
 * ouverture contrôlée au tap, avec fermeture au tap extérieur.
 */
export function InfoTooltip({
    content,
    icon: Icon = Info,
    size = 14,
    side = "top",
    className,
}: InfoTooltipProps) {
    const [open, setOpen] = useState(false)
    const isTouchRef = useRef(false)
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Fermer au tap extérieur sur mobile
    useEffect(() => {
        if (!open || !isTouchRef.current) return

        const handleOutsideTouch = (e: TouchEvent) => {
            if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener("touchstart", handleOutsideTouch)
        return () => document.removeEventListener("touchstart", handleOutsideTouch)
    }, [open])

    return (
        <Tooltip
            open={open}
            onOpenChange={(v) => {
                if (!isTouchRef.current) setOpen(v)
            }}
        >
            <TooltipTrigger asChild>
                <Button
                    ref={buttonRef}
                    type="button"
                    tabIndex={-1}
                    onPointerDown={(e) => {
                        isTouchRef.current = e.pointerType === "touch"
                    }}
                    onClick={() => {
                        if (isTouchRef.current) {
                            setOpen((prev) => !prev)
                        }
                    }}
                    className={cn(
                        "flex items-center justify-center p-0 m-0 border-none bg-transparent hover:bg-transparent h-fit w-fit leading-none outline-none focus:ring-0 transition-opacity hover:opacity-70",
                        className
                    )}
                >
                    <Icon
                        size={size}
                        style={{ width: size, height: size }}
                        className="text-muted-foreground cursor-help"
                    />
                </Button>
            </TooltipTrigger>
            <TooltipContent side={side} className="max-w-xs p-3">
                {content}
            </TooltipContent>
        </Tooltip>
    )
}
