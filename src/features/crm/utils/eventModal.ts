/**
 * eventModal.ts — Résolution du client pour le singleton AddEventModal de l'onglet.
 *
 * `AddEventModal` est monté à deux endroits : le singleton de `CustomersTab` (pour
 * les déclencheurs des cartes du board) et la modale imbriquée dans la fiche client.
 * Quand la fiche est ouverte pour le client courant, c'est ELLE qui rend la modale
 * (avec `client={customer}`, toujours correct) ; le singleton doit alors s'abstenir
 * pour éviter deux modales empilées.
 */

import type { Client } from "@/features/crm/types"

export function resolveSingletonEventClient(
    openEventModal: string | number | null,
    clients: Client[],
    ficheClient: boolean,
    customerId?: string
): Client | undefined {
    if (openEventModal == null) return undefined
    // La fiche ouverte pour ce même client gère déjà sa propre modale → anti-doublon.
    if (ficheClient && customerId === openEventModal) return undefined
    return clients.find((c) => c.id === openEventModal)
}
