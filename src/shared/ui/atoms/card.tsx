import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/lib/utils"

/**
 * Variantes de surface. `default` reste STRICTEMENT identique à l'existant :
 * la très grande majorité des ~100 `Card` de l'app sont des conteneurs de
 * mise en page (sections de formulaire, wrappers de tableau). Leur donner un
 * hover-lift créerait une affordance mensongère — l'élément aurait l'air
 * cliquable sans l'être — et déclencherait un repaint de sous-arbre large sur
 * les cartes qui enveloppent un tableau.
 *
 * `interactive` est donc opt-in et greppable. Voir DESIGN_SYSTEM.md §13.
 */
const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground shadow-sm",
  {
    variants: {
      variant: {
        default: "",
        /**
         * Carte réellement actionnable (onClick, <Link>, navigation).
         * `motion-reduce:` est nécessaire : la media query globale rend la
         * transition instantanée mais n'annule pas l'état final du translate.
         */
        interactive:
          "cursor-pointer transition-[box-shadow,transform,border-color] duration-base ease-emphasized hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0",
        /** Élévation statique, sans interaction. */
        elevated: "shadow-raised",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Card({ className, variant, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ref, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return (
    <h3
      ref={ref}
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ref, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
}

function CardFooter({ className, ref, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }
