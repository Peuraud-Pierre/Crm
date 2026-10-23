import MyTicketsPage from "../components/MyTicketsTab";

export function TicketCreationPage() {

    return (
        // On enveloppe avec le Provider pour que useTickets fonctionne dans le formulaire
            <div className={`min-h-screen w-full flex flex-col transition-colors`}>
                {/* --- Contenu Principal --- */}
                <main className="flex-1 p-6 md:p-12 flex flex-col items-center justify-start">
                    <div className="w-full max-w-6xl">
                        <MyTicketsPage />
                    </div>
                </main>
            </div>
    )
}