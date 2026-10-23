/**
 * useCreateEventLogic.ts
 * Hook principal de la modale de création/édition d'événement calendrier.
 * Extrait de components/types.ts pour respecter la séparation hooks/composants.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"
import { format, addHours } from "date-fns"
import { fromZonedTime } from "date-fns-tz"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useAuth } from "@/features/auth/hooks/useAuth"
import type { Event_creation } from "@/features/crm/types"
import { isCustomerObject } from "@/features/crm/utils/invariants"
import type { SlotConflict } from "@/features/crm/hooks/CRM_hook/use_calendar"
import * as calendarEventService from "@/features/crm/services/calendarEventService"
import { useClientSearch } from "@/features/crm/hooks/data/useClientSearch"
import {
    safeDate,
    timeToMinutes,
    minutesToTime,
    START_HOUR,
    HOUR_HEIGHT,
    EVENT_TYPES,
    isFerieOrWeekend,
    getFerieLabel,
} from "@/features/crm/utils/calendarConstants"
import {
    createDragActivation,
    getPointerPosition,
    isTouchEvent,
    signalDragActivation,
} from "@/features/crm/utils/dragActivation"

// « rdv physique achat — Dupont — 10:30 à 11:00 » : ce qui bloque, et quand.
const describeConflict = (c: SlotConflict): string => {
    const start = safeDate(c.debut)
    const end = safeDate(c.fin)
    const when =
        start && end
            ? `${format(start, "HH:mm")} à ${format(end, "HH:mm")}`
            : start
              ? format(start, "HH:mm")
              : ""
    return [c.nom || "Événement", c.client, when].filter(Boolean).join(" — ")
}

export function useCreateEventLogic({ update }: { update: boolean }) {
    const {
        eventToEdit,
        update_Event,
        create_event_calendar,
        setCreationevent,
        setCreation,
        setUpdate,
        search,
        findSlotConflict,
        date,
        fetch_calendar_event,
        events,
        customer,
        update_fiche_client,
    } = useCRMContext()

    const { user } = useAuth()
    const gridRef = useRef<HTMLDivElement>(null)

    const [formData, setFormData] = useState(() => ({
        id: "",
        nom: "rdv decouverte visio",
        participants: "",
        participantsID: "",
        mail: [] as string[],
        lieu: "",
        description: "",
        dateOnly: format(safeDate(date) || new Date(), "yyyy-MM-dd"),
        timeStart: "09:00",
        timeEnd: "10:00",
        owner: "",
    }))

    const [isBusy, setIsBusy] = useState(false)
    // Événement qui occupe le créneau chez le commercial choisi (nommé à
    // l'utilisateur : « Occupé » seul était illisible quand la grille ne
    // montrait rien, cf. ownerDayEvents).
    const [busyConflict, setBusyConflict] = useState<SlotConflict | null>(null)
    // Événements du commercial choisi pour la journée, chargés à la demande :
    // en vue jour/année, `events` ne contient que le commercial filtré dans
    // l'agenda. Sans ça, choisir un autre commercial affichait une grille vide
    // alors que la détection de conflit (en base) refusait le créneau.
    const [ownerDayEvents, setOwnerDayEvents] = useState<Event_creation[]>([])
    const [isChecking, setIsChecking] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    // Garde anti double-soumission. Un `useRef` (synchrone) et non un `useState`
    // (asynchrone) : sur connexion instable, plusieurs clics / re-soumissions
    // peuvent partir avant le prochain rendu et créer des événements en double.
    const isSubmittingRef = useRef(false)
    const [isFocused, setIsFocused] = useState(false)
    const [interaction, setInteraction] = useState<{
        type: "drag" | "resize-bottom"
        offsetY: number
        durationMin: number
    } | null>(null)

    // Chargement des données (séparé de l'initialisation du formulaire pour éviter
    // un re-fetch inutile à chaque changement de `date`).
    // On ne recharge l'agenda QUE s'il est vide : sur l'onglet Agenda, `events`
    // est déjà peuplé par CalendarProvider → pas de scan complet redondant à
    // chaque ouverture de modale. Mais la modale "RDV Rapide" lancée depuis la
    // fiche client est montée HORS CalendarProvider ; sans ce repli, la grille du
    // jour serait vide et masquerait les RDV existants (risque de double-booking).
    const didLoadRef = useRef(false)
    useEffect(() => {
        if (didLoadRef.current) return
        didLoadRef.current = true
        if (events.length === 0) fetch_calendar_event()
        // Plus de fetch_client ici : il rechargeait `clients[]` (page 1) et
        // vidait les colonnes déjà défilées du Kanban. Les suggestions passent
        // par useClientSearch.
    }, [events.length, fetch_calendar_event])

    // Initialisation du formulaire depuis l'event en édition ou le client pré-sélectionné.
    // Synchronisation légitime d'un état externe (eventToEdit / customer) vers le
    // formulaire éditable : on doit réinitialiser formData à l'ouverture de la modale,
    // ce qui requiert un setState dans l'effet (pas de valeur dérivée possible car le
    // formulaire est ensuite modifiable par l'utilisateur).
    //
    // Garde anti-réinitialisation : `user` et `customer` changent d'identité
    // d'objet sans changement réel (TOKEN_REFRESHED au refocus d'onglet,
    // resynchro realtime de clients[]). Sans cette garde, l'effet re-tourne en
    // plein milieu de l'édition et ÉCRASE les champs modifiés par l'utilisateur
    // (ex. le commercial sélectionné) avec les valeurs d'origine de l'event.
    const initializedForRef = useRef<string | null>(null)
    useEffect(() => {
        if (update && eventToEdit?.id) {
            const initKey = `edit:${eventToEdit.id}`
            if (initializedForRef.current === initKey) return
            initializedForRef.current = initKey
            const startDate = safeDate(eventToEdit.debut) || new Date()
            const endDate = safeDate(eventToEdit.fin) || addHours(startDate, 1)
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- reset d'un formulaire éditable depuis des props externes
            setFormData((prev) => ({
                ...prev,
                id: eventToEdit.id || "",
                nom: eventToEdit.nom || "rdv decouverte visio",
                // Les événements venus d'Amelia ont la colonne texte `client` vide :
                // le nom du client n'existe que sur la fiche jointe via id_client.
                // Sans ce fallback, le champ Client reste vide et le bouton
                // « Mettre à jour » est désactivé.
                participants:
                    eventToEdit.participants ||
                    eventToEdit.client ||
                    eventToEdit.clientProfile?.nom ||
                    "",
                participantsID: eventToEdit.id_client || "",
                lieu: eventToEdit.lieu || "",
                description: eventToEdit.description || "",
                dateOnly: format(startDate, "yyyy-MM-dd"),
                timeStart: format(startDate, "HH:mm"),
                timeEnd: format(endDate, "HH:mm"),
                owner:
                    eventToEdit.owner ||
                    (isCustomerObject(eventToEdit.customer)
                        ? eventToEdit.customer.user_id
                        : null) ||
                    user?.user_id ||
                    "",
                mail: Array.isArray(eventToEdit.mail)
                    ? eventToEdit.mail
                    : eventToEdit.mail
                      ? [eventToEdit.mail]
                      : [],
            }))
        } else if (customer?.id && !update) {
            const initKey = `create:${customer.id}`
            if (initializedForRef.current === initKey) return
            initializedForRef.current = initKey
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- pré-remplissage du formulaire depuis le client sélectionné
            setFormData((prev) => ({
                ...prev,
                participants: customer.nom || "",
                participantsID: customer.id || "",
                mail: [customer.mail, customer.mail_2].filter(
                    Boolean
                ) as string[],
            }))
        }
    }, [eventToEdit, update, user, customer])

    // Suggestions de clients : recherche serveur sur toute la table (et non
    // plus dans les seules pages de `clients[]` chargées par le Kanban).
    const filteredClients = useClientSearch(formData.participants ?? "", 5)

    useEffect(() => {
        let cancelled = false
        const owner = formData.owner
        if (!owner) {
            const clear = setTimeout(() => setOwnerDayEvents([]), 0)
            return () => clearTimeout(clear)
        }
        const dayStart = new Date(`${formData.dateOnly}T00:00:00`)
        const dayEnd = new Date(`${formData.dateOnly}T23:59:59.999`)
        if (isNaN(dayStart.getTime())) return
        calendarEventService
            .fetchOwnerDayEvents(
                owner,
                dayStart.toISOString(),
                dayEnd.toISOString()
            )
            .then(({ data, error }) => {
                if (cancelled || error || !data) return
                setOwnerDayEvents(
                    data.map((row) => ({
                        ...row,
                        owner,
                        participants: row.client || "",
                        debut: row.debut || "",
                        fin: row.fin || "",
                        lieu: null,
                    })) as Event_creation[]
                )
            })
        return () => {
            cancelled = true
        }
    }, [formData.owner, formData.dateOnly])

    // Emplois du temps de la journée (pour afficher les autres évènements)
    const daySchedule = useMemo(() => {
        const inMemory = Array.isArray(events) ? (events as Event_creation[]) : []
        const known = new Set(inMemory.map((e) => e.id))
        const merged = [
            ...inMemory,
            ...ownerDayEvents.filter((e) => !known.has(e.id)),
        ]
        return merged
            .filter((e) => {
                if (!e.debut || e.id === formData.id) return false
                const eventStart = safeDate(e.debut)
                if (!eventStart) return false
                const ownerKey =
                    e.owner ||
                    (isCustomerObject(e.customer)
                        ? (e.customer.user_id ?? e.customer.id)
                        : null)
                return (
                    format(eventStart, "yyyy-MM-dd") === formData.dateOnly &&
                    ownerKey?.toString() === formData.owner?.toString()
                )
            })
            .sort(
                (a, b) =>
                    (safeDate(a.debut)?.getTime() || 0) -
                    (safeDate(b.debut)?.getTime() || 0)
            )
    }, [events, ownerDayEvents, formData.dateOnly, formData.owner, formData.id])

    // Blocage week-end / jours fériés (sauf "Non Disponible") — valeur dérivée
    const ferieError = useMemo<string | null>(() => {
        if (formData.nom === "Non Disponible") return null
        const dateStr = `${formData.dateOnly}T${formData.timeStart}`
        if (isFerieOrWeekend(dateStr)) {
            const label = getFerieLabel(dateStr) ?? "Jour non ouvré"
            return `Impossible de créer un RDV un ${label}`
        }
        return null
    }, [formData.dateOnly, formData.timeStart, formData.nom])

    // Vérification de la disponibilité (Debounced)
    useEffect(() => {
        // Les `set*` sont déplacés dans le timeout (ou différés via un timer 0)
        // pour ne pas appeler de setter de façon synchrone dans le corps de
        // l'effet (no-direct-set-state-in-use-effect).
        if (formData.nom === "Non Disponible" || interaction) {
            const skipId = setTimeout(() => {
                setIsBusy(false)
                setBusyConflict(null)
            }, 0)
            return () => clearTimeout(skipId)
        }
        const timeoutId = setTimeout(async () => {
            setIsChecking(true)
            const conflict = await findSlotConflict(
                formData.owner,
                `${formData.dateOnly}T${formData.timeStart}`,
                `${formData.dateOnly}T${formData.timeEnd}`,
                formData.id
            )
            setBusyConflict(conflict)
            setIsBusy(conflict !== null)
            setIsChecking(false)
        }, 350)
        return () => clearTimeout(timeoutId)
    }, [
        formData.dateOnly,
        formData.timeStart,
        formData.timeEnd,
        formData.owner,
        formData.id,
        formData.nom,
        interaction,
        findSlotConflict,
    ])

    // Interactions Drag & Drop (pointeur enfoncé).
    // Souris : le geste démarre immédiatement. Tactile : appui long de 250 ms,
    // même règle que les grilles Jour/Semaine — sans ça, faire défiler la
    // grille de la modale déplaçait le créneau en cours de création.
    const handleMouseDown = useCallback(
        (
            e: React.MouseEvent | React.TouchEvent,
            type: "drag" | "resize-bottom"
        ) => {
            const rect = gridRef.current?.getBoundingClientRect()
            if (!rect) return

            const isTouch = isTouchEvent(e)
            const start = getPointerPosition(e)
            // Pas de preventDefault en tactile : le listener racine de React
            // est passif, et on veut justement laisser le scroll natif faire
            // son travail tant que l'appui long n'a pas abouti.
            if (!isTouch) e.preventDefault()

            const begin = () => {
                const offsetY =
                    type === "drag"
                        ? start.y -
                          (rect.top +
                              (timeToMinutes(formData.timeStart) / 60 -
                                  START_HOUR) *
                                  HOUR_HEIGHT)
                        : 0
                setInteraction({
                    type,
                    offsetY,
                    durationMin:
                        timeToMinutes(formData.timeEnd) -
                        timeToMinutes(formData.timeStart),
                })
            }

            if (!isTouch) {
                begin()
                return
            }

            // Écoute temporaire, le temps de savoir si le doigt reste posé
            // (drag) ou se déplace (scroll). L'interaction n'est créée qu'au
            // terme de l'appui long.
            const detach = () => {
                window.removeEventListener("touchmove", onProbeMove)
                window.removeEventListener("touchend", onProbeEnd)
                window.removeEventListener("touchcancel", onProbeEnd)
            }

            const activation = createDragActivation({
                isTouch: true,
                onActivate: () => {
                    signalDragActivation()
                    begin()
                    detach()
                },
            })

            const onProbeMove = (moveEvent: TouchEvent) => {
                const current = getPointerPosition(moveEvent)
                activation.update(current.x - start.x, current.y - start.y)
                if (activation.isCancelled) detach()
            }

            const onProbeEnd = () => {
                activation.cancel()
                detach()
            }

            window.addEventListener("touchmove", onProbeMove, { passive: true })
            window.addEventListener("touchend", onProbeEnd)
            window.addEventListener("touchcancel", onProbeEnd)
        },
        [formData.timeStart, formData.timeEnd]
    )

    // Interactions Drag & Drop (Déplacement & relâchement)
    useEffect(() => {
        if (!interaction) return
        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            const rect = gridRef.current?.getBoundingClientRect()
            if (!rect) return
            // Le geste est engagé : on le confisque au scroll de la grille.
            if (isTouchEvent(e) && e.cancelable) e.preventDefault()
            const y = getPointerPosition(e).y - rect.top
            const currentMin = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60

            if (interaction.type === "drag") {
                const newStartMin =
                    Math.round(
                        (currentMin -
                            (interaction.offsetY / HOUR_HEIGHT) * 60) /
                            15
                    ) * 15
                setFormData((p) => ({
                    ...p,
                    timeStart: minutesToTime(newStartMin),
                    timeEnd: minutesToTime(
                        newStartMin + interaction.durationMin
                    ),
                }))
            } else if (interaction.type === "resize-bottom") {
                const newEndMin = Math.round(currentMin / 15) * 15
                if (newEndMin > timeToMinutes(formData.timeStart))
                    setFormData((p) => ({
                        ...p,
                        timeEnd: minutesToTime(newEndMin),
                    }))
            }
        }
        const handleMouseUp = () => setInteraction(null)

        window.addEventListener("mousemove", handleMouseMove)
        window.addEventListener("mouseup", handleMouseUp)
        window.addEventListener("touchmove", handleMouseMove, {
            passive: false,
        })
        window.addEventListener("touchend", handleMouseUp)
        window.addEventListener("touchcancel", handleMouseUp)

        return () => {
            window.removeEventListener("mousemove", handleMouseMove)
            window.removeEventListener("mouseup", handleMouseUp)
            window.removeEventListener("touchmove", handleMouseMove)
            window.removeEventListener("touchend", handleMouseUp)
            window.removeEventListener("touchcancel", handleMouseUp)
        }
    }, [interaction, formData.timeStart])

    // Soumission du formulaire
    const handleSubmit = async () => {
        if (ferieError) return
        // Bloque toute soumission concurrente (double-clic, renvoi réseau).
        if (isSubmittingRef.current) return
        isSubmittingRef.current = true
        setIsSubmitting(true)

        try {
            // Deux RDV peuvent se chevaucher pour un même commercial : le
            // conflit AVERTIT, il ne bloque plus. Le contrôle de la saisie est
            // debouncé (350 ms) et reflète la dernière frappe, pas l'instant du
            // clic : entre les deux, un prospect a pu réserver le créneau sur
            // Amelia ou un collègue le poser depuis le CRM. On le rejoue donc
            // juste avant l'écriture, pour prévenir du chevauchement créé.
            if (formData.nom !== "Non Disponible") {
                const conflict = await findSlotConflict(
                    formData.owner,
                    `${formData.dateOnly}T${formData.timeStart}`,
                    `${formData.dateOnly}T${formData.timeEnd}`,
                    formData.id
                )
                if (conflict) {
                    setIsBusy(true)
                    setBusyConflict(conflict)
                    toast.warning("RDV enregistré en même temps qu'un autre", {
                        description: describeConflict(conflict),
                    })
                }
            }

            // L'heure saisie est une heure murale Europe/Paris. On l'interprète
            // explicitement dans ce fuseau (et non dans le fuseau du runtime, qui peut
            // être UTC côté serveur et produirait un instant décalé), puis on stocke en
            // vrai UTC (toISOString). Évite les timestamps "naïfs" en base.
            const debutStr = fromZonedTime(
                `${formData.dateOnly}T${formData.timeStart}`,
                "Europe/Paris"
            ).toISOString()
            const finStr = fromZonedTime(
                `${formData.dateOnly}T${formData.timeEnd}`,
                "Europe/Paris"
            ).toISOString()
            const payload = {
                ...formData,
                debut: debutStr,
                fin: finStr,
                creator_id: user?.user_id || "",
                id_client: formData.participantsID,
            }

            if (update) {
                await update_Event(payload)
            } else {
                await create_event_calendar(payload)

                // À la création d'un RDV, on affecte le client concerné au closer.
                // Le closer = le « customer » du RDV, càd la même valeur que la
                // colonne `customer` de l'événement : `owner ?? user.user_id`
                // (cf. create_event_calendar). Sans ça, un RDV créé sans owner
                // explicite laissait le closer en "non-assigné".
                const rdvCustomer = formData.owner || user?.user_id
                if (formData.participantsID && rdvCustomer) {
                    // closers stocke un UUID (user_id) côté DB ; le type Client.closers
                    // décrit l'objet joint en lecture, d'où le cast.
                    await update_fiche_client({
                        id: formData.participantsID,
                        closers: rdvCustomer,
                    } as Parameters<typeof update_fiche_client>[0])
                }
            }

            // Pas de fetch_calendar_event() ici : create_event_calendar ajoute déjà
            // l'event optimiste (et swap l'id au retour serveur) et update_Event patche
            // la liste de façon optimiste ; le channel realtime réconcilie le reste.
            // Évite un scan complet de la table à chaque création/édition.
            handleClose()
        } catch (err) {
            // Échec (réseau, serveur) : on réautorise une nouvelle tentative.
            isSubmittingRef.current = false
            setIsSubmitting(false)
            throw err
        }
    }

    // Fermeture de la modale
    const handleClose = () => {
        setCreationevent(false)
        setCreation(false)
        setUpdate(false)
    }

    // Styles dynamiques pour le bloc de prévisualisation (drag & drop)
    const previewStyles = useMemo(() => {
        const startMin = timeToMinutes(formData.timeStart)
        const top = (startMin / 60 - START_HOUR) * HOUR_HEIGHT
        const height =
            (timeToMinutes(formData.timeEnd) - startMin) * (HOUR_HEIGHT / 60)
        return { top: `${top}px`, height: `${height}px` }
    }, [formData.timeStart, formData.timeEnd])

    // Récupération de la configuration visuelle du type d'évènement
    const currentTypeConfig =
        EVENT_TYPES.find((t) => t.value === formData.nom) || EVENT_TYPES[0]

    return {
        formData,
        setFormData,
        isBusy,
        busyConflict,
        busyConflictLabel: busyConflict ? describeConflict(busyConflict) : null,
        isChecking,
        isSubmitting,
        ferieError,
        isFocused,
        setIsFocused,
        filteredClients,
        daySchedule,
        previewStyles,
        currentTypeConfig,
        search,
        handleMouseDown,
        handleSubmit,
        handleClose,
        gridRef,
    }
}
