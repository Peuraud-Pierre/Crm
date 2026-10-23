import { NotificationCenter } from "@/features/notifications/components/NotificationCenter"
import { Button } from "@/shared/ui/atoms/button"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useOutroTarget } from "@/features/auth/components/outro/useOutroTarget"
import { Menu } from "lucide-react"
import { MaintenanceBanner } from "@/features/maintenance"
import { ThemeToggle } from "@/shared/components/layout/ThemeToggle"
import { useNavigate } from "react-router"

interface HeaderProps {
    onMenuClick?: () => void
    title?: string
}

export function Header({ onMenuClick, title }: HeaderProps) {
    const { user } = useAuth()
    const navigate = useNavigate()
    // La sidebar (et le logo) vit derrière ce bouton : c'est là que le logo
    // de l'écran de connexion atterrit à la fin de l'outro.
    const menuRef = useOutroTarget<HTMLButtonElement>()

    return (
        // Liseré vert de marque pour détacher l'en-tête du contenu :
        // `sidebar-accent`, le vert de l'élément actif du tiroir de navigation,
        // qui fonce en thème sombre (32 % → 28 % de luminosité). Épaisseur
        // de 1,5 px, entre les crans 1 et 2 de l'échelle Tailwind : valeur
        // arbitraire assumée (1 px trop discret, 2 px trop appuyé).
        <header className="h-16 bg-card border-b-[1.5px] border-sidebar-accent px-4 md:px-6 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-4">
                <Button
                    ref={menuRef}
                    variant="ghost"
                    size="sm"
                    onClick={onMenuClick}
                    className="shrink-0"
                >
                    <Menu className="w-5 h-5" />
                </Button>

                <div className="min-w-0">
                    {/* `truncate` : le bloc de droite (thème, maintenance,
                        notifications) n'a pas de largeur garantie, et un
                        titre long le poussait hors du cadre sur petit
                        écran. */}
                    <h1 className="truncate text-lg md:text-xl font-semibold text-foreground">
                        {title}
                    </h1>
                    <p className="truncate text-xs md:text-sm text-muted-foreground hidden sm:block">
                        {new Date().toLocaleDateString("fr-FR", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 md:gap-4">
                <ThemeToggle />
                <MaintenanceBanner />
                <NotificationCenter />
                <button
                    type="button"
                    onClick={() => navigate("/profile")}
                    className="group hidden md:inline-block relative h-5 overflow-hidden text-sm text-muted-foreground"
                >
                    <span className="block transition-[opacity,transform] duration-base group-hover:opacity-0 group-hover:-translate-y-1">
                        {user?.full_name}
                    </span>
                    <span className="absolute left-0 top-0 text-primary opacity-0 translate-y-2 transition-[opacity,transform] duration-base group-hover:opacity-100 group-hover:translate-y-0">
                        Voir le profil
                    </span>
                </button>
            </div>
        </header>
    )
}
