# 12 — Acceptance Checklist

## Arquitectura
- [ ] Existe capa `services/`
- [ ] WhatsApp y web reutilizan esos services
- [ ] Hay ActivityLog
- [ ] Las obligations tienen estados explícitos
- [ ] Los cambios de estado son determinísticos
- [ ] El agente no decide negocio crítico

## Producto
- [ ] El owner puede operar cobros por WhatsApp
- [ ] El tenant puede subir comprobante sin fricción
- [ ] El dashboard muestra estado y timeline
- [ ] Hay follow-up automático de mora

## Calidad
- [ ] No hay rutas obvias inseguras
- [ ] No hay secrets serializados al frontend
- [ ] Hay tests mínimos en lo core
- [ ] El bot falla con seguridad

## Foco
- [ ] El scope sigue centrado en cobranzas
- [ ] No entraron features laterales por ansiedad
