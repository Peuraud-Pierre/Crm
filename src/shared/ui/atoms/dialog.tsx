import { cn } from "@/shared/lib/utils"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import * as React from "react"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = ({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Overlay> | null> }) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            // Remplacement ici : opacité réduite + ajout du flou
            // eslint-disable-next-line nokk-project/no-restricted-syntax -- scrim/overlay volontairement noir quel que soit le thème (design system §12.4)
            "fixed inset-0 z-50 bg-black/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
    />
)

function DialogContent({
    className,
    children,
    ref,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Content>>
}) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
                ref={ref}
                className={cn(
                    // translate-x-0/y-0 + [transform:translate(-50%,-50%)] plutôt que
                    // translate-x-[-50%] translate-y-[-50%] : en Tailwind v4 ces derniers
                    // posent la propriété CSS `translate` native (distincte de `transform`),
                    // qui se CUMULE avec le `transform: translate3d(...)` de l'animation
                    // d'entrée (tw-animate-css) au lieu d'être remplacée par elle — la modale
                    // apparaît alors depuis un coin plutôt que du centre, surtout visible sur
                    // les grandes modales (`max-w-[...]`, `w-[Nvw]`).
                    "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-0 translate-y-0 [transform:translate(-50%,-50%)] gap-4 border bg-background p-6 shadow-lg duration-base data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
                    className
                )}
                {...props}
            >
                {children}
                <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Fermer</span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPortal>
    )
}

function DialogContent_2({
    className,
    children,
    ref,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Content>>
}) {
    return (
        <DialogPortal>
            {/* flou léger sur fond */}
            <DialogOverlay className="backdrop-blur-sm" />

            <DialogPrimitive.Content
                ref={ref}
                {...props}
                className={cn(
                    // Base responsive layout
                    "fixed z-50 grid w-full sm:w-[90vw] md:w-[80vw] max-w-4xl gap-4 border bg-background p-6 shadow-lg duration-base",

                    // Mobile = plein écran. Desktop centré via `transform` (pas la propriété
                    // native `translate`) pour la même raison que DialogContent ci-dessus.
                    "inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:translate-x-0 sm:translate-y-0 sm:[transform:translate(-50%,-50%)]",
                    "sm:rounded-lg rounded-none",

                    // Gestion hauteur & scroll
                    "h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto overscroll-contain",

                    // Animations Radix propres
                    "data-[state=open]:animate-in data-[state=closed]:animate-out",
                    "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
                    "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
                    "data-[state=open]:slide-in-from-bottom-10 sm:data-[state=open]:slide-in-from-top-[48%]",
                    "data-[state=closed]:slide-out-to-bottom-10 sm:data-[state=closed]:slide-out-to-top-[48%]",

                    className
                )}
            >
                {children}

                {/* bouton de fermeture */}
                <DialogPrimitive.Close
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background
        transition-opacity hover:opacity-100 focus:outline-none
        focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:pointer-events-none"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Fermer</span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPortal>
    )
}

const DialogHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col space-y-1.5 text-center sm:text-left",
            className
        )}
        {...props}
    />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
            className
        )}
        {...props}
    />
)
DialogFooter.displayName = "DialogFooter"

function DialogTitle({
    className,
    ref,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Title>>
}) {
    return (
        <DialogPrimitive.Title
            ref={ref}
            className={cn(
                "text-lg font-semibold leading-none tracking-tight",
                className
            )}
            {...props}
        />
    )
}

function DialogDescription({
    className,
    ref,
    ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & {
    ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Description>>
}) {
    return (
        <DialogPrimitive.Description
            ref={ref}
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    )
}

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogContent_2,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
}
