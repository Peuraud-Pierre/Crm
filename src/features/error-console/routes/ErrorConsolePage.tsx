import { ErrorConsole } from "@/features/manager/components/ErrorConsole/ErrorConsole"
import { CRMProvider } from "@/features/crm/context/CRMContext"
import { DevisProvider } from "@/features/crm/context/DevisContext"
import CustomerDetailDialog from "@/features/crm/components/Client/fiche"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"

function ErrorConsoleWithFiche() {
    const { FicheClient, setFicheclient } = useCRMContext()
    return (
        <>
            <CustomerDetailDialog open={FicheClient} setficheclient={setFicheclient} />
            <ErrorConsole />
        </>
    )
}

export default function ErrorConsolePage() {
    const { hasPermission } = useAuth()

    if (!hasPermission("manager.console")) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Accès restreint
            </div>
        )
    }

    return (
        <CRMProvider>
            <DevisProvider>
                <div className="flex flex-col p-4 sm:p-6 sm:h-[calc(100svh-4rem)] sm:overflow-hidden">
                    <ErrorConsoleWithFiche />
                </div>
            </DevisProvider>
        </CRMProvider>
    )
}
