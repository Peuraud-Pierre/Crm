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
import {
    RadioGroup,
    RadioGroupItem,
} from "@/shared/ui/atoms/radio-group"
import { Euro, Scale, Settings } from "lucide-react"
import { CalculetteResult } from "../tool_result/CalculetteResult"

export function CalculetteForm({
    open,
    setOpen,
}: {
    open: boolean
    setOpen: (open: boolean) => void
}) {
    const [showResult, setShowResult] = useState(false)
    const [form, setForm] = useState({
        prix: "",
        poid: "",
        chargeKg: "",
    })

    const handleChange = (field: string, value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }))

    const handleSubmit = () => {
        if (!form.prix || !form.poid) return alert("Merci de renseigner tous les champs.")
        setShowResult(true)
    }

    const handleReset = () => {
        setForm({ prix: "", poid: "", chargeKg: "" })
        setShowResult(false)
    }

    if (showResult) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Résultats de la simulation</DialogTitle>
                    </DialogHeader>
                    <CalculetteResult data={form} onReset={handleReset} />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Settings className="text-green-600" /> Nouvelle simulation
                    </DialogTitle>
                </DialogHeader>

                <Card className="border-0 shadow-none">
                    <CardContent className="space-y-6 pt-4">
                        {/* === Champs prix & poids === */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="prix" className="flex items-center gap-1">
                                        <Euro size={16} /> Prix d’achat
                                    </Label>
                                    {/* <span className="text-xs text-muted-foreground">
                                        Total de la balle
                                    </span> */}
                                </div>
                                <Input
                                    onChange={(e) => handleChange("prix", e.target.value)}
                                    id="prix"
                                    type="number"
                                    value={form.prix}
                                    placeholder="ex : 230"
                                    className="text-right"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="poid" className="flex items-center gap-1">
                                        <Scale size={16} /> Poids
                                    </Label>
                                    <span className="text-xs text-muted-foreground">
                                        En kilogrammes
                                    </span>
                                </div>
                                <Input
                                    onChange={(e) => handleChange("poid", e.target.value)}
                                    id="poid"
                                    type="number"
                                    value={form.poid}
                                    placeholder="ex : 75"
                                    className="text-right"
                                />
                            </div>
                        </div>

                        {/* === Sélecteur de taux de charge === */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-1">
                                    <Settings size={16} /> Taux de charge au kg
                                </Label>
                                {/* <div className="flex items-center text-xs text-muted-foreground">
                                    <Info size={14} className="mr-1" />
                                    Coût du traitement/balle
                                </div> */}
                            </div>

                            <RadioGroup
                                onValueChange={(value) =>
                                    handleChange("chargeKg", value)
                                }
                                className="grid grid-cols-3 gap-3"
                            >
                                {[
                                    { label: "0 €", value: "0" },
                                    { label: "3.5 €/kg", value: "3.5" },
                                    { label: "5.2 €/kg", value: "5.2" },
                                ].map((opt) => (
                                    <div
                                        key={opt.value}
                                        className={`flex items-center justify-center border rounded-lg p-2 cursor-pointer transition hover:bg-muted/50 ${
                                            form.chargeKg === opt.value
                                                ? "border-green-600 bg-green-50"
                                                : "border-muted"
                                        }`}
                                    >
                                        <RadioGroupItem value={opt.value} id={opt.value} />
                                        <Label htmlFor={opt.value} className="ml-2">
                                            {opt.label}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        {/* === Bouton calcul === */}
                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleSubmit}
                                className="bg-success hover:bg-success/90 text-success-foreground"
                            >
                                Calculer
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </DialogContent>
        </Dialog>
    )
}
