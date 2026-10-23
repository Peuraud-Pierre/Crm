import Modal from "@/features/sorters/components/Modal/Modal"
import Table from "@/features/sorters/components/Table"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useSorters } from "@/features/sorters/context/SortersProvider"
import { Loader2, Shield } from "lucide-react"

export default function Main() {
    const {
        loading,
        setFilter,
        search,
        setSearch,
        filteredReports,
        adminView,
    } = useSorters()

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p>Chargement des rapports de tri...</p>
            </div>
        )
    }

    return (
        <div className="w-full space-y-4 p-4">
            <Card className="shadow-md rounded-2xl border-border">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-xl font-semibold">
                            {adminView
                                ? "Gestion des rapports de tri"
                                : "Rapports de tri"}
                        </CardTitle>
                        {adminView && (
                            <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                <Shield className="w-3 h-3" /> Admin
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Input
                            placeholder="Rechercher..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-56"
                        />
                        <Select onValueChange={setFilter} defaultValue="all">
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Catégorie" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes</SelectItem>
                                <SelectItem value="tshirt">T-Shirts</SelectItem>
                                <SelectItem value="pants">Pantalons</SelectItem>
                                <SelectItem value="shoes">
                                    Chaussures
                                </SelectItem>
                                <SelectItem value="accessory">
                                    Accessoires
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>

                <CardContent>
                    {filteredReports.length === 0 ? (
                        <p className="text-center text-muted-foreground italic">
                            Aucun rapport trouvé.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* --- FORMULAIRE MODAL --- */}
            <Modal />
        </div>
    )
}
