import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/shared/ui/atoms/button"
import { useUserPreferences } from "@/features/profile/hooks/data/useUserPreferences"

/**
 * Bascule clair/sombre de la barre supérieure (app-shell).
 *
 * Monté une fois par `MainLayout`, il porte aussi la lecture initiale des
 * préférences : le thème enregistré sur le compte est appliqué dès
 * l'ouverture de l'application, pas seulement en visitant `/profile`. Le
 * réglage complet à trois états (clair / sombre / système) vit dans
 * l'onglet Préférences du profil.
 */
export function ThemeToggle() {
    const { resolvedTheme } = useTheme()
    const { setThemeChoice } = useUserPreferences()

    const isDark = resolvedTheme === "dark"

    return (
        <Button
            variant="ghost"
            size="sm"
            aria-label={
                isDark ? "Passer en thème clair" : "Passer en thème sombre"
            }
            onClick={() => setThemeChoice(isDark ? "light" : "dark")}
        >
            {isDark ? (
                <Moon className="h-5 w-5" />
            ) : (
                <Sun className="h-5 w-5" />
            )}
        </Button>
    )
}
