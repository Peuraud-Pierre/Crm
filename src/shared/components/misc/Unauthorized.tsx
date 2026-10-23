import { Lock, ArrowLeft } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { useNavigate } from "react-router"

interface UnauthorizedProps {
    title?: string
    description?: string
}

export function Unauthorized({
    title = "Accès refusé",
    description = "Vous n'avez pas les permissions nécessaires pour accéder à cette page.",
}: UnauthorizedProps) {
    const navigate = useNavigate()

    return (
        <div className="flex-1 flex items-center justify-center min-h-screen bg-muted/30">
            <div className="w-full max-w-md mx-auto px-4">
                <div className="rounded-lg border bg-card p-8 space-y-6 text-center">
                    <div className="flex justify-center">
                        <Lock className="h-12 w-12 text-destructive" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        <p className="text-muted-foreground">
                            {description}
                        </p>
                    </div>
                    <Button
                        onClick={() => navigate(-1)}
                        variant="outline"
                        className="w-full gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                    </Button>
                </div>
            </div>
        </div>
    )
}
