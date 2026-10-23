import { createContext, use, useState } from "react"
import type { ReactNode } from "react"

export type ProjectDisplayStyle = "grid" | "list"

interface ProjectUICtx {
    displayStyle: ProjectDisplayStyle
    setDisplayStyle: (s: ProjectDisplayStyle) => void
}

const ProjectUIContext = createContext<ProjectUICtx | null>(null)

export function ProjectUIProvider({ children }: { children: ReactNode }) {
    const [displayStyle, setDisplayStyle] = useState<ProjectDisplayStyle>("grid")

    return (
        <ProjectUIContext value={{ displayStyle, setDisplayStyle }}>
            {children}
        </ProjectUIContext>
    )
}

export function useProjectUIContext() {
    const ctx = use(ProjectUIContext)
    if (!ctx)
        throw new Error("useProjectUIContext must be used within <ProjectUIProvider>")
    return ctx
}
