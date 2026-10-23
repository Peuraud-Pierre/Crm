import type { ProfileStatus } from "../types"

export function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return "Jamais"
    return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
}

export function getStatusColor(status: ProfileStatus | string): string {
    switch (status) {
        case "active":
            return "bg-success text-success-foreground"
        case "inactive":
            return "bg-destructive text-destructive-foreground"
        case "pending":
            return "bg-warning text-warning-foreground"
        default:
            return "bg-muted text-muted-foreground"
    }
}

export function getStatusLabel(status: ProfileStatus | string): string {
    switch (status) {
        case "active":
            return "Actif"
        case "inactive":
            return "Inactif"
        case "pending":
            return "En attente"
        default:
            return status
    }
}

export function isEmailValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial, 8 caractères. */
export function isPasswordValid(password: string): boolean {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(password)
}
