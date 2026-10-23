import { useState, useEffect } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    fetchServices as fetchServicesList,
    type ServiceOption as Service,
} from "../services/watchConfigService"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Button } from "@/shared/ui/atoms/button"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { Label } from "@/shared/ui/atoms/label"
import { Loader2, ServerOff } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

interface ConfigServicesModalProps {
    configId: number
    configName: string
    currentServiceIds: string[] | null
    isOpen: boolean
    onClose: () => void
    onSave: (id: number, serviceIds: string[] | null) => Promise<boolean>
}

export function ConfigServicesModal({
    configId,
    configName,
    currentServiceIds,
    isOpen,
    onClose,
    onSave,
}: ConfigServicesModalProps) {
    const { user } = useAuth()
    const [services, setServices] = useState<Service[]>([])
    const [selectedServices, setSelectedServices] = useState<Set<string>>(
        () => new Set()
    )
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Charger les services disponibles
    useEffect(() => {
        if (!isOpen || !user) return

        const fetchServices = async () => {
            try {
                setLoading(true)
                setError(null)

                const data = await fetchServicesList()

                setServices(data)
                // Initialiser les services sélectionnés
                setSelectedServices(new Set(currentServiceIds ?? []))
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Erreur lors du chargement des services"
                setError(message)
            } finally {
                setLoading(false)
            }
        }

        fetchServices()
    }, [isOpen, user, currentServiceIds])

    const handleServiceToggle = (serviceId: string) => {
        const newSelected = new Set(selectedServices)
        if (newSelected.has(serviceId)) {
            newSelected.delete(serviceId)
        } else {
            newSelected.add(serviceId)
        }
        setSelectedServices(newSelected)
    }

    const handleToggleAll = () => {
        if (selectedServices.size === services.length) {
            setSelectedServices(new Set())
        } else {
            setSelectedServices(new Set(services.map((s) => s.id)))
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            const serviceIds =
                selectedServices.size > 0 ? Array.from(selectedServices) : null
            const success = await onSave(configId, serviceIds)

            if (success) {
                onClose()
            } else {
                setError("Erreur lors de la sauvegarde des services")
            }
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Erreur lors de la sauvegarde"
            setError(message)
        } finally {
            setSaving(false)
        }
    }

    const allSelected =
        selectedServices.size === services.length && services.length > 0
    const someSelected =
        selectedServices.size > 0 && selectedServices.size < services.length

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Services de {configName}</DialogTitle>
                    <DialogDescription>
                        Sélectionnez les services associés à cette
                        configuration. Laisser vide signifie que tous les
                        services sont inclus.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <p className="text-muted-foreground text-sm">
                                    Chargement des services...
                                </p>
                            </div>
                        </div>
                    ) : services.length === 0 ? (
                        <EmptyState
                            icon={ServerOff}
                            size="sm"
                            title="Aucun service disponible"
                        />
                    ) : (
                        <div className="space-y-3">
                            {/* Toggle all */}
                            <div className="p-3 rounded-lg border border-muted bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Checkbox
                                            id="toggle-all"
                                            checked={allSelected}
                                            onCheckedChange={handleToggleAll}
                                        />
                                        {someSelected && (
                                            <div className="absolute inset-0 pointer-events-none" />
                                        )}
                                    </div>
                                    <Label
                                        htmlFor="toggle-all"
                                        className="font-medium cursor-pointer flex-1 mb-0"
                                    >
                                        Tous les services
                                    </Label>
                                </div>
                            </div>

                            {/* Services list */}
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {services.map((service) => (
                                    <div
                                        key={service.id}
                                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition"
                                    >
                                        <Checkbox
                                            id={`service-${service.id}`}
                                            checked={selectedServices.has(
                                                service.id
                                            )}
                                            onCheckedChange={() =>
                                                handleServiceToggle(service.id)
                                            }
                                        />
                                        <Label
                                            htmlFor={`service-${service.id}`}
                                            className="cursor-pointer flex-1 mb-0"
                                        >
                                            {service.nom}
                                        </Label>
                                    </div>
                                ))}
                            </div>

                            {/* Info message */}
                            {selectedServices.size === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                    Aucun service sélectionné = tous les
                                    services inclus
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving || loading}
                    >
                        Annuler
                    </Button>
                    <Button onClick={handleSave} disabled={loading} loading={saving}>
                        {saving ? "Sauvegarde…" : "Sauvegarder"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
