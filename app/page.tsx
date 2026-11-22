'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, FileText, LoaderCircle, Send, ShieldCheck, Share2, AlertCircle, Trash2, X } from 'lucide-react';
import { makePDF } from './pdf';
import bank from '../public/questions.json';

type Question = {
  // Esquema con claves en español (legacy GAS) y esquema actual en minúsculas/en inglés (questions.json)
  ID?: string; id?: string;
  Seccion?: string; seccion?: string; section?: string;
  Orden?: number; orden?: number; order?: number;
  Pregunta?: string; pregunta?: string; question?: string;
  Tipo?: string; tipo?: string; type?: string;
  Opciones?: string | string[]; opciones?: string | string[]; options?: string | string[];
  Obligatoria?: string | boolean; obligatoria?: string | boolean; required?: string | boolean;
  PermitirOtro?: string | boolean; permitirOtro?: string | boolean; allowOther?: string | boolean;
  Ayuda?: string; ayuda?: string; help?: string;
  Ejemplo?: string; ejemplo?: string; example?: string;
  Condicion?: string; condicion?: string; condition?: string;
};

type Q = {
  id: string;
  section: string;
  order: number;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  allowOther: boolean;
  help: string;
  example: string;
  condition: string;
};

const truth = (x: unknown) =>
  x === true ||
  String(x).toLowerCase() === 'si' ||
  String(x).toLowerCase() === 'sí' ||
  String(x).toLowerCase() === 'true';

const normalize = (q: Question): Q => ({
  id: String(q.id ?? q.ID ?? ''),
  section: String(q.section ?? q.seccion ?? ''),
  order: Number(q.order ?? q.orden ?? 0),
  label: String(q.question ?? q.Pregunta ?? ''),
  type: String(q.type ?? q.Tipo ?? 'texto').toLowerCase(),
  options: Array.isArray(q.options ?? q.Opciones)
    ? ((q.options ?? q.Opciones) as string[])
    : String(q.options ?? q.Opciones ?? '')
        .split(/\s*[|;,]\s*/)
        .filter(Boolean),
  required: truth(q.required ?? q.Obligatoria),
  allowOther: truth(q.allowOther ?? q.PermitirOtro),
  help: String(q.help ?? q.Ayuda ?? ''),
  example: String(q.example ?? q.Ejemplo ?? ''),
  condition: String(q.condition ?? q.Condicion ?? ''),
});

const MODULES = ['Inventario', 'Nomina', 'Finanzas', 'Facturacion'];
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const PAGE_SIZE = 4;
const FORM_VERSION = 'R6 · 22/11/2026';
const STORAGE_KEY = 'copi-form-data-v3';
const LEGACY_FINISHED_KEY = 'copi-form-finished';
const DRAFT_KEY = 'copi-form-data-v4';
const MAX_TEXT = 8000;
const NOT_APPLICABLE = 'No aplica';

function applies(id: string, answers: Record<string, unknown>) {
  if (id === 'INV02') return answers.INV01 !== 'No';
  if (id === 'FIN08') return answers.FIN07 !== 'No';
  if (id === 'FAC03') return answers.FAC01 === 'Inscrito';
  return true;
}

function validation(q: Q, answer: unknown, detail: string) {
  const empty = Array.isArray(answer) ? answer.length === 0 : String(answer ?? '').trim() === '';
  if (q.required && empty) return 'Completa la pregunta obligatoria: ' + q.label;
  if (!empty && q.id === 'NOM01' && (!Number.isSafeInteger(answer) || Number(answer) < 0)) {
    return 'Indica una cantidad entera de personas, igual o mayor que cero.';
  }
  if ((answer === 'Otro' || (Array.isArray(answer) && answer.includes('Otro'))) && !detail.trim()) {
    return 'Describe la opción «Otro»: ' + q.label;
  }
  return '';
}
const OFFICIAL_WHATSAPP_NUMBER = '18295210521';
const LABELS: Record<string, string> = {
  Inventario: 'Inventario y materiales',
  Nomina: 'Nómina y personal',
  Finanzas: 'Finanzas y gastos',
  Facturacion: 'Facturación y comprobantes',
};

export default function Page() {
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [stage, setStage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [finished, setFinished] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    try {
      const list = bank.map(normalize);
      if (list.length !== 56 || new Set(list.map(q => q.id)).size !== 56) {
        throw new Error('El banco de preguntas está incompleto o tiene identificadores duplicados.');
      }
      setQuestions(list);
      try {
        const currentDraft = localStorage.getItem(DRAFT_KEY);
        const raw = currentDraft || localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const draft = JSON.parse(raw);
          const saved: Record<string, unknown> = {};
          const details: Record<string, string> = {};
          for (const q of list) {
            // Old answers cannot be reused when the question now asks something different.
            if (!currentDraft && ['NOM09', 'FIN06', 'FIN09', 'FAC03', 'FAC04', 'FAC06', 'FAC07', 'FAC11', 'FAC12'].includes(q.id)) continue;
            const raw = draft.answers?.[q.id];
            const value = !currentDraft && q.id === 'NOM04' && typeof raw === 'string' ? [raw] : raw;
            const options = [...q.options, ...(q.allowOther ? ['Otro'] : [])];
            if (q.type === 'checkbox' && Array.isArray(value)) {
              saved[q.id] = [...new Set(value.filter(v => options.includes(v)))];
            } else if (q.type === 'radio' && options.includes(value)) {
              saved[q.id] = value;
            } else if (q.id === 'NOM01' && Number.isSafeInteger(value) && value >= 0) {
              saved[q.id] = value;
            } else if (q.type === 'parrafo' && typeof value === 'string') {
              saved[q.id] = value;
            }
            const detail = draft.otherTexts?.[q.id];
            if (q.allowOther && typeof detail === 'string') details[q.id] = detail;
          }
          setAnswers(saved);
          setOtherTexts(details);
          if (currentDraft) {
            const active = Array.isArray(saved.GEN01) ? saved.GEN01.map(fold) : [];
            const lastStage = MODULES.filter(module => active.includes(fold(module))).reduce((last, module) => last + Math.ceil(list.filter(q => fold(q.section) === fold(module)).length / PAGE_SIZE), 0);
            setStage(Number.isSafeInteger(draft.stage) ? Math.min(lastStage, Math.max(0, draft.stage)) : 0);
            setFinished(draft.finished === true && list.filter(q =>
              applies(q.id, saved) && (q.id === 'GEN01' || active.includes(fold(q.section)))
            ).every(q => !validation(q, saved[q.id], details[q.id] || '')));
          } else {
            setNotice('Recuperamos las respuestas compatibles. Revisa el formulario actualizado antes de finalizar.');
          }
        }
      } catch {
        setNotice('No se pudo leer el borrador guardado en este navegador.');
      }
      initialized.current = true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cargar el cuestionario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized.current || !questions.length) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, otherTexts, stage, finished }));
    } catch {
      setStorageAvailable(false);
    }
  }, [answers, otherTexts, stage, finished, questions.length]);

  function reset() {
    setShowResetModal(false);
    try {
      for (const key of [DRAFT_KEY, STORAGE_KEY, LEGACY_FINISHED_KEY, 'copi-form-draft-v1', 'copi-form-draft-v2']) {
        localStorage.removeItem(key);
      }
    } catch {
      setStorageAvailable(false);
    }
    setAnswers({});
    setOtherTexts({});
    setStage(0);
    setFinished(false);
    setNotice('');
    window.scrollTo(0, 0);
  }

  const selected = Array.isArray(answers.GEN01) ? (answers.GEN01 as string[]) : [];

  const pages = useMemo(() => {
    const result: { key: string; name: string; items: Q[] }[] = [];
    const chunk = (key: string, name: string, items: Q[]) => {
      for (let i = 0; i < items.length; i += PAGE_SIZE) {
        const total = Math.ceil(items.length / PAGE_SIZE);
        result.push({
          key: key + '-' + i,
          name: total > 1 ? name + ' · Parte ' + (Math.floor(i / PAGE_SIZE) + 1) + ' de ' + total : name,
          items: items.slice(i, i + PAGE_SIZE),
        });
      }
    };
    chunk('GEN', 'Servicios solicitados', questions.filter(q => fold(q.section) === 'general'));
    for (const m of MODULES) {
      if (!selected.some(x => fold(x) === fold(m))) continue;
      chunk(m, LABELS[m], questions.filter(q => fold(q.section) === fold(m)));
    }
    return result;
  }, [questions, selected]);

  const current = pages[Math.min(stage, Math.max(0, pages.length - 1))];
  const completed = pages.flatMap(page => page.items).filter(q => {
    const answer = answers[q.id];
    return applies(q.id, answers) &&
      (Array.isArray(answer) ? answer.length > 0 : String(answer ?? '').trim() !== '');
  }).length;

  function change(q: Q, value: unknown) {
    setAnswers(a => {
      const next = { ...a, [q.id]: value };
      for (const dependent of ['INV02', 'FIN08', 'FAC03']) {
        if (!applies(dependent, next)) delete next[dependent];
      }
      return next;
    });
    setNotice('');
  }

  function changeCheckbox(q: Q, chosen: string[], option: string, checked: boolean) {
    if (!checked) {
      change(q, chosen.filter(value => value !== option));
      return;
    }
    const exclusive = ['Ninguno por ahora', 'No sabemos'];
    change(q, q.id === 'FAC12'
      ? exclusive.includes(option) ? [option] : [...chosen.filter(value => !exclusive.includes(value)), option]
      : [...chosen, option]);
  }

  function changeOther(id: string, value: string) {
    setOtherTexts(a => ({ ...a, [id]: value }));
    setNotice('');
  }

  const hasOther = (q: Q) =>
    q.allowOther &&
    (answers[q.id] === 'Otro' || (Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes('Otro')));

  function goBack() {
    if (stage === 0) return;
    setStage(x => Math.max(0, x - 1));
    setNotice('Los cambios se guardan automáticamente en el navegador.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function advance() {
    if (!current) return;
    for (const q of current.items) {
      if (!applies(q.id, answers)) continue;
      const issue = validation(q, answers[q.id], otherTexts[q.id] || '');
      if (issue) {
        setNotice(issue);
        document.getElementById(q.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    if (stage >= pages.length - 1) {
      const invalid = pages.findIndex(page => page.items.some(q =>
        applies(q.id, answers) && validation(q, answers[q.id], otherTexts[q.id] || '')
      ));
      if (invalid >= 0) {
        setStage(invalid);
        setNotice('Revisa las respuestas pendientes de este paso.');
        return;
      }
      setShowFinishModal(true);
      return;
    }
    setStage(x => x + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function generatePDF() {
    return makePDF(FORM_VERSION, selected, pages.map(page => ({
      name: page.name,
      items: page.items.map(q => {
        const value = answers[q.id];
        const values = Array.isArray(value) ? value : [value];
        const detail = otherTexts[q.id]?.trim();
        const text = values.filter(v => v !== undefined && String(v).trim()).map(v =>
          v === 'Otro' && detail ? 'Otro: ' + detail : String(v)
        ).join(', ');
        return { id: q.id, label: q.label, answer: applies(q.id, answers) ? text || '(sin respuesta)' : NOT_APPLICABLE };
      }),
    })));
  }

  function exportPDF() {
    generatePDF().save(pdfName());
  }

  function pdfName() {
    return `Cuestionario_Copi_Autopint_${new Date().toISOString().slice(0, 10)}.pdf`;
  }

  const whatsappMessage = 'Hola, NexusRD. Ya completé el cuestionario de Copi Autopint. Voy a adjuntar el PDF descargado.';
  const whatsappUrl = `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

  if (loading) {
    return (
      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src="https://iyyeczoamsoiwujbwgjh.supabase.co/storage/v1/object/public/img_products/landing/logo.webp" alt="" width={46} height={46} onError={event => { event.currentTarget.style.display = "none"; }} />
            
            <div><strong>Nexus<span>RD</span></strong><small>Servicios digitales</small></div>
          </div>
          <span className="secure"><ShieldCheck size={16} /> Cuestionario de requisitos</span>
        </header>
        <div className="container">
          <div className="eyebrow"><span className="dot" /> PROYECTO · COPI AUTOPINT</div>
          <h1>Construyamos la solución <em>correcta.</em></h1>
          <p className="intro">Queremos entender cómo trabaja tu negocio para diseñar un sistema que realmente te facilite el día a día.</p>
          <div className="panel centered"><LoaderCircle className="spin" /> Cargando cuestionario…</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src="https://iyyeczoamsoiwujbwgjh.supabase.co/storage/v1/object/public/img_products/landing/logo.webp" alt="" width={46} height={46} onError={event => { event.currentTarget.style.display = "none"; }} />
            
            <div><strong>Nexus<span>RD</span></strong><small>Servicios digitales</small></div>
          </div>
          <span className="secure"><ShieldCheck size={16} /> Cuestionario de requisitos</span>
        </header>
        <div className="container">
          <div className="eyebrow"><span className="dot" /> PROYECTO · COPI AUTOPINT</div>
          <h1>Construyamos la solución <em>correcta.</em></h1>
          <div className="panel centered error">
            <AlertCircle size={32} />
            <h2>El formulario no está disponible</h2>
            <p>{error}</p>
            <p>Comunícate con NexusRD para resolverlo.</p>
          </div>
        </div>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src="https://iyyeczoamsoiwujbwgjh.supabase.co/storage/v1/object/public/img_products/landing/logo.webp" alt="" width={46} height={46} onError={event => { event.currentTarget.style.display = "none"; }} />
            
            <div><strong>Nexus<span>RD</span></strong><small>Servicios digitales</small></div>
          </div>
          <span className="secure"><ShieldCheck size={16} /> Cuestionario de requisitos</span>
        </header>
        <div className="container">
          <div className="eyebrow"><span className="dot" /> PROYECTO · COPI AUTOPINT</div>
          <h1>Construyamos la solución <em>correcta.</em></h1>
          <div className="panel centered success">
            <div className="success-icon"><CheckCircle2 size={38} /></div>
            <h2>¡Cuestionario completado!</h2>
            <p>{storageAvailable ? 'Las respuestas se guardaron en tu navegador.' : 'El navegador no permitió guardar las respuestas. Descarga una copia antes de cerrar.'}</p>
            <div className="actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px' }}>
              <button className="primary" onClick={exportPDF}><FileText size={18} /> Descargar PDF</button>
              <a className="primary" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><Share2 size={18} /> Abrir WhatsApp del negocio</a>
            </div>
            <p className="notice" style={{ marginTop: '16px', fontSize: '13px', color: '#526e75', lineHeight: 1.7 }}>
              <strong>¿Cómo enviar tus respuestas?</strong> Primero pulsa «Descargar PDF». Después abre WhatsApp, busca el contacto del equipo de NexusRD (+1 829-521-0521) y adjunta el archivo descargado. También puedes pulsar «Abrir WhatsApp del negocio» para entrar directamente a nuestra conversación. Revisa el destinatario y pulsa Enviar en WhatsApp.
            </p>
            <p className="notice" style={{ marginTop: '8px', fontSize: '12px', color: '#677b82' }}>
              Tus respuestas permanecen guardadas en este navegador. <a href="#" onClick={event => { event.preventDefault(); setShowResetModal(true); }}>Borrar respuestas y empezar de nuevo</a>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
            <img className="brand-logo" src="https://iyyeczoamsoiwujbwgjh.supabase.co/storage/v1/object/public/img_products/landing/logo.webp" alt="" width={46} height={46} onError={event => { event.currentTarget.style.display = "none"; }} />
          
          <div><strong>Nexus<span>RD</span></strong><small>Servicios digitales</small></div>
        </div>
        <span className="secure"><ShieldCheck size={16} /> Cuestionario de requisitos</span>
      </header>
      <div className="container">
        <div className="eyebrow"><span className="dot" /> PROYECTO · COPI AUTOPINT</div>
        <h1>Construyamos la solución <em>correcta.</em></h1>
        <p className="intro">Queremos entender cómo trabaja tu negocio para diseñar un sistema que realmente te facilite el día a día. Responde con tranquilidad: cada pregunta incluye orientación.</p>

        {!storageAvailable && <p role="alert">El navegador no permite guardar el progreso. Descarga el PDF al terminar.</p>}
        <div className="draft-actions"><button type="button" className="reset-draft" onClick={() => setShowResetModal(true)}><Trash2 size={14} aria-hidden="true" /> Borrar borrador y empezar de nuevo</button></div>
        <div className="progress-info">
          <span>Paso {Math.min(stage + 1, pages.length)} de {pages.length}</span>
          <span>{completed} respuestas en el formulario</span>
        </div>
        <div className="progress"><div style={{ width: ((stage + 1) / pages.length) * 100 + '%' }} /></div>

        <div className="panel">
          <div className="section-heading">
            <div className="section-icon"><ClipboardList size={22} /></div>
            <div><small>ETAPA {String(stage + 1).padStart(2, '0')}</small><h2>{current?.name}</h2></div>
          </div>
          {stage === 0 && <p className="section-lead">Selecciona las áreas que necesitas. Solo te mostraremos las preguntas correspondientes.</p>}
          {current?.items.map((q, i) => (
            <section className="question" key={q.id} id={q.id}>
              <label className="question-title" htmlFor={'field-' + q.id}>
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                {q.label}
                {q.required && <span className="required">*</span>}
              </label>
              {q.help && <p className="help">{q.help}</p>}
              {!applies(q.id, answers) ? <p>{NOT_APPLICABLE}</p> : q.id === 'GEN01' || q.type.includes('multiple') || q.type.includes('checkbox') || q.type.includes('multi') ? (
                <div className="options">
                  {(q.id === 'GEN01' && q.options.length === 0
                    ? ['Inventario', 'Nómina', 'Finanzas', 'Facturación']
                    : q.options
                  )
                    .concat(q.allowOther && !q.options.includes('Otro') ? ['Otro'] : [])
                    .map(o => {
                      const chosen = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                      return (
                        <label key={o} className={'option ' + (chosen.includes(o) ? 'selected' : '')}>
                          <input
                            type="checkbox"
                            value={o}
                            checked={chosen.includes(o)}
                            onChange={e => changeCheckbox(q, chosen, o, e.target.checked)}
                          />
                          <span className="check">{chosen.includes(o) && <Check size={14} />}</span>
                          {LABELS[fold(o) === 'nomina' ? 'Nomina' : fold(o) === 'facturacion' ? 'Facturacion' : o] ?? o}
                        </label>
                      );
                    })}
                  {hasOther(q) && (
                    <textarea
                      rows={3}
                      maxLength={MAX_TEXT}
                      value={otherTexts[q.id] || ''}
                      onChange={e => changeOther(q.id, e.target.value)}
                      placeholder="Especifica cuál…"
                      aria-label={'Especifica Otro: ' + q.label}
                    />
                  )}
                </div>
              ) : q.type === 'radio' || q.type.includes('select') || q.type.includes('opcion') || q.type.includes('lista') ? (
                <div className="options">
                  {q.options.concat(q.allowOther && !q.options.includes('Otro') ? ['Otro'] : []).map(o => (
                    <label key={o} className={'option ' + (answers[q.id] === o ? 'selected' : '')}>
                      <input
                        type="radio"
                        name={q.id}
                        value={o}
                        checked={answers[q.id] === o}
                        onChange={() => change(q, o)}
                      />
                      <span className="check">{answers[q.id] === o && <Check size={14} />}</span>
                      {o}
                    </label>
                  ))}
                  {hasOther(q) && (
                    <textarea
                      rows={3}
                      maxLength={MAX_TEXT}
                      value={otherTexts[q.id] || ''}
                      onChange={e => changeOther(q.id, e.target.value)}
                      placeholder="Especifica cuál…"
                      aria-label={'Especifica Otro: ' + q.label}
                    />
                  )}
                </div>
              ) : q.type.includes('numero') || q.type.includes('número') ? (
                <input
                  id={'field-' + q.id}
                  type="number"
                  min={0}
                  step={1}
                  value={String(answers[q.id] ?? '')}
                  onChange={e => change(q, e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Escribe un número…"
                />
              ) : q.type.includes('fecha') ? (
                <input
                  id={'field-' + q.id}
                  type="date"
                  value={String(answers[q.id] ?? '')}
                  onChange={e => change(q, e.target.value)}
                />
              ) : q.type.includes('si_no') || q.type.includes('boolean') ? (
                <div className="options">
                  {['Sí', 'No'].map(o => (
                    <label key={o} className={'option ' + (answers[q.id] === o ? 'selected' : '')}>
                      <input
                        type="radio"
                        name={q.id}
                        value={o}
                        checked={answers[q.id] === o}
                        onChange={() => change(q, o)}
                      />
                      <span className="check">{answers[q.id] === o && <Check size={14} />}</span>
                      {o}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  id={'field-' + q.id}
                  maxLength={MAX_TEXT}
                  rows={q.type.includes('largo') || q.type.includes('parrafo') || q.type.includes('párrafo') ? 5 : 3}
                  value={String(answers[q.id] ?? '')}
                  onChange={e => {
                    change(q, e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  placeholder="Escribe tu respuesta aquí…"
                />
              )}
              {q.example && <div className="example"><strong>Ejemplo:</strong> {q.example}</div>}
            </section>
          ))}
          {notice && <div className="notice" role="alert">{notice}</div>}
        </div>

        <div className="actions">
          <button className="back" disabled={stage === 0} onClick={goBack}>
            <ArrowLeft size={17} /> Anterior
          </button>
          <button className="primary" onClick={advance}>
            {stage === pages.length - 1 ? <CheckCircle2 size={17} /> : <ArrowRight size={17} />}
            {stage === pages.length - 1 ? 'Finalizar cuestionario' : 'Guardar y continuar'}
          </button>
        </div>
      </div>
      {showResetModal && (
        <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowResetModal(false); }}>
          <section className="reset-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-modal-title" aria-describedby="reset-modal-description">
            <button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setShowResetModal(false)}><X size={20} /></button>
            <div className="modal-icon"><Trash2 size={24} /></div>
            <h2 id="reset-modal-title">¿Empezar de nuevo?</h2>
            <p id="reset-modal-description">Se borrarán las respuestas guardadas en este dispositivo. Esta acción no se puede deshacer. Si quieres conservarlas, descarga primero tu PDF.</p>
            <div className="modal-actions">
              <button type="button" className="modal-cancel" autoFocus onClick={() => setShowResetModal(false)}>Conservar respuestas</button>
              <button type="button" className="modal-danger" onClick={reset}><Trash2 size={16} /> Sí, borrar borrador</button>
            </div>
          </section>
        </div>
      )}
      {showFinishModal && (
        <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowFinishModal(false); }}>
          <section className="reset-modal" role="alertdialog" aria-modal="true" aria-labelledby="finish-modal-title" aria-describedby="finish-modal-description">
            <button type="button" className="modal-close" aria-label="Cerrar" onClick={() => setShowFinishModal(false)}><X size={20} /></button>
            <div className="modal-icon modal-icon-success"><CheckCircle2 size={25} /></div>
            <h2 id="finish-modal-title">¿Todo listo para finalizar?</h2>
            <p id="finish-modal-description">Revisa que tus respuestas estén completas. Al confirmar, podrás descargar el cuestionario en PDF o compartirlo por WhatsApp.</p>
            <div className="modal-actions">
              <button type="button" className="modal-cancel" autoFocus onClick={() => setShowFinishModal(false)}>Seguir revisando</button>
              <button type="button" className="modal-confirm" onClick={() => { setShowFinishModal(false); setFinished(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><CheckCircle2 size={16} /> Finalizar cuestionario</button>
            </div>
          </section>
        </div>
      )}
      <footer>
        <span>© {new Date().getFullYear()} NexusRD · {FORM_VERSION}</span>
        <span>Diseñado para Copi Autopint · Con atención a cada detalle</span>
      </footer>
    </main>
  );
}