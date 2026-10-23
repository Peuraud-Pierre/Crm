import { useState } from "react"
import type {
    TicketCategory,
    TicketConsoleExpedior,
    TicketType,
} from "../../components/types" // Vérifie tes chemins
import { TICKET_TYPE_OPTIONS } from "../../components/types"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/shared/ui/atoms/sheet"
import {
    Send,
    Bug,
    Sparkles,
    MessageSquare,
    FileText,
} from "lucide-react"
import { toast } from "sonner"
import { TICKET_THEME } from "../../ticket.theme"
import { useTicketContext } from "../../context/TicketContext"

// --- INTERFACE PROPS ---
interface TicketCreationSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TicketCreationSheet({
    open,
    onOpenChange,
}: TicketCreationSheetProps) {
    const { createTicket } = useTicketContext()
    const [isLoading, setIsLoading] = useState(false)

    // --- STATE FORMULAIRE ---
    const initialFormState = {
        title: "",
        description: "",
        category: "bug" as TicketCategory,
        from: "Nokk_project" as TicketConsoleExpedior,
        type: "" as TicketType | "",
    }
    const [formData, setFormData] = useState(initialFormState)

    // --- HANDLER ---
    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()

        // Validation simple
        if (!formData.title.trim() || !formData.description.trim()) {
            toast.error("Veuillez remplir le titre et la description.")
            return
        }

        setIsLoading(true)

        try {
            await createTicket({
                title: formData.title,
                description: formData.description,
                category: formData.category,
                from: formData.from,
                type: formData.type ? (formData.type as TicketType) : null,
                status: "ouvert",
                priority: "nouveau",
            })

            setFormData(initialFormState) // Reset
            onOpenChange(false) // Fermer le sheet
            // Le toast de succès est déjà géré dans le contexte/hook
        } catch (error) {
            console.error(error)
            // Le toast d'erreur est géré dans le hook
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className={`sm:max-w-[500px] w-full flex flex-col ${TICKET_THEME.page.background} border-l dark:border-slate-800`}
            >
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    {/* --- HEADER --- */}
                    <SheetHeader className="pb-6 border-b dark:border-slate-800">
                        <SheetTitle
                            className={`text-xl font-black ${TICKET_THEME.page.text}`}
                        >
                            Nouveau Ticket
                        </SheetTitle>
                        <SheetDescription className="text-slate-500">
                            Décrivez votre problème ou votre suggestion. Nous la
                            traiterons dans les plus brefs délais.
                        </SheetDescription>
                    </SheetHeader>

                    {/* --- BODY (Scrollable) --- */}
                    <div className="flex-1 py-6 space-y-6 overflow-y-auto pr-2 px-2">
                        {/* Type */}
                        <div className="space-y-2.5">
                            <Label
                                className={`text-xs font-bold uppercase tracking-wider text-slate-500`}
                            >
                                Type de demande
                            </Label>
                            <Select
                                value={formData.category}
                                onValueChange={(val) =>
                                    setFormData({
                                        ...formData,
                                        category: val as TicketCategory,
                                    })
                                }
                            >
                                <SelectTrigger
                                    className={`${TICKET_THEME.input.base} h-11`}
                                >
                                    <SelectValue placeholder="Sélectionner le type" />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    <SelectItem value="bug">
                                        <div className="flex items-center gap-2">
                                            <Bug className="h-4 w-4 text-red-500" />
                                            <span>Signaler un Bug</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="amelioration">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-purple-500" />
                                            <span>Amélioration</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="feedback">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4 text-blue-500" />
                                            <span>Feedback</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="autre">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-slate-500" />
                                            <span>Autre</span>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Type métier */}
                        <div className="space-y-2.5">
                            <Label
                                className={`text-xs font-bold uppercase tracking-wider text-slate-500`}
                            >
                                Catégorie métier (optionnel)
                            </Label>
                            <Select
                                value={formData.type || "none"}
                                onValueChange={(val) =>
                                    setFormData({
                                        ...formData,
                                        type: val === "none" ? "" : (val as TicketType),
                                    })
                                }
                            >
                                <SelectTrigger
                                    className={`${TICKET_THEME.input.base} h-11`}
                                >
                                    <SelectValue placeholder="Sélectionner une catégorie" />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                    <SelectItem value="none">
                                        <span className="text-slate-500">Non classé</span>
                                    </SelectItem>
                                    {TICKET_TYPE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Titre */}
                        <div className="space-y-2.5">
                            <Label
                                htmlFor="title"
                                className={`text-xs font-bold uppercase tracking-wider text-slate-500`}
                            >
                                Sujet
                            </Label>
                            <Input
                                id="title"
                                placeholder="Ex: Impossible de télécharger le PDF..."
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        title: e.target.value,
                                    })
                                }
                                className={`${TICKET_THEME.input.base} h-11`}
                                autoFocus
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2.5">
                            <Label
                                htmlFor="description"
                                className={`text-xs font-bold uppercase tracking-wider text-slate-500`}
                            >
                                Détails
                            </Label>
                            <Textarea
                                id="description"
                                placeholder="Expliquez le contexte, les étapes pour reproduire..."
                                className={`min-h-[200px] resize-none ${TICKET_THEME.input.base} p-4 leading-relaxed`}
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        description: e.target.value,
                                    })
                                }
                            />
                        </div>
                    </div>

                    {/* --- FOOTER (Actions) --- */}
                    <SheetFooter className="pt-6 border-t dark:border-slate-800 flex-col sm:flex-row gap-3 sm:space-x-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                            className="w-full sm:w-auto text-slate-500 hover:text-slate-200 dark:hover:text-slate-200"
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            disabled={!formData.title || !formData.description}
                            loading={isLoading}
                            className={`w-full sm:w-auto ${TICKET_THEME.button.primary} px-8`}
                        >
                            {isLoading ? (
                                "Envoi…"
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" /> Envoyer la
                                    demande
                                </>
                            )}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    )
}
