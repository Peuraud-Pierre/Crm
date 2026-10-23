/**
 * Origine des RDV comptés dans les stats de prise de RDV (use_stats, widget
 * paliers). Un RDV compte s'il a été créé depuis le CRM (`source = 'crm'`),
 * ou s'il vient d'Amelia et a été CONFIRMÉ depuis le CRM : la confirmation le
 * compte comme créé par celui qui confirme, le jour de la confirmation
 * (`confirmCalendarEvent` réécrit `creator_id` et `created_at`, et pose
 * `confirmed_by`, qui sert de marqueur ici).
 *
 * La source n'est pas réécrite en 'crm' : le bridge Amelia retrouve ses RDV
 * par (source, external_id) et les recréerait.
 *
 * Même règle, dupliquée faute d'import partagé (Deno), dans
 * `supabase/functions/crm-stats-newsletter/stats.ts`.
 */
export function isCountedSource(event: {
    source?: string | null
    src?: string | null
    confirmed_by?: string | null
}): boolean {
    return (event.source ?? event.src) === "crm" || Boolean(event.confirmed_by)
}
