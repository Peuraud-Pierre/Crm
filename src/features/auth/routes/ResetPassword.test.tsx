import { beforeEach, expect, rstest, test } from "@rstest/core";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";

const mocks = rstest.hoisted(() => ({
    getSession: rstest.fn(),
    updateUser: rstest.fn(),
    hasAAL2Enabled: rstest.fn(),
    getCurrentAAL: rstest.fn(),
}));

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        auth: {
            getSession: mocks.getSession,
            updateUser: mocks.updateUser,
        },
    },
}));

rstest.mock("@/features/auth/hooks/useAuth/auth.mfa", () => ({
    hasAAL2Enabled: mocks.hasAAL2Enabled,
    getCurrentAAL: mocks.getCurrentAAL,
    verifyOtp: rstest.fn(),
}));

rstest.mock("@/features/auth/components/OtpStep", () => ({
    OtpStep: () => <div>OtpStep</div>,
}));

// Le logo vivant (framer-motion) est décoratif ici. Ses gestes de survol
// passent un AbortSignal de Node que jsdom refuse (« parameter 3 dictionary
// has member 'signal' that is not of type 'AbortSignal' ») : problème
// d'environnement de test, pas de l'app. On le remplace par un stub.
rstest.mock("@/features/auth/components/shell/LivingLogo", () => ({
    LivingLogo: () => null,
}));

import ResetPassword from "./ResetPassword";

beforeEach(() => {
    rstest.clearAllMocks();
    mocks.getSession.mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
    });
    mocks.hasAAL2Enabled.mockResolvedValue(false);
    mocks.getCurrentAAL.mockResolvedValue("aal2");
});

function renderPage() {
    window.history.pushState({}, "", "/reset-password");
    return render(
        <BrowserRouter>
            <ResetPassword />
        </BrowserRouter>
    );
}

test("ResetPassword renders password form when session is valid", async () => {
    renderPage();

    expect(
        await screen.findByRole("heading", { name: "Nouveau mot de passe" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nouveau mot de passe")).toBeInTheDocument();
    expect(
        screen.getByLabelText("Confirmer le mot de passe")
    ).toBeInTheDocument();
});

test("ResetPassword asks for the TOTP code on an AAL1 session", async () => {
    mocks.hasAAL2Enabled.mockResolvedValue(true);
    mocks.getCurrentAAL.mockResolvedValue("aal1");

    renderPage();

    expect(await screen.findByText("OtpStep")).toBeInTheDocument();
});

test("ResetPassword explains an expired link instead of redirecting", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    renderPage();

    expect(
        await screen.findByRole("heading", { name: "Lien invalide ou expiré" })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("link", { name: "Demander un nouveau lien" })
    ).toHaveAttribute("href", "/forgot-password");
});
