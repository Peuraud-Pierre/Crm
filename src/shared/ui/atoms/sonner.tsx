import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Sonner est le SEUL système de toast de l'app (DESIGN_SYSTEM.md §13.8).
 *
 * La sévérité doit rester lisible : depuis le retrait du toast Radix, dont le
 * `variant="destructive"` rendait une surface rouge, un `toast.error` était
 * visuellement identique à un `toast.success` (~60 appels d'erreur concernés).
 * On ne passe pas `richColors` — sa palette est codée en dur et court-circuite
 * les tokens (§12.4) : on peint une barre latérale et l'icône avec
 * `--success` / `--destructive` / `--warning` / `--primary`.
 *
 * Le variant `data-[type=…]` porte une spécificité supérieure à celle du
 * `group-[.toaster]:border-border` de base : sans lui la couleur de bordure
 * générique gagnerait et la barre resterait grise.
 */
const SEVERITY = [
    "group-[.toaster]:border-l-4",
    "group-[.toaster]:data-[type=success]:border-l-success",
    "group-[.toaster]:data-[type=error]:border-l-destructive",
    "group-[.toaster]:data-[type=warning]:border-l-warning",
    "group-[.toaster]:data-[type=info]:border-l-primary",
    "group-[.toaster]:data-[type=success]:[&_[data-icon]]:text-success",
    "group-[.toaster]:data-[type=error]:[&_[data-icon]]:text-destructive",
    "group-[.toaster]:data-[type=warning]:[&_[data-icon]]:text-warning",
    "group-[.toaster]:data-[type=info]:[&_[data-icon]]:text-primary",
].join(" ")

const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = "system" } = useTheme()

    return (
        <Sonner
            theme={theme as ToasterProps["theme"]}
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast: `group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-raised ${SEVERITY}`,
                    description: "group-[.toast]:text-muted-foreground",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                },
            }}
            {...props}
        />
    )
}

/**
 * Seul le `Toaster` est exporté. `toast` s'importe depuis `"sonner"`
 * directement (DESIGN_SYSTEM.md §13.8) : c'est un import statique, il ne
 * rentre donc pas dans les tableaux de dépendances des `useCallback`. Le
 * ré-exporter en parallèle faisait coexister deux chemins d'import pour la
 * même fonction.
 */
export { Toaster }
