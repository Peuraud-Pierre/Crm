import { beforeEach, expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";

const mocks = rstest.hoisted(() => ({
    verifyOtp: rstest.fn(),
}));

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        auth: {
            verifyOtp: mocks.verifyOtp,
        },
    },
}));

// Le logo vivant (framer-motion) est décoratif ici. Ses gestes de survol
// passent un AbortSignal de Node que jsdom refuse (« parameter 3 dictionary
// has member 'signal' that is not of type 'AbortSignal' ») : problème
// d'environnement de test, pas de l'app. On le remplace par un stub.
rstest.mock("@/features/auth/components/shell/LivingLogo", () => ({
    LivingLogo: () => null,
}));

import AuthConfirm from "./AuthConfirm";

const originalConsoleError = console.error;

beforeEach(() => {
    rstest.clearAllMocks();
    console.error = originalConsoleError;
});

function renderAt(url: string) {
    window.history.pushState({}, "", url);
    return render(
        <BrowserRouter>
            <AuthConfirm />
        </BrowserRouter>
    );
}

test("AuthConfirm explains an invalid link in place", async () => {
    renderAt("/auth/confirm");

    expect(
        await screen.findByRole("heading", { name: "Lien invalide ou expiré" })
    ).toBeInTheDocument();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(
        screen.getByRole("link", { name: "Retour à la connexion" })
    ).toHaveAttribute("href", "/login");
});

test("AuthConfirm offers a new link when a recovery token is rejected", async () => {
    console.error = () => {};
    mocks.verifyOtp.mockResolvedValue({
        data: { session: null },
        error: { code: "otp_expired", message: "Token has expired" },
    });

    renderAt("/auth/confirm?token_hash=abc&type=recovery");

    expect(screen.getByText("Vérification en cours…")).toBeInTheDocument();
    expect(
        await screen.findByRole("link", { name: "Demander un nouveau lien" })
    ).toHaveAttribute("href", "/forgot-password");
});

test("AuthConfirm confirms a signup in place", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: {}, error: null });

    renderAt("/auth/confirm?token_hash=abc&type=signup");

    expect(
        await screen.findByRole("heading", { name: "Adresse email confirmée" })
    ).toBeInTheDocument();
});
