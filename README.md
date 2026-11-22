# Cuestionario Copi Autopint · NexusRD

Cuestionario de levantamiento de requisitos para un taller dominicano. La aplicación estática carga el banco desde el código publicado y guarda un borrador en el mismo navegador, con el paso y las respuestas. El proceso no necesita Sheets ni Apps Script. Para abrir o recargar la página pública se requiere acceso al sitio.

## Verificación y GitHub Pages

En Node.js 22, ejecuta `npm ci`, `npm run lint`, `npm run build`, `npm test`, `npx playwright install chromium` y `npm run test:e2e`. Playwright sirve `out/` bajo el prefijo `/copi-autopint-formulario/`. Configura Pages con GitHub Actions como origen. El workflow verifica el PR y solo puede publicar desde `main` después de superar las verificaciones.

## Manejo del cuestionario

- Descarga una copia antes de borrar el borrador. El enlace de reinicio solicita confirmación. Evita responder con datos personales de clientes o trabajadores.
- En el menú de compartir, elige WhatsApp y verifica el contacto NexusRD (+1 829-521-0521). Si el navegador descarga el PDF, adjúntalo manualmente en el chat oficial y confirma el envío en WhatsApp.
- Las respuestas antiguas compatibles se conservan al actualizar. Las preguntas que cambiaron de sentido o de opciones deben revisarse antes de volver a finalizar.

## Puntos para confirmar con el contador

- FAC01–FAC04, FAC06–FAC08 y FAC10–FAC13. Confirma inscripción, autorización de emisión, datos del receptor, tipos y series autorizados, alcance de e-CF, ITBIS y procedimiento de corrección. Consulta la [clasificación de comprobantes de la DGII](https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscales/Paginas/tiposComprobantes.aspx).
- NOM09. Confirma qué retenciones y recuperaciones aplican, junto con el registro separado de las contribuciones a cargo del empleador. Consulta las [preguntas frecuentes de la TSS](https://tss.gob.do/preguntas-frecuentes/).
- FIN06, FIN08 y FIN09. Define tratamiento de desembolsos, asignación de costos y método para estimar el margen.

El historial previo contiene una referencia al antiguo Apps Script. El propietario del servicio debe comprobar su configuración de acceso y retirar implementaciones públicas que ya no se usen. Esa acción pertenece a la cuenta de Google que administra el servicio.

