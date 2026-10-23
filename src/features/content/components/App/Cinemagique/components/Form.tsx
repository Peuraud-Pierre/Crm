import { CheveuxSelect } from "../../components/Form/CheveuxSelect"
import { DecorSelect } from "../../components/Form/DecorSelect"
import { EffetSelect } from "../../components/Form/EffetSelect"
import { FiltreSelect } from "../../components/Form/FiltreSelect"
import { GenreSelect } from "../../components/Form/GenreSelect"
import { LogoSelect } from "../../components/Form/LogoSelect"
import { PositionSelect } from "../../components/Form/PositionSelect"

export function Form() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GenreSelect />
            <CheveuxSelect />
            <PositionSelect />
            <FiltreSelect />
            <EffetSelect />
            <DecorSelect />
            <LogoSelect />
        </div>
    )
}
