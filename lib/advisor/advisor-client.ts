import OpenAI from "openai";
import type { AdvisorInput, AdvisorOutput } from "./types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TIMEOUT_MS = 8_000;

const FALLBACK: AdvisorOutput = {
  plan: "n/a",
  risks: [],
  recommendation: "proceed",
  stop: false,
  confidence: 0,
  _fallback: true,
};

const SYSTEM_PROMPT = `Sos un Principal Agent Architect revisando una acción de alto riesgo en Casita, un sistema de gestión de alquileres para propietarios de LATAM.

Tu trabajo es revisar lo que el executor está a punto de hacer y:
1. Identificar riesgos operacionales concretos basados SOLO en el contexto dado
2. Recomendar si proceder (stop: false) o pausar (stop: true)
3. Si pausás, dar un stopReason claro y breve que el executor pueda mostrar al propietario

REGLAS ESTRICTAS:
- No tenés acceso a tools ni a bases de datos. Razonás exclusivamente sobre lo que viene en el input.
- No generás respuestas para el propietario — solo para el executor.
- Si todo parece correcto, retorná stop: false con risks: [].
- Solo recomendás stop: true si hay un riesgo CONCRETO respaldado por el contexto. No sobreanalicés.
- No inventés riesgos. Un "OK, proceder" es una respuesta válida y valiosa.
- stopReason, si existe, debe ser una oración en español argentino, amable y directa, dirigida al propietario.

Respondé SIEMPRE con un JSON válido exactamente con este schema:
{
  "plan": "string — qué debería pasar",
  "risks": ["string — riesgo concreto"],
  "recommendation": "string — acción específica para el executor",
  "stop": false,
  "stopReason": null,
  "confidence": 0.9
}`;

export async function callAdvisor(input: AdvisorInput): Promise<AdvisorOutput> {
  const start = Date.now();

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-5.4-mini",
        temperature: 0.2,
        max_completion_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input, null, 2) },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("advisor_timeout")), TIMEOUT_MS)
      ),
    ]);

    const text = completion.choices[0]?.message?.content ?? "";

    let parsed: Partial<AdvisorOutput>;
    try {
      parsed = JSON.parse(text) as Partial<AdvisorOutput>;
    } catch {
      return FALLBACK;
    }

    if (typeof parsed.stop !== "boolean" || typeof parsed.plan !== "string") {
      return FALLBACK;
    }

    return {
      plan: parsed.plan,
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "proceed",
      stop: parsed.stop,
      stopReason: parsed.stopReason ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    console.log(
      JSON.stringify({
        level: "error",
        event: "advisor.failed",
        intent: input.intent,
        error: err instanceof Error ? err.message : "unknown",
        durationMs,
      })
    );
    return FALLBACK;
  }
}
