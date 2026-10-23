import { useState } from "react"
import { ToolCard } from "./ToolCard"
import { CalculetteForm } from "./tool_form/CalculetteForm"
import { CalculetteProForm } from "./tool_form/CalculetteProForm"

export function CatalogueTools() {
    const [openCalculetteS, setOpenCalculetteS] = useState(false)
    const [openCalculetteP, setOpenCalculetteP] = useState(false)

    const tools = [
        {
            title: "Calculette (Simple)",
            description: "Outil de calcul des marges des balles.",
            color: "bg-green-600 hover:bg-green-700",
            onClick: () => setOpenCalculetteS(true),
            disabled: false,
        },
        {
            title: "Calculette pro",
            description: "Outil de calcul de marge sur une balle trié.",
            color: "bg-blue-600 hover:bg-blue-700",
            onClick: () => setOpenCalculetteP(true),
            disabled: false,
        },
    ]

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Outils du catalogue</h1>
                <p className="text-sm text-muted-foreground">
                    Accédez rapidement aux outils d’analyse, de gestion et de calcul.
                </p>
            </div>

            {/* Grille des outils */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool) => (
                    <ToolCard key={tool.title} {...tool} />
                ))}
            </div>

            {/* Dialog Calculette */}
            <CalculetteForm open={openCalculetteS} setOpen={setOpenCalculetteS} />
            <CalculetteProForm open={openCalculetteP} setOpen={setOpenCalculetteP} />
        </div>
    )
}
