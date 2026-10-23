import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { displayVersion, useAppVersion } from "@/features/changelog"
import type {
    MenuCategory,
    MenuItem,
} from "@/shared/components/layout/menuItems"
import { CollapsibleSection } from "@/shared/components/sidebar/CollapsibleSection"
import { resolveAvatarUrl } from "@/shared/lib/avatar"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import { LogOut, Settings, Shield, User } from "lucide-react"
import { useMemo } from "react"
import { useLocation, useNavigate } from "react-router"

type SidebarSection = {
    category: MenuCategory | "main"
    items: MenuItem[]
    groups: Record<string, MenuItem[]>
}

interface SidebarProps {
    className?: string
    onNavigate?: () => void
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
    const { signOut, user, allowedRoutes } = useAuth()
    const navigate = useNavigate()
    const { pathname } = useLocation()

    // Une requête d'une ligne, au lieu du contexte changelog complet :
    // afficher un numéro de version ne justifie pas de charger toutes les
    // versions, leurs éléments et leurs catégories pour chaque utilisateur.
    const latest = useAppVersion()
    // Toujours préfixé « v » (SemVer : vX.Y.Z).
    const version = latest ? (displayVersion(latest) ?? latest) : "—"

    const structured = useMemo<Record<string, SidebarSection>>(() => {
        const result: Record<string, SidebarSection> = {}

        allowedRoutes.forEach((item) => {
            if (item.hideFromSidebar) return
            const category = item.category ?? "main"

            result[category] ??= { category, items: [], groups: {} }

            if (item.group) {
                result[category].groups[item.group] ??= []
                result[category].groups[item.group].push(item)
            } else {
                result[category].items.push(item)
            }
        })

        return result
    }, [allowedRoutes])

    const avatarUrl = resolveAvatarUrl(user?.avatar_url)

    const renderItem = (item: MenuItem) => {
        const Icon = item.icon
        // Actif si chemin exact OU sous-chemin (ex. /crm actif sur /crm/agenda/days).
        // La frontière "/" évite que /content matche /contentlist.
        const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")

        return (
            <Button
                key={item.title}
                variant="ghost"
                className={cn(
                    "relative w-full flex items-center h-12 text-sidebar-accent-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-muted/50 transition-[color,background-color,box-shadow] duration-base justify-start gap-3",
                    isActive &&
                        "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm hover:bg-sidebar-accent/90 hover:text-sidebar-accent-foreground"
                )}
                onClick={() => {
                    navigate(item.href)
                    onNavigate?.()
                }}
            >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate font-medium">{item.displayName}</span>
            </Button>
        )
    }

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "flex flex-col h-full bg-sidebar overflow-hidden w-64",
                    className
                )}
            >
                {/* Header */}
                <div className="border-b border-sidebar-muted/20 text-sidebar-foreground flex items-center gap-4 p-3 h-[72px] shrink-0">
                    <img
                        src="/nokk_project_logo.svg"
                        alt="Logo"
                        className="w-9 h-9 shrink-0 [filter:brightness(0)_invert(1)]"
                    />
                    <div className="flex flex-col leading-tight">
                        <h2 className="font-bold text-lg whitespace-nowrap">
                            La Console
                        </h2>
                        <p className="text-[11px] text-sidebar-foreground/60 whitespace-nowrap">
                            Plateforme interne
                        </p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {structured.main?.items.map(renderItem)}

                    {Object.entries(structured.main?.groups ?? {}).map(
                        ([group, items]) => {
                            const allItems = [...items]
                            const Icon =
                                allItems.find((i) => i.icon_main)?.icon_main ||
                                allItems[0]?.icon ||
                                Shield

                            return (
                                <CollapsibleSection
                                    key={group}
                                    title={group}
                                    icon={Icon}
                                    items={allItems}
                                    activeItem={pathname}
                                    onItemClick={(href) => {
                                        navigate(href)
                                        onNavigate?.()
                                    }}
                                />
                            )
                        }
                    )}

                    {Object.entries(structured).map(([category, section]) => {
                        if (category === "main") return null

                        const allItems = [
                            ...section.items,
                            ...Object.values(section.groups).flat(),
                        ]
                        const Icon =
                            allItems.find((i) => i.icon_main)?.icon_main ||
                            allItems[0]?.icon ||
                            Shield

                        return (
                            <CollapsibleSection
                                key={category}
                                title={category}
                                icon={Icon}
                                items={allItems}
                                activeItem={pathname}
                                onItemClick={(href) => {
                                    navigate(href)
                                    onNavigate?.()
                                }}
                            />
                        )
                    })}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-sidebar-muted/20 space-y-2">
                    {/* Deux cibles distinctes (profil / paramètres) : des
                        boutons frères, jamais imbriqués. */}
                    <div className="flex items-center gap-1 rounded-xl bg-sidebar-muted/30">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                navigate("/profile")
                                onNavigate?.()
                            }}
                            className="group flex-1 min-w-0 justify-start gap-3 p-3 rounded-xl hover:bg-sidebar-muted/50 transition-colors duration-base"
                        >
                            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 overflow-hidden">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt={user?.full_name || "Avatar"}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <User className="w-4 h-4 text-sidebar-foreground" />
                                )}
                            </div>

                            <div className="relative flex-1 min-w-0 text-left overflow-hidden">
                                <p className="font-medium text-sm truncate transition-[opacity,transform] text-sidebar-foreground duration-base group-hover:opacity-0 group-hover:-translate-y-1">
                                    {user?.full_name}
                                </p>
                                <p className="absolute left-0 top-0 font-medium text-sm text-sidebar-accent opacity-0 translate-y-2 transition-[opacity,transform] duration-base group-hover:opacity-100 group-hover:translate-y-0">
                                    Voir le profil
                                </p>
                                <p className="text-xs text-sidebar-foreground/60 truncate">
                                    {user?.role}
                                </p>
                            </div>
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Paramètres"
                            onClick={() => {
                                navigate("/settings")
                                onNavigate?.()
                            }}
                            className="shrink-0 mr-1 text-sidebar-foreground hover:bg-sidebar-muted/50"
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        className="w-full text-sidebar-foreground justify-start gap-3"
                        onClick={async () => {
                            try {
                                await signOut()
                            } finally {
                                navigate("/login")
                            }
                        }}
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Déconnexion</span>
                    </Button>

                    <div className="text-xs text-sidebar-foreground/40">
                        Version bêta {version}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}
