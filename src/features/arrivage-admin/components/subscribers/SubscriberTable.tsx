import { Send } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { Switch } from "@/shared/ui/atoms/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"
import { formatDate } from "@/features/arrivage-admin/utils/format"
import type { Subscriber } from "@/features/arrivage-admin/types"

const SKELETON_ROWS = ["sr1", "sr2", "sr3", "sr4"]

interface SubscriberTableProps {
    subscribers: Subscriber[]
    loading: boolean
    canSend: boolean
    sendingId: string | null
    sendingAll: boolean
    onResend: (userId: string) => void
    onToggleArrivage: (userId: string, arrivage: boolean) => void
    onToggleCrmStat: (userId: string, crmStat: boolean) => void
}

/** Vue desktop des abonnés (≥ md) — la vue mobile est `SubscriberCard`. */
export function SubscriberTable({
    subscribers,
    loading,
    canSend,
    sendingId,
    sendingAll,
    onResend,
    onToggleArrivage,
    onToggleCrmStat,
}: SubscriberTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Arrivage</TableHead>
                    <TableHead>Stats CRM</TableHead>
                    <TableHead>Colonnes</TableHead>
                    <TableHead>Abonné depuis</TableHead>
                    {canSend && <TableHead className="w-8" />}
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading
                    ? SKELETON_ROWS.map(key => (
                          <TableRow key={key}>
                              <TableCell colSpan={canSend ? 7 : 6}>
                                  <Skeleton className="h-6 w-full" />
                              </TableCell>
                          </TableRow>
                      ))
                    : subscribers.map(s => (
                          <TableRow key={s.user_id}>
                              <TableCell className="text-sm">{s.email}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                  {s.full_name || "—"}
                              </TableCell>
                              <TableCell>
                                  <Switch
                                      checked={!!s.arrivage}
                                      onCheckedChange={checked =>
                                          onToggleArrivage(s.user_id, checked)
                                      }
                                      aria-label={`Newsletter arrivage pour ${s.email}`}
                                  />
                              </TableCell>
                              <TableCell>
                                  <Switch
                                      checked={!!s.crm_stat}
                                      onCheckedChange={checked =>
                                          onToggleCrmStat(s.user_id, checked)
                                      }
                                      aria-label={`Newsletter stats CRM pour ${s.email}`}
                                  />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                  {Array.isArray(s.visible_columns)
                                      ? `${s.visible_columns.length} colonne(s)`
                                      : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                  {formatDate(s.created_at)}
                              </TableCell>
                              {canSend && (
                                  <TableCell className="w-8 pr-0">
                                      <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-muted-foreground"
                                          onClick={() => onResend(s.user_id)}
                                          disabled={
                                              !s.active ||
                                              sendingId === s.user_id ||
                                              sendingAll
                                          }
                                          title="Renvoyer la newsletter"
                                          aria-label={`Renvoyer la newsletter à ${s.email}`}
                                      >
                                          <Send className="h-3.5 w-3.5" />
                                      </Button>
                                  </TableCell>
                              )}
                          </TableRow>
                      ))}
            </TableBody>
        </Table>
    )
}
