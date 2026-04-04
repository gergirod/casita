# Milestones

## ✅ Fase 1 — Fundamentos (completada)

- Auth (Clerk)
- Workspaces / casitas
- Cobros recurrentes (templates: alquiler, expensas, servicios)
- Vista mensual navegable con estado por cobro
- Subida de boletas por cobro (con Gemini opcional)
- Cron de recordatorios automáticos (por reminderDays del template)
- Link seguro para inquilino
- Subida de comprobante por inquilino
- Configuración: inquilino, contrato, integraciones
- Terminar alquiler / iniciar nuevo alquiler (historial)
- Buckets de Supabase: original-bills, contracts, proofs

## 🔜 Fase 2 — Pagos y automatización

- Mercado Pago: link de pago automático para alquiler
  - Crear link al generar obligación de alquiler
  - Webhook de MP para verificar automáticamente
- WhatsApp: recordatorios por WhatsApp además de email
- WhatsApp inbound (MVP técnico): webhook Twilio + bridge a n8n + APIs para guardar comprobantes/notas
- Obligaciones de alquiler: generación automática mensual
  (hoy se crean al subir boleta; alquiler debería generarse solo)

## 🔮 Fase 3 — Pulido y escala

- Dashboard multi-casita mejorado (cuando haya más de una)
- Historial de aumentos de alquiler visible en la casita
- Filtros en el panel de cobros
- CSV export de cobros por período
- Notificación al propietario cuando el inquilino sube comprobante
- Onboarding mejorado (wizard de primera casita)
