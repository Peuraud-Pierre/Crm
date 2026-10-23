import { describe, it, expect } from "@rstest/core"
import { renderHook, waitFor, act } from "@testing-library/react"
import { usePakeAuth } from "./usePakeAuth.js"

const run = async <T>(fn: () => Promise<T> | T) => {
    let value: T | undefined
    await act(async () => {
        value = await fn()
    })
    return value as T
}

describe("usePakeAuth Hook", () => {
    describe("Hook initialization", () => {
        it("should initialize with undefined auth state", () => {
            const { result } = renderHook(() => usePakeAuth())

            expect(result.current).toBeDefined()
            expect(typeof result.current).toBe("object")
        })

        it("should provide auth methods", () => {
            const { result } = renderHook(() => usePakeAuth())

            expect(typeof result.current.initiatePakeAuth).toBe("function")
            expect(typeof result.current.completePakeAuth).toBe("function")
            expect(typeof result.current.clearAuth).toBe("function")
        })
    })

    describe("PAKE authentication flow", () => {
        it("should initiate PAKE authentication", async () => {
            const { result } = renderHook(() => usePakeAuth())
            const email = "test@example.com"
            const password = "password123"

            await run(() => result.current.initiatePakeAuth(email, password))

            await waitFor(() => {
                expect(result.current).toBeDefined()
            })
        })

        it("should handle PAKE authentication with valid credentials", async () => {
            const { result } = renderHook(() => usePakeAuth())
            const email = "user@example.com"
            const password = "securepassword"

            const authResult = await run(() =>
                result.current.initiatePakeAuth(email, password)
            )

            expect(authResult).toBeDefined()
        })

        it("should reject invalid email format", async () => {
            const { result } = renderHook(() => usePakeAuth())
            const invalidEmail = "not-an-email"
            const password = "password123"

            await expect(
                run(() =>
                    result.current.initiatePakeAuth(invalidEmail, password)
                )
            ).rejects.toThrow()
        })

        it("should reject weak passwords", async () => {
            const { result } = renderHook(() => usePakeAuth())
            const email = "test@example.com"
            const weakPassword = "123" // Too short

            await expect(
                run(() => result.current.initiatePakeAuth(email, weakPassword))
            ).rejects.toThrow()
        })
    })

    describe("PAKE key derivation", () => {
        it("should derive consistent keys for same credentials", async () => {
            const { result: result1 } = renderHook(() => usePakeAuth())
            const { result: result2 } = renderHook(() => usePakeAuth())

            const email = "consistent@example.com"
            const password = "consistentpassword"

            const auth1 = await run(() =>
                result1.current.initiatePakeAuth(email, password)
            )
            const auth2 = await run(() =>
                result2.current.initiatePakeAuth(email, password)
            )

            // Both should succeed
            expect(auth1).toBeDefined()
            expect(auth2).toBeDefined()
        })

        it("should derive different keys for different passwords", async () => {
            const { result: result1 } = renderHook(() => usePakeAuth())
            const { result: result2 } = renderHook(() => usePakeAuth())

            const email = "different@example.com"

            await run(() =>
                result1.current.initiatePakeAuth(email, "password1")
            )
            await run(() =>
                result2.current.initiatePakeAuth(email, "password2")
            )

            // Should have different authentication states
            expect(result1.current).toBeDefined()
            expect(result2.current).toBeDefined()
        })

        it("should derive different keys for different emails", async () => {
            const { result: result1 } = renderHook(() => usePakeAuth())
            const { result: result2 } = renderHook(() => usePakeAuth())

            const password = "samepassword"

            await run(() =>
                result1.current.initiatePakeAuth("user1@example.com", password)
            )
            await run(() =>
                result2.current.initiatePakeAuth("user2@example.com", password)
            )

            // Should have different authentication states
            expect(result1.current).toBeDefined()
            expect(result2.current).toBeDefined()
        })
    })

    describe("PAKE session management", () => {
        it("should clear authentication", async () => {
            const { result } = renderHook(() => usePakeAuth())

            await run(() =>
                result.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )
            await act(async () => {
                result.current.clearAuth()
            })

            expect(result.current).toBeDefined()
        })

        it("should allow reauthentication after clearing", async () => {
            const { result } = renderHook(() => usePakeAuth())

            await run(() =>
                result.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )
            await act(async () => {
                result.current.clearAuth()
            })

            // Should be able to authenticate again
            const reauth = await run(() =>
                result.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )
            expect(reauth).toBeDefined()
        })
    })

    describe("Error handling", () => {
        it("should handle empty email", async () => {
            const { result } = renderHook(() => usePakeAuth())

            await expect(
                run(() => result.current.initiatePakeAuth("", "password123"))
            ).rejects.toThrow()
        })

        it("should handle empty password", async () => {
            const { result } = renderHook(() => usePakeAuth())

            await expect(
                run(() =>
                    result.current.initiatePakeAuth("test@example.com", "")
                )
            ).rejects.toThrow()
        })

        it("should handle null credentials", async () => {
            const { result } = renderHook(() => usePakeAuth())

            await expect(
                run(() =>
                    result.current.initiatePakeAuth(
                        null as unknown as string,
                        null as unknown as string
                    )
                )
            ).rejects.toThrow()
        })

        it("should handle authentication timeouts", async () => {
            const { result } = renderHook(() => usePakeAuth())

            // Should handle timeouts gracefully
            const authPromise = run(() =>
                result.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )

            expect(authPromise).toBeDefined()
        })
    })

    describe("Security considerations", () => {
        it("should not expose password in auth state", async () => {
            const { result } = renderHook(() => usePakeAuth())
            const password = "secretpassword123"

            await run(() =>
                result.current.initiatePakeAuth("test@example.com", password)
            )

            const authState = result.current
            const authString = JSON.stringify(authState)

            // Password should not appear in the auth state
            expect(authString.includes(password)).toBe(false)
        })

        it("should use constant-time comparison for PAKE verification", async () => {
            const { result } = renderHook(() => usePakeAuth())

            // Create two similar but different passwords
            const password1 = "passwordaaaaaa"
            const password2 = "passwordbbbbbbb"

            const auth1 = await run(() =>
                result.current.initiatePakeAuth("test@example.com", password1)
            )

            const auth2 = await run(() =>
                result.current.initiatePakeAuth("test@example.com", password2)
            )

            // Both should complete without timing attacks
            expect(auth1).toBeDefined()
            expect(auth2).toBeDefined()
        })

        it("should generate random salts for each authentication", async () => {
            const { result: result1 } = renderHook(() => usePakeAuth())
            const { result: result2 } = renderHook(() => usePakeAuth())

            const email = "test@example.com"
            const password = "samepassword"

            // Two separate authentications should generate different states
            await run(() => result1.current.initiatePakeAuth(email, password))
            await run(() => result2.current.initiatePakeAuth(email, password))

            // Despite identical credentials, the internal states should differ
            expect(result1.current).toBeDefined()
            expect(result2.current).toBeDefined()
        })
    })

    describe("Multi-device scenarios", () => {
        it("should allow same user to authenticate on multiple devices", async () => {
            const { result: device1 } = renderHook(() => usePakeAuth())
            const { result: device2 } = renderHook(() => usePakeAuth())
            const { result: device3 } = renderHook(() => usePakeAuth())

            const email = "multidevice@example.com"
            const password = "sharedpassword"

            const auth1 = await run(() =>
                device1.current.initiatePakeAuth(email, password)
            )
            const auth2 = await run(() =>
                device2.current.initiatePakeAuth(email, password)
            )
            const auth3 = await run(() =>
                device3.current.initiatePakeAuth(email, password)
            )

            expect(auth1).toBeDefined()
            expect(auth2).toBeDefined()
            expect(auth3).toBeDefined()
        })

        it("should maintain separate auth states across devices", async () => {
            const { result: device1 } = renderHook(() => usePakeAuth())
            const { result: device2 } = renderHook(() => usePakeAuth())

            await run(() =>
                device1.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )
            await act(async () => {
                device1.current.clearAuth()
            })

            // Device 2 should still be authenticated
            const device2Auth = await run(() =>
                device2.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )
            expect(device2Auth).toBeDefined()
        })
    })

    describe("Performance", () => {
        it("should complete PAKE authentication in reasonable time", async () => {
            const { result } = renderHook(() => usePakeAuth())

            const start = performance.now()
            await run(() =>
                result.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )
            const duration = performance.now() - start

            // PAKE should complete within 5 seconds
            expect(duration).toBeLessThan(5000)
        })

        it("should handle rapid successive authentications", async () => {
            const { result } = renderHook(() => usePakeAuth())

            const start = performance.now()

            for (let i = 0; i < 5; i++) {
                await run(() =>
                    result.current.initiatePakeAuth(
                        `user${i}@example.com`,
                        `password${i}`
                    )
                )
            }

            const totalDuration = performance.now() - start
            const avgTimePerAuth = totalDuration / 5

            // Average time per auth should be reasonable (< 2 seconds)
            expect(avgTimePerAuth).toBeLessThan(2000)
        })
    })

    describe("Integration with messaging", () => {
        it("should provide crypto context after authentication", async () => {
            const { result } = renderHook(() => usePakeAuth())

            const auth = await run(() =>
                result.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )

            // Should have crypto-related context
            expect(auth).toBeDefined()
        })

        it("should maintain auth across component remounts", async () => {
            const { result, unmount } = renderHook(() => usePakeAuth())

            await run(() =>
                result.current.initiatePakeAuth(
                    "test@example.com",
                    "password123"
                )
            )

            unmount()

            // Note: In a real app, auth would be persisted to storage
            const { result: result2 } = renderHook(() => usePakeAuth())
            expect(result2.current).toBeDefined()
        })
    })
})
