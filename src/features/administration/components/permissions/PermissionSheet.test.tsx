import { expect, rstest, test } from "@rstest/core"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import type { EntityOption, Permission, PermissionHolders } from "../../types"
import { PermissionSheet } from "./PermissionSheet"

const permission: Permission = {
    id: "p1",
    code: "users.view",
    label: "Voir les utilisateurs",
    category: "users",
}

const roles: EntityOption[] = [
    { id: "r1", nom: "Admin" },
    { id: "r2", nom: "Support" },
]
const services: EntityOption[] = [{ id: "s1", nom: "IT" }]

function renderSheet(overrides: {
    holders?: PermissionHolders | null
    canManage?: boolean
    onToggle?: (...args: unknown[]) => Promise<boolean>
} = {}) {
    const onToggle =
        overrides.onToggle ?? rstest.fn(async () => true)
    const onClose = rstest.fn()
    render(
        <MemoryRouter>
            <PermissionSheet
                permission={permission}
                holders={overrides.holders ?? null}
                roles={roles}
                services={services}
                canManage={overrides.canManage ?? true}
                onClose={onClose}
                onToggle={onToggle}
            />
        </MemoryRouter>
    )
    return { onToggle, onClose }
}

test("lecture seule : montre les détenteurs sans case à cocher", () => {
    renderSheet({
        canManage: false,
        holders: {
            roles: [{ id: "r1", nom: "Admin" }],
            services: [],
            userCount: 0,
        },
    })

    expect(
        screen.getByRole("button", { name: /ouvrir la fiche du rôle admin/i })
    ).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
})

test("gérable : cocher un rôle non détenu attribue la permission", async () => {
    const onToggle = rstest.fn(async () => true)
    renderSheet({ holders: null, onToggle })

    const checkbox = screen.getByRole("checkbox", {
        name: /attribuer.*admin/i,
    })
    // toggle() enchaîne setPendingKey -> await onToggle -> setPendingKey(null) :
    // sans act, ce dernier setState retombe après la fin du test.
    await act(async () => {
        fireEvent.click(checkbox)
    })

    expect(onToggle).toHaveBeenCalledWith({ kind: "role", id: "r1" }, true)
})

test("gérable : décocher un rôle détenu retire la permission", async () => {
    const onToggle = rstest.fn(async () => true)
    renderSheet({
        holders: { roles: [{ id: "r1", nom: "Admin" }], services: [], userCount: 0 },
        onToggle,
    })

    const checkbox = screen.getByRole("checkbox", {
        name: /retirer.*admin/i,
    })
    await act(async () => {
        fireEvent.click(checkbox)
    })

    expect(onToggle).toHaveBeenCalledWith({ kind: "role", id: "r1" }, false)
})

test("recherche filtre rôles et services par nom", () => {
    renderSheet()

    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("IT")).toBeInTheDocument()

    fireEvent.change(
        screen.getByPlaceholderText(/rechercher un rôle ou service/i),
        { target: { value: "IT" } }
    )

    expect(screen.queryByText("Admin")).not.toBeInTheDocument()
    expect(screen.queryByText("Support")).not.toBeInTheDocument()
    expect(screen.getByText("IT")).toBeInTheDocument()
})
