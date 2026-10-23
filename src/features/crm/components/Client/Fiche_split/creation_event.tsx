import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type Client } from "@/features/crm/hooks/CRM_hook/use_client"
import { safeRandomUUID } from "@/shared/lib/uuid"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Switch } from "@/shared/ui/atoms/switch"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { AnimatePresence, motion } from "framer-motion"
import {
    Calendar,
    CheckCircle2,
    MessageSquare,
    Clock,
    Plus,
    UserCheck,
    X,
} from "lucide-react"
import React, { useEffect, useState } from "react"

import type { Variants } from "framer-motion"
import type { Tache } from "@/features/crm/hooks/CRM_hook/use_tache"
import {
    buildEventFormState,
    rdvValidationError,
    secondRdvFrom,
    toLocalDateStr,
    toLocalTimeStr,
    type RdvState,
} from "@/features/crm/utils/eventForm"
import { CRM_TASK_TYPES as TASK_TYPES } from "@/features/crm/utils/taskTypes"
import { RdvFields } from "./RdvFields"

const Tache_TYPES = [
    { val: "appel", label: "Appel" },
    { val: "message", label: "Message" },
    { val: "mail", label: "Mail" },
    { val: "qualification", label: "Qualification" },
    { val: "Rdv decouverte visio", label: "Rdv decouverte visio" },
    { val: "Rdv decouverte physique", label: "Rdv decouverte physique" },
    { val: "Rdv achat", label: "Rdv achat" },
]

const RELANCE_DELAY_OPTIONS = [
    { label: "Dans 1 jour", value: "1d", days: 2 },
    { label: "Dans 1 semaine", value: "1w", days: 7 },
    { label: "Dans 1 mois", value: "1m", days: 30 },
    { label: "Date personnalisée", value: "custom", days: 0 },
]

interface AddEventModalProps {
    client?: Client
    open: boolean
    onOpenChange: (open: boolean) => void
}

export const AddEventModal: React.FC<AddEventModalProps> = ({
    client,
    open,
    onOpenChange,
}) => {
    const { user } = useAuth()
    const {
        event,
        edit,
        update_Activites,
        create_activites,
        create_event_calendar,
        create_Tache,
        search,
        fetch_research,
        fetchOneClient,
        setCustomer,
        setSelectedClient,
        customer,
        selectedClient,
    } = useCRMContext()

    const now = new Date()

    // --- ÉTATS ---
    const [mainActivity, setMainActivity] = useState(() => ({
        title: "",
        date: toLocalDateStr(now),
        time: toLocalTimeStr(now),
        description: "",
    }))

    const [rdvData, setRdvData] = useState(() => ({
        enabled: false,
        type: "",
        owner: "",
        startDate: toLocalDateStr(now),
        startTime: "12:00",
        endDate: toLocalDateStr(now),
        endTime: "13:00",
        description: "",
    }))

    // Second RDV planifié depuis la même interaction (même créneau par défaut :
    // deux RDV en même temps). `null` : un seul RDV.
    const [secondRdv, setSecondRdv] = useState<RdvState | null>(null)

    const [taskData, setTaskData] = useState(() => ({
        enabled: false,
        type: "",
        owner: "",
        date: toLocalDateStr(now),
        time: "",
        content: "",
    }))

    // État lié à la valeur du select de délai (pour pouvoir le basculer sur "custom")
    const [selectedDelayValue, setSelectedDelayValue] = useState("")

    const [isSubmitting, setIsSubmitting] = useState(false)

    // Sur téléphone, les colonnes RDV/Tâche empilent en pleine largeur plutôt
    // que de garder leur largeur fixe desktop (320/300px) — columnVariants
    // s'appuie dessus pour cibler "100%" au lieu du pixel fixe.
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 639px)")
        const update = () => {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- mesure du viewport (matchMedia), non dérivable au rendu
            setIsMobile(mq.matches)
        }
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])

    // Chargement des profils
    useEffect(() => {
        if (open) fetch_research()
    }, [open, fetch_research])

    // L'affectation par défaut de la tâche (utilisateur courant) est gérée par
    // buildEventFormState lors de la réinitialisation à l'ouverture ci-dessous.

    // --- EFFETS ---
    // Réinitialise le formulaire à CHAQUE ouverture (création comme édition).
    // Sans ça, le composant restant monté entre deux ouvertures (singleton de
    // l'onglet), une fermeture via overlay/Échap qui contourne handleClose, ou
    // un passage édition → création laissait des données périmées à l'écran.
    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect --
       Réinitialisation volontaire d'un formulaire éditable depuis des props externes
       (open/edit/event) : il faut repartir d'un état propre à chaque ouverture, ce qui
       n'est pas exprimable en valeur dérivée. */
    useEffect(() => {
        if (!open) return
        const s = buildEventFormState(edit, event, user?.user_id, new Date())
        setMainActivity(s.mainActivity)
        setRdvData(s.rdvData)
        setSecondRdv(null)
        setTaskData(s.taskData)
        setSelectedDelayValue(s.selectedDelayValue)
    }, [open, edit, event, user?.user_id])
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

    // --- HANDLERS ---
    // Les « Notes RDV » reprennent le compte-rendu : tant qu'un RDV n'a pas été
    // annoté à part (notes identiques à l'ancien compte-rendu), elles suivent la
    // saisie. Dès que l'utilisateur les modifie, elles ne sont plus écrasées.
    const handleCompteRenduChange = (value: string) => {
        const previous = mainActivity.description
        const sync = <T extends { description: string }>(r: T): T =>
            r.description === previous ? { ...r, description: value } : r
        setMainActivity((p) => ({ ...p, description: value }))
        setRdvData(sync)
        setSecondRdv((r) => r && sync(r))
    }

    // Active le RDV et, pour un nouveau RDV (type vide), pré-remplit des créneaux
    // par défaut (J+3, 10h-11h). Logique déplacée hors d'un effet pour ne pas
    // dériver l'état depuis un autre état dans un useEffect.
    const handleRdvToggle = (enabled: boolean) => {
        if (!enabled) setSecondRdv(null)
        setRdvData((prev) => {
            if (!enabled) return { ...prev, enabled }
            if (!prev.description)
                prev = { ...prev, description: mainActivity.description }
            if (prev.type !== "") return { ...prev, enabled }
            const baseDate = mainActivity.date
                ? new Date(mainActivity.date)
                : new Date()
            const rdvStart = new Date(
                baseDate.getTime() + 3 * 24 * 60 * 60 * 1000
            )
            if (isNaN(rdvStart.getTime())) return { ...prev, enabled }
            const dateStr = rdvStart.toISOString().slice(0, 10)
            return {
                ...prev,
                enabled,
                startDate: dateStr,
                endDate: dateStr,
                startTime: "10:00",
                endTime: "11:00",
            }
        })
    }

    // Déclenché par le bouton d'enregistrement, jamais par une soumission de
    // formulaire (aucun `onSubmit` ici) : il n'y a pas d'évènement à recevoir
    // ni à neutraliser.
    const handleSubmit = async () => {
        if (isSubmitting) return

        if (!mainActivity.title)
            return alert("Veuillez sélectionner un type d'échange.")
        if (!mainActivity.description)
            return alert("Le compte-rendu est requis.")

        const activityDate = new Date(
            `${mainActivity.date}T${mainActivity.time || "00:00"}`
        )

        if (!client?.id) return alert("Client introuvable.")

        // Tous les contrôles AVANT le premier envoi : sinon l'activité part
        // alors qu'un RDV invalide interrompt l'enregistrement.
        const rdvs = rdvData.enabled
            ? [rdvData, ...(secondRdv ? [secondRdv] : [])]
            : []
        for (const [i, rdv] of rdvs.entries()) {
            const error = rdvValidationError(rdv)
            if (error) return alert(rdvs.length > 1 ? `RDV ${i + 1} : ${error}` : error)
        }
        if (taskData.enabled) {
            if (!taskData.type)
                return alert("Veuillez choisir un type de tâche.")
            // Pour les relances, on veut au moins une date. Pour les autres, du contenu.
            if (taskData.type === "Relance" && !taskData.date) {
                return alert("Veuillez définir une date pour la relance.")
            }
            if (taskData.type !== "Relance" && !taskData.content) {
                return alert("Veuillez ajouter des détails à votre tâche.")
            }
        }
        if (edit && !event?.id) return alert("Identifiant d'activité manquant.")

        const activiteBasePayload = {
            id: safeRandomUUID(),
            client: client.id,
            title: mainActivity.title,
            date: activityDate.toISOString(),
            content: mainActivity.description,
            owner: user?.user_id,
        }

        const promises = []

        if (edit && event?.id) {
            promises.push(
                update_Activites({ ...activiteBasePayload, id: event.id })
            )
        } else {
            promises.push(create_activites(activiteBasePayload))
        }

        for (const rdv of rdvs) {
            const start = new Date(`${rdv.startDate}T${rdv.startTime}`)
            const end = new Date(`${rdv.endDate}T${rdv.endTime}`)
            promises.push(
                create_event_calendar({
                    nom: rdv.type,
                    id_client: client.id,
                    debut: start.toISOString(),
                    fin: end.toISOString(),
                    participants: client.nom || "",
                    mail: [client.mail, client.mail_2].filter(
                        Boolean
                    ) as string[],
                    lieu: "",
                    description: rdv.description || "RDV Client",
                    creator_id: user?.user_id || "",
                    owner: rdv.owner || user?.user_id || "",
                })
            )
        }

        if (taskData.enabled) {
            const finalDate = taskData.date
                ? new Date(`${taskData.date}T${taskData.time || "00:00"}`)
                : new Date()

            promises.push(
                create_Tache({
                    type: taskData.type,
                    client: client.id,
                    content: taskData.content,
                    date: finalDate.toISOString(),
                    owner: taskData.owner || user?.user_id,
                } as Tache)
            )
        }

        try {
            setIsSubmitting(true)
            await Promise.all(promises)

            // À la création d'un RDV, un trigger DB affecte le closer du client
            // (client_crm.closers = owner du RDV). On rafraîchit la fiche affichée
            // pour que le closer apparaisse EN DIRECT, sans recharger la page.
            if (rdvData.enabled && client?.id) {
                const full = await fetchOneClient(client.id)
                if (full) {
                    if (customer?.id === full.id) setCustomer(full)
                    if (selectedClient?.id === full.id) setSelectedClient(full)
                }
            }

            handleClose()
        } catch (error) {
            console.error("Erreur lors de la sauvegarde multiple:", error)
            alert("Une erreur est survenue lors de l'enregistrement.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        const resetNow = new Date()
        setMainActivity({
            title: "",
            date: toLocalDateStr(resetNow),
            time: toLocalTimeStr(resetNow),
            description: "",
        })
        setRdvData({
            enabled: false,
            type: "",
            owner: "",
            startDate: "",
            startTime: "12:00",
            endDate: "",
            endTime: "13:00",
            description: "",
        })
        setSecondRdv(null)
        setTaskData({
            enabled: false,
            type: "",
            owner: user?.user_id ?? "",
            date: toLocalDateStr(resetNow),
            time: "",
            content: "",
        })
        setSelectedDelayValue("")
        onOpenChange(false)
    }

    // Largeur cible passée via `custom` (px) : on anime vers une largeur FIXE
    // et non `"auto"`, sinon le panneau suit la taille de son contenu et se
    // rétrécit quand on masque des champs (ex. type "Relance"). Sur mobile
    // (empilement vertical), on cible "100%" plutôt que le pixel fixe desktop.
    const columnVariants: Variants = {
        hidden: { opacity: 0, x: 20, width: 0 },
        visible: (targetWidth: number) => ({
            opacity: 1,
            x: 0,
            width: isMobile ? "100%" : targetWidth,
            transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
        }),
        exit: { opacity: 0, x: 20, width: 0, transition: { duration: 0.2 } },
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] sm:w-auto max-w-[95vw] sm:min-w-[450px] max-h-[90dvh] p-0 gap-0 bg-background overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-4 border-b bg-muted/10">
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        {edit
                            ? "Modifier l'interaction"
                            : "Nouvelle interaction"}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-y-auto sm:h-[600px] sm:overflow-visible">
                    {/* === COLONNE 1 : ACTIVITÉ PRINCIPALE === */}
                    {/* motion.div + layout : sans ça, cette colonne (toujours visible) se
                        rétrécit instantanément quand un panneau RDV/Tâche s'ouvre à côté,
                        au lieu de suivre le glissement animé des autres colonnes. */}
                    <motion.div
                        layout
                        style={{ contain: "layout paint" }}
                        className="flex-1 p-4 sm:p-6 space-y-5 w-full sm:min-w-[400px] overflow-y-auto"
                    >
                        <div className="space-y-1">
                            <Label>Type d&apos;échange</Label>
                            <Select
                                value={mainActivity.title}
                                onValueChange={(v) =>
                                    setMainActivity((p) => ({ ...p, title: v }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {Tache_TYPES.map((t) => (
                                        <SelectItem key={t.val} value={t.label}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={mainActivity.date}
                                    onChange={(e) =>
                                        setMainActivity((p) => ({
                                            ...p,
                                            date: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>Heure (Optionnel)</Label>
                                <Input
                                    type="time"
                                    value={mainActivity.time}
                                    onChange={(e) =>
                                        setMainActivity((p) => ({
                                            ...p,
                                            time: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label>Compte-rendu</Label>
                            <Textarea
                                className="min-h-[150px] resize-none"
                                value={mainActivity.description}
                                onChange={(e) =>
                                    handleCompteRenduChange(e.target.value)
                                }
                                placeholder="Détails de l'échange..."
                            />
                        </div>

                        <div className="pt-4 border-t space-y-3">
                            <Label className="text-muted-foreground uppercase text-xs font-semibold tracking-wider">
                                Actions à suivre
                            </Label>

                            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`p-2 rounded-full ${rdvData.enabled ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50" : "bg-muted"}`}
                                    >
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                            Planifier un RDV
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Suite à cet échange
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={rdvData.enabled}
                                    onCheckedChange={handleRdvToggle}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`p-2 rounded-full ${taskData.enabled ? "bg-orange-100 text-orange-600 dark:bg-orange-900/50" : "bg-muted"}`}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">
                                            Créer une tâche
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            À faire plus tard
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={taskData.enabled}
                                    onCheckedChange={(c) =>
                                        setTaskData((p) => ({
                                            ...p,
                                            enabled: c,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* === COLONNES DYNAMIQUES === */}
                    <AnimatePresence mode="popLayout">
                        {rdvData.enabled && (
                            <motion.div
                                key="rdv"
                                layout
                                custom={320}
                                variants={columnVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                style={{ contain: "layout paint" }}
                                className="shrink-0 border-t sm:border-t-0 sm:border-l p-4 sm:p-6 space-y-4 overflow-y-auto overflow-x-hidden bg-blue-50/50 dark:bg-blue-950/20 border-blue-100"
                            >
                                <div className="flex items-center gap-2 font-semibold pb-2 border-b text-blue-700 dark:text-blue-300">
                                    <Calendar className="w-5 h-5" /> Détails du
                                    RDV
                                </div>
                                <RdvFields
                                    rdv={rdvData}
                                    onChange={setRdvData}
                                    users={search}
                                    currentUserId={user?.user_id}
                                />

                                {secondRdv ? (
                                    <div className="space-y-4 border-t border-blue-200 pt-4 dark:border-blue-900">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                                Second RDV
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() => setSecondRdv(null)}
                                            >
                                                <X className="w-3 h-3" />
                                                Retirer
                                            </Button>
                                        </div>
                                        <RdvFields
                                            rdv={secondRdv}
                                            onChange={setSecondRdv}
                                            users={search}
                                            currentUserId={user?.user_id}
                                        />
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-dashed"
                                        onClick={() =>
                                            setSecondRdv({
                                                ...secondRdvFrom(rdvData),
                                                description: mainActivity.description,
                                            })
                                        }
                                    >
                                        <Plus className="w-4 h-4" />
                                        Ajouter un second RDV
                                    </Button>
                                )}
                            </motion.div>
                        )}

                        {taskData.enabled && (
                            <motion.div
                                key="task"
                                layout
                                custom={300}
                                variants={columnVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                style={{ contain: "layout paint" }}
                                className="shrink-0 border-t sm:border-t-0 sm:border-l p-4 sm:p-6 space-y-4 overflow-y-auto overflow-x-hidden bg-orange-50/50 dark:bg-orange-950/20 border-orange-100"
                            >
                                <div className="flex items-center gap-2 font-semibold pb-2 border-b text-orange-700 dark:text-orange-300">
                                    <CheckCircle2 className="w-5 h-5" /> Détails
                                    Tâche
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Type</Label>
                                    <Select
                                        value={taskData.type}
                                        onValueChange={(v) =>
                                            setTaskData((p) => ({
                                                ...p,
                                                type: v,
                                            }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choisir..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TASK_TYPES.map((t) => (
                                                <SelectItem key={t} value={t}>
                                                    {t}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs flex items-center gap-1">
                                        <UserCheck className="w-3 h-3" />
                                        Attribuer à
                                    </Label>
                                    <Select
                                        value={taskData.owner}
                                        onValueChange={(v) =>
                                            setTaskData((p) => ({
                                                ...p,
                                                owner: v,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Sélectionner un commercial" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {search?.map((u) => (
                                                <SelectItem
                                                    key={u.user_id}
                                                    value={u.user_id}
                                                >
                                                    {u.name}
                                                    {u.user_id ===
                                                        user?.user_id &&
                                                        " (moi)"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* SECTION DYNAMIQUE POUR RELANCE */}
                                <AnimatePresence>
                                    {taskData.type === "Relance" && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{
                                                opacity: 1,
                                                height: "auto",
                                            }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-1 overflow-hidden"
                                        >
                                            <Label className="text-[10px] text-orange-600 font-bold uppercase flex items-center gap-1">
                                                <Clock className="w-3 h-3" />{" "}
                                                Raccourci de délai
                                            </Label>
                                            <Select
                                                value={selectedDelayValue}
                                                onValueChange={(val) => {
                                                    setSelectedDelayValue(val)
                                                    if (val !== "custom") {
                                                        const option =
                                                            RELANCE_DELAY_OPTIONS.find(
                                                                (o) =>
                                                                    o.value ===
                                                                    val
                                                            )
                                                        if (option) {
                                                            const newDate =
                                                                new Date()
                                                            newDate.setDate(
                                                                newDate.getDate() +
                                                                    option.days
                                                            )
                                                            setTaskData(
                                                                (p) => ({
                                                                    ...p,
                                                                    date: toLocalDateStr(
                                                                        newDate
                                                                    ),
                                                                })
                                                            )
                                                        }
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-8 border-orange-200 bg-orange-100/50 dark:bg-orange-900/20 text-xs">
                                                    <SelectValue placeholder="Choisir le délai..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {RELANCE_DELAY_OPTIONS.map(
                                                        (opt) => (
                                                            <SelectItem
                                                                key={opt.value}
                                                                value={
                                                                    opt.value
                                                                }
                                                            >
                                                                {opt.label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* CHAMPS DE DATE, HEURE ET CONTENU (VISIBLES SI PAS RELANCE OU SI DATE PERSONNALISÉE) */}
                                <AnimatePresence>
                                    {(taskData.type !== "Relance" ||
                                        selectedDelayValue === "custom") && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{
                                                opacity: 1,
                                                height: "auto",
                                            }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4 pt-2 overflow-hidden"
                                        >
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">
                                                        Échéance
                                                    </Label>
                                                    <Input
                                                        type="date"
                                                        value={taskData.date}
                                                        className="h-8 text-xs"
                                                        onChange={(e) => {
                                                            setTaskData(
                                                                (p) => ({
                                                                    ...p,
                                                                    date: e
                                                                        .target
                                                                        .value,
                                                                })
                                                            )
                                                        }}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">
                                                        Heure
                                                    </Label>
                                                    <Input
                                                        type="time"
                                                        value={taskData.time}
                                                        className="h-8 text-xs"
                                                        onChange={(e) =>
                                                            setTaskData(
                                                                (p) => ({
                                                                    ...p,
                                                                    time: e
                                                                        .target
                                                                        .value,
                                                                })
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            {taskData.type !== "Relance" && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs">
                                                        {taskData.type ===
                                                        "Relance"
                                                            ? "Notes de relance (Optionnel)"
                                                            : "Détails"}
                                                    </Label>
                                                    <Textarea
                                                        value={taskData.content}
                                                        onChange={(e) =>
                                                            setTaskData(
                                                                (p) => ({
                                                                    ...p,
                                                                    content:
                                                                        e.target
                                                                            .value,
                                                                })
                                                            )
                                                        }
                                                        className="h-24 bg-background"
                                                        placeholder="À faire..."
                                                    />
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-muted/10">
                    <Button variant="ghost" onClick={handleClose}>
                        Annuler
                    </Button>
                    <Button
                        onClick={() => handleSubmit()}
                        disabled={isSubmitting}
                        className="min-w-[120px]"
                    >
                        {isSubmitting
                            ? "Enregistrement..."
                            : edit
                              ? "Mettre à jour"
                              : "Enregistrer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
