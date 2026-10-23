import { beforeEach, expect, rstest, test } from "@rstest/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";

const mocks = rstest.hoisted(() => ({
    resetPasswordForEmail: rstest.fn(),
}));

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        auth: {
            resetPasswordForEmail: mocks.resetPasswordForEmail,
        },
    },
}));

// Le widget Turnstile (@marsidev/react-turnstile) injecte le script Cloudflare et
// met à jour son état quand celui-ci répond — ce qui, en jsdom, arrive après la
// fin du test : "update to Turnstile ... not wrapped in act". Le captcha n'est
// pas le sujet ici ; on le remplace par un stub qui expose le même contrat
// (ref.reset + ref.getToken).
rstest.mock("@/features/auth/components/TurnstileField", () => ({
    TurnstileField: ({
        ref,
    }: {
        ref?: {
            current: {
                reset: () => void;
                getToken: () => Promise<string>;
            } | null;
        };
    }) => {
        if (ref && typeof ref === "object") {
            ref.current = { reset: () => {}, getToken: async () => "token" };
        }
        return <div data-testid="turnstile-stub" />;
    },
}));

// Le logo vivant (framer-motion) est décoratif ici. Ses gestes de survol
// passent un AbortSignal de Node que jsdom refuse (« parameter 3 dictionary
// has member 'signal' that is not of type 'AbortSignal' ») : problème
// d'environnement de test, pas de l'app. On le remplace par un stub.
rstest.mock("@/features/auth/components/shell/LivingLogo", () => ({
    LivingLogo: () => null,
}));

import ForgotPassword from "./ForgotPassword";

beforeEach(() => {
    rstest.clearAllMocks();
});

function renderAt(url: string) {
    window.history.pushState({}, "", url);
    return render(
        <BrowserRouter>
            <ForgotPassword />
        </BrowserRouter>
    );
}

test("ForgotPassword renders form", () => {
    renderAt("/forgot-password");

    expect(
        screen.getByRole("heading", { name: "Mot de passe oublié" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
});

test("ForgotPassword prefills the email passed by the login screen", () => {
    renderAt("/forgot-password?email=ana%40exemple.fr");

    expect(screen.getByLabelText("Email")).toHaveValue("ana@exemple.fr");
});

test("ForgotPassword blocks empty email submit with an inline error", () => {
    const { container } = renderAt("/forgot-password");

    const form = container.querySelector("form");
    if (!form) {
        throw new Error("Missing reset password form");
    }
    fireEvent.submit(form);

    expect(screen.getByRole("alert")).toHaveTextContent(
        "Saisissez votre adresse email."
    );
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
});

test("ForgotPassword confirms the sending with a masked address", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    renderAt("/forgot-password?email=ana%40exemple.fr");

    fireEvent.click(screen.getByRole("button", { name: "Envoyer le lien" }));

    expect(
        await screen.findByRole("heading", { name: "Vérifiez votre boîte mail" })
    ).toBeInTheDocument();
    expect(screen.getByText("a•••@exemple.fr")).toBeInTheDocument();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("ana@exemple.fr", {
        redirectTo: `${window.location.origin}/reset-password`,
        captchaToken: "token",
    });
    // Renvoi bloqué pendant le délai anti-spam.
    expect(
        screen.getByRole("button", { name: /Renvoyer le lien \(60 s\)/ })
    ).toBeDisabled();
});
