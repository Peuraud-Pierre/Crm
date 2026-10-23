import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { OtpStep } from "./OtpStep"

// input-otp sonde la position du badge des gestionnaires de mots de passe via
// document.elementFromPoint, absent de jsdom : sans ce polyfill, le timer
// qu'il arme lève une erreur non interceptée après la fin du test.
if (!document.elementFromPoint) {
    document.elementFromPoint = () => null
}

function codeInput() {
    return screen.getByLabelText("Code de vérification à 6 chiffres")
}

test("submits automatically once the 6th digit is typed", async () => {
    const verifyOtp = rstest.fn().mockResolvedValue({ error: null })
    const onVerified = rstest.fn()
    render(<OtpStep verifyOtp={verifyOtp} onVerified={onVerified} />)

    fireEvent.change(codeInput(), { target: { value: "123456" } })

    await waitFor(() => expect(onVerified).toHaveBeenCalled())
    expect(verifyOtp).toHaveBeenCalledTimes(1)
    expect(verifyOtp).toHaveBeenCalledWith("123456")
    expect(screen.getByRole("button", { name: /Code validé/ })).toBeInTheDocument()
})

test("ignores non-digit input", () => {
    const verifyOtp = rstest.fn()
    render(<OtpStep verifyOtp={verifyOtp} />)

    fireEvent.change(codeInput(), { target: { value: "12a" } })

    expect(codeInput()).toHaveValue("")
    expect(verifyOtp).not.toHaveBeenCalled()
})

test("shows the error inline and clears the code on a wrong code", async () => {
    const verifyOtp = rstest.fn().mockResolvedValue({
        error: "Code incorrect. Vérifiez votre application et réessayez.",
    })
    const onVerified = rstest.fn()
    render(<OtpStep verifyOtp={verifyOtp} onVerified={onVerified} />)

    fireEvent.change(codeInput(), { target: { value: "000000" } })

    expect(await screen.findByRole("alert")).toHaveTextContent("Code incorrect.")
    expect(codeInput()).toHaveValue("")
    expect(onVerified).not.toHaveBeenCalled()
})

test("offers to switch account only when onCancel is given", async () => {
    const verifyOtp = rstest.fn()
    const { rerender } = render(<OtpStep verifyOtp={verifyOtp} />)
    expect(
        screen.queryByRole("button", { name: /Utiliser un autre compte/ })
    ).not.toBeInTheDocument()

    const onCancel = rstest.fn().mockResolvedValue(undefined)
    rerender(<OtpStep verifyOtp={verifyOtp} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole("button", { name: /Utiliser un autre compte/ }))

    await waitFor(() => expect(onCancel).toHaveBeenCalled())
})
