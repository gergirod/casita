import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO    = "aes-256-cbc";
const IV_LEN  = 16;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET no configurado");
  /* Pad/truncate to 32 bytes */
  return Buffer.from(secret.padEnd(32, "0").slice(0, 32));
}

export function encrypt(plain: string): string {
  const iv         = randomBytes(IV_LEN);
  const cipher     = createCipheriv(ALGO, getKey(), iv);
  const encrypted  = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(stored: string): string {
  const [ivHex, encHex] = stored.split(":");
  const iv              = Buffer.from(ivHex, "hex");
  const encrypted       = Buffer.from(encHex, "hex");
  const decipher        = createDecipheriv(ALGO, getKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
