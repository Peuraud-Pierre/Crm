/**
 * Regroupement des entrées d'un journal d'activité.
 *
 * Sans lui, un arrivage de 40 balles produit 40 lignes identiques dans le feed
 * et noie tout le reste. Le regroupement est purement présentationnel : la
 * donnée en base reste ligne à ligne.
 *
 * Les deux modules de stock en avaient chacun une implémentation, identiques à
 * un détail près — et ce détail change le résultat, d'où le paramètre `anchor`
 * plutôt qu'une fusion silencieuse.
 */

/** Ce dont le regroupement a besoin ; chaque module en met davantage. */
export interface GroupableLog {
    id: string
    created_at: string
    user_id: string | null
    action: string
    entity_type: string
}

export interface LogGrouping<T extends GroupableLog> {
    /** Id de la première entrée : identifiant stable du groupe. */
    key: string
    action: T["action"]
    entity_type: T["entity_type"]
    user_id: string | null
    /** Horodatage de l'entrée qui a ouvert le groupe. */
    created_at: string
    entries: T[]
}

export interface GroupLogsOptions {
    windowMs: number
    /**
     * Point de mesure de la fenêtre temporelle :
     *
     *  • `"head"` — depuis l'entrée qui a OUVERT le groupe. Une salve étalée
     *    sur plus que la fenêtre finit donc par se scinder, quelle que soit la
     *    densité des entrées.
     *  • `"last"` — depuis la DERNIÈRE entrée ajoutée (fenêtre glissante). Une
     *    salve continue reste un seul groupe, aussi longue soit-elle.
     *
     * Les deux modules n'avaient pas fait le même choix. Les aligner sans le
     * dire changerait le découpage des salves de l'un des deux, sans qu'aucun
     * type ni aucun test existant ne s'en aperçoive : le paramètre rend l'écart
     * visible en attendant qu'il soit tranché.
     */
    anchor: "head" | "last"
}

/**
 * Regroupe les entrées CONSÉCUTIVES d'un même utilisateur portant la même
 * action sur le même type d'entité, dans une fenêtre de temps courte.
 *
 * Les entrées sont supposées triées du plus récent au plus ancien (ordre des
 * services) ; la valeur absolue de l'écart rend le calcul indifférent au sens.
 */
export function groupLogs<T extends GroupableLog>(
    logs: readonly T[],
    { windowMs, anchor }: GroupLogsOptions,
): LogGrouping<T>[] {
    const groups: LogGrouping<T>[] = []

    for (const log of logs) {
        const current = groups.length > 0 ? groups[groups.length - 1] : undefined

        const sameContext =
            current !== undefined &&
            current.user_id === log.user_id &&
            current.action === log.action &&
            current.entity_type === log.entity_type

        const reference =
            anchor === "head"
                ? current?.created_at
                : current?.entries[current.entries.length - 1].created_at

        const withinWindow =
            reference !== undefined &&
            Math.abs(new Date(reference).getTime() - new Date(log.created_at).getTime()) <=
                windowMs

        if (sameContext && withinWindow && current) {
            current.entries.push(log)
            continue
        }

        groups.push({
            key: log.id,
            action: log.action,
            entity_type: log.entity_type,
            user_id: log.user_id,
            created_at: log.created_at,
            entries: [log],
        })
    }

    return groups
}
