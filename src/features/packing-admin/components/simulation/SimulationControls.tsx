import { Play, RotateCcw } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Label } from "@/shared/ui/atoms/label"
import { Slider } from "@/shared/ui/atoms/slider"
import { formatShare } from "@/features/packing-admin/utils/format"
import type { PackingGuardSettings } from "@/features/packing-admin/types"

interface SimulationControlsProps {
    value: PackingGuardSettings
    production: PackingGuardSettings | null
    running: boolean
    onChange: (next: PackingGuardSettings) => void
    onRun: () => void
    onReset: () => void
}

/**
 * Les trois réglages qui déterminent le seuil d'auto-classement.
 *
 * Le calcul est déclenché par un BOUTON et non à chaque mouvement de curseur : une
 * simulation reconstruit un modèle complet côté service. Débouncer donnerait
 * l'illusion du direct tout en lançant des calculs que personne n'a demandés ;
 * un bouton dit ce qui se passe et quand.
 */
export function SimulationControls({
    value,
    production,
    running,
    onChange,
    onRun,
    onReset,
}: SimulationControlsProps) {
    const dirty =
        production !== null &&
        (value.target_precision !== production.target_precision ||
            value.min_evidence !== production.min_evidence ||
            value.min_margin !== production.min_margin)

    return (
        <div className="flex flex-col gap-5">
            <Control
                id="sim-precision"
                label="Précision cible"
                hint="Part des propositions qui doivent avoir été justes pour que le modèle ait le droit de classer seul. Plus haut = plus prudent, et moins de lignes classées d'office."
                display={formatShare(value.target_precision)}
            >
                <Slider
                    id="sim-precision"
                    min={0.5}
                    max={1}
                    step={0.005}
                    value={[value.target_precision]}
                    onValueChange={([next]) => onChange({ ...value, target_precision: next })}
                />
            </Control>

            <Control
                id="sim-evidence"
                label="Preuves minimales"
                hint="Nombre de propositions déjà arbitrées par un humain avant de mesurer quoi que ce soit. En dessous, le modèle propose sans jamais décider."
                display={String(value.min_evidence)}
            >
                <Slider
                    id="sim-evidence"
                    min={1}
                    max={300}
                    step={1}
                    value={[value.min_evidence]}
                    onValueChange={([next]) => onChange({ ...value, min_evidence: next })}
                />
            </Control>

            <Control
                id="sim-margin"
                label="Marge minimale"
                hint="Écart exigé entre la première et la deuxième catégorie. C'est ce qui bloque les hésitations entre deux marques proches, qu'une confiance élevée ne suffit pas à écarter."
                display={value.min_margin.toFixed(2)}
            >
                <Slider
                    id="sim-margin"
                    min={0}
                    max={0.8}
                    step={0.01}
                    value={[value.min_margin]}
                    onValueChange={([next]) => onChange({ ...value, min_margin: next })}
                />
            </Control>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 sm:w-auto"
                    onClick={onReset}
                    disabled={!dirty && !running}
                >
                    <RotateCcw size={13} aria-hidden />
                    Revenir aux réglages du service
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="w-full gap-1.5 sm:w-auto"
                    onClick={onRun}
                    loading={running}
                >
                    <Play size={13} aria-hidden />
                    Simuler
                </Button>
            </div>
        </div>
    )
}

function Control({
    id,
    label,
    hint,
    display,
    children,
}: {
    id: string
    label: string
    hint: string
    display: string
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={id} className="text-sm font-medium">
                    {label}
                </Label>
                <span className="text-sm font-semibold tabular-nums text-foreground">{display}</span>
            </div>
            {children}
            <p className="text-2xs text-muted-foreground">{hint}</p>
        </div>
    )
}
