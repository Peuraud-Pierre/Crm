import { Download, Upload } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { cn } from "@/shared/lib/utils"
import { isValidSemVer } from "../../utils/compareVersions"
import type { ChangelogVersionStatus } from "../../types/changelog.types"
import { SemverBumpPicker, type BumpType } from "./SemverBumpPicker"

interface Props {
    isEdit: boolean
    version: string
    onVersionChange: (value: string) => void
    date: string
    onDateChange: (value: string) => void
    status: ChangelogVersionStatus
    onStatusChange: (value: ChangelogVersionStatus) => void
    summary: string
    onSummaryChange: (value: string) => void
    latestPublished: string | null
    suggestedBump: BumpType | null
    onImport: () => void
    onExport: () => void
}

/** Colonne de gauche du formulaire : identité de la version. */
export function VersionMetaFields({
    isEdit,
    version,
    onVersionChange,
    date,
    onDateChange,
    status,
    onStatusChange,
    summary,
    onSummaryChange,
    latestPublished,
    suggestedBump,
    onImport,
    onExport,
}: Props) {
    const versionInvalid = !!version && !isValidSemVer(version)

    return (
        <aside className="h-fit rounded-2xl bg-muted/30 p-5 shadow-xs sm:p-6 lg:sticky lg:top-6">
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label
                        htmlFor="changelog-version"
                        className="text-base font-semibold sm:text-lg"
                    >
                        Version{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                            (SemVer : MAJOR.MINOR.PATCH)
                        </span>
                    </Label>

                    {latestPublished && (
                        <SemverBumpPicker
                            latestPublished={latestPublished}
                            suggested={suggestedBump}
                            onPick={onVersionChange}
                        />
                    )}

                    <Input
                        id="changelog-version"
                        className={cn(
                            "font-mono",
                            versionInvalid &&
                                "border-destructive focus-visible:ring-destructive"
                        )}
                        value={version}
                        onChange={(e) => onVersionChange(e.target.value)}
                        placeholder="2.1.0"
                        aria-invalid={versionInvalid}
                        required
                    />
                    {versionInvalid && (
                        <p className="text-xs text-destructive">
                            Format invalide — attendu : X.Y.Z (ex. 2.1.0)
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor="changelog-date"
                        className="text-base font-semibold sm:text-lg"
                    >
                        Date de déploiement
                    </Label>
                    <Input
                        id="changelog-date"
                        type="datetime-local"
                        value={date}
                        onChange={(e) => onDateChange(e.target.value)}
                        required
                    />
                    <p className="text-xs text-muted-foreground">
                        Saisie en heure française, quel que soit le fuseau du
                        navigateur.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor="changelog-status"
                        className="text-base font-semibold sm:text-lg"
                    >
                        Statut
                    </Label>
                    <Select
                        value={status}
                        onValueChange={(v) =>
                            onStatusChange(v as ChangelogVersionStatus)
                        }
                    >
                        <SelectTrigger id="changelog-status">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="draft">Brouillon</SelectItem>
                            <SelectItem value="published">Publié</SelectItem>
                            {isEdit && (
                                <SelectItem value="archived">
                                    Archivé
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor="changelog-summary"
                        className="text-base font-semibold sm:text-lg"
                    >
                        Résumé{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                            (facultatif)
                        </span>
                    </Label>
                    <Textarea
                        id="changelog-summary"
                        className="resize-none"
                        value={summary}
                        onChange={(e) => onSummaryChange(e.target.value)}
                        placeholder="Résumé rapide de cette version..."
                        rows={3}
                    />
                </div>

                <div className="space-y-2 border-t pt-4">
                    <Label className="text-sm font-semibold text-muted-foreground">
                        Import / Export JSON
                    </Label>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={onImport}
                        >
                            <Upload className="size-3.5" />
                            Importer
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={onExport}
                        >
                            <Download className="size-3.5" />
                            Exporter
                        </Button>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Exportez la structure pour la donner à un LLM, puis
                        importez le résultat.
                    </p>
                </div>
            </div>
        </aside>
    )
}
