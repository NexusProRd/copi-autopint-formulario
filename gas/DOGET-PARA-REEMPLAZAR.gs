/**
 * Sustituir ÚNICAMENTE la función doGet(e) existente por esta versión.
 * Reutiliza guardarRespuestas, consultarRespuestas y finalizarCuestionario de R3.
 * ATENCIÓN: esta modalidad sin autenticación expone las respuestas a cualquiera
 * que conozca la URL y permite su modificación. No usar para datos sensibles.
 * El ID real permanece en Script Properties; no publicarlo en GitHub.
 */
function doGet(e) {
  try {
    const p = e && e.parameter ? e.parameter : {};
    const accion = String(p.accion || 'preguntas');
    if (accion === 'preguntas') {
      return json({ok:true, cliente:COPI.CLIENTE, preguntas:obtenerPreguntas()});
    }
    if (accion === 'consultar') {
      return json(consultarRespuestas({cuestionarioId:cuestionarioID()}));
    }
    if (accion === 'guardar') {
      const preguntaId = String(p.preguntaId || '');
      if (!/^(GEN01|INV\d{2}|NOM\d{2}|FIN\d{2}|FAC\d{2})$/.test(preguntaId)) {
        throw new Error('Pregunta inválida');
      }
      if (!p.valor || p.valor.length > 12000) throw new Error('Respuesta inválida');
      const valor = JSON.parse(p.valor);
      return json(guardarRespuestas({
        cuestionarioId:cuestionarioID(),
        respuestas:[{preguntaId, valor, otroTexto:String(p.otroTexto || '')}]
      }));
    }
    // La finalización se confirma por separado; el cliente puede editar
    // mientras el cuestionario siga EN_PROGRESO.
    if (accion === 'finalizar') {
      return json(finalizarCuestionario({cuestionarioId:cuestionarioID()}));
    }
    return json({ok:false,error:'Acción no permitida'});
  } catch (error) {
    console.error(error);
    return json({ok:false,error:String(error && error.message || error)});
  }
}
