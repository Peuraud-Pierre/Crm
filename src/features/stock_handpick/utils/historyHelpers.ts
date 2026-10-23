import { GROUPING_WINDOW_MS, UUID_DISPLAY_LENGTH } from "@/features/stock_handpick/constants"
import { groupLogs as groupLogsShared } from "@/shared/lib/logGrouping"
import type {
    HandpickActivityLog,
    HandpickLogGroup,
} from "@/features/stock_handpick/types/history.types"

/**
 * Regroupe le journal pour le feed. L'algorithme vit dans
 * `shared/lib/logGrouping.ts`, partagé avec le stock principal ; il ne reste
 * ici que la résolution du nom d'utilisateur, que le socle n'a pas à connaître.
 *
 * `anchor: "last"` conserve le découpage de ce module : fenêtre glissante, donc
 * une salve continue reste un seul groupe quelle que soit sa durée — un
 * arrivage de 40 balles ne se scinde pas en plein milieu.
 *
 * Les entrées sont supposées triées du plus récent au plus ancien (ordre du
 * service).
 */
export function groupActivityLogs(
    logs: HandpickActivityLog[],
    userNames: Map<string, string>,
): HandpickLogGroup[] {
    return groupLogsShared(logs, { windowMs: GROUPING_WINDOW_MS, anchor: "last" }).map(
        (group) => ({
            id: group.key,
            user_id: group.user_id,
            user_name: group.user_id ? userNames.get(group.user_id) ?? null : null,
            entity_type: group.entity_type,
            action: group.action,
            created_at: group.created_at,
            entries: group.entries,
        }),
    )
}

/**
 * Libellé affichable d'une entrée de journal.
 *
 * Le trigger fige le libellé au moment de l'action, mais la colonne qu'il lit
 * est souvent vide : une balle handpick n'a pas de code lisible (son identité
 * EST son UUID), une ligne de colisage en vrac n'a pas de libellé de balle, un
 * départ n'a pas toujours de conteneur. Le journal affichait alors une entrée
 * anonyme. À défaut de libellé, on montre l'identifiant tronqué — la même
 * convention que le reste du module.
 */
export function entityDisplayLabel(log: {
    entity_label: string | null
    entity_id: string | null
}): string | null {
    const label = log.entity_label?.trim()
    if (label) return label
    if (!log.entity_id) return null
    return `#${log.entity_id.slice(0, UUID_DISPLAY_LENGTH)}`
}

/**
 * Rend une valeur de diff lisible. Les colonnes sont typées librement
 * (`unknown`) parce que le trigger construit `changes` génériquement à partir
 * de `to_jsonb(NEW)` : on ne sait pas à la compilation ce qu'on affiche.
 */
export function formatDiffValue(value: unknown): string {
    if (value === null || value === undefined) return "—"
    if (typeof value === "boolean") return value ? "oui" : "non"
    if (typeof value === "number") return new Intl.NumberFormat("fr-FR").format(value)
    if (typeof value === "string") {
        // Horodatage ISO → date lisible ; le reste est rendu tel quel.
        if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
            return new Intl.DateTimeFormat("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
            }).format(new Date(value))
        }
        return value === "" ? "—" : value
    }
    return JSON.stringify(value)
}
