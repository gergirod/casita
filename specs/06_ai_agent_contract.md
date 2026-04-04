# 06 — AI / Agent Contract

## Rol de la AI
La AI sirve para:
- interpretar lenguaje natural
- clasificar intención
- extraer datos de mensajes
- redactar respuestas naturales
- resumir contexto

## La AI NO debe
- decidir state transitions críticas
- ejecutar lógica de negocio sensible libremente
- construir queries de negocio arbitrarias
- borrar datos sin confirmación
- reemplazar validaciones del sistema

## Patrón recomendado
```text
message -> classify -> dispatch -> execute service -> compose response
```

## Componentes sugeridos
### classifier.ts
Devuelve algo como:
```json
{
  "intent": "verify_payment",
  "confidence": 0.92,
  "entities": {
    "obligation_reference": "alquiler abril"
  },
  "needs_clarification": false
}
```

### response-composer.ts
Toma:
- output del service
- contexto mínimo
- tono por rol

Y devuelve mensaje de WhatsApp o texto para web.

## Skills
Las skills son playbooks finitos y chicos.
Ejemplos:
- owner/get-overview
- owner/verify-payment
- owner/send-reminder
- tenant/get-my-obligations
- tenant/upload-proof

## Reglas de skills
- una skill no consulta Prisma directo si existe un service
- una skill no cambia estado directo si existe una state machine o un service que lo haga
- una skill puede pedir aclaración
- una skill debe ser chica

## Confirmación obligatoria
Acciones destructivas o sensibles deben pedir confirmación explícita.
Ejemplos:
- delete workspace
- end rental
- cambios grandes de monto
- aceptar o rechazar disputas futuras
