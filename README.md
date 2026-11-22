# Cuestionario Copi Autopint — NexusRD

Sitio Next.js estático en GitHub Pages:
https://nexusprord.github.io/copi-autopint-formulario/

## Estado

- Preguntas desde Google Apps Script: operativo.
- Guardado, reanudación desde Google Sheets y edición: **código web preparado; pendiente actualizar la implementación GAS y probar el ciclo real**.
- Las respuestas se actualizan por ID de pregunta, no se agregan duplicados.
- Se guardan al avanzar o retroceder entre etapas. Mientras se escribe, el borrador permanece en el navegador; no cerrar antes de guardar si se necesita sincronización inmediata.
- La finalización requiere confirmación y bloquea nuevas modificaciones.

## Paso obligatorio en Google Apps Script

1. Abre el proyecto Apps Script de Copi Autopint.
2. Busca la función `function doGet(e)` que ya existe.
3. **Reemplaza únicamente esa función** con el contenido de `gas/DOGET-PARA-REEMPLAZAR.gs`. No pegues una segunda función con el mismo nombre.
4. Guarda y ve a **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**. Actualiza la implementación cuyo enlace utiliza GitHub Pages.
5. Abre `https://script.google.com/macros/s/<ID>/exec?accion=consultar` y comprueba que devuelve `ok:true`, `respuestas` y `estado`.
6. Prueba guardar una respuesta y verificarla en Sheets. Después recarga la página y comprueba que reaparece.

## Aviso importante de privacidad

**Esta modalidad simplificada NO tiene autenticación.** Cualquiera que conozca el enlace de Apps Script puede leer, modificar o finalizar las respuestas. No es adecuada para datos fiscales o personales reales. No se ha expuesto `API_SECRET` ni `QUESTIONNAIRE_ID` en GitHub, pero el acceso público de lectura/escritura es deliberadamente abierto. Antes de usar con clientes reales, incorporar un mecanismo de acceso controlado.

## GitHub Pages

En Settings → Pages → Build and deployment → Source, seleccionar GitHub Actions. El workflow `.github/workflows/pages.yml` publica automáticamente.

El logo se obtiene de la URL pública de NexusRD. No borrar la pestaña `Preguntas` al limpiar pruebas.
