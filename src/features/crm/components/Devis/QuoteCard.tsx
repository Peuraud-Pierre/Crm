import React from "react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/shared/ui/atoms/card"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    Edit,
    Trash,
    MoreVertical,
    FileText,
    Send,
    Archive,
    User,
    Building2,
    Calendar,
    AlertCircle, // <-- ICÔNE AJOUTÉE ICI
} from "lucide-react"
import { cn } from "@/shared/lib/utils"

import { type Devis } from "@/features/crm/hooks/CRM_hook/use_devis"
import { type AppUser } from "@/features/auth/hooks/useAuth"
import { useQuoteActions } from "./Quotes/QuoteAction"
import { NokkProjectLogo, VintageLogo, DarkVintage } from "../Devis/pdfvisuel"

interface QuoteCardProps {
    quote: Devis & { urgence?: "normale" | "haute" | "élevée" | null } // <-- J'assure le typage si pas encore fait globalement
    user: AppUser | null
    round2: (n: number) => number
    onArchive: (q: Devis) => void
    onDelete: (q: Devis) => void
    onEdit: (q: Devis) => void
}

export const QuoteCard: React.FC<QuoteCardProps> = React.memo(
    ({ quote, user, round2, onArchive, onDelete, onEdit }) => {
        // 🧠 Appel du cerveau local
        const {
            totalHTFormatted,
            statusColor,
            statusBadge,
            handleViewPDF,
            handleSendEmail,
            canGeneratePDF,
        } = useQuoteActions(quote, user, round2)

        return (
            <Card
                variant="interactive"
                className={cn(
                    "group relative overflow-hidden border-l-4",
                    statusColor,
                    // Si urgence critique, on peut même ajouter une bordure lumineuse rouge sur toute la carte au hover :
                    quote.urgence === "élevée" ? "hover:border-red-500" : ""
                )}
            >
                {/* Background Image */}
                <div className="absolute -right-6 -top-6 w-32 h-32 opacity-5 pointer-events-none rotate-12 group-hover:opacity-10 transition-opacity">
                    {quote.service === "Handpick" ? (
                        <>
                            <img
                                src={VintageLogo}
                                alt="Logo bg"
                                className="w-full h-full object-contain grayscale dark:hidden"
                            />
                            <img
                                src={DarkVintage}
                                alt="Logo bg"
                                className="w-full h-full object-contain grayscale hidden dark:block"
                            />
                        </>
                    ) : (
                        <img
                            src={NokkProjectLogo}
                            alt="Logo bg"
                            className="w-full h-full object-contain grayscale"
                        />
                    )}
                </div>

                <CardHeader className="pb-3 pt-5">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className="h-12 w-12 rounded-lg border bg-muted/30 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                {quote.service === "Handpick" ? (
                                    <>
                                        <img
                                            src={VintageLogo}
                                            alt="Light"
                                            className="h-full w-full object-contain dark:hidden"
                                        />
                                        <img
                                            src={DarkVintage}
                                            alt="Dark"
                                            className="h-full w-full object-contain hidden dark:block"
                                        />
                                    </>
                                ) : (
                                    <img
                                        src={NokkProjectLogo}
                                        alt="Service"
                                        className="h-full w-full object-contain"
                                    />
                                )}
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-lg leading-none truncate max-w-[200px]">
                                        {quote.name}
                                    </h3>

                                    <Badge
                                        variant="secondary"
                                        className={cn(
                                            "text-[10px] h-5 px-1.5",
                                            statusBadge
                                        )}
                                    >
                                        {quote.status}
                                    </Badge>

                                    {/* ✅ BADGE URGENCE AJOUTÉ ICI */}
                                    {quote.urgence &&
                                        quote.urgence !== "normale" && (
                                            <Badge
                                                className={cn(
                                                    // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                                                    "text-[10px] h-5 px-1.5 gap-1 border-0 text-white font-bold tracking-wider cursor-default",
                                                    quote.urgence === "élevée"
                                                        ? "bg-red-600 hover:bg-red-700 shadow-[0_0_8px_rgba(220,38,38,0.4)]"
                                                        : "bg-orange-500 hover:bg-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.4)]"
                                                )}
                                            >
                                                <AlertCircle className="w-3 h-3" />
                                                {quote.urgence === "élevée"
                                                    ? "CRITIQUE"
                                                    : "HAUTE"}
                                            </Badge>
                                        )}
                                </div>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {quote.Date_crea
                                        ? new Date(
                                              quote.Date_crea
                                          ).toLocaleDateString("fr-FR")
                                        : "Date inconnue"}
                                </p>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 -mt-1 -mr-2"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onEdit(quote)}>
                                    <Edit className="w-4 h-4 mr-2" /> Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={handleViewPDF}
                                    disabled={!canGeneratePDF}
                                >
                                    <FileText className="w-4 h-4 mr-2" /> Voir
                                    PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleSendEmail}>
                                    <Send className="w-4 h-4 mr-2" /> Envoyer
                                    par email
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => onArchive(quote)}
                                    className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                >
                                    <Archive className="w-4 h-4 mr-2" />{" "}
                                    Archiver
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onDelete(quote)}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                    <Trash className="w-4 h-4 mr-2" /> Supprimer
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>

                <CardContent className="pb-3 text-sm space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground bg-muted/20 p-3 rounded-md">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-foreground font-medium text-xs uppercase tracking-wide">
                                <Building2 className="w-3 h-3" /> Société
                            </div>
                            <span className="truncate pl-5 text-xs font-medium">
                                {quote.client_crm?.societe || "—"}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-foreground font-medium text-xs uppercase tracking-wide">
                                <User className="w-3 h-3" /> Contact
                            </div>
                            <span className="truncate pl-5 text-xs font-medium">
                                {quote.client_crm?.nom || "—"}
                            </span>
                        </div>
                    </div>

                    {quote.Avoir ? (
                        <div className="flex items-center justify-between mt-2">
                            <Badge
                                variant="outline"
                                className="border-yellow-200 bg-yellow-50 text-yellow-700 ml-2"
                            >
                                Avoir: {quote.Avoir.toFixed(2)}€
                            </Badge>
                        </div>
                    ) : null}
                </CardContent>

                <Separator className="bg-border/50" />

                <CardFooter className="pt-3 pb-4 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            Total HT
                        </span>
                        <span className="text-2xl font-bold text-primary tracking-tight">
                            {totalHTFormatted}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 hidden sm:flex"
                            onClick={handleViewPDF}
                            disabled={!canGeneratePDF}
                        >
                            <FileText className="w-4 h-4 mr-2" /> PDF
                        </Button>
                        <Button
                            size="sm"
                            className="h-9 shadow-sm"
                            onClick={() => onEdit(quote)}
                        >
                            <Edit className="w-4 h-4 mr-2" /> Modifier
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        )
    }
)

QuoteCard.displayName = "QuoteCard"
