import { EntryForm } from "./Entries/EntryForm";
import { EntryList } from "./Entries/Entrylist";



export function EntriesTab() {
    return (
        <div className="space-y-6 mt-4">
            <EntryForm />
            <EntryList />
        </div>
    )
}