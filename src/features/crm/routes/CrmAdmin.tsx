import { useState } from "react"
import { ListChecks, Mail, ScrollText, Settings2 } from "lucide-react"
import { BriefOptionsTab } from "@/features/crm/components/brief-options/BriefOptionsTab"
import { NewsletterCrmTab } from "@/features/crm/components/newsletter-crm/NewsletterCrmTab"
import { CRMLogsPanel } from "@/features/manager/components/ErrorConsole/CRMLogsPanel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import CustomerDetailDialog from "@/features/crm/components/Client/fiche"
import { useCRMContext } from "@/features/crm/context/CRMContext"

/**
 * Page « Administration CRM » — configuration du CRM séparée des onglets
 * métier de /crm (Calendrier/Clients/Tâches...). Deux sous-onglets pour
 * l'instant : les listes de valeurs dynamiques du brief (plateformes,
 * styles, marques...) et le journal d'audit CRM (logs_crm) ; conçue pour
 * accueillir d'autres sections d'admin CRM plus tard sans redevenir un
 * onglet de SinglePageCRM.
 *
 * CRMLogsPanel est déjà utilisé dans /error-console (manager) — réutilisé
 * tel quel ici plutôt que dupliqué. Il consomme useCRMContext() en interne
 * (échantillon clients), d'où le CRMProvider/DevisProvider posés sur la
 * route /crm-admin dans router.tsx. Cliquer sur un client de l'échantillon
 * appelle openClientFiche(), qui ne fait que basculer l'état FicheClient du
 * contexte — encore faut-il monter la modale qui le consomme : même recette
 * que ErrorConsolePage.tsx (ErrorConsoleWithFiche).
 */
export default function CrmAdmin() {
    const [activeTab, setActiveTab] = useState("brief-options")
    const { FicheClient, setFicheclient } = useCRMContext()

    return (
        <div className="flex-1 p-4 sm:p-6 space-y-6">
            <CustomerDetailDialog
                open={FicheClient}
                setficheclient={setFicheclient}
            />
            <header className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Settings2 className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">
                        Administration CRM
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Les listes de valeurs (plateformes, styles, marques...)
                        affichées dans le brief CRM, et le journal des
                        modifications CRM.
                    </p>
                </div>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList
                    indicator
                    indicatorClassName="rounded-sm"
                    className="gap-1 bg-muted/50 border border-border/50"
                >
                    <TabsTrigger
                        value="brief-options"
                        className="gap-1.5 text-muted-foreground"
                    >
                        <ListChecks className="w-4 h-4" />
                        Listes Brief
                    </TabsTrigger>
                    <TabsTrigger
                        value="logs"
                        className="gap-1.5 text-muted-foreground"
                    >
                        <ScrollText className="w-4 h-4" />
                        Logs CRM
                    </TabsTrigger>
                    <TabsTrigger
                        value="newsletter-crm"
                        className="gap-1.5 text-muted-foreground"
                    >
                        <Mail className="w-4 h-4" />
                        Newsletter CRM
                    </TabsTrigger>
                </TabsList>

                <TabsContent
                    value="brief-options"
                    className="pt-4"
                >
                    <BriefOptionsTab />
                </TabsContent>

                <TabsContent value="logs" className="pt-4">
                    <CRMLogsPanel />
                </TabsContent>

                <TabsContent value="newsletter-crm" className="pt-4">
                    <NewsletterCrmTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}
