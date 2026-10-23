import Main from "@/features/sorters/components/Main"
import { type SortersProps } from "@/features/sorters/components/struct"
import { SortersProvider } from "@/features/sorters/context/SortersProvider"

export default function Sorters({ userId, adminView }: SortersProps) {
    return (
        <SortersProvider userId={userId} adminView={adminView}>
            <Main />
        </SortersProvider>
    )
}
