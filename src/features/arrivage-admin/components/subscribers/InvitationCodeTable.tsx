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
import { CODE_MASK } from "@/features/arrivage-admin/constants"
import { InvitationCodeActions } from "@/features/arrivage-admin/components/subscribers/InvitationCodeActions"
import { formatDate, shortId } from "@/features/arrivage-admin/utils/format"
import type { InvitationCode } from "@/features/arrivage-admin/types"

const SKELETON_ROWS = ["cr1", "cr2", "cr3", "cr4"]

interface InvitationCodeTableProps {
    codes: InvitationCode[]
    loading: boolean
    isVisible: (id: string) => boolean
    isCopied: (id: string) => boolean
    onToggleVisibility: (id: string) => void
    onCopy: (id: string, code: string) => void
    onAssociate: (code: InvitationCode) => void
}

/** Vue desktop des codes d'invitation (≥ md). */
export function InvitationCodeTable({
    codes,
    loading,
    isVisible,
    isCopied,
    onToggleVisibility,
    onCopy,
    onAssociate,
}: InvitationCodeTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead className="w-8" />
                    <TableHead>Label</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Utilisé par</TableHead>
                    <TableHead>Utilisé le</TableHead>
                    <TableHead>Créé le</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? SKELETON_ROWS.map(key => (
                          <TableRow key={key}>
                              <TableCell colSpan={7}>
                                  <Skeleton className="h-6 w-full" />
                              </TableCell>
                          </TableRow>
                      ))
                    : codes.map(c => (
                          <TableRow key={c.id}>
                              <TableCell className="font-mono text-sm tracking-widest">
                                  {isVisible(c.id) ? c.code : CODE_MASK}
                              </TableCell>
                              <TableCell className="w-8 pr-0">
                                  <InvitationCodeActions
                                      code={c}
                                      revealed={isVisible(c.id)}
                                      copied={isCopied(c.id)}
                                      onToggleVisibility={onToggleVisibility}
                                      onCopy={onCopy}
                                      onAssociate={onAssociate}
                                  />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                  {c.label ?? "—"}
                              </TableCell>
                              <TableCell>
                                  <Badge
                                      variant={c.used_by ? "secondary" : "default"}
                                  >
                                      {c.used_by ? "Utilisé" : "Disponible"}
                                  </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-muted-foreground">
                                  {shortId(c.used_by)}
                              </TableCell>
                              <TableCell className="text-sm">
                                  {formatDate(c.used_at)}
                              </TableCell>
                              <TableCell className="text-sm">
                                  {formatDate(c.created_at)}
                              </TableCell>
                          </TableRow>
                      ))}
            </TableBody>
        </Table>
    )
}
