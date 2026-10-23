import { BrandInput } from "./BrandInput"
import { NameInput } from "./NameInput"

export function Form() {
    return (
        <div className="grid grid-cols-1 gap-3">
            <NameInput />
            <BrandInput />
        </div>
    )
}
