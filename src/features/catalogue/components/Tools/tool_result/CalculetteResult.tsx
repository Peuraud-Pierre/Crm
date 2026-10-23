import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { TrendingUp, ArrowLeft, Scale, Euro, Settings } from "lucide-react"

export function CalculetteResult({
    data,
    onReset,
}: {
    data: { prix: string; poid: string; chargeKg: string }
    onReset: () => void
}) {
    const { prix, poid, chargeKg } = data
    const p = Number(prix) || 0
    const kg = Number(poid) || 0
    const charge = Number(chargeKg) || 0

    const totalCharge = kg * charge
    const coutTotal = p + totalCharge

    const marges = [10, 20, 30, 40, 50].map((m) => {
        const prixVente = coutTotal * (1 + m / 100)
        const benef = prixVente - coutTotal
        return { taux: m, prixVente, benef }
    })

    const fmt = (n: number) =>
        n.toLocaleString("fr-FR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })

    return (
        <Card className="shadow-md border">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <TrendingUp className="text-green-600" /> Résultat de la simulation
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
                {/* --- Coût total mis en avant --- */}
                <div className="p-5 rounded-xl border-2 border-success bg-success-light text-center">
                    <p className="text-sm uppercase tracking-wide text-success font-medium">
                        Coût total après charge
                    </p>
                    <p className="text-3xl sm:text-4xl font-bold text-success mt-1">
                        {fmt(coutTotal)} €
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        (Prix d’achat + charges totales)
                    </p>
                </div>

                {/* --- Détails secondaires --- */}
                <div className="bg-muted/30 p-4 rounded-lg text-sm sm:text-base grid grid-cols-1 sm:grid-cols-3 gap-3 text-muted-foreground">
                    <p className="flex items-center gap-2">
                        <Euro size={16} className="text-green-600" /> Achat :{" "}
                        <span className="font-medium text-foreground">{fmt(p)} €</span>
                    </p>
                    <p className="flex items-center gap-2">
                        <Scale size={16} className="text-green-600" /> Poids :{" "}
                        <span className="font-medium text-foreground">{fmt(kg)} kg</span>
                    </p>
                    <p className="flex items-center gap-2">
                        <Settings size={16} className="text-green-600" /> Charge :{" "}
                        <span className="font-medium text-foreground">
                            {fmt(charge)} €/kg
                        </span>
                    </p>
                </div>

                {/* --- Tableau --- */}
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-center">
                        <thead className="bg-success text-success-foreground">
                            <tr>
                                <th className="p-2">Marge</th>
                                <th className="p-2">Prix de vente</th>
                                <th className="p-2">Bénéfice</th>
                            </tr>
                        </thead>
                        <tbody>
                            {marges.map((m) => (
                                <tr
                                    key={m.taux}
                                    className="border-t hover:bg-muted/50 transition"
                                >
                                    <td className="p-2 font-medium">{m.taux}%</td>
                                    <td className="p-2">{fmt(m.prixVente)} €</td>
                                    <td className="p-2 text-green-700 font-semibold">
                                        +{fmt(m.benef)} €
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* --- Boutons --- */}
                <div className="flex justify-end mt-4 gap-2">
                    <Button
                        onClick={onReset}
                        variant="outline"
                        className="flex items-center gap-1"
                    >
                        <ArrowLeft size={16} /> Nouvelle simulation
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
