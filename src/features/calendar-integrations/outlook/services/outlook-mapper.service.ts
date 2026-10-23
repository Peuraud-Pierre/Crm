/**
 * Service de mapping bidirectionnel entre Event_calendar et Microsoft Graph Event
 */

import type { Event_creation } from "@/features/crm/hooks/CRM_hook/use_calendar"
import type { MicrosoftGraphEvent } from "../types"

export class OutlookMapperService {
    /**
     * Convertit un événement Nokk_project vers le format Microsoft Graph
     */
    toOutlookEvent(paEvent: Event_creation): Omit<MicrosoftGraphEvent, "id"> {
        const startDate = new Date(paEvent.debut)
        const endDate = new Date(paEvent.fin)

        // Stocker l'ID client dans la description (métadonnée cachée)
        const descriptionWithMetadata = paEvent.id_client
            ? `${paEvent.description || ""}\n\n<!-- PA_CLIENT_ID:${paEvent.id_client} -->`
            : paEvent.description || ""

        return {
            subject: paEvent.nom || "Sans titre",
            body: {
                contentType: "html",
                content: descriptionWithMetadata,
            },
            start: {
                dateTime: startDate.toISOString(),
                timeZone: "UTC",
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: "UTC",
            },
            location: paEvent.lieu
                ? {
                      displayName: paEvent.lieu,
                  }
                : undefined,
            attendees: paEvent.participants
                ? [
                      {
                          emailAddress: {
                              name: paEvent.participants,
                          },
                          type: "required",
                      },
                  ]
                : [],
        }
    }

    /**
     * Convertit un événement Microsoft Graph vers le format Nokk_project
     */
    toNokkProjectEvent(
        outlookEvent: MicrosoftGraphEvent,
        customerId: string
    ): Omit<Event_creation, "id"> {
        // Extraire l'ID client de la description si présent
        const idClientMatch =
            outlookEvent.body.content.match(
                /<!-- PA_CLIENT_ID:([a-f0-9-]+) -->/
            )
        const idClient = idClientMatch ? idClientMatch[1] : null

        // Nettoyer la description (retirer la métadonnée)
        const cleanDescription = outlookEvent.body.content.replace(
            /\n\n<!-- PA_CLIENT_ID:[a-f0-9-]+ -->/g,
            ""
        )

        // Extraire le nom du premier participant s'il existe
        const firstAttendee = outlookEvent.attendees?.[0]
        const participantName =
            firstAttendee?.emailAddress.name ||
            firstAttendee?.emailAddress.address ||
            null

        return {
            nom: outlookEvent.subject || "Sans titre",
            debut: outlookEvent.start.dateTime,
            fin: outlookEvent.end.dateTime,
            description: cleanDescription || null,
            lieu: outlookEvent.location?.displayName || null,
            participants: participantName,
            id_client: idClient,
            customer: customerId,
        }
    }

    /**
     * Extrait l'ID client d'un événement Outlook
     */
    extractClientId(outlookEvent: MicrosoftGraphEvent): string | null {
        const match = outlookEvent.body.content.match(
            /<!-- PA_CLIENT_ID:([a-f0-9-]+) -->/
        )
        return match ? match[1] : null
    }

    /**
     * Vérifie si un événement Outlook a été créé par Nokk_project
     */
    isFromNokk_project(outlookEvent: MicrosoftGraphEvent): boolean {
        return /<!-- PA_CLIENT_ID:[a-f0-9-]+ -->/.test(
            outlookEvent.body.content
        )
    }

    /**
     * Compare deux événements pour détecter les changements significatifs
     */
    hasSignificantChanges(
        event1: Partial<Event_creation>,
        event2: Partial<Event_creation>
    ): boolean {
        // Comparaison des champs clés
        const fields: Array<keyof Event_creation> = [
            "nom",
            "debut",
            "fin",
            "description",
            "lieu",
            "participants",
        ]

        for (const field of fields) {
            const val1 = event1[field]
            const val2 = event2[field]

            // Normaliser les dates pour la comparaison
            if (field === "debut" || field === "fin") {
                const date1 = val1 ? new Date(val1 as string).getTime() : null
                const date2 = val2 ? new Date(val2 as string).getTime() : null
                if (date1 !== date2) return true
            } else {
                // Comparaison simple pour les autres champs
                if (val1 !== val2) return true
            }
        }

        return false
    }
}

// Export singleton
export const outlookMapperService = new OutlookMapperService()
