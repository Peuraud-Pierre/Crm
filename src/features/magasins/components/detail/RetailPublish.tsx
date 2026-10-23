import { Send } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/atoms/select"
import type { useRetailLayout } from "@/features/magasins/hooks/data/useRetailLayout"
import type { Magasin } from "@/features/magasins/types/magasin.types"

/** Valeur du choix « aucune boutique » : Radix refuse une valeur vide. */
const NONE = "none"

interface RetailPublishProps {
    magasin: Magasin
    retail: ReturnType<typeof useRetailLayout>
}

/**
 * Boutique de la console retail qui voit ce plan, et publication. La
 * boutique ne voit que la dernière version publiée.
 */
export function RetailPublish({ magasin, retail }: RetailPublishProps) {
    const { shops, shopsError, busy, link, publish } = retail
    const linked = magasin.retail_shop_id
    // Boutique supprimée côté retail : on la garde lisible plutôt que vide.
    const missing = linked && shops.length > 0 && !shops.some((s) => s.id === linked)

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Select
                value={linked ?? NONE}
                onValueChange={(v) => void link(v === NONE ? null : v)}
                disabled={busy || Boolean(shopsError)}
            >
                <SelectTrigger className="h-9 w-56" aria-label="Boutique retail">
                    <SelectValue placeholder={shopsError ?? "Boutique retail"} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={NONE}>Aucune boutique retail</SelectItem>
                    {missing && <SelectItem value={linked}>Boutique introuvable</SelectItem>}
                    {shops.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                            {s.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => void publish()} disabled={!linked || busy}>
                <Send size={14} /> Publier
            </Button>
            {linked && (
                <span className="text-xs text-muted-foreground">
                    {magasin.retail_published_at
                        ? `Publié le ${new Date(magasin.retail_published_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`
                        : "Jamais publié"}
                </span>
            )}
        </div>
    )
}
