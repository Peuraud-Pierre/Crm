import { type Visit } from "./utils"
import VisitItem from "./VisitItem"

interface VisitsListProps {
    log: Visit[]
    onSelectVisitor: (id: string) => void
}

export default function VisitsList({
    log,
    onSelectVisitor,
}: VisitsListProps) {
    return (
        <ul className="divide-y divide-border/60">
            {log.map((v) => (
                <VisitItem
                    key={v.idVisit}
                    visit={v}
                    onSelect={onSelectVisitor}
                />
            ))}
        </ul>
    )
}
