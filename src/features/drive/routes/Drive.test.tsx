import { expect, rstest, test } from "@rstest/core";
import { act, render, screen } from "@testing-library/react";

const mocks = rstest.hoisted(() => ({
    listFolder: rstest.fn().mockResolvedValue({ items: [], path: [] }),
    createFolder: rstest.fn(),
    deleteItems: rstest.fn(),
    uploadFiles: rstest.fn().mockResolvedValue([]),
    shareItems: rstest.fn(),
    setShareOpen: rstest.fn(),
    setItemIds: rstest.fn(),
    toast: rstest.fn(),
}));

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock du vrai hook useAuth
    useAuth: () => ({ user: { user_id: "user-1" } }),
}));

rstest.mock("sonner", () => ({
    toast: { error: mocks.toast, success: mocks.toast, info: mocks.toast },
}));

rstest.mock("@/features/drive/hooks/useDrive", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock du vrai hook useDrive
    useDrive: () => ({
        listFolder: mocks.listFolder,
        createFolder: mocks.createFolder,
        deleteItems: mocks.deleteItems,
        uploadFiles: mocks.uploadFiles,
        shareItems: mocks.shareItems,
    }),
}));

rstest.mock("@/features/sorters/hooks/useSelection", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock du vrai hook useSelection
    useSelection: () => ({
        selected: [],
        selectedIds: [],
        clear: rstest.fn(),
        toggle: rstest.fn(),
    }),
}));

rstest.mock("@/features/drive/context/ShareProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix -- mock du vrai hook useShareCtx
    useShareCtx: () => ({
        setShareOpen: mocks.setShareOpen,
        setItemIds: mocks.setItemIds,
    }),
}));

rstest.mock("@/features/drive/components/Grid", () => ({
    default: () => <div>DriveGrid</div>,
}));

rstest.mock("@/features/drive/components/Preview", () => ({
    default: () => <div>DrivePreview</div>,
}));

rstest.mock("@/features/drive/components/Share", () => ({
    default: () => <div>DriveShare</div>,
}));

rstest.mock("@/features/drive/components/Toolbar", () => ({
    default: () => <div>DriveToolbar</div>,
}));

import { MemoryRouter, Routes, Route } from "react-router";
import Drive from "./Drive";

test("Drive renders header", async () => {
    await act(async () => {
        render(
            <MemoryRouter>
                <Drive />
            </MemoryRouter>
        );
    });

    expect(
        screen.getByRole("heading", { name: "Drive" })
    ).toBeInTheDocument();
});

/**
 * Un dossier peut devenir inaccessible pendant qu'on le regarde : partage
 * révoqué, ou supprimé par son propriétaire. L'URL, elle, survit — favori,
 * onglet resté ouvert, lien collé. Sans retour à la racine, la page reste
 * vide sur une route morte, sans moyen d'en sortir.
 */
test("un dossier devenu inaccessible ramène à la racine du Drive", async () => {
    // Le mock est partagé avec les autres tests du fichier (rstest.hoisted).
    mocks.listFolder.mockClear();
    mocks.listFolder.mockRejectedValueOnce(new Error("folder not found"));

    await act(async () => {
        render(
            <MemoryRouter initialEntries={["/drive/dossier-revoque"]}>
                <Routes>
                    <Route path="/drive/:folderId?" element={<Drive />} />
                </Routes>
            </MemoryRouter>
        );
    });

    // Le second appel, déclenché par la redirection, vise la racine.
    expect(mocks.listFolder).toHaveBeenCalledTimes(2);
    expect(mocks.listFolder.mock.calls[0][1]).toBe("dossier-revoque");
    expect(mocks.listFolder.mock.calls[1][1]).toBeUndefined();
});
