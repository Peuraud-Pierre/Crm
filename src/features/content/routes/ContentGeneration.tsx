import Main from "@/features/content/components/Main"
import { ContentProvider } from "@/features/content/context/ContentProvider"

export default function ContentGeneration() {
    return (
        <ContentProvider>
            <Main />
        </ContentProvider>
    )
}
