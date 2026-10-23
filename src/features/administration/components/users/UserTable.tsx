import { ArrowDown, ArrowUp } from "lucide-react"
import { Avatar, AvatarFallback } from "@/shared/ui/atoms/avatar"
import { Badge } from "@/shared/ui/atoms/badge"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"
import { formatDate, getInitials, getStatusColor, getStatusLabel } from "../../utils/format"
import type { AdminProfile } from "../../types"
import { UserRowActions } from "./UserRowActions"

// Clés stables pour les placeholders de chargement (évite les clés d'index).
const SKELETON_ROWS = ["sr1", "sr2", "sr3", "sr4", "sr5"]

export interface UserActionHandlers {
    canUpdate: boolean
    canDelete: boolean
    /** Ouvre la fiche d'accès (clic de ligne ou « Modifier » du menu). */
    onEdit: (user: AdminProfile) => void
    onToggleStatus: (user: AdminProfile) => void
    onDelete: (user: AdminProfile) => void
}

interface UserTableProps extends UserActionHandlers {
    users: AdminProfile[]
    loading: boolean
    sortOrder: "asc" | "desc"
    onToggleSort: () => void
}

export function UserTable({
    users,
    loading,
    sortOrder,
    onToggleSort,
    ...actions
}: UserTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead
                        aria-sort={
                            sortOrder === "asc" ? "ascending" : "descending"
                        }
                    >
                        <button
                            type="button"
                            onClick={onToggleSort}
                            aria-label={`Trier par dernière connexion (${
                                sortOrder === "asc"
                                    ? "croissant"
                                    : "décroissant"
                            })`}
                            className="inline-flex items-center gap-1 select-none hover:text-foreground transition-colors"
                        >
                            Dernière connexion
                            {sortOrder === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                            ) : (
                                <ArrowDown className="w-3 h-3" />
                            )}
                        </button>
                    </TableHead>
                    <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? SKELETON_ROWS.map((key) => (
                          <TableRow key={key}>
                              <TableCell colSpan={6}>
                                  <Skeleton className="h-10 w-full" />
                              </TableCell>
                          </TableRow>
                      ))
                    : users.map((user) => (
                          <UserTableRow
                              key={user.user_id}
                              user={user}
                              {...actions}
                          />
                      ))}
            </TableBody>
        </Table>
    )
}

function UserTableRow({
    user,
    canUpdate,
    canDelete,
    onEdit,
    onToggleStatus,
    onDelete,
}: UserActionHandlers & { user: AdminProfile }) {
    return (
        // Le chemin clavier équivalent est l'entrée « Modifier » du menu ⋯.
        <TableRow
            onClick={() => onEdit(user)}
            className="cursor-pointer"
            aria-label={`Ouvrir la fiche de ${user.full_name}`}
        >
            <TableCell>
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarFallback>
                            {getInitials(user.full_name)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="secondary">{user.role?.nom || "Inconnu"}</Badge>
            </TableCell>
            <TableCell>
                <Badge variant="outline">
                    {user.service?.nom || "Non assigné"}
                </Badge>
            </TableCell>
            <TableCell>
                <Badge className={getStatusColor(user.status)}>
                    {getStatusLabel(user.status)}
                </Badge>
            </TableCell>
            <TableCell>
                {user.last_login ? (
                    <span className="text-sm text-muted-foreground">
                        {formatDate(user.last_login)}
                    </span>
                ) : (
                    <span className="text-sm italic text-muted-foreground">
                        Jamais connecté
                    </span>
                )}
            </TableCell>
            <TableCell className="text-right">
                <UserRowActions
                    user={user}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    onEdit={() => onEdit(user)}
                    onToggleStatus={() => onToggleStatus(user)}
                    onDelete={() => onDelete(user)}
                />
            </TableCell>
        </TableRow>
    )
}
