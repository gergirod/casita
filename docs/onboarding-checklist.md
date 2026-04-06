# Onboarding Checklist — Casita

Cada vez que el bot guía al owner por un wizard, tiene que cubrir estos campos.
Los **obligatorios** bloquean la creación si faltan. Los **opcionales** se pueden saltar.

---

## 1. Crear casita (create_workspace)

### Obligatorios
- [ ] Nombre de la casita
- [ ] Método de cobro del alquiler: CBU/alias o Mercado Pago
- [ ] CBU o alias *(si eligió transferencia)*
- [ ] Nombre del titular de la cuenta *(para incluirlo en el mensaje al inquilino)*
- [ ] ¿Ya tiene inquilino? (sí / no)

### Si tiene inquilino — Obligatorios
- [ ] Nombre completo del inquilino
- [ ] WhatsApp del inquilino
- [ ] Monto del alquiler
- [ ] Día de vencimiento (1–31)

### Si tiene inquilino — Opcionales
- [ ] Email del inquilino
- [ ] Fecha de fin del contrato

### Post-creación
- [ ] Preguntar si quiere enviar el mensaje de bienvenida al inquilino ahora

---

## 2. Cobro recurrente (create_recurring_charge)

### Obligatorios
- [ ] Nombre del cobro (Expensas, Luz EDESUR, Gas, etc.)
- [ ] ¿El monto es fijo o varía cada período?
  - Si **fijo**: pedir el monto
  - Si **variable**: aclarar que hay que subir la factura cada mes para enviársela al inquilino
- [ ] Frecuencia: mensual / bimestral / trimestral
- [ ] Día de vencimiento

### Opcionales
- [ ] Moneda (default ARS)

### Post-creación — Si es variable
- [ ] Recordar: "Cuando llegue la factura, mandámela y la cargo"

---

## 3. Cobro puntual (create_manual_charge)

### Obligatorios
- [ ] Descripción del cobro
- [ ] Monto
- [ ] Fecha de vencimiento

### Opcionales
- [ ] Moneda (default ARS)

---

## 4. Nuevo alquiler en casita existente (create_new_rental)

### Obligatorios
- [ ] Nombre completo del inquilino
- [ ] WhatsApp del inquilino
- [ ] Monto del alquiler
- [ ] Día de vencimiento

### Opcionales
- [ ] Email del inquilino
- [ ] Fecha de fin del contrato

### Post-creación
- [ ] Preguntar si quiere enviar el mensaje de bienvenida al inquilino ahora

---

## Reglas generales del wizard

1. **Nunca pedir más de un dato por mensaje** — un campo, esperar respuesta, siguiente.
2. **Siempre confirmar antes de crear** — resumir y preguntar "¿Lo creo?".
3. **CBU/alias es obligatorio en crear casita** — sin él el welcome message queda incompleto.
4. **Cobros variables** — siempre aclarar que hay que subir la factura para enviarla al inquilino.
5. **Welcome message** — siempre preguntar después de crear, nunca enviar sin confirmación.
