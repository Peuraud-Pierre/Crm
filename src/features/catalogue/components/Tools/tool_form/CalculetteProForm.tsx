import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Card, CardContent } from "@/shared/ui/atoms/card"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/atoms/select"
import { AlertCircle, Euro, Trash2 } from "lucide-react"

type ColumnKey =
  | "stock"
  | "export"
  | "magasin"
  | "kiloshop_ete"
  | "kiloshop_hiver"
  | "so3"
  | "client"

const COLUMNS: { key: ColumnKey; label: string; priceAllowed: boolean }[] = [
  { key: "stock", label: "Stock", priceAllowed: false },
  { key: "export", label: "Export", priceAllowed: false },
  { key: "magasin", label: "Magasin", priceAllowed: true },
  { key: "kiloshop_ete", label: "Kiloshop été", priceAllowed: true },
  { key: "kiloshop_hiver", label: "Kiloshop hiver", priceAllowed: true },
  { key: "so3", label: "SO3", priceAllowed: true },
  { key: "client", label: "Client", priceAllowed: true },
]

export function CalculetteProForm({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  // === Form basics ===
  const [category, setCategory] = useState<string>("Chemise")
  const [unitMode, setUnitMode] = useState<"kg" | "pc">("kg") // kg or piece
  const [prixTotal, setPrixTotal] = useState<number | "">("")
  const [totalQuantity, setTotalQuantity] = useState<number | "">("")

  // charge mode: perKg, perPc, fixed
  const [chargeMode, setChargeMode] = useState<"perKg" | "perPc" | "fixed">(
    "perKg"
  )
  const [chargeValue, setChargeValue] = useState<number | "">("")

  // table state: quantity and unit price for each column
  const [table, setTable] = useState<
    Record<
      ColumnKey,
      {
        qty: number | ""
        unitPrice: number | ""
      }
    >
  >(
    COLUMNS.reduce((acc, c) => {
      acc[c.key] = { qty: "", unitPrice: "" }
      return acc
    }, {} as Record<ColumnKey, { qty: number | ""; unitPrice: number | "" }>)
  )

  // results visibility
  const [showResults, setShowResults] = useState(false)

  // helper parse
  const num = (v: number | string | "") =>
    v === "" || v === null || v === undefined ? 0 : Number(v)

  const fmt = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // derived computations
  const totalQty = num(totalQuantity)
  const prix = num(prixTotal)
  const chargeVal = num(chargeValue)

  // Compute charge total according to mode and unitMode
  const chargeTotal = (() => {
    if (!totalQty) return 0
    if (chargeMode === "fixed") return chargeVal
    if (chargeMode === "perKg") {
      // if unitMode is pc but charge is perKg, interpret as per physical kg (user should choose appropriate)
      return (unitMode === "kg" ? totalQty : totalQty) * chargeVal
    }
    // perPc
    return totalQty * chargeVal
  })()

  // unit cost (coût matière + charges) per unit (kg or pc)
  const unitCost = totalQty > 0 ? (prix + chargeTotal) / totalQty : 0

  // sum quantities in table
  const sumAllocated = COLUMNS.reduce((s, c) => s + num(table[c.key].qty), 0)

  const allocationValid = sumAllocated <= totalQty && totalQty > 0

  // revenue per column and totals
  const breakdown = COLUMNS.map((c) => {
    const qty = num(table[c.key].qty)
    const unitPrice = num(table[c.key].unitPrice)
    const revenue = c.priceAllowed ? qty * unitPrice : 0
    const cost = qty * unitCost // cost of goods for that qty
    const profit = revenue - cost
    return { key: c.key, label: c.label, qty, unitPrice, revenue, cost, profit }
  })

  const totals = breakdown.reduce(
    (acc, r) => {
      acc.qty += r.qty
      acc.revenue += r.revenue
      acc.cost += r.cost
      acc.profit += r.profit
      return acc
    },
    { qty: 0, revenue: 0, cost: 0, profit: 0 }
  )

  // Validation messages
  const validationMessages: string[] = []
  if (!totalQty || totalQty <= 0) validationMessages.push("Quantité totale invalide.")
  if (!prix || prix <= 0) validationMessages.push("Prix d'achat total invalide.")
  if (!allocationValid)
    validationMessages.push(
      sumAllocated > totalQty
        ? `Total réparti (${sumAllocated}) dépasse la quantité totale (${totalQty}).`
        : `Répartissez la quantité (somme = ${sumAllocated}).`
    )

  const handleTableChange = (key: ColumnKey, field: "qty" | "unitPrice", val: string) => {
    setTable((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val === "" ? "" : Number(val) } }))
  }

  const handleReset = () => {
    setCategory("Chemise")
    setUnitMode("kg")
    setPrixTotal("")
    setTotalQuantity("")
    setChargeMode("perKg")
    setChargeValue("")
    setTable(
      COLUMNS.reduce((acc, c) => {
        acc[c.key] = { qty: "", unitPrice: "" }
        return acc
      }, {} as Record<ColumnKey, { qty: number | ""; unitPrice: number | "" }>)
    )
    setShowResults(false)
  }

  const handleCalculate = () => {
    if (validationMessages.length > 0) {
      alert("Merci de corriger :\n" + validationMessages.join("\n"))
      return
    }
    setShowResults(true)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-5xl max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Calculette — Répartition & Marges</DialogTitle>
        </DialogHeader>

        <Card className="mt-4">
          <CardContent className="space-y-4">
            {/* Header form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 space-y-2 items-end">
              <div>
                <Label>Catégorie de balle</Label>
                <Select value={category} onValueChange={(v) => setCategory(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Chemise">Chemise</SelectItem>
                    <SelectItem value="Veste cuir">Veste cuir</SelectItem>
                    <SelectItem value="Foulard">Foulard</SelectItem>
                    <SelectItem value="Chaussures">Chaussures</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type</Label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="unitMode"
                      checked={unitMode === "kg"}
                      onChange={() => setUnitMode("kg")}
                    />
                    <span className="text-sm">Au kg</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="unitMode"
                      checked={unitMode === "pc"}
                      onChange={() => setUnitMode("pc")}
                    />
                    <span className="text-sm">À la pièce</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Prix d'achat (total)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={prixTotal === "" ? "" : String(prixTotal)}
                      onChange={(e) => setPrixTotal(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Ex: 230.00"
                      className="pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      <Euro size={14} />
                    </span>
                  </div>
                </div>

                <div>
                  <Label>{unitMode === "kg" ? "Poids total (kg)" : "Quantité totale (pcs)"}</Label>
                  <Input
                    type="number"
                    value={totalQuantity === "" ? "" : String(totalQuantity)}
                    onChange={(e) => setTotalQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={unitMode === "kg" ? "Ex: 75" : "Ex: 120"}
                  />
                </div>
              </div>
            </div>

            {/* Charges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <Label>Taux de charge</Label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="chargeMode"
                      checked={chargeMode === "perKg"}
                      onChange={() => setChargeMode("perKg")}
                    />
                    <span className="text-sm">€/kg</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="chargeMode"
                      checked={chargeMode === "perPc"}
                      onChange={() => setChargeMode("perPc")}
                    />
                    <span className="text-sm">€/pc</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="chargeMode"
                      checked={chargeMode === "fixed"}
                      onChange={() => setChargeMode("fixed")}
                    />
                    <span className="text-sm">Fixe</span>
                  </label>
                </div>
              </div>

              <div>
                <Label>Valeur charge</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={chargeValue === "" ? "" : String(chargeValue)}
                    onChange={(e) => setChargeValue(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={chargeMode === "fixed" ? "Montant fixe" : "Ex: 3.5"}
                  />
                  <span className="text-sm text-muted-foreground">
                    {chargeMode === "perKg" ? "€/kg" : chargeMode === "perPc" ? "€/pc" : "€"}
                  </span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <div>
                  <strong>Coût unité estimé :</strong>{" "}
                  {totalQty > 0 ? `${fmt(unitCost)} ${unitMode === "kg" ? "€/kg" : "€/pc"}` : "—"}
                </div>
                <div className="mt-1">
                  <small className="flex items-center gap-2">
                    <AlertCircle size={14} />{" "}
                    {sumAllocated > totalQty
                      ? `Attention : ${sumAllocated} > ${totalQty} (somme répartie dépasse)` 
                      : `Réparti : ${sumAllocated} / ${totalQty}`}
                  </small>
                </div>
              </div>
            </div>

            {/* Table répartition */}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-2">Canal</th>
                    <th className="p-2 w-36">Quantité</th>
                    <th className="p-2 w-40">Prix unité ({unitMode === "kg" ? "€/kg" : "€/pc"})</th>
                    <th className="p-2 text-right w-36">Revenu</th>
                    <th className="p-2 text-right w-36">Coût</th>
                    <th className="p-2 text-right w-36">Profit</th>
                  </tr>
                </thead>

                <tbody>
                  {breakdown.map((row) => (
                    <tr key={row.key} className="border-t">
                      <td className="p-2 align-top">{row.label}</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={table[row.key].qty === "" ? "" : String(table[row.key].qty)}
                          onChange={(e) => handleTableChange(row.key as ColumnKey, "qty", e.target.value)}
                          aria-label={`${row.label} quantité`}
                        />
                      </td>

                      <td className="p-2">
                        {COLUMNS.find((c) => c.key === row.key)?.priceAllowed ? (
                          <Input
                            type="number"
                            value={table[row.key].unitPrice === "" ? "" : String(table[row.key].unitPrice)}
                            onChange={(e) => handleTableChange(row.key as ColumnKey, "unitPrice", e.target.value)}
                            aria-label={`${row.label} prix unitaire`}
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground">—</div>
                        )}
                      </td>

                      <td className="p-2 text-right">{fmt(row.revenue)} €</td>
                      <td className="p-2 text-right">{fmt(row.cost)} €</td>
                      <td className={`p-2 text-right ${row.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {row.profit >= 0 ? "+" : "–"}{fmt(Math.abs(row.profit))} €
                      </td>
                    </tr>
                  ))}

                  {/* Totals */}
                  <tr className="border-t font-semibold">
                    <td className="p-2">Total</td>
                    <td className="p-2">{totals.qty}</td>
                    <td className="p-2">—</td>
                    <td className="p-2 text-right">{fmt(totals.revenue)} €</td>
                    <td className="p-2 text-right">{fmt(totals.cost)} €</td>
                    <td className={`p-2 text-right ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {totals.profit >= 0 ? "+" : "–"}{fmt(Math.abs(totals.profit))} €
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Résumé & actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
              <div className="text-sm space-y-1">
                <div><strong>Coût total (achat + charges) :</strong> {fmt(prix + chargeTotal)} €</div>
                <div><strong>Charge totale :</strong> {fmt(chargeTotal)} €</div>
                <div><strong>Prix unité réel (PR) :</strong> {totalQty>0 ? `${fmt(unitCost)} ${unitMode === "kg" ? "€/kg" : "€/pc"}` : "—"}</div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
                  <Trash2 size={14} /> Réinitialiser
                </Button>
                <Button onClick={handleCalculate} className="bg-success hover:bg-success/90 text-success-foreground">
                  Calculer
                </Button>
              </div>
            </div>

            {/* Résultats détaillés -> affichés si showResults true */}
            {showResults && (
              <div className="mt-4 border rounded-lg p-4 bg-muted/10">
                <h3 className="font-semibold mb-2">Synthèse finale</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div><strong>Revenu total : </strong>{fmt(totals.revenue)} €</div>
                    <div className="text-muted-foreground">Somme des ventes renseignées</div>
                  </div>
                  <div>
                    <div><strong>Coût total :</strong> {fmt(totals.cost)} €</div>
                    <div className="text-muted-foreground">Coût matière calculé via PR × quantités</div>
                  </div>
                  <div>
                    <div>
                      <strong>Profit total :</strong>{" "}
                      <span className={totals.profit >= 0 ? "text-green-600" : "text-red-600"}>
                        {totals.profit >= 0 ? "+" : "–"}{fmt(Math.abs(totals.profit))} €
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Marge: {totalQty>0 ? fmt((totals.profit / (prix + chargeTotal)) * 100) : "—"} %
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}
