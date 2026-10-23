import {
    formatDistance,
    type DistanceResult,
} from "@/features/crm/utils/distance"
import { calculateDistance } from "@/features/crm/services/distanceService"
import { useClientEvents } from "@/features/crm/hooks/data/useClientEvents"
import { safeDateMs } from "@/features/crm/utils/safeDate"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { ameliaBridgeService } from "@/features/calendar-integrations/amelia"
import { type Event_creation } from "@/features/crm/hooks/CRM_hook/use_calendar"
import { type activites as ActiviteType } from "@/features/crm/hooks/CRM_hook/use_activites"
import { type FicheAppro } from "@/features/crm/hooks/CRM_hook/use_client"
import { type Tache as TacheType } from "@/features/crm/hooks/CRM_hook/use_tache"
import { cn } from "@/shared/lib/utils"
import { NewsletterOptIn } from "@/features/crm/components/Client/NewsletterOptIn"
import { Avatar, AvatarFallback } from "@/shared/ui/atoms/avatar"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Separator } from "@/shared/ui/atoms/separator"
import { Textarea } from "@/shared/ui/atoms/textarea"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import { format } from "date-fns"
import { toast } from "sonner"
import { fr } from "date-fns/locale"
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Edit,
    Link,
    Mail,
    Route,
    Timer,
    User,
    UserPlus,
    Plus,
    Phone,
} from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"

import CreateEvent from "../../Calendar/create_event"
import Createclient from "../creation_client"

import type { Client, Search } from "@/features/crm/hooks/CRM_hook/use_client"

// Forme hybride retournée par fetch_research / profiles : on accepte les deux
// shapes croisés dans le code (`user_id` vs `id`, `full_name` vs `name`).
type AssignableUser = Search & {
    id?: string
    full_name?: string | null
}
// Aligné sur la signature exposée par useCRMContext.update_fiche_client
// qui accepte customer/closers en string (UUID) ou Owner (objet joint).
type UpdateFicheFn = (changes: {
    id: string
    [key: string]: unknown
}) => Promise<void> | void
import type { Tache } from "@/features/crm/hooks/CRM_hook/use_tache"

// --- CONFIGURATION STATIQUE ---
export const columnNames = [
    "Nouveau lead",
    "En qualification",
    "En incubation",
    "RDV Decouverte",
    "RDV Achat",
    "1ère commande / Test",
    "Fidélisation / Client Actif",
    "Dormant",
]

const SPECIAL_TYPES = [
    "Relance",
    "Email",
    "WhatsApp",
    "A Faire",
    "Nouvelle commande",
    "Suivi Post-Livraison",
]

const EVENT_CONFIG: Record<string, { color: string; label: string }> = {
    rdv: { color: "bg-blue-500 border-blue-500", label: "Rendez-vous" },
    appel: { color: "bg-green-500 border-green-500", label: "Appel" },
    visio: { color: "bg-purple-500 border-purple-500", label: "Visio" },
    default: { color: "bg-gray-400 border-gray-400", label: "Autre" },
}

// ---------------------------------------------------------------------------
// Génération PDF RGPD (Art. 15 – Droit d'accès)
// ---------------------------------------------------------------------------
//
const PIPELINE_LABELS_PDF: Record<number, string> = {
    0: "Nouveau lead",
    1: "En qualification",
    2: "En incubation",
    3: "RDV Découverte",
    4: "RDV Achat",
    5: "Visio RDV",
    6: "Client Actif",
    7: "Dormant",
    8: "No Show",
    9: "RDV à confirmer",
}

async function generateClientRGPDPDF(
    customer: Client | undefined,
    fiche: FicheAppro,
    activites: ActiviteType[],
    allTache: TacheType[],
    events: Event_creation[]
) {
    // Import dynamique : jsPDF (lourd) n'est chargé qu'à la génération du PDF.
    const { default: jsPDF } = await import("jspdf")
    const doc = new jsPDF("p", "mm", "a4")
    const pageW = 210
    const ml = 14
    const contentW = pageW - ml * 2
    let y = 20

    const C = {
        blue: [37, 99, 235] as [number, number, number],
        dark: [20, 20, 30] as [number, number, number],
        mid: [75, 85, 99] as [number, number, number],
        light: [156, 163, 175] as [number, number, number],
        bg: [241, 245, 249] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
        green: [22, 163, 74] as [number, number, number],
    }

    const newPage = () => {
        doc.addPage()
        y = 20
    }
    const guard = (h = 10) => {
        if (y + h > 278) newPage()
    }

    const sectionTitle = (n: string) => {
        guard(14)
        doc.setFillColor(...C.bg)
        doc.roundedRect(ml, y, contentW, 7, 1.5, 1.5, "F")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8)
        doc.setTextColor(...C.blue)
        doc.text(n.toUpperCase(), ml + 3, y + 5)
        y += 11
    }

    const row = (
        label: string,
        value: string | null | undefined,
        labelW = 48
    ) => {
        if (!value && value !== "0") return
        guard(7)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(7.5)
        doc.setTextColor(...C.mid)
        doc.text(label, ml + 2, y)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...C.dark)
        const lines = doc.splitTextToSize(String(value), contentW - labelW - 4)
        doc.text(lines, ml + labelW, y)
        y += Math.max(lines.length * 4.5, 5) + 1.5
    }

    const bullet = (title: string, body?: string | null) => {
        guard(12)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8)
        doc.setTextColor(...C.dark)
        doc.text(`• ${title}`, ml + 3, y)
        y += 5
        if (body) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(7.5)
            doc.setTextColor(...C.mid)
            const lines = doc.splitTextToSize(body, contentW - 8)
            doc.text(lines, ml + 7, y)
            y += lines.length * 4.2 + 2
        }
    }

    // ── HEADER ──────────────────────────────────────────────────────────────
    doc.setFillColor(...C.blue)
    doc.rect(0, 0, pageW, 32, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(...C.white)
    doc.text("Export RGPD – Données personnelles", ml, 14)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.text(
        `Client : ${customer?.nom ?? "—"}   |   Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
        ml,
        22
    )
    doc.text("Conformément au RGPD – Article 15 (Droit d'accès)", ml, 29)
    y = 42

    // ── NOTICE RGPD ─────────────────────────────────────────────────────────
    const noticeItems: Array<{ label: string; text: string }> = [
        {
            label: "Finalités du traitement",
            text: "Vos données sont collectées et conservées dans le cadre de la gestion de la relation commerciale : prospection, suivi des commandes, fidélisation client et communication commerciale.",
        },
        {
            label: "Destinataires",
            text: "Ces données sont accessibles au personnel commercial habilité (setters, closers, direction commerciale). Elles ne sont pas transmises à des tiers sans votre consentement préalable, sauf obligation légale.",
        },
        {
            label: "Durée de conservation",
            text: "Vos données sont conservées 3 ans à compter du dernier contact commercial actif (conformément aux recommandations de la CNIL pour les données de prospection).",
        },
        {
            label: "Vos droits",
            text: "Conformément au RGPD, vous disposez des droits suivants sur vos données : droit d'accès (Art. 15), droit de rectification (Art. 16), droit à l'effacement (Art. 17), droit à la limitation du traitement (Art. 18), droit à la portabilité (Art. 20) et droit d'opposition (Art. 21). Pour exercer ces droits, contactez-nous par écrit.",
        },
        {
            label: "Droit de réclamation",
            text: "Si vous estimez que le traitement de vos données n'est pas conforme à la réglementation, vous avez le droit d'introduire une réclamation auprès de la Commission Nationale de l'Informatique et des Libertés (CNIL) — www.cnil.fr — ou de toute autre autorité de contrôle compétente.",
        },
    ]

    // Cadre de notice
    const noticeHeight = noticeItems.length * 18 + 10
    guard(noticeHeight + 6)
    doc.setFillColor(239, 246, 255) // bleu très pâle
    doc.setDrawColor(...C.blue)
    doc.roundedRect(ml, y, contentW, noticeHeight, 2, 2, "FD")

    // Titre notice
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...C.blue)
    doc.text(
        "ℹ  Informations obligatoires – Réponse à votre demande d'accès (Art. 15 RGPD)",
        ml + 4,
        y + 6
    )
    y += 11

    noticeItems.forEach(({ label, text }) => {
        guard(20)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(7.5)
        doc.setTextColor(...C.dark)
        doc.text(`${label} :`, ml + 4, y)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...C.mid)
        const lines = doc.splitTextToSize(text, contentW - 8)
        doc.text(lines, ml + 4, y + 4)
        y += lines.length * 4 + 7
    })

    y += 6

    // ── 1. IDENTITÉ & COORDONNÉES ───────────────────────────────────────────
    sectionTitle("1. Identité & Coordonnées")
    row("Nom complet", customer?.nom)
    row("Société", customer?.societe)
    row("Tél. personnel", customer?.telephone)
    row("Tél. professionnel", customer?.telephone_2)
    row("Email personnel", customer?.mail)
    row("Email professionnel", customer?.mail_2)
    row("Localisation", customer?.localisation)
    row("Instagram", customer?.insta)
    row("Étape pipeline", PIPELINE_LABELS_PDF[customer?.collum ?? 0])
    row(
        "Créé le",
        customer?.created_at
            ? new Date(customer.created_at).toLocaleDateString("fr-FR")
            : undefined
    )
    row(
        "Prise en charge",
        customer?.prise_en_charge
            ? new Date(customer.prise_en_charge).toLocaleDateString("fr-FR")
            : undefined
    )
    row("Setter", customer?.customer?.full_name ?? undefined)
    row("Closer", customer?.closers?.full_name ?? undefined)
    if (customer?.message) row("Message", customer.message)
    y += 4

    // ── 2. INFORMATIONS SOCIÉTÉ ──────────────────────────────────────────────
    if (customer?.siret || customer?.numero_TVA) {
        sectionTitle("2. Informations Société")
        row("SIRET", customer?.siret)
        row("N° TVA", customer?.numero_TVA)
        y += 4
    }

    // ── 3. PROFIL COMMERCIAL ────────────────────────────────────────────────
    sectionTitle("3. Profil Commercial")
    row("Type d'activité", fiche?.activiteType)
    row("Canal de vente", fiche?.boutiqueType as string)
    row("Budget", fiche?.budget ? String(fiche.budget) : undefined)
    row("Expérience", fiche?.experience)
    row("Horizon projet", fiche?.Horizon)
    row("Provenance", fiche?.provenance)
    row("Ville", fiche?.ville)
    row("Pays", fiche?.pays)
    row("Vintage", fiche?.vintage ? "Oui" : undefined)
    if (Array.isArray(fiche?.plateformes) && fiche.plateformes.length)
        row("Plateformes", fiche.plateformes.join(", "))
    if (Array.isArray(fiche?.marques) && fiche.marques.length)
        row("Marques", fiche.marques.join(", "))
    if (Array.isArray(fiche?.besoinsFemme) && fiche.besoinsFemme.length)
        row("Styles", fiche.besoinsFemme.join(", "))
    if (Array.isArray(fiche?.Matiere) && fiche.Matiere.length)
        row("Matières", fiche.Matiere.join(", "))
    if (fiche?.approvisionnement)
        row("Approvisionnement", fiche.approvisionnement)
    if (fiche?.Note) row("Notes", fiche.Note)
    y += 4

    // ── 4. HISTORIQUE DES INTERACTIONS ─────────────────────────────────────
    const clientActivites = activites
        .filter((a) => {
            return a.client === customer?.id
        })
        .sort(
            (a, b) =>
                new Date(b.date ?? "").getTime() -
                new Date(a.date ?? "").getTime()
        )

    sectionTitle(`4. Historique des Interactions (${clientActivites.length})`)
    if (clientActivites.length === 0) {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(8)
        doc.setTextColor(...C.light)
        doc.text("Aucune interaction enregistrée.", ml + 3, y)
        y += 8
    } else {
        clientActivites.forEach((act) => {
            const dateStr = act.date
                ? new Date(act.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                  })
                : "—"
            bullet(`${act.title ?? "Interaction"} — ${dateStr}`, act.content)
        })
    }
    y += 4

    // ── 5. TÂCHES ────────────────────────────────────────────────────────────
    const clientTasks = allTache.filter((t) => {
        const cid = typeof t.client === "object" ? t.client?.id : t.client
        return cid === customer?.id
    })

    sectionTitle(`5. Tâches (${clientTasks.length})`)
    if (clientTasks.length === 0) {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(8)
        doc.setTextColor(...C.light)
        doc.text("Aucune tâche planifiée.", ml + 3, y)
        y += 8
    } else {
        clientTasks.forEach((t) => {
            const dateStr = t.date
                ? new Date(t.date).toLocaleDateString("fr-FR")
                : "—"
            const status = t.valide ? "✓ Terminée" : "En cours"
            bullet(`[${t.type}] ${dateStr} — ${status}`, t.content)
        })
    }
    y += 4

    // ── 6. RENDEZ-VOUS ───────────────────────────────────────────────────────
    const clientEvents = events
        .filter((e) => e.id_client === customer?.id)
        .sort(
            (a, b) =>
                new Date(b.debut ?? "").getTime() -
                new Date(a.debut ?? "").getTime()
        )

    sectionTitle(`6. Rendez-vous Calendrier (${clientEvents.length})`)
    if (clientEvents.length === 0) {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(8)
        doc.setTextColor(...C.light)
        doc.text("Aucun rendez-vous enregistré.", ml + 3, y)
        y += 8
    } else {
        clientEvents.forEach((evt) => {
            const dateStr = evt.debut
                ? new Date(evt.debut).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                  })
                : "—"
            bullet(`${evt.nom ?? "RDV"} — ${dateStr}`, evt.description)
        })
    }

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const total = doc.getNumberOfPages()
    for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        doc.setDrawColor(...C.light)
        doc.line(ml, 284, pageW - ml, 284)
        doc.setFont("helvetica", "italic")
        doc.setFontSize(6.5)
        doc.setTextColor(...C.light)
        doc.text(
            `Document généré conformément au RGPD – Art. 15 (Droit d'accès) – ${new Date().toLocaleDateString("fr-FR")} – Page ${i}/${total}`,
            ml,
            289
        )
    }

    const fileName = `RGPD_${(customer?.nom ?? "client").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(fileName)
}

// ---------------------------------------------------------------------------

const calculateHandlingTime = (
    createdStr?: string | null,
    handledStr?: string | null
) => {
    if (!createdStr || !handledStr) return null
    const start = new Date(createdStr.replace(" ", "T")).getTime()
    const end = new Date(handledStr.replace(" ", "T")).getTime()
    if (isNaN(start) || isNaN(end)) return null
    let diff = end - start
    if (diff < 0) diff = 0
    const totalSeconds = Math.floor(diff / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

const ClientSidebar = memo(function ClientSidebar({
    setOpenEventModal,
}: {
    setOpenEventModal: (v: boolean) => void
}) {
    const { user } = useAuth()
    const {
        customer,
        setCustomer,
        clients,
        setEdit,
        setEvent,
        setActiveTab,
        setFicheclient,
        create_Tache,
        update_fiche_client,
        fetchOneClient,
        creationEvent,
        setCreationevent,
        events,
        setEventToEdit,
        setUpdate,
        setSelectedEventInfo,
        setDate,
        search,
        fiche,
        activites,
        clientTaches,
        confirm_event,
    } = useCRMContext()

    const createTask = create_Tache as (task: Partial<Tache>) => Promise<void>
    const [openSpecialModal, setOpenSpecialModal] = useState(false)
    // Édition du client en overlay AU-DESSUS de la fiche (état local dédié) :
    // on ne réutilise pas le `creationclient` global pour ne pas avoir à fermer
    // la fiche ni à basculer sur l'onglet « customers ».
    const [editOpen, setEditOpen] = useState(false)

    // Historique complet des RDV du client (l'agenda ne garde qu'une fenêtre).
    const clientEvents = useClientEvents(customer?.id)

    // Fusion dédupliquée : la version temps réel de `events` (confirmation,
    // édition pendant que la fiche est ouverte) prime sur la liste figée.
    const clientAppointments = useMemo(() => {
        if (!customer?.id) return []
        const live = (events ?? []).filter(
            (evt: Event_creation) => evt.id_client === customer.id
        )
        const seen = new Set(live.map((evt: Event_creation) => evt.id))
        return [
            ...live,
            ...clientEvents.filter((evt) => !seen.has(evt.id)),
        ].sort(
            (a: Event_creation, b: Event_creation) =>
                safeDateMs(b.debut) - safeDateMs(a.debut)
        )
    }, [events, clientEvents, customer?.id])

    const lastThreeAppointments = useMemo(
        () => clientAppointments.slice(0, 3),
        [clientAppointments]
    )

    const { hasPrev, hasNext, handlePrev, handleNext } = useMemo(() => {
        if (!clients || !customer)
            return {
                hasPrev: false,
                hasNext: false,
                handlePrev: () => {},
                handleNext: () => {},
            }
        const getBudget = (c: Client) =>
            c.brief && typeof c.brief === "object" && "budget" in c.brief
                ? Number(c.brief.budget) || 0
                : 0
        let allOrderedClients: Client[] = []
        columnNames.forEach((_, colIndex) => {
            const colClients = clients.filter(
                (c) => (c.collum || 0) === colIndex
            )
            colClients.sort((a, b) => getBudget(b) - getBudget(a))
            allOrderedClients = [...allOrderedClients, ...colClients]
        })
        const currentIndex = allOrderedClients.findIndex(
            (c) => c.id === customer.id
        )
        // Les objets de `allOrderedClients` viennent de la liste légère
        // (CLIENT_LIST_SELECT) qui n'inclut pas localisation, telephone_2,
        // mail_2, message, insta… On recharge donc la version COMPLÈTE via
        // fetchOneClient pour que la fiche affiche toutes les infos, comme à
        // l'ouverture normale. setCustomer immédiat = navigation réactive,
        // puis remplacement par la donnée serveur complète.
        const goTo = async (target: Client) => {
            setCustomer(target)
            if (!target.id) return
            const fresh = await fetchOneClient(target.id)
            if (fresh) setCustomer(fresh)
        }
        return {
            hasPrev: currentIndex > 0,
            hasNext: currentIndex < allOrderedClients.length - 1,
            handlePrev: () =>
                currentIndex > 0 && goTo(allOrderedClients[currentIndex - 1]),
            handleNext: () =>
                currentIndex < allOrderedClients.length - 1 &&
                goTo(allOrderedClients[currentIndex + 1]),
        }
    }, [clients, customer, setCustomer, fetchOneClient])

    // Témoin visuel de navigation : "prev"/"next" pendant ~450 ms, puis null.
    // Déclenché aussi bien par les flèches du clavier que par les boutons.
    const [pulseDir, setPulseDir] = useState<"prev" | "next" | null>(null)
    const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pulseNav = useCallback((dir: "prev" | "next") => {
        setPulseDir(dir)
        if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
        pulseTimerRef.current = setTimeout(() => setPulseDir(null), 450)
    }, [])
    useEffect(
        () => () => {
            if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
        },
        []
    )

    const goPrev = useCallback(() => {
        if (!hasPrev) return
        pulseNav("prev")
        handlePrev()
    }, [hasPrev, handlePrev, pulseNav])
    const goNext = useCallback(() => {
        if (!hasNext) return
        pulseNav("next")
        handleNext()
    }, [hasNext, handleNext, pulseNav])

    const actions = useMemo(
        () => ({
            // Ouvre le formulaire d'édition par-dessus la fiche, sans la fermer.
            editProfile: () => setEditOpen(true),
            createEvent: () => {
                setEvent(null)
                setEdit(false)
                // setOpenEventModal est ici l'adaptateur (boolean → id) passé
                // par fiche.tsx ; true → ouvre la modale pour le customer courant.
                setOpenEventModal(true)
            },
            quickRDV: () => {
                setEventToEdit({
                    id: undefined,
                    description: "",
                    debut: "",
                    fin: "",
                    nom: "other",
                    clientProfile: customer,
                    client: customer?.nom,
                    id_client: customer?.id,
                    participants: "",
                    lieu: "",
                })
                setCreationevent(true)
            },
            takeLead: async () => {
                if (!customer?.id || !user?.user_id) return

                // Mise à jour optimiste immédiate — utilise user.full_name (profil DB)
                // et non user.user_metadata?.full_name (metadata auth, souvent absent).
                setCustomer({
                    ...customer,
                    customer: {
                        user_id: user.user_id,
                        id: user.user_id,
                        full_name: user.full_name ?? null,
                    },
                    collum: 1,
                } as unknown as Client)

                // Un seul appel DB (customer + collum en même temps) plutôt que deux.
                // take_lead appelait update_fiche_client sans collum, puis on rappelait
                // update_fiche_client avec collum — double écriture inutile.
                // On passe `customer` en OBJET joint (et non en UUID brut) pour que
                // la mise à jour optimiste de clients[] conserve la forme
                // {id,user_id,full_name} ; sinon la fiche resynchronisée depuis
                // clients[] perdrait le nom du setter (« Non assigné »).
                await update_fiche_client({
                    id: customer.id,
                    collum: 1,
                    customer: {
                        id: user.user_id,
                        user_id: user.user_id,
                        full_name: user.full_name ?? null,
                    },
                } as Parameters<typeof update_fiche_client>[0])

                // Rafraîchir customer avec la vraie donnée serveur (full_name vérifié,
                // relations jointes) pour éviter que l'état reste sur la valeur optimiste.
                const fresh = await fetchOneClient(customer.id)
                if (fresh) setCustomer(fresh)
            },
        }),
        [
            customer,
            user,
            setFicheclient,
            setActiveTab,
            setEvent,
            setEdit,
            setOpenEventModal,
            setCreationevent,
            setEventToEdit,
            setCustomer,
            update_fiche_client,
            fetchOneClient,
        ]
    )

    const handlingTime = useMemo(
        () =>
            calculateHandlingTime(
                customer?.created_at,
                customer?.prise_en_charge
            ),
        [customer?.created_at, customer?.prise_en_charge]
    )

    // Navigation au clavier entre fiches client : ← précédent, → suivant.
    // Désactivée quand on saisit dans un champ ou qu'un overlay est ouvert.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return

            const el = e.target as HTMLElement | null
            const typing =
                !!el &&
                (el.tagName === "INPUT" ||
                    el.tagName === "TEXTAREA" ||
                    el.tagName === "SELECT" ||
                    el.isContentEditable)
            if (typing) return
            if (editOpen || openSpecialModal || creationEvent) return

            if (e.key === "ArrowLeft") {
                e.preventDefault()
                goPrev()
            } else if (e.key === "ArrowRight") {
                e.preventDefault()
                goNext()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [goPrev, goNext, editOpen, openSpecialModal, creationEvent])

    return (
        <div className="w-full shrink-0 flex flex-col sticky top-0 h-[calc(100vh-5rem)] overflow-hidden z-10 bg-background border-l">
            {" "}
            <div className="flex flex-col flex-1 overflow-y-auto p-5 space-y-6 scrollbar-none">
                <UserProfile
                    customer={customer}
                    onEdit={actions.editProfile}
                    hasPrev={hasPrev}
                    hasNext={hasNext}
                    onPrev={goPrev}
                    onNext={goNext}
                    pulseDir={pulseDir}
                    search={search}
                    updateFiche={update_fiche_client}
                    setCustomer={setCustomer}
                />

                {customer && customer.customer?.user_id !== user?.user_id && (
                    <Button
                        onClick={actions.takeLead}
                        className="w-full shadow-md font-bold"
                        variant="default"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Prendre le lead
                    </Button>
                )}

                <Separator />

                <QuickActions
                    customer={customer}
                    actions={actions}
                    onSpecial={() => setOpenSpecialModal(true)}
                />

                <Separator />

                <ClientInfo customer={customer} />

                <UpcomingEvents
                    appointments={lastThreeAppointments}
                    onEventClick={(evt) => {
                        setSelectedEventInfo?.(evt)
                        if (evt.debut) setDate?.(new Date(evt.debut))
                        setUpdate(false)
                        setCreationevent(false)
                        setActiveTab?.("calendar")
                        setFicheclient(false)
                    }}
                    onConfirm={(evt) => confirm_event(evt)}
                />

                {customer?.message && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-800 dark:text-yellow-200 italic shadow-sm">
                        &quot;{customer.message}&quot;
                    </div>
                )}
            </div>
            <div className="mt-auto sticky bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur z-20 shadow-[0_-15px_15px_-15px_rgba(0,0,0,0.1)]">
                <div className="px-3 pt-2 pb-1 flex flex-col items-center gap-1.5 text-center text-[10px]">
                    {handlingTime && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded font-medium border border-success/30 text-xs">
                            <Timer className="h-3 w-3" />
                            <span>Pris en charge en : {handlingTime}</span>
                        </div>
                    )}
                    <p className="text-muted-foreground font-mono uppercase tracking-wider">
                        Updated:{" "}
                        {customer?.updated_at
                            ? format(
                                  new Date(customer.updated_at),
                                  "dd/MM/yyyy HH:mm"
                              )
                            : "N/A"}
                    </p>
                </div>

                {/* Bouton export RGPD */}
                <div className="px-3 pb-3">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!customer}
                        onClick={() =>
                            generateClientRGPDPDF(
                                customer,
                                fiche,
                                activites,
                                clientTaches,
                                clientAppointments
                            )
                        }
                        className="w-full h-8 text-[10px] gap-1.5 text-muted-foreground hover:text-foreground border-dashed"
                    >
                        <Download className="h-3 w-3" />
                        Export RGPD (Art. 15)
                    </Button>
                </div>
            </div>
            {creationEvent && <CreateEvent update={false} />}
            {/* Édition du client en overlay au-dessus de la fiche (Dialog Radix
                porté sur le body) — la fiche reste ouverte derrière. */}
            {editOpen && customer && (
                <Createclient
                    client={customer}
                    setCreationclient={setEditOpen}
                />
            )}
            <SpecialTaskModal
                open={openSpecialModal}
                onOpenChange={setOpenSpecialModal}
                client={customer}
                user={user}
                create_Tache={createTask}
            />
        </div>
    )
})

// --- SOUS-COMPOSANTS ---

interface UserProfileProps {
    customer: Client | null | undefined
    onEdit: () => void
    hasPrev: boolean
    hasNext: boolean
    onPrev: () => void
    onNext: () => void
    pulseDir: "prev" | "next" | null
    search: AssignableUser[] | undefined
    updateFiche: UpdateFicheFn
    setCustomer: (c: Client) => void
}

const UserProfile = ({
    customer,
    onEdit,
    hasPrev,
    hasNext,
    onPrev,
    onNext,
    pulseDir,
    search,
    updateFiche,
    setCustomer,
}: UserProfileProps) => {
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
    const [distance, setDistance] = useState<DistanceResult | null>(null)

    const initials = customer?.nom
        ? customer.nom
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase()
        : "CL"

    const dest = customer?.localisation?.trim() || ""

    useEffect(() => {
        if (!dest) return
        calculateDistance(dest)
            .then(setDistance)
            .catch(() => setDistance(null))
    }, [dest])

    const setterName = useMemo(
        () => customer?.customer?.full_name || "Non assigné",
        [customer]
    )
    const closerName = useMemo(
        () => customer?.closers?.full_name || "Non assigné",
        [customer]
    )

    return (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-2 duration-slower">
            <div className="flex items-center justify-between w-full px-4 mb-2">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onPrev}
                    disabled={!hasPrev}
                    className={cn(
                        "rounded-full h-8 w-8 shadow-sm transition-[color,background-color,border-color,box-shadow,transform] border",
                        "bg-card text-foreground border-border hover:bg-muted",
                        pulseDir === "prev" &&
                            "ring-2 ring-primary ring-offset-0 ring-offset-background scale-110 border-primary text-primary"
                    )}
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="relative group">
                    <Avatar className="w-20 h-20 border-4 shadow-lg group-hover:scale-105 transition-transform border-white dark:border-slate-950">
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            "absolute bottom-0 right-0 h-7 w-7 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity border",
                            "bg-card text-primary border-border hover:bg-primary/10"
                        )}
                        onClick={onEdit}
                    >
                        <Edit className="h-3 w-3" />
                    </Button>
                </div>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={onNext}
                    disabled={!hasNext}
                    className={cn(
                        "rounded-full h-8 w-8 shadow-sm transition-[color,background-color,border-color,box-shadow,transform] border",
                        "bg-card text-foreground border-border hover:bg-muted",
                        pulseDir === "next" &&
                            "ring-2 ring-primary ring-offset-0 ring-offset-background scale-110 border-primary text-primary"
                    )}
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            <h2 className="text-lg font-bold mt-1 text-center line-clamp-1">
                {customer?.nom}
            </h2>

            {customer?.id && (
                <span className="text-[10px] text-muted-foreground font-mono select-all">
                    ID: {customer.id}
                </span>
            )}

            <Badge variant="secondary" className="mt-1 text-[10px] opacity-80">
                {customer?.collum === 0
                    ? "Nouveau lead"
                    : columnNames[customer?.collum || 0]}
            </Badge>

            {/* ✅ Encadrés CLIQUABLES pour le Setter et le Closer */}
            <div className="flex items-center gap-3 mt-4 w-full px-1">
                <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="flex-1 flex flex-col items-center bg-muted/40 border border-border/60 rounded-xl p-2 shadow-sm hover:ring-2 hover:ring-primary/40 transition-shadow cursor-pointer group"
                >
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5 group-hover:text-primary transition-colors">
                        Setter
                    </span>
                    <span className="text-xs font-bold text-foreground truncate w-full text-center">
                        {setterName}
                    </span>
                </button>
                <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="flex-1 flex flex-col items-center bg-primary/5 border border-primary/20 rounded-xl p-2 shadow-sm hover:ring-2 hover:ring-primary transition-shadow cursor-pointer group"
                >
                    <span className="text-[9px] font-bold text-primary/70 uppercase tracking-widest mb-0.5 group-hover:text-primary transition-colors">
                        Closer
                    </span>
                    <span className="text-xs font-bold text-primary truncate w-full text-center">
                        {closerName}
                    </span>
                </button>
            </div>

            {distance && (
                <div className="mt-3 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full flex items-center gap-1.5">
                    <Route className="h-3 w-3" />
                    {formatDistance(distance)}
                </div>
            )}

            {/* Modale d'assignation */}
            <AssignRolesModal
                open={isAssignModalOpen}
                onOpenChange={setIsAssignModalOpen}
                customer={customer}
                search={search}
                updateFiche={updateFiche}
                setCustomer={setCustomer}
            />
        </div>
    )
}

interface AssignRolesModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customer: Client | null | undefined
    search: AssignableUser[] | undefined
    updateFiche: UpdateFicheFn
    setCustomer: (c: Client) => void
}

function AssignRolesModal({
    open,
    onOpenChange,
    customer,
    search,
    updateFiche,
    setCustomer,
}: AssignRolesModalProps) {
    const [setterId, setSetterId] = useState<string>("")
    const [closerId, setCloserId] = useState<string>("")
    const [loading, setLoading] = useState(false)

    // Initialisation des valeurs par défaut à l'ouverture de la modale.
    // Reset de formulaire contrôlé sur transition d'ouverture : les valeurs
    // sont ensuite éditables par l'utilisateur, donc non dérivables via useMemo.
    useEffect(() => {
        if (open && customer) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- reset de form contrôlé à l'ouverture de la modale (état ensuite édité par l'utilisateur)
            setSetterId(
                customer.customer?.user_id || customer.customer?.id || "none"
            )
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- reset de form contrôlé à l'ouverture de la modale (état ensuite édité par l'utilisateur)
            setCloserId(
                customer.closers?.user_id || customer.closers?.id || "none"
            )
        }
    }, [open, customer])

    const handleSave = async () => {
        if (!customer?.id) return
        setLoading(true)

        const finalSetterId = setterId === "none" ? null : setterId
        const finalCloserId = closerId === "none" ? null : closerId

        // On recrée les objets de relation {id,user_id,full_name} attendus par
        // clients[]/la fiche. On les passe à updateFiche (qui en extrait l'UUID
        // pour la DB) ET on les réutilise pour la mise à jour optimiste locale :
        // ainsi la liste optimiste garde la forme objet et la fiche
        // resynchronisée depuis clients[] n'affiche plus « Non assigné ».
        const newSetterObj = search?.find(
            (u) => u.user_id === finalSetterId || u.id === finalSetterId
        )
        const newCloserObj = search?.find(
            (u) => u.user_id === finalCloserId || u.id === finalCloserId
        )
        const setterRelation = newSetterObj
            ? {
                  id: newSetterObj.id,
                  user_id: newSetterObj.user_id,
                  full_name: newSetterObj.full_name || newSetterObj.name,
              }
            : null
        const closerRelation = newCloserObj
            ? {
                  id: newCloserObj.id,
                  user_id: newCloserObj.user_id,
                  full_name: newCloserObj.full_name || newCloserObj.name,
              }
            : null

        try {
            await updateFiche({
                id: customer.id,
                customer: setterRelation, // Le Setter (objet joint ou null)
                closers: closerRelation, // Le Closer (objet joint ou null)
            })

            setCustomer({
                ...customer,
                customer: setterRelation,
                closers: closerRelation,
            })

            onOpenChange(false)
        } catch (error) {
            console.error("Erreur lors de l'assignation:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Assigner les rôles</DialogTitle>
                </DialogHeader>
                <div className="grid gap-5 py-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                            Setter (Créateur)
                        </label>
                        <Select value={setterId} onValueChange={setSetterId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un Setter" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    value="none"
                                    className="text-muted-foreground italic"
                                >
                                    Non assigné
                                </SelectItem>
                                {search?.map((u) => (
                                    <SelectItem
                                        key={u.user_id || u.id}
                                        value={u.user_id || u.id || ""}
                                    >
                                        {u.full_name || u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-primary/80 uppercase tracking-widest">
                            Closer (Assigné)
                        </label>
                        <Select value={closerId} onValueChange={setCloserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un Closer" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    value="none"
                                    className="text-muted-foreground italic"
                                >
                                    Non assigné
                                </SelectItem>
                                {search?.map((u) => (
                                    <SelectItem
                                        key={u.user_id || u.id}
                                        value={u.user_id || u.id || ""}
                                    >
                                        {u.full_name || u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Annuler
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface QuickActionsProps {
    customer: Client | null | undefined
    actions: { quickRDV: () => void; createEvent: () => void }
    onSpecial: () => void
}

const QuickActions = ({ customer, actions }: QuickActionsProps) => {
    const btns = [
        {
            show: !!customer?.mail,
            href: `mailto:${customer?.mail}`,
            icon: Mail,
            color: "text-chart-2 bg-chart-2/10",
            label: "Email",
        },
        {
            show: !!customer?.telephone,
            onClick: () => {
                if (customer?.telephone) {
                    // Remplace window.open pour éviter d'ouvrir un onglet vide
                    window.location.href = `tel:${customer.telephone}`
                }
            },
            icon: Phone,
            color: "text-chart-4 bg-chart-4/10",
            label: "Appeler",
        },
        {
            show: true,
            onClick: actions.quickRDV,
            icon: Calendar,
            color: "text-chart-5 bg-chart-5/10",
            label: "RDV Rapide",
        },
        {
            show: true,
            onClick: actions.createEvent,
            icon: Plus,
            color: "text-destructive bg-destructive/10 hover:bg-destructive/20",
            label: "Interaction",
        },
    ]

    return (
        <div className="grid grid-cols-4 gap-2">
            {btns.map(
                (btn) =>
                    btn.show && (
                        <TooltipProvider key={btn.label}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    {btn.href ? (
                                        <a
                                            href={btn.href}
                                            className={cn(
                                                "flex items-center justify-center h-10 rounded-md transition-colors shadow-sm",
                                                btn.color
                                            )}
                                        >
                                            <btn.icon className="h-4 w-4" />
                                        </a>
                                    ) : (
                                        <button
                                            onClick={btn.onClick}
                                            className={cn(
                                                "flex items-center justify-center h-10 rounded-md transition-colors shadow-sm",
                                                btn.color
                                            )}
                                        >
                                            <btn.icon className="h-4 w-4" />
                                        </button>
                                    )}
                                </TooltipTrigger>
                                <TooltipContent
                                    side="bottom"
                                    className="text-xs"
                                >
                                    <p>{btn.label}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )
            )}
        </div>
    )
}

interface ClientInfoProps {
    customer: Client | null | undefined
}

const ClientInfo = ({ customer }: ClientInfoProps) => {
    const [isOpen, setIsOpen] = useState(false)
    const [copiedLabel, setCopiedLabel] = useState<string | null>(null)

    // Fonction pour copier et gérer le feedback visuel
    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        setCopiedLabel(label)
        setTimeout(() => {
            setCopiedLabel(null)
        }, 2000)
    }

    const copyRebookLink = async (email: string) => {
        try {
            handleCopy(await ameliaBridgeService.rebookLink(email), "rebook")
        } catch (err) {
            console.warn("[CRM] rebookLink:", err)
            toast.error("Impossible de générer le lien de reprise RDV")
        }
    }

    return (
        <div className="space-y-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full p-2 text-sm font-semibold hover:bg-muted/50 rounded-md transition-colors"
            >
                <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" /> Infos
                    Client
                </span>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform duration-base",
                        isOpen && "rotate-180"
                    )}
                />
            </button>
            {isOpen && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-2">
                    {(
                        [
                            {
                                label: "Nom",
                                value: customer?.nom?.split(" ")[1],
                            },
                            {
                                label: "Prénom",
                                value: customer?.nom?.split(" ")[0],
                            },
                            {
                                label: "Société",
                                value: customer?.societe,
                                span: true,
                            },
                            {
                                label: "Téléphone Personnel",
                                value: customer?.telephone,
                                actionType: "copy",
                                span: true,
                            },
                            {
                                label: "Téléphone Professionnel",
                                value: customer?.telephone_2,
                                actionType: "copy",
                                span: true,
                            },
                            {
                                label: "Email Personnel",
                                value: customer?.mail,
                                actionType: "copy",
                                span: true,
                            },
                            {
                                label: "Email Professionnel",
                                value: customer?.mail_2,
                                actionType: "copy",
                                span: true,
                            },
                            { label: "Ville", value: customer?.localisation },
                        ] as {
                            label: string
                            value: string | null | undefined
                            actionType?: "copy"
                            span?: boolean
                        }[]
                    ).map(({ label, value, actionType, span }, index) => (
                        <div
                            key={label}
                            style={{
                                animationDelay: `${Math.min(index * 30, 210)}ms`,
                            }}
                            className={cn(
                                "flex flex-col rounded-md border border-border/50 bg-muted/20 px-3 py-2 animate-in fade-in slide-in-from-top-1 fill-mode-backwards duration-base",
                                span && "col-span-2"
                            )}
                        >
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">
                                {label}
                            </span>

                            {/* Gestion du type de clic : Copie, Lien, ou Texte simple */}
                            {actionType === "copy" && value ? (
                                <button
                                    onClick={() => handleCopy(value, label)}
                                    className="text-sm font-medium text-primary hover:underline text-left flex items-center gap-2 w-fit transition-colors"
                                >
                                    <span className="truncate">{value}</span>
                                    {copiedLabel === label && (
                                        <span className="text-[9px] text-success bg-success/10 px-1.5 py-0.5 rounded-full font-bold animate-in fade-in zoom-in duration-base">
                                            ✔️ Copié !
                                        </span>
                                    )}
                                </button>
                            ) : (
                                <span className="text-sm font-medium truncate">
                                    {value || "-"}
                                </span>
                            )}
                        </div>
                    ))}
                    {customer?.mail && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="col-span-2"
                            onClick={() => copyRebookLink(customer.mail!)}
                        >
                            <Link className="h-4 w-4" />
                            {copiedLabel === "rebook"
                                ? "✔️ Lien copié !"
                                : "Copier le lien de reprise RDV"}
                        </Button>
                    )}
                    <NewsletterOptIn client={customer} className="col-span-2" />
                </div>
            )}
        </div>
    )
}
interface UpcomingEventsProps {
    appointments: Event_creation[]
    onEventClick: (evt: Event_creation) => void
    onConfirm?: (evt: Event_creation) => void
}

const UpcomingEvents = ({
    appointments,
    onEventClick,
    onConfirm,
}: UpcomingEventsProps) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground px-2">
            <Calendar className="h-4 w-4" />
            <span>Historique RDV</span>
        </div>
        <div className="flex flex-col gap-2">
            {appointments.length > 0 ? (
                appointments.map((evt: Event_creation) => {
                    const style =
                        EVENT_CONFIG[evt.nom || ""] || EVENT_CONFIG.default
                    const debutDate = evt.debut ? new Date(evt.debut) : null
                    const debutValid =
                        debutDate && !isNaN(debutDate.getTime())
                            ? debutDate
                            : null
                    const isPast = debutValid
                        ? debutValid.getTime() < Date.now()
                        : false
                    return (
                        <div
                            key={evt.id}
                            onClick={(e) => {
                                e.stopPropagation()
                                onEventClick(evt)
                            }}
                            className={cn(
                                "relative pl-3 p-3 rounded-md border bg-card hover:bg-accent/50 cursor-pointer transition-colors shadow-sm",
                                isPast && "opacity-60"
                            )}
                        >
                            <div
                                className={cn(
                                    "absolute left-0 top-0 bottom-0 w-1 rounded-l-md",
                                    style.color.split(" ")[0]
                                )}
                            />
                            <div className="flex justify-between items-start">
                                <span className="font-medium text-sm truncate">
                                    {evt.description || "Événement"}
                                </span>
                                <Badge
                                    variant="outline"
                                    className="text-[9px] h-4 px-1"
                                >
                                    {style.label}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-sm">
                                    <Clock className="h-3 w-3" />
                                    {debutValid
                                        ? format(debutValid, "dd MMM HH:mm", {
                                              locale: fr,
                                          })
                                        : "-"}
                                </span>
                                {evt.confirmed === false && (
                                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500 font-medium">
                                        <AlertCircle className="h-3 w-3" />
                                        À confirmer
                                    </span>
                                )}
                                {evt.confirmed === false && onConfirm && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-1.5 text-[11px] text-success hover:text-success/80"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onConfirm(evt)
                                        }}
                                    >
                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                        Confirmer
                                    </Button>
                                )}
                            </div>
                        </div>
                    )
                })
            ) : (
                <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground text-xs bg-muted/10">
                    Aucun rendez-vous
                </div>
            )}
        </div>
    </div>
)

interface SpecialTaskModalProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    client: Client | null | undefined
    user: { user_id?: string } | null
    create_Tache: (task: Partial<Tache>) => Promise<void>
}

const SpecialTaskModal = ({
    open,
    onOpenChange,
    client,
    user,
    create_Tache,
}: SpecialTaskModalProps) => {
    const { search } = useCRMContext()
    const [state, setState] = useState({
        type: "",
        date: new Date().toISOString().slice(0, 10),
        content: "",
        owner: user?.user_id ?? "",
    })
    // Réinitialise l'affectation sur l'utilisateur courant à chaque ouverture.
    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- reset de form contrôlé à l'ouverture de la modale (champ owner ensuite édité par l'utilisateur)
        if (open) setState((s) => ({ ...s, owner: user?.user_id ?? "" }))
    }, [open, user?.user_id])
    const handleSubmit = async () => {
        if (!state.type || !state.content || !client?.id) return
        const d = state.date ? new Date(state.date) : new Date()
        const safeDate = isNaN(d.getTime()) ? new Date() : d
        await create_Tache({
            type: state.type,
            client: client.id,
            content: state.content,
            date: safeDate.toISOString(),
            owner: state.owner || user?.user_id,
        })
        onOpenChange(false)
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Nouvelle tâche</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <Select
                        onValueChange={(v) => setState({ ...state, type: v })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Type..." />
                        </SelectTrigger>
                        <SelectContent>
                            {SPECIAL_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {t}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        type="date"
                        value={state.date}
                        onChange={(e) =>
                            setState({ ...state, date: e.target.value })
                        }
                    />
                    <Select
                        value={state.owner}
                        onValueChange={(v) => setState({ ...state, owner: v })}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Assigné à..." />
                        </SelectTrigger>
                        <SelectContent>
                            {search.map((u) => (
                                <SelectItem key={u.user_id} value={u.user_id}>
                                    {u.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Textarea
                        placeholder="Détails..."
                        className="resize-none min-h-[80px]"
                        onChange={(e) =>
                            setState({ ...state, content: e.target.value })
                        }
                    />
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} className="w-full">
                        Enregistrer la tâche
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ClientSidebar
