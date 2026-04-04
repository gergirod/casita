# WhatsApp Bot MVP — E2E Checklist

## Environment

- Local app: `http://localhost:3000`
- Twilio sandbox: connected
- ngrok webhook: active
- n8n secret used in tests: `x-casita-secret`

## Test results

1. `GET /api/tenant-by-phone` without secret
- Expected: `401 Unauthorized`
- Result: `PASS`

2. `GET /api/tenant-by-phone` with secret + WhatsApp number
- Expected: tenant + unit + obligations payload
- Result: `PASS`

3. `POST /api/tenant/[token]/note` with category `reclamo`
- Expected: creates custom pending item for owner dashboard
- Result: `PASS`
- Verified DB: `sourceType = n8n`

4. `POST /api/tenant/[token]/proof-url` with non-Twilio `mediaUrl`
- Expected: `400 mediaUrl inválida (debe ser Twilio)`
- Result: `PASS`

5. `POST /api/webhooks/twilio-whatsapp` in local dev without signature
- Expected: accepted in dev (no hard fail), TwiML 200
- Result: `PASS`

6. Real Twilio inbound via sandbox
- Expected: webhook hit and parsed fields (`From`, `Body`, `NumMedia`)
- Result: `PASS`
- Evidence observed in server logs before hardening completion.

## Remaining production checks

- Validate `X-Twilio-Signature` end-to-end in production env with `TWILIO_AUTH_TOKEN` present.
- Run media upload test with a real Twilio media URL from an image message.
- Verify n8n workflow imported from template and OpenAI credentials configured.
