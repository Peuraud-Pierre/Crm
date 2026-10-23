import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
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
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { staggerStyle } from "@/shared/lib/motion"
import { Pencil, Receipt, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

export function EntryList() {
    const { entries, updateEntry, deleteEntry } = useSellJournalContext()
    const [openEntry, setOpenEntry] = useState(false)
    const [editEntry, setEditEntry] = useState<JournalEntry>({} as JournalEntry)
    const [openDeleteTarget, setOpenDeleteTarget] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<JournalEntry>(
        {} as JournalEntry
    )

    const [form, setForm] = useState({
        date: "",
        service: "",
        commercial: "",
        sales: "",
    })

    /* ───────────── DATE DU JOUR ───────────── */
    const today = new Date().toISOString().slice(0, 10)

    /* ───────────── FILTRE : ENTRÉES DU JOUR ───────────── */
    const todayEntries = useMemo(() => {
        return entries.filter((e) => e.created_at?.slice(0, 10) === today)
    }, [entries, today])

    const { profiles } = useProfilesCtx()
    const commercialUsers = useMemo(
        () =>
            profiles?.filter((p) => p.service?.nom === "Commercial") ?? [],
        [profiles]
    )

    const openEdit = (entry: JournalEntry) => {
        setForm({
            date: entry.sell_at.slice(0, 10),
            service: entry.service,
            commercial: entry.commercial,
            sales: entry.sales,
        })
        setEditEntry(entry)
        setOpenEntry(true)
    }

    const handleUpdate = () => {
        updateEntry(
            editEntry.id,
            form.date,
            form.service,
            form.commercial,
            form.sales
        )
        setEditEntry({} as JournalEntry)
        setOpenEntry(false)
    }

    return (
        <>
            {/* TABLE */}
            <div className="border rounded-lg shadow-sm overflow-hidden">
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
                        {todayEntries.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="py-0">
                                    <EmptyState
                                        size="sm"
                                        icon={Receipt}
                                        title="Aucune entrée aujourd’hui"
                                        description="Les ventes saisies aujourd’hui apparaîtront ici."
                                    />
                                </TableCell>
                            </TableRow>
                        )}

                        {todayEntries.map((e, i) => (
                            <TableRow
                                key={e.id}
                                style={staggerStyle(i, { step: 30, cap: 300 })}
                                className="animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-slow ease-out"
                            >
                                <TableCell>{e.sell_at.slice(0, 10)}</TableCell>
                                <TableCell>{e.service}</TableCell>
                                <TableCell>{e.commercial}</TableCell>
                                <TableCell>{e.sales} €</TableCell>
                                <TableCell>{e.created_by}</TableCell>

                                <TableCell className="text-right space-x-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openEdit(e)}
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setDeleteTarget(e)
                                            setOpenDeleteTarget(true)
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* ───────────── EDIT DIALOG ───────────── */}
            <Dialog open={openEntry} onOpenChange={() => setOpenEntry(false)}>
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
                            onClick={() => {
                                setEditEntry({} as JournalEntry)
                                setOpenEntry(false)
                            }}
                        >
                            Annuler
                        </Button>
                        <Button onClick={handleUpdate}>Enregistrer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ───────────── DELETE CONFIRMATION ───────────── */}
            <Dialog
                open={openDeleteTarget}
                onOpenChange={() => setOpenDeleteTarget(false)}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Supprimer cette entrée ?</DialogTitle>
                    </DialogHeader>

                    <p className="text-sm text-muted-foreground">
                        Cette action est irréversible.
                    </p>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteTarget({} as JournalEntry)
                                setOpenDeleteTarget(false)
                            }}
                        >
                            Annuler
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                deleteEntry(deleteTarget.id)
                                setDeleteTarget({} as JournalEntry)
                                setOpenDeleteTarget(false)
                            }}
                        >
                            Supprimer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
