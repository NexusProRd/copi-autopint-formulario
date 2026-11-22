# Cuestionario de requisitos · Copi Autopint

Web de recopilación de requisitos de Copi Autopint, desarrollada por NexusRD.

## Inicio

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Integración

- `GET /api/questions` consulta el banco de preguntas activo del GAS.
- `POST /api/answers` envía `guardar` o `finalizar` al GAS desde el servidor, con secreto protegido.
- Configurar `GAS_WEB_APP_URL`, `GAS_API_SECRET` y `GAS_QUESTIONNAIRE_ID` en Vercel.
- El cliente no recibe el secreto de GAS.
- La web muestra estado de configuración cuando faltan variables; no simula guardados exitosos.
- El botón final prepara un mensaje de WhatsApp; el usuario confirma el envío en WhatsApp.

**Antes de producción:** comprobar esquema real de GAS R3, permisos, id de cuestionario, CORS/redirecciones de Apps Script, pruebas de finalización y protección contra abuso. No publicar datos sensibles ni habilitar el formulario público hasta aprobar pruebas.

## Logo

Colocar el logo original de NexusRD en `public/nexus-logo.png` (imagen aportada por el cliente del proyecto). Mientras tanto se muestra un monograma tipográfico.
