import { TaskPageProvider } from "./context/TaskPageContext"
import { TaskFilters } from "./components/Task/TaskFilters"
import { TaskList } from "./components/Task/TaskList"
import { TaskModals } from "./modales/TaskModals"

// Composant interne qui utilise le layout
function TaskPageContent() {
    return (
        <div className="min-h-screen p-4 flex flex-col font-sans bg-background text-foreground">
            <TaskFilters />
            <TaskList />
            <TaskModals />
        </div>
    )
}

// Composant exporté par défaut qui enveloppe tout dans le Provider
export default function PageWithResponsiveTasks() {
    return (
        <TaskPageProvider>
            <TaskPageContent />
        </TaskPageProvider>
    )
}
