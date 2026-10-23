import {
    createContext,
    use,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import type {
    Tache as Tache_,
    FilterType,
    activites,
} from "@/features/crm/types"

export type { FilterType } from "@/features/crm/types"

interface TaskPageContextType {
    tasks: (Tache_ & { placement?: string })[]
    filteredTasks: (Tache_ & { placement?: string })[]
    activeFilter: FilterType
    setActiveFilter: (filter: FilterType) => void
    filters: { label: string; value: FilterType }[]
    taskCount: (type: FilterType) => number

    // Actions de tâches
    toggleDone: (id: string) => void
    handleClientClick: (task: Tache_) => void

    // Modale d'édition
    openEditModal: boolean
    setOpenEditModal: (open: boolean) => void
    editTask: Tache_ | null
    setEditTask: (task: Tache_) => void
    handleOpenEditModal: (task: Tache_) => void
    saveTask: () => void

    // Modale de suppression
    openDeleteModal: boolean
    setOpenDeleteModal: (open: boolean) => void
    openDeleteConfirm: (taskId: string) => void
    executeDelete: () => void

    // Modale de création
    openCreateModal: boolean
    setOpenCreateModal: (open: boolean) => void
    newTask: Partial<Tache_>
    setNewTask: (task: Partial<Tache_>) => void
    handleOpenCreateModal: () => void
    createTask: () => void
}

const TaskPageContext = createContext<TaskPageContextType | undefined>(
    undefined
)

export function TaskPageProvider({ children }: { children: ReactNode }) {
    const {
        Tache,
        TacheDelegated,
        update_Tache,
        delete_Tache,
        create_Tache,
        clients,
        openClientFiche,
        fetchOneClient,
        create_activites,
    } = useCRMContext()
    const { user } = useAuth()

    const [activeFilter, setActiveFilter] = useState<FilterType>("today")
    const [tasks, setTasks] = useState<(Tache_ & { placement?: string })[]>([])
    const toggleDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => () => {
        if (toggleDoneTimeoutRef.current) clearTimeout(toggleDoneTimeoutRef.current)
    }, [])

    // Modales states
    const [openEditModal, setOpenEditModal] = useState(false)
    const [editTask, setEditTask] = useState<Tache_ | null>(null)
    const [openDeleteModal, setOpenDeleteModal] = useState(false)
    const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null)
    const [openCreateModal, setOpenCreateModal] = useState(false)
    const emptyNewTask: Partial<Tache_> = {
        type: "Relance",
        content: "",
        date: new Date().toISOString(),
        client: null,
        categorie: "crm",
    }
    const [newTask, setNewTask] = useState<Partial<Tache_>>(emptyNewTask)

    const filters: { label: string; value: FilterType }[] = [
        { label: "Aujourd'hui", value: "today" },
        { label: "En retard", value: "retard" },
        { label: "À venir", value: "venir" },
        { label: "Tout", value: "tout" },
        { label: "Assignées", value: "assignees" },
    ]

    const getTaskDateType = (dateStr: string) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const taskDate = new Date(dateStr)
        taskDate.setHours(0, 0, 0, 0)

        if (taskDate.getTime() === today.getTime()) return "today"
        if (taskDate.getTime() > today.getTime()) return "venir"
        if (taskDate.getTime() < today.getTime()) return "retard"
        return "tout"
    }

    useEffect(() => {
        if (Tache && Tache.length > 0) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resynchro de l'état local éditable depuis Tache[]
            setTasks(
                Tache.map((t) => ({
                    ...t,
                    placement: getTaskDateType(t.date || ""),
                }))
            )
        }
    }, [Tache])

    // Tâches que j'ai créées et assignées à quelqu'un d'autre : liste à part
    // (pas dans `tasks`, qui ne contient que MES tâches), lue directement
    // depuis le hook qui gère l'optimistic UI et le realtime.
    const delegatedTasks = (TacheDelegated ?? []).map((t) => ({
        ...t,
        placement: getTaskDateType(t.date || ""),
    }))

    const filteredTasks =
        activeFilter === "assignees"
            ? delegatedTasks
            : activeFilter === "tout"
              ? tasks
              : tasks.filter((task) => task.placement === activeFilter)

    const taskCount = (type: FilterType) =>
        type === "assignees"
            ? delegatedTasks.length
            : type === "tout"
              ? tasks.length
              : tasks.filter((t) => t.placement === type).length

    // Actions
    const handleOpenEditModal = (task: Tache_) => {
        setEditTask({ ...task })
        setOpenEditModal(true)
    }

    const saveTask = () => {
        if (editTask && editTask.id) {
            update_Tache(editTask.id, editTask)
            // Réassignée à quelqu'un d'autre : cette liste ne contient que
            // MES tâches (owner = utilisateur courant, cf. useTache), donc
            // la tâche doit disparaître localement au lieu de rester
            // affichée avec un nouvel owner qui n'est plus moi.
            const reassignedAway =
                !!editTask.owner &&
                !!user?.user_id &&
                editTask.owner !== user.user_id
            setTasks((prev) =>
                reassignedAway
                    ? prev.filter((t) => t.id !== editTask.id)
                    : prev.map((t): Tache_ & { placement?: string } =>
                          t.id === editTask.id
                              ? { ...t, ...editTask, placement: t.placement }
                              : t
                      )
            )
            setOpenEditModal(false)
        }
    }

    const openDeleteConfirm = (taskId: string) => {
        setTaskToDeleteId(taskId)
        setOpenDeleteModal(true)
    }

    const executeDelete = () => {
        if (taskToDeleteId) {
            delete_Tache(taskToDeleteId)
            setTasks((prev) => prev.filter((t) => t.id !== taskToDeleteId))
        }
        setTaskToDeleteId(null)
        setOpenDeleteModal(false)
    }

    const toggleDone = (id: string) => {
        const task =
            tasks.find((t) => t.id === id) ??
            delegatedTasks.find((t) => t.id === id)
        if (task) {
            const updated = { ...task, valide: true }
            setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))

            toggleDoneTimeoutRef.current = setTimeout(async () => {
                try {
                    await delete_Tache(id)
                    const clientId =
                        typeof task.client === "object"
                            ? task.client?.id
                            : task.client
                    if (clientId) {
                        await create_activites({
                            client: clientId,
                            date: new Date().toISOString(),
                            created_at: new Date().toISOString(),
                            title: "Tâche terminée",
                            content: `Validation de la tâche : ${task.content}`,
                            // L'id réel est généré côté hook ; le type du contexte
                            // exige néanmoins un objet activites complet.
                        } as activites)
                    }
                } catch (err) {
                    console.error("Erreur lors de la validation de la tâche:", err)
                    // Rollback : on remet la tâche dans son état original
                    setTasks((prev) =>
                        prev.map((t) => (t.id === id ? task : t)) as typeof prev
                    )
                    return
                }
                setTasks((prev) => prev.filter((t) => t.id !== id))
            }, 500)
        }
    }

    const handleOpenCreateModal = () => {
        setNewTask(emptyNewTask)
        setOpenCreateModal(true)
    }

    const createTask = () => {
        if (!newTask.type) {
            console.warn("❌ Type manquant pour la création de tâche")
            return
        }
        create_Tache(newTask as Tache_)
        setOpenCreateModal(false)
    }

    const handleClientClick = async (task: Tache_) => {
        if (!task.client || !openClientFiche) return

        const clientId =
            typeof task.client === "object" ? task.client.id : task.client
        if (!clientId) return

        // Toujours la ligne complète : `clients` (Kanban) est un select léger
        // (CLIENT_LIST_SELECT, sans message, adresses, telephone_2…) et la fiche
        // ouverte avec lui n'affichait pas le message du client. La liste ne
        // sert que de repli si le fetch échoue.
        const fullClient =
            (await fetchOneClient?.(clientId)) ??
            clients?.find((c) => c.id === clientId)
        if (fullClient) {
            openClientFiche(fullClient)
        }
    }

    return (
        <TaskPageContext
            value={{
                tasks,
                filteredTasks,
                activeFilter,
                setActiveFilter,
                filters,
                taskCount,
                toggleDone,
                handleClientClick,
                openEditModal,
                setOpenEditModal,
                editTask,
                setEditTask,
                handleOpenEditModal,
                saveTask,
                openDeleteModal,
                setOpenDeleteModal,
                openDeleteConfirm,
                executeDelete,
                openCreateModal,
                setOpenCreateModal,
                newTask,
                setNewTask,
                handleOpenCreateModal,
                createTask,
            }}
        >
            {children}
        </TaskPageContext>
    )
}

export const useTaskPage = () => {
    const context = use(TaskPageContext)
    if (!context)
        throw new Error(
            "useTaskPage doit être utilisé dans un TaskPageProvider"
        )
    return context
}
