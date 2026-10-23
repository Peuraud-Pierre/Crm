import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"
import { useProfilesCtx } from "@/shared/context/ProfilesProvider"
import { useSellJournalContext } from "@/features/sell-journal/context/SellJournalContext"
import { type JournalEntry } from "@/features/journal/hooks/Journal_hook/useJournalEntry"
import jsPDF from "jspdf"
import { Pencil, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

export function BilanDialog({
    open,
    setOpen,
    bilan,
}: {
    open: boolean
    setOpen: (open: boolean) => void
    bilan: { key: string; total: number; entries: JournalEntry[] } | null
}) {
    const { entries, updateEntry, deleteEntry } = useSellJournalContext()

    const { profiles } = useProfilesCtx()
    const commercialUsers = useMemo(
        () =>
            profiles?.filter((p) => p.service?.nom === "Commercial") ?? [],
        [profiles]
    )
    const [editEntry, setEditEntry] = useState<JournalEntry | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null)
    const [form, setForm] = useState({
        date: "",
        service: "",
        commercial: "",
        sales: "",
    })

    /** live sync with global entries */
    const liveEntries = bilan
        ? entries.filter((e) =>
              (bilan.entries ?? []).some((be) => be.id === e.id)
          )
        : []

    /** group by day for readability */
    const byDay = liveEntries.reduce<Record<string, JournalEntry[]>>(
        (acc, e) => {
            const day = e.sell_at.slice(0, 10)
            if (!acc[day]) acc[day] = []
            acc[day].push(e)
            return acc
        },
        {}
    )

    const total = liveEntries.reduce((sum, e) => sum + Number(e.sales), 0)

    const handleExportPDF = () => {
        if (!bilan) return

        const doc = new jsPDF("p", "mm", "a4")
        const marginY = 12
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        const rowHeight = 7
        const cellPaddingY = rowHeight / 2
        const fontSize = 9

        const formatAmount = (value: string | number) => {
            const numeric = Number(value)
            if (Number.isNaN(numeric)) return String(value)
            return numeric.toLocaleString("fr-FR").replace(/\u202F/g, " ")
        }

        const fitText = (text: string, width: number) => {
            if (!text) return "-"
            let current = text
            if (doc.getTextWidth(current) <= width) return current
            while (
                current.length > 1 &&
                doc.getTextWidth(current + "...") > width
            ) {
                current = current.slice(0, -1)
            }
            return current.length < text.length ? `${current}...` : current
        }

        const columnGap = 4
        const columns = [
            { label: "Date", width: 24, align: "center" as const },
            { label: "Service", width: 24, align: "center" as const },
            { label: "Commercial", width: 40, align: "center" as const },
            { label: "CA (€)", width: 26, align: "center" as const },
            { label: "Ajoute par", width: 36, align: "center" as const },
        ]
        const tableWidth =
            columns.reduce((sum, col) => sum + col.width, 0) +
            columnGap * (columns.length - 1)
        const marginX = Math.max((pageWidth - tableWidth) / 2, 8)

        const renderHeader = () => {
            doc.setFontSize(14)
            doc.text(`Bilan - ${bilan.key}`, marginX, marginY)
            doc.setFontSize(10)
            doc.text(
                `Total: ${formatAmount(total)} €`,
                marginX,
                marginY + 6
            )

            let x = marginX
            const y = marginY + 14
            doc.setFontSize(fontSize)
            columns.forEach((col) => {
                if (col.align === "center") {
                    doc.text(
                        fitText(col.label, col.width),
                        x + col.width / 2,
                        y + cellPaddingY,
                        { align: "center", baseline: "middle" }
                    )
                } else if (col.align === "right") {
                    doc.text(
                        fitText(col.label, col.width),
                        x + col.width,
                        y + cellPaddingY,
                        { align: "right", baseline: "middle" }
                    )
                } else {
                    doc.text(
                        fitText(col.label, col.width),
                        x,
                        y + cellPaddingY,
                        {
                            baseline: "middle",
                        }
                    )
                }
                x += col.width + columnGap
            })
            return y + rowHeight
        }

        let y = renderHeader()
        const rows = [...liveEntries].sort((a, b) =>
            b.sell_at.localeCompare(a.sell_at)
        )

        rows.forEach((entry) => {
            if (y + rowHeight > pageHeight - marginY) {
                doc.addPage()
                y = renderHeader()
            }

            let x = marginX
            doc.setFontSize(fontSize)
            doc.text(
                fitText(entry.sell_at.slice(0, 10), columns[0].width),
                x + columns[0].width / 2,
                y + cellPaddingY,
                { align: "center", baseline: "middle" }
            )
            x += columns[0].width + columnGap
            doc.text(
                fitText(entry.service, columns[1].width),
                x + columns[1].width / 2,
                y + cellPaddingY,
                {
                    align: "center",
                    baseline: "middle",
                }
            )
            x += columns[1].width + columnGap
            doc.text(
                fitText(entry.commercial, columns[2].width),
                x + columns[2].width / 2,
                y + cellPaddingY,
                { align: "center", baseline: "middle" }
            )
            x += columns[2].width + columnGap
            doc.text(
                `${formatAmount(entry.sales)} €`,
                x + columns[3].width / 2,
                y + cellPaddingY,
                { align: "center", baseline: "middle" }
            )
            x += columns[3].width + columnGap
            doc.text(
                fitText(entry.created_by || "-", columns[4].width),
                x + columns[4].width / 2,
                y + cellPaddingY,
                {
                    align: "center",
                    baseline: "middle",
                }
            )
            y += rowHeight
        })

        doc.save(`bilan-${bilan.key}.pdf`)
    }

    const openEdit = (entry: JournalEntry) => {
        setForm({
            date: entry.sell_at.slice(0, 10),
            service: entry.service,
            commercial: entry.commercial,
            sales: entry.sales,
        })
        setEditEntry(entry)
    }

    const handleUpdate = () => {
        if (!editEntry) return
        updateEntry(
            editEntry.id,
            form.date,
            form.service,
            form.commercial,
            form.sales
        )
        setEditEntry(null)
    }

    useEffect(() => {
        if (!bilan) return
        if (!liveEntries.length && open) setOpen(false)
    }, [bilan, liveEntries.length, open, setOpen])


    if (!bilan) return null
    if (!liveEntries.length) return null

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-6xl">
                <DialogHeader>
                    <DialogTitle>Bilan — {bilan.key}</DialogTitle>
                </DialogHeader>

                {/* TABLE */}
                <div className="max-h-[60vh] overflow-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Service</TableHead>
                                <TableHead>Commercial</TableHead>
                                <TableHead>CA (€)</TableHead>
                                <TableHead>Ajouté par</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {Object.entries(byDay)
                                .sort(([a], [b]) => b.localeCompare(a))
                                .map(([day, list]) => [
                                    <TableRow
                                        key={`day-${day}`}
                                        className="bg-muted/40"
                                    >
                                        <TableCell
                                            colSpan={6}
                                            className="font-semibold"
                                        >
                                                {new Date(
                                                    day
                                                ).toLocaleDateString("fr-FR", {
                                                    weekday: "long",
                                                    day: "2-digit",
                                                    month: "long",
                                                    year: "numeric",
                                                })}
                                            </TableCell>
                                        </TableRow>,

                                        ...list.map((e) => (
                                            <TableRow key={e.id}>
                                                <TableCell>
                                                    {e.sell_at.slice(0, 10)}
                                                </TableCell>
                                                <TableCell>
                                                    {e.service}
                                                </TableCell>
                                                <TableCell>
                                                    {e.commercial}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {e.sales} €
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {e.created_by}
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            openEdit(e)
                                                        }
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>

                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setDeleteTarget(e)
                                                        }
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )),
                                    ]
                                )}
                        </TableBody>
                    </Table>
                </div>

                {/* FOOTER */}
                <div className="flex justify-between items-center pt-4">
                    <p className="text-sm text-muted-foreground">
                        Total : {total.toLocaleString()} € —{" "}
                        {liveEntries.length} vente(s)
                    </p>
                    <Button variant="outline" onClick={handleExportPDF}>
                        Exporter PDF
                    </Button>
                </div>

                {/* ───────── EDIT DIALOG ───────── */}
                <Dialog
                    open={!!editEntry}
                    onOpenChange={() => setEditEntry(null)}
                >
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Modifier l’entrée</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <Input
                                type="date"
                                value={form.date}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        date: e.target.value,
                                    })
                                }
                            />

                            <Select
                                value={form.service}
                                onValueChange={(v) =>
                                    setForm({ ...form, service: v })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Service" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Handpick">
                                        Handpick
                                    </SelectItem>
                                    <SelectItem value="Grossiste">
                                        Grossiste
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                            {/* COMMERCIAL SELECT */}
                            <Select
                                value={form.commercial}
                                onValueChange={(value) =>
                                    setForm({ ...form, commercial: value })
                                }
                                defaultValue={form.commercial}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Sélectionner un commercial" />
                                </SelectTrigger>
                                <SelectContent>
                                    {commercialUsers.map((u) => (
                                        <SelectItem
                                            key={u.user_id}
                                            value={u.full_name}
                                        >
                                            {u.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Input
                                type="number"
                                placeholder="Chiffre d’affaire"
                                value={form.sales}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        sales: e.target.value,
                                    })
                                }
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setEditEntry(null)}
                            >
                                Annuler
                            </Button>
                            <Button onClick={handleUpdate}>Enregistrer</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ───────── DELETE CONFIRM ───────── */}
                {deleteTarget && (
                    <Dialog
                        open={!!deleteTarget}
                        onOpenChange={(nextOpen) => {
                            if (!nextOpen) setDeleteTarget(null)
                        }}
                    >
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>
                                    Supprimer cette entrée ?
                                </DialogTitle>
                                <DialogDescription>
                                    Cette action est définitive et supprimera la
                                    vente sélectionnée.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex justify-end gap-2">
                                <DialogClose asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setDeleteTarget(null)}
                                    >
                                        Annuler
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => {
                                        deleteEntry(deleteTarget.id)
                                        setDeleteTarget(null)
                                        if (liveEntries.length === 1)
                                            setOpen(false)
                                    }}
                                >
                                    Supprimer
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </DialogContent>
        </Dialog>
    )
}
