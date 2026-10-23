import { Main } from "@/features/projects/components/project/Main"
import { ProjectProvider } from "@/features/projects/hooks/context/Project/ProjectProvider"

// ---------- Component ----------
export default function Projects() {
    // ---------- Render ----------
    return (
        <ProjectProvider>
            <Main />
        </ProjectProvider>
    )
}
