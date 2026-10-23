// Affiche le code TOTP courant des comptes de la base locale (local-db/).
// Tous les comptes du seed partagent le secret JBSWY3DPEHPK3PXP — dev uniquement.
import { createHmac } from "node:crypto"

const SECRET = process.argv[2] ?? "JBSWY3DPEHPK3PXP"

function base32Decode(input) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
    let bits = ""
    for (const c of input.replace(/=+$/, "").toUpperCase()) {
        bits += alphabet.indexOf(c).toString(2).padStart(5, "0")
    }
    const bytes = []
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
    return Buffer.from(bytes)
}

export function totp(secret, now = Date.now()) {
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)))
    const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest()
    const offset = hmac[hmac.length - 1] & 0xf
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
    return code.toString().padStart(6, "0")
}

// Exécuté directement (pas importé) : on affiche le code.
if (process.argv[1]?.endsWith("otp.mjs")) {
    const remaining = 30 - (Math.floor(Date.now() / 1000) % 30)
    console.log(`Code TOTP : ${totp(SECRET)}  (valide encore ${remaining}s)`)
}
