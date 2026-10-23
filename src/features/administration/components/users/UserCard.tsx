import { Clock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/shared/ui/atoms/avatar"
import { Badge } from "@/shared/ui/atoms/badge"
import { Card, CardContent } from "@/shared/ui/atoms/card"
import { formatDate, getInitials, getStatusColor, getStatusLabel } from "../../utils/format"
import type { AdminProfile } from "../../types"
import { UserRowActions } from "./UserRowActions"
import type { UserActionHandlers } from "./UserTable"

/**
 * Représentation « carte » d'un utilisateur, à la place de la ligne de table
 * sur mobile (la table déborderait sous md). Cliquable → fiche d'accès ;
 * réutilise le menu d'actions partagé.
 */
export function UserCard({
    user,
    canUpdate,
    canDelete,
    onEdit,
    onToggleStatus,
    onDelete,
}: UserActionHandlers & { user: AdminProfile }) {
    return (
        // Le chemin clavier équivalent est l'entrée « Modifier » du menu ⋯.
        <Card
            variant="interactive"
            className="shadow-surface hover:bg-muted/50"
            onClick={() => onEdit(user)}
            aria-label={`Ouvrir la fiche de ${user.full_name}`}
        >
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <Avatar>
                        <AvatarFallback>
                            {getInitials(user.full_name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                        </p>
                    </div>
                    <UserRowActions
                        user={user}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        onEdit={() => onEdit(user)}
                        onToggleStatus={() => onToggleStatus(user)}
                        onDelete={() => onDelete(user)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge variant="secondary">
                        {user.role?.nom || "Inconnu"}
                    </Badge>
                    <Badge variant="outline">
                        {user.service?.nom || "Non assigné"}
                    </Badge>
                    <Badge className={getStatusColor(user.status)}>
                        {getStatusLabel(user.status)}
                    </Badge>
                </div>

                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {user.last_login
                        ? formatDate(user.last_login)
                        : "Jamais connecté"}
                </div>
            </CardContent>
        </Card>
    )
}
