import { expect, rstest, test } from "@rstest/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DriveNameDialog from "./DriveNameDialog";

test("création : le nom est trimé avant d'être soumis", async () => {
    const onSubmit = rstest.fn().mockResolvedValue(undefined);
    render(
        <DriveNameDialog open onOpenChange={() => {}} onSubmit={onSubmit} />
    );
    await userEvent.type(screen.getByLabelText("Nom du dossier"), "  Factures  ");
    await userEvent.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Factures"));
});

test("renommage : le champ est pré-rempli et les libellés suivent", async () => {
    const onSubmit = rstest.fn().mockResolvedValue(undefined);
    render(
        <DriveNameDialog
            open
            onOpenChange={() => {}}
            onSubmit={onSubmit}
            heading="Renommer le fichier"
            label="Nouveau nom"
            submitLabel="Renommer"
            initialValue="rapport.pdf"
        />
    );
    expect(screen.getByLabelText("Nouveau nom")).toHaveValue("rapport.pdf");
    expect(screen.getByText("Renommer le fichier")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Renommer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("rapport.pdf"));
});

// Un nom vide ou uniquement composé d'espaces ne doit jamais partir au serveur.
test("un nom vide n'est pas soumis", async () => {
    const onSubmit = rstest.fn();
    render(
        <DriveNameDialog open onOpenChange={() => {}} onSubmit={onSubmit} initialValue="   " />
    );
    expect(screen.getByRole("button", { name: "Créer" })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
});

// L'échec doit laisser le dialog ouvert : le nom saisi reste corrigeable.
test("en cas d'échec le dialog ne se ferme pas", async () => {
    const onSubmit = rstest.fn().mockRejectedValue(new Error("boom"));
    const onOpenChange = rstest.fn();
    render(
        <DriveNameDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} initialValue="a" />
    );
    await userEvent.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
});
