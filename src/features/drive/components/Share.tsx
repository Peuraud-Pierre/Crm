import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { useProfilesCtx } from "@/shared/context/ProfilesProvider"
import { useShareCtx } from "@/features/drive/context/ShareProvider"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { Minus, Plus, Search } from "lucide-react"
import { useMemo } from "react"

export default function Share() {
    const { user } = useAuth()

    const { profiles } = useProfilesCtx()

    const {
        shareOpen,
        setShareOpen,
        shareFilter,
        setShareFilter,
        shareTargets,
        loading,
        error,
        itemIds,
        toggleTarget,
        submitShare,
    } = useShareCtx()

    const selectedCount = Object.values(shareTargets).filter(Boolean).length

    const filtered = useMemo(() => {
        if (!profiles) return []

        return profiles
            .filter((c) => c.user_id !== user?.user_id) // ⛔ Exclut l'utilisateur connecté
            .filter(
                (c) =>
                    c.full_name
                        ?.toLowerCase()
                        .includes(shareFilter.toLowerCase()) ||
                    c.email?.toLowerCase().includes(shareFilter.toLowerCase())
            )
    }, [profiles, shareFilter, user?.user_id])

    return (
        <Sheet open={shareOpen} onOpenChange={setShareOpen}>
            <SheetContent className="w-[420px] sm:w-[480px]">
                <SheetHeader>
                    <SheetTitle>
                        Gérer le partage ({itemIds.length} photo
                        {itemIds.length > 1 ? "s" : ""})
                    </SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-4">
                    {/* Champ de recherche */}
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un contact…"
                            value={shareFilter}
                            onChange={(e) => setShareFilter(e.target.value)}
                            className="pl-8"
                        />
                    </div>

                    {/* Liste des utilisateurs */}
                    <div className="max-h-[55vh] space-y-2 overflow-auto pr-2">
                        {filtered.map((c) => {
                            const hasAccess = !!shareTargets[c.user_id]
                            return (
                                <label
                                    key={c.user_id}
                                    className={`flex items-center justify-between rounded-xl border p-3 transition hover:bg-muted/30 ${
                                        hasAccess ? "border-green-400" : ""
                                    }`}
                                >
                                    <div>
                                        <div className="font-medium">
                                            {c.full_name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {c.role?.nom ?? ""} •{" "}
                                            {c.service?.nom ?? ""}
                                        </div>
                                    </div>

                                    <Button
                                        variant={
                                            hasAccess
                                                ? "destructive"
                                                : "outline"
                                        }
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => toggleTarget(c.user_id)}
                                    >
                                        {hasAccess ? (
                                            <>
                                                <Minus className="h-4 w-4" />{" "}
                                                Retirer
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4" />{" "}
                                                Ajouter
                                            </>
                                        )}
                                    </Button>
                                </label>
                            )
                        })}
                    </div>
                </div>

                {/* Pied de tiroir */}
                <SheetFooter className="mt-4">
                    <div className="flex w-full items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                            {selectedCount} destinataire
                            {selectedCount > 1 ? "s" : ""}
                        </div>
                        {error && (
                            <div className="text-sm text-red-500">{error}</div>
                        )}

                        <Button
                            onClick={() => {
                                submitShare()
                            }}
                            disabled={!itemIds.length || loading}
                        >
                            {loading
                                ? "Chargement..."
                                : selectedCount > 0
                                ? "Mettre à jour le partage"
                                : "Supprimer toutes les permissions"}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
