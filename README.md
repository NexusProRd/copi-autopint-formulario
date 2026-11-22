# Cuestionario Copi Autopint — NexusRD

Web Next.js exportada como sitio estático para GitHub Pages.

## Publicación

En **Settings → Pages → Build and deployment → Source**, seleccionar **GitHub Actions**. Cada push a main ejecutará el flujo `.github/workflows/pages.yml` y publicará `out/` en https://nexusprord.github.io/copi-autopint-formulario/.

## Configuración pendiente

En **Settings → Secrets and variables → Actions → Variables**:
- `GAS_QUESTIONS_URL`: URL pública de solo lectura del catálogo de preguntas de Apps Script.
- `FORM_API_URL`: URL HTTPS de un intermediario seguro que recibe respuestas y guarda en GAS. Debe implementar autenticación, validación, limitación de peticiones y CORS para el dominio de Pages. **No poner el secreto de GAS en variables NEXT_PUBLIC ni en GitHub Pages**.
- `NEXUS_WHATSAPP`: teléfono de WhatsApp de NexusRD en formato internacional, sin +.

La versión estática no ejecuta rutas API de Next.js. El formulario muestra un error explícito si no se configura la lectura, y no permite guardar sin un endpoint seguro. **No entregar al cliente como formulario funcional hasta probar el ciclo completo** (preguntas, guardado, finalización y Sheets).

## Desarrollo local

```bash
npm install
npm run dev
npm run lint
npm run build
```

Logo de NexusRD enlazado desde el almacenamiento público facilitado por NexusRD. El formulario no debe contener secretos ni datos de clientes en el repositorio público.
