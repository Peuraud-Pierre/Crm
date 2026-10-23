import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core";

const mocks = rstest.hoisted(() => {
    const signInWithPassword = rstest.fn();
    const signUp = rstest.fn();
    const signOut = rstest.fn();
    const updateUser = rstest.fn();
    const toast = {
        error: rstest.fn(),
        success: rstest.fn(),
        message: rstest.fn(),
    };
    const supabase = {
        auth: {
            signInWithPassword,
            signUp,
            signOut,
            updateUser,
        },
    };
    return {
        signInWithPassword,
        signUp,
        signOut,
        updateUser,
        toast,
        supabase,
    };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import {
    abandonPendingSignIn,
    changePassword,
    signIn,
    signOutAction,
    signUp,
} from "./auth.actions";

const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeEach(() => {
    rstest.clearAllMocks();
    console.error = () => {};
    console.log = () => {};
});

afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
});

test("signIn returns error when GoTrue rejects the captcha", async () => {
    mocks.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: "captcha protection: request disallowed" },
    });

    const result = await signIn("user@test.com", "pwd", "captcha");

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "user@test.com",
        password: "pwd",
        options: { captchaToken: "captcha" },
    });
    // GoTrue ancien : pas de `code`, seulement le texte anglais → on le
    // reconnaît et on renvoie un message français, sans toast (l'erreur est
    // affichée dans le formulaire).
    expect(result).toEqual({
        error: "La vérification de sécurité a échoué. Réessayez.",
        code: "captcha_failed",
    });
    expect(mocks.toast.error).not.toHaveBeenCalled();
});

test("signIn translates invalid credentials by GoTrue code", async () => {
    mocks.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });

    const result = await signIn("user@test.com", "bad");

    expect(result).toEqual({
        error: "Email ou mot de passe incorrect.",
        code: "invalid_credentials",
    });
});

test("signIn reports a network failure without throwing", async () => {
    mocks.signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await signIn("user@test.com", "pwd");

    expect(result).toEqual({
        error: "Connexion impossible. Vérifiez votre réseau et réessayez.",
        code: "network",
    });
});

test("signIn returns user on success", async () => {
    mocks.signInWithPassword.mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
    });

    const result = await signIn("user@test.com", "pwd");

    expect(result).toEqual({ user: { id: "user-1" } });
    expect(mocks.toast.message).not.toHaveBeenCalled();
    expect(
        window.sessionStorage.getItem("cryptedmessage:pendingAuthSecret")
    ).toBe("pwd");
});

test("abandonPendingSignIn signs out silently and forgets the pending secret", async () => {
    window.sessionStorage.setItem("cryptedmessage:pendingAuthSecret", "pwd");
    window.sessionStorage.setItem("cryptedmessage:pendingAuthSecretAt", "1");
    mocks.signOut.mockResolvedValue({});

    await abandonPendingSignIn();

    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(
        window.sessionStorage.getItem("cryptedmessage:pendingAuthSecret")
    ).toBeNull();
    expect(
        window.sessionStorage.getItem("cryptedmessage:pendingAuthSecretAt")
    ).toBeNull();
});

test("signUp returns error on failure", async () => {
    mocks.signUp.mockResolvedValue({
        error: { message: "Invalid email" },
    });

    const result = await signUp("bad", "pwd");

    expect(result).toEqual({ user: null, error: "Invalid email" });
    expect(mocks.toast.error).toHaveBeenCalledWith("Invalid email");
});

test("changePassword validates length and updates", async () => {
    const short = await changePassword("123");
    expect(short).toEqual({ error: true });
    expect(mocks.toast.error).toHaveBeenCalledWith("Mot de passe trop court");

    mocks.updateUser.mockResolvedValue({ error: null });
    const ok = await changePassword("123456");
    expect(ok).toEqual({ success: true });
    expect(mocks.toast.success).toHaveBeenCalledWith("Mot de passe mis à jour");
});

test("signOutAction invokes supabase signOut", async () => {
    mocks.signOut.mockResolvedValue({});
    await signOutAction();
    expect(mocks.signOut).toHaveBeenCalled();
});
