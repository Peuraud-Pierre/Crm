import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { Dot } from "lucide-react"

import { cn } from "@/shared/lib/utils"

function InputOTP({
  className,
  containerClassName,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof OTPInput> & { ref?: React.Ref<React.ElementRef<typeof OTPInput>> }) {
  return (
    <OTPInput
      ref={ref}
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed [color:transparent] [caret-color:transparent] select-none", className)}
      {...props}
    />
  )
}

function InputOTPGroup({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={cn("flex items-center", className)} {...props} />
  )
}

function InputOTPSlot({
  index,
  masked = true,
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  index: number
  /**
   * Masque le caractère saisi (•). Vrai par défaut : les codes PIN de la
   * messagerie sont des secrets. À désactiver pour un code TOTP, éphémère,
   * que l'utilisateur recopie et doit pouvoir relire.
   */
  masked?: boolean
  ref?: React.Ref<HTMLDivElement>
}) {
  const inputOTPContext = React.use(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-sm transition-shadow first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-2 ring-ring ring-offset-background",
        className
      )}
      {...props}
    >
      {char && (masked ? "•" : char)}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- clignotement du curseur : 1000ms est la cadence de la primitive shadcn, hors échelle motion (§13.1) */}
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  )
}

function InputOTPSeparator({
  ref,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} role="separator" {...props}>
      <Dot />
    </div>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
