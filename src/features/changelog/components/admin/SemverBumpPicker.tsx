import { Sparkles } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { bumpVersion, displayVersion } from "../../utils/compareVersions"

export type BumpType = "major" | "minor" | "patch"

/**
 * Palette des trois niveaux d'incrémentation.
 *
 * Tokenisée : l'écran précédent codait en dur `blue-500`, `amber-500` et
 * `red-500` (avec leurs variantes `dark:`), ce que la règle de lint
 * couleurs ne voit pas — elle ne détecte que `bg-white`/`bg-black` et les
 * hex littéraux. La correspondance est sémantique et non décorative : un
 * correctif est neutre, une fonctionnalité mérite l'attention, une rupture
 * est un avertissement fort.
 */
const BUMP_CONFIG: Record<
    BumpType,
    { label: string; hint: string; reason: string; tone: string; dot: string }
> = {
    patch: {
        label: "Patch",
        hint: "+0.0.1 — correctif",
        reason: "Catégorie(s) de correctifs détectée(s)",
        tone: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
        dot: "bg-primary",
    },
    minor: {
        label: "Minor",
        hint: "+0.1.0 — fonctionnalité",
        reason: "Catégorie(s) de fonctionnalités détectée(s)",
        tone: "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20",
        dot: "bg-warning",
    },
    major: {
        label: "Major",
        hint: "+1.0.0 — rupture",
        reason: "Catégorie(s) avec changements cassants détectée(s)",
        tone: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
        dot: "bg-destructive",
    },
}

const BUMP_ORDER: BumpType[] = ["patch", "minor", "major"]

interface Props {
    latestPublished: string
    suggested: BumpType | null
    onPick: (version: string) => void
}

/**
 * Suggestion d'incrémentation SemVer et raccourcis manuels, calculés
 * depuis la dernière version publiée.
 */
export function SemverBumpPicker({
    latestPublished,
    suggested,
    onPick,
}: Props) {
    const suggestedVersion = suggested
        ? bumpVersion(latestPublished, suggested)
        : null

    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
                Dernière publiée :{" "}
                <span className="font-mono font-semibold text-foreground">
                    {displayVersion(latestPublished)}
                </span>
            </p>

            {suggested && suggestedVersion && (
                <button
                    type="button"
                    title={BUMP_CONFIG[suggested].reason}
                    onClick={() => onPick(suggestedVersion)}
                    className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                        BUMP_CONFIG[suggested].tone
                    )}
                >
                    <span className="flex min-w-0 items-center gap-1.5">
                        <Sparkles className="size-3 shrink-0" />
                        <span className="truncate">
                            {BUMP_CONFIG[suggested].label} suggéré
                        </span>
                    </span>
                    <span className="shrink-0 font-mono">
                        → {suggestedVersion}
                    </span>
                </button>
            )}

            <div className="flex gap-1.5">
                {BUMP_ORDER.map((type) => {
                    const next = bumpVersion(latestPublished, type)
                    const config = BUMP_CONFIG[type]
                    const isSuggested = type === suggested

                    return (
                        <button
                            key={type}
                            type="button"
                            title={config.hint}
                            disabled={!next}
                            onClick={() => next && onPick(next)}
                            className={cn(
                                "flex-1 rounded border px-1 py-1.5 text-xs font-bold leading-tight transition-colors",
                                config.tone,
                                isSuggested
                                    ? "ring-2 ring-current ring-offset-1"
                                    : "opacity-60 hover:opacity-100"
                            )}
                        >
                            <span className="flex items-center justify-center gap-0.5">
                                {isSuggested && <Sparkles className="size-3" />}
                                {config.label}
                            </span>
                            <span className="block font-mono font-normal opacity-70">
                                {next ?? "—"}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
