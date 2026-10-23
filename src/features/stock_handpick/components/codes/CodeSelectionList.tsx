import type { CodeGroup } from "@/features/stock_handpick/utils/emplacementGroups"
import { CodeRackCard } from "./CodeRackCard"

interface CodeSelectionListProps {
    groups: CodeGroup[]
    selected: ReadonlySet<string>
    onChange: (next: Set<string>) => void
}

/** Emplacements à étiqueter : une carte par rack, une par zone sans rack. */
export function CodeSelectionList({ groups, selected, onChange }: CodeSelectionListProps) {
    const toggle = (ids: string[], on: boolean) => {
        const next = new Set(selected)
        for (const id of ids) {
            if (on) next.add(id)
            else next.delete(id)
        }
        onChange(next)
    }

    return (
        <div className="grid gap-4 xl:grid-cols-2">
            {groups.map((group) => (
                <CodeRackCard key={group.key} group={group} selected={selected} onToggle={toggle} />
            ))}
        </div>
    )
}
