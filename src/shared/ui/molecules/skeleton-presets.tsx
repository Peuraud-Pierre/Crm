import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { staggerStyle } from "@/shared/lib/motion"
import { cn } from "@/shared/lib/utils"

/**
 * Presets de squelettes de chargement.
 *
 * Deux apports par rapport à l'atom `Skeleton` seul :
 * - un stagger court (30ms, plafonné à 200ms) : le squelette se REMPLIT au
 *   lieu d'apparaître d'un bloc, ce qui suggère un chargement en cours plutôt
 *   qu'un écran figé ;
 * - `role="status" aria-busy` sur le conteneur, que l'atom ne porte pas — un
 *   lecteur d'écran annonce le chargement au lieu de lire des div vides.
 *
 * Préférer ces presets aux spinners : un squelette de forme approchante
 * réduit le décalage visuel quand le contenu réel arrive.
 */

interface Common {
    className?: string
    /** Libellé annoncé aux lecteurs d'écran. */
    label?: string
    /**
     * Pose `role="status"` sur le conteneur. À passer à `false` quand ce
     * preset est imbriqué dans un autre : deux régions live imbriquées portant
     * le même libellé font annoncer « Chargement » deux fois. Seul le
     * conteneur le plus externe doit l'annoncer.
     */
    announce?: boolean
}

function Shell({
    children,
    className,
    label = "Chargement…",
    announce = true,
}: Common & { children: React.ReactNode }) {
    if (!announce) return <div className={className}>{children}</div>
    return (
        <div role="status" aria-busy="true" aria-label={label} className={className}>
            {children}
        </div>
    )
}

/**
 * Conteneur annonce, pour les squelettes sur-mesure.
 *
 * Tous les presets ci-dessous portent deja `role="status"`, mais une forme
 * bespoke (avatar + champs, vignette en aspect-square, ligne de tableau
 * specifique) reste souvent preferable a un preset generique : DESIGN_SYSTEM.md
 * §13.8 rappelle qu'un squelette de forme approchante reduit le decalage a
 * l'arrivee du contenu. `SkeletonGroup` permet de garder la forme tout en
 * annoncant le chargement, au lieu de laisser un lecteur d'ecran sur des div
 * vides.
 */
export function SkeletonGroup({
    children,
    className,
    label,
}: Common & { children: React.ReactNode }) {
    return (
        <Shell className={className} label={label}>
            {children}
        </Shell>
    )
}

export function SkeletonText({ lines = 3, className, label, announce }: Common & { lines?: number }) {
    return (
        <Shell className={cn("space-y-2", className)} label={label} announce={announce}>
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton
                    key={i}
                    style={staggerStyle(i, { step: 30, cap: 200 })}
                    className={cn(
                        "h-3 animate-in fade-in fill-mode-backwards duration-slow ease-out",
                        // La dernière ligne est plus courte : un paragraphe ne
                        // se termine jamais pile en bord de colonne.
                        i === lines - 1 ? "w-3/5" : "w-full"
                    )}
                />
            ))}
        </Shell>
    )
}

export function SkeletonCard({
    header = true,
    lines = 3,
    className,
    label,
    announce,
}: Common & { header?: boolean; lines?: number }) {
    return (
        <Shell
            className={cn("rounded-lg border bg-card p-4 shadow-surface", className)}
            label={label}
            announce={announce}
        >
            {header && <Skeleton className="mb-4 h-5 w-1/3" />}
            <SkeletonText lines={lines} label={label} announce={false} />
        </Shell>
    )
}

export function SkeletonList({
    rows = 5,
    avatar = false,
    className,
    label,
    announce,
}: Common & { rows?: number; avatar?: boolean }) {
    return (
        <Shell className={cn("space-y-3", className)} label={label} announce={announce}>
            {Array.from({ length: rows }, (_, i) => (
                <div
                    key={i}
                    style={staggerStyle(i, { step: 30, cap: 200 })}
                    className="flex items-center gap-3 animate-in fade-in fill-mode-backwards duration-slow ease-out"
                >
                    {avatar && <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3 w-2/5" />
                        <Skeleton className="h-2.5 w-3/5" />
                    </div>
                </div>
            ))}
        </Shell>
    )
}

export function SkeletonTable({
    rows = 8,
    columns = 4,
    header = true,
    className,
    label,
    announce,
}: Common & { rows?: number; columns?: number; header?: boolean }) {
    return (
        <Shell className={cn("w-full space-y-2", className)} label={label} announce={announce}>
            {header && (
                <div className="flex gap-3 border-b pb-2">
                    {Array.from({ length: columns }, (_, c) => (
                        <Skeleton key={c} className="h-3 flex-1" />
                    ))}
                </div>
            )}
            {Array.from({ length: rows }, (_, r) => (
                <div
                    key={r}
                    style={staggerStyle(r, { step: 30, cap: 200 })}
                    className="flex gap-3 py-1.5 animate-in fade-in fill-mode-backwards duration-slow ease-out"
                >
                    {Array.from({ length: columns }, (_, c) => (
                        <Skeleton key={c} className="h-3 flex-1" />
                    ))}
                </div>
            ))}
        </Shell>
    )
}

/** Bande de tuiles KPI — pendant de `StatTile` pendant le chargement. */
export function SkeletonStatTiles({ count = 4, className, label, announce }: Common & { count?: number }) {
    return (
        <Shell
            className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
            label={label}
            announce={announce}
        >
            {Array.from({ length: count }, (_, i) => (
                <div
                    key={i}
                    style={staggerStyle(i, { step: 30, cap: 200 })}
                    className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4 shadow-surface animate-in fade-in fill-mode-backwards duration-slow ease-out sm:p-6"
                >
                    <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-6 w-12" />
                        <Skeleton className="h-3 w-20" />
                    </div>
                </div>
            ))}
        </Shell>
    )
}
