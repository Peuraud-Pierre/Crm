// ── VisitorProfileBlocks.tsx ──────────────────────────────────────────────────
// RÔLE : primitives d'affichage du profil visiteur (paire label/valeur, tuile de
// KPI, titre de section, skeleton de chargement). Extraites de
// VisitorProfileModal.tsx pour garder ce dernier sous le seuil des 400 lignes
// (Architecture_Feature.pdf §15).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/VisitsLog/VisitorProfileModal.tsx

import { Globe, Monitor, Smartphone } from "lucide-react"
import type { ReactNode } from "react"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"

/** Étiquette « Nom (version) », en omettant la parenthèse si la version manque. */
function withVersion(name?: string, version?: string) {
    if (!name) return ""
    return version ? `${name} (${version})` : name
}

/**
 * Appareils, OS et navigateurs partagent la même mise en forme (icône + texte) :
 * une liste unique évite trois blocs JSX quasi identiques côté modale.
 *
 * Attention à la forme de la réponse : Live.getVisitorProfile agrège chaque
 * dimension dans son propre tableau. Un élément de `devices` ne porte donc PAS
 * d'OS ni de navigateur (ceux-ci sont dans `operatingSystems` / `browsers`) —
 * les lire ici affichait « Smartphone — undefined — undefined ». Contrairement à
 * l'endpoint /log, dont chaque entrée est une visite avec les champs à plat.
 */
export function buildEnvironmentRows(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- réponse Matomo non typée
    profile: any
): { key: string; Icon: typeof Globe; text: string }[] {
    if (!profile) return []
    return [
        ...(profile.devices ?? []).map(
            (d: { type?: string; prettyName?: string }, i: number) => ({
                key: `device-${d.type ?? d.prettyName}-${i}`,
                Icon: Smartphone,
                text: d.prettyName || d.type || "",
            })
        ),
        ...(profile.operatingSystems ?? []).map(
            (os: { prettyName?: string; version?: string }, i: number) => ({
                key: `os-${os.prettyName}-${i}`,
                Icon: Monitor,
                text: withVersion(os.prettyName, os.version),
            })
        ),
        ...(profile.browsers ?? []).map(
            (b: { prettyName?: string; version?: string }, i: number) => ({
                key: `browser-${b.prettyName}-${i}`,
                Icon: Globe,
                text: withVersion(b.prettyName, b.version),
            })
        ),
        // Une dimension absente de la réponse ne doit pas laisser de ligne vide.
    ].filter((row) => row.text.trim() !== "")
}

/**
 * Paire label / valeur en grille : label et valeur alignés en colonnes sur
 * desktop, empilés sur mobile. La hiérarchie passe par la taille et la graisse
 * (label petit et muted, valeur en font-medium), jamais par la couleur seule.
 */
export function Row({
    label,
    children,
}: {
    label: string
    children: ReactNode
}) {
    return (
        <div className="grid grid-cols-1 gap-x-4 py-1.5 sm:grid-cols-3">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {label}
            </dt>
            <dd className="min-w-0 break-words text-sm font-medium text-foreground sm:col-span-2">
                {children}
            </dd>
        </div>
    )
}

/** Tuile de KPI : le chiffre porte l'information, le libellé le qualifie. */
export function StatTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xl font-semibold tabular-nums text-foreground">
                {value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
        </div>
    )
}

export function Section({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) {
    return (
        <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
            </h3>
            {children}
        </section>
    )
}

/** Skeleton plutôt qu'un texte « Chargement… » : la modale garde sa silhouette. */
export function ProfileSkeleton() {
    return (
        <SkeletonGroup className="space-y-6" label="Chargement du profil visiteur…">
            <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
            </div>
        </SkeletonGroup>
    )
}
