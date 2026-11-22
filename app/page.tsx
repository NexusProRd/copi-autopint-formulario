'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, Download, FileSpreadsheet, FileText, LoaderCircle, Send, ShieldCheck, Share2, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
const FORM_VERSION = 'R5 · 22/11/2026';
const STORAGE_KEY = 'copi-form-data-v3';
const FINISHED_KEY = 'copi-form-finished';
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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [finished, setFinished] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const res = await fetch('/copi-autopint-formulario/questions.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo cargar questions.json');
        const data: Question[] = await res.json();
        const list = data.map(normalize).filter((q: Q) => q.id && q.label).sort((a, b) => a.order - b.order);
        if (!list.length) throw new Error('No hay preguntas válidas en questions.json');
        const ids = new Set(list.map(q => q.id));
        if (ids.size !== list.length) throw new Error('Hay preguntas duplicadas en questions.json');
        const counts = { General: 1, Inventario: 14, Nomina: 13, Finanzas: 14, Facturacion: 14 };
        const incomplete = Object.entries(counts).filter(
          ([name, count]) => list.filter(q => fold(q.section) === fold(name)).length !== count
        );
        if (incomplete.length) {
          throw new Error(
            'El banco de preguntas está incompleto: ' +
              incomplete.map(([name, count]) => `${name} (esperadas ${count})`).join(', ')
          );
        }

        let local: Record<string, unknown> = {};
        let localOther: Record<string, string> = {};
        let finishedFlag = false;
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            local = parsed.answers || {};
            localOther = parsed.otherTexts || {};
          }
          if (typeof window !== 'undefined' && localStorage.getItem(FINISHED_KEY)) {
            finishedFlag = true;
          }
        } catch {}

        if (!alive) return;
        setQuestions(list);
        setAnswers(local);
        setOtherTexts(localOther);
        setFinished(finishedFlag);
        if (finishedFlag) {
          // Consistencia: conservar las respuestas (STORAGE_KEY) y el estado finalizado (FINISHED_KEY).
          try {
            localStorage.setItem(FINISHED_KEY, 'true');
          } catch {}
        } else {
          localStorage.removeItem('copi-form-draft-v1');
          localStorage.removeItem('copi-form-draft-v2');
        }
        initialized.current = true;
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'No se pudo cargar el cuestionario.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    init();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!initialized.current || finished) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, otherTexts }));
  }, [answers, otherTexts, finished]);

  useEffect(() => {
    if (finished && initialized.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, otherTexts }));
        localStorage.setItem(FINISHED_KEY, 'true');
      } catch {}
    }
  }, [finished, answers, otherTexts]);

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
  const completed = Object.values(answers).filter(
    v => Array.isArray(v) ? v.length > 0 : String(v ?? '').trim().length > 0
  ).length;

  function change(q: Q, value: unknown) {
    setAnswers(a => ({ ...a, [q.id]: value }));
    setNotice('');
  }

  function changeOther(id: string, value: string) {
    setOtherTexts(a => ({ ...a, [id]: value }));
    setNotice('');
  }

  const hasOther = (q: Q) =>
    q.allowOther &&
    (answers[q.id] === 'Otro' || (Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes('Otro')));

  function goBack() {
    if (stage === 0 || busy) return;
    setStage(x => Math.max(0, x - 1));
    setNotice('Los cambios se guardan automáticamente en el navegador.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function advance() {
    if (!current || busy) return;
    const missing = current.items.find(
      q => q.required && (Array.isArray(answers[q.id]) ? !(answers[q.id] as unknown[]).length : String(answers[q.id] ?? '').trim() === '')
    );
    if (missing) {
      setNotice('Completa la pregunta obligatoria: ' + missing.label);
      document.getElementById(missing.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (stage === pages.length - 1) {
      if (!window.confirm('¿Confirmas que terminaste? Después de finalizar no podrás editar las respuestas.')) return;
      setFinished(true);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, otherTexts }));
        localStorage.setItem(FINISHED_KEY, 'true');
      } catch {}
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setStage(x => x + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exportPDF() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 50;

    // Logo placeholder / Brand
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(18, 158, 145);
    doc.text('Nexus', margin, y);
    doc.setTextColor(19, 42, 52);
    doc.text('RD', margin + 55, y);

    y += 30;
    doc.setFontSize(10);
    doc.setTextColor(103, 123, 130);
    doc.text('Servicios digitales', margin, y);

    y += 20;
    doc.setDrawColor(221, 236, 234);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    y += 20;
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 42, 52);
    doc.text('Cuestionario de Requisitos — Copi Autopint', margin, y);

    y += 18;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(103, 123, 130);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
    doc.text(`Versión: ${FORM_VERSION}`, margin + 200, y);

    y += 25;

    const selectedModules = selected.filter(m => m !== 'General').map(m => LABELS[m] || m).join(', ') || 'Ninguno';
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 42, 52);
    doc.text('Módulos seleccionados:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(103, 123, 130);
    doc.text(selectedModules, margin + 110, y);

    y += 25;

    const allQuestions = pages.flatMap(p => p.items);
    let qNum = 0;

    for (const page of pages) {
      if (page.items.length === 0) continue;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 158, 145);
      doc.text(page.name, margin, y);
      y += 10;
      doc.setDrawColor(221, 236, 234);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      for (const q of page.items) {
        qNum++;
        const answer = answers[q.id];
        const other = otherTexts[q.id] || '';

        let answerStr = '';
        if (Array.isArray(answer)) {
          answerStr = answer.length ? answer.join(', ') : '(sin respuesta)';
          if (q.allowOther && answer.includes('Otro') && other) {
            answerStr += ` (Otro: ${other})`;
          }
        } else if (answer !== undefined && String(answer).trim()) {
          answerStr = String(answer);
          if (q.allowOther && answer === 'Otro' && other) {
            answerStr += ` (Otro: ${other})`;
          }
        } else {
          answerStr = '(sin respuesta)';
        }

        // Question number and text
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(19, 42, 52);
        const qLines = doc.splitTextToSize(`${qNum}. ${q.label}`, pageWidth - margin * 2);
        for (const line of qLines) {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.text(line, margin, y);
          y += 14;
        }

        // Help text
        if (q.help) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(103, 123, 130);
          const hLines = doc.splitTextToSize(q.help, pageWidth - margin * 2 - 20);
          for (const line of hLines) {
            if (y > 750) { doc.addPage(); y = 50; }
            doc.text(line, margin + 10, y);
            y += 12;
          }
        }

        // Answer
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(19, 42, 52);
        const aLines = doc.splitTextToSize(`Respuesta: ${answerStr}`, pageWidth - margin * 2 - 20);
        for (const line of aLines) {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.text(line, margin + 10, y);
          y += 14;
        }

        // Example
        if (q.example) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(103, 123, 130);
          const eLines = doc.splitTextToSize(`Ejemplo: ${q.example}`, pageWidth - margin * 2 - 20);
          for (const line of eLines) {
            if (y > 750) { doc.addPage(); y = 50; }
            doc.text(line, margin + 10, y);
            y += 12;
          }
        }

        y += 10;
      }
      y += 10;
    }

    // Footer
    const totalPages = (doc as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(103, 123, 130);
      doc.text(`NexusRD · ${FORM_VERSION} · Página ${i} de ${totalPages}`, pageWidth / 2, 810, { align: 'center' });
    }

    doc.save(`Cuestionario_Copi_Autopint_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function exportExcel() {
    const allQuestions = pages.flatMap(p => p.items);
    const rows = allQuestions.map((q, idx) => {
      const answer = answers[q.id];
      const other = otherTexts[q.id] || '';

      let answerStr = '';
      if (Array.isArray(answer)) {
        answerStr = answer.length ? answer.join(', ') : '';
        if (q.allowOther && answer.includes('Otro') && other) {
          answerStr += ` (Otro: ${other})`;
        }
      } else if (answer !== undefined && String(answer).trim()) {
        answerStr = String(answer);
        if (q.allowOther && answer === 'Otro' && other) {
          answerStr += ` (Otro: ${other})`;
        }
      }

      return {
        Módulo: LABELS[q.section] || q.section,
        'Nº Pregunta': idx + 1,
        ID: q.id,
        Pregunta: q.label,
        Respuesta: answerStr,
        Obligatoria: q.required ? 'Sí' : 'No',
        Tipo: q.type,
        Ayuda: q.help || '',
        Ejemplo: q.example || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Respuestas');
    XLSX.writeFile(wb, `Cuestionario_Copi_Autopint_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  async function shareViaWhatsApp() {
    const pdfBlob = await generatePDFBlob();
    const file = new File([pdfBlob], `Cuestionario_Copi_Autopint_${new Date().toISOString().split('T')[0]}.pdf`, { type: 'application/pdf' });

    const message = 'Hola, NexusRD. Adjunto el cuestionario de requisitos completado de Copi Autopint.';

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Cuestionario Copi Autopint', text: message });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    const blobUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

    const waUrl = `https://wa.me/${OFFICIAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }

  function generatePDFBlob(): Promise<Blob> {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(18, 158, 145);
    doc.text('Nexus', margin, y);
    doc.setTextColor(19, 42, 52);
    doc.text('RD', margin + 55, y);

    y += 30;
    doc.setFontSize(10);
    doc.setTextColor(103, 123, 130);
    doc.text('Servicios digitales', margin, y);

    y += 20;
    doc.setDrawColor(221, 236, 234);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);

    y += 20;
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 42, 52);
    doc.text('Cuestionario de Requisitos — Copi Autopint', margin, y);

    y += 18;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(103, 123, 130);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
    doc.text(`Versión: ${FORM_VERSION}`, margin + 200, y);

    y += 25;

    const selectedModules = selected.filter(m => m !== 'General').map(m => LABELS[m] || m).join(', ') || 'Ninguno';
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(19, 42, 52);
    doc.text('Módulos seleccionados:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(103, 123, 130);
    doc.text(selectedModules, margin + 110, y);

    y += 25;

    const allQuestions = pages.flatMap(p => p.items);
    let qNum = 0;

    for (const page of pages) {
      if (page.items.length === 0) continue;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 158, 145);
      doc.text(page.name, margin, y);
      y += 10;
      doc.setDrawColor(221, 236, 234);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      for (const q of page.items) {
        qNum++;
        const answer = answers[q.id];
        const other = otherTexts[q.id] || '';

        let answerStr = '';
        if (Array.isArray(answer)) {
          answerStr = answer.length ? answer.join(', ') : '(sin respuesta)';
          if (q.allowOther && answer.includes('Otro') && other) {
            answerStr += ` (Otro: ${other})`;
          }
        } else if (answer !== undefined && String(answer).trim()) {
          answerStr = String(answer);
          if (q.allowOther && answer === 'Otro' && other) {
            answerStr += ` (Otro: ${other})`;
          }
        } else {
          answerStr = '(sin respuesta)';
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(19, 42, 52);
        const qLines = doc.splitTextToSize(`${qNum}. ${q.label}`, pageWidth - margin * 2);
        for (const line of qLines) {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.text(line, margin, y);
          y += 14;
        }

        if (q.help) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(103, 123, 130);
          const hLines = doc.splitTextToSize(q.help, pageWidth - margin * 2 - 20);
          for (const line of hLines) {
            if (y > 750) { doc.addPage(); y = 50; }
            doc.text(line, margin + 10, y);
            y += 12;
          }
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(19, 42, 52);
        const aLines = doc.splitTextToSize(`Respuesta: ${answerStr}`, pageWidth - margin * 2 - 20);
        for (const line of aLines) {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.text(line, margin + 10, y);
          y += 14;
        }

        if (q.example) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(103, 123, 130);
          const eLines = doc.splitTextToSize(`Ejemplo: ${q.example}`, pageWidth - margin * 2 - 20);
          for (const line of eLines) {
            if (y > 750) { doc.addPage(); y = 50; }
            doc.text(line, margin + 10, y);
            y += 12;
          }
        }

        y += 10;
      }
      y += 10;
    }

    const totalPages = (doc as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(103, 123, 130);
      doc.text(`NexusRD · ${FORM_VERSION} · Página ${i} de ${totalPages}`, pageWidth / 2, 810, { align: 'center' });
    }

    return Promise.resolve(doc.output('blob'));
  }

  if (loading) {
    return (
      <main className="shell">
        <header className="topbar">
          <div className="brand">
            <img className="brand-logo" src="https://iyyeczoamsoiwujbwgjh.supabase.co/storage/v1/object/public/img_products/landing/logo.webp" alt="Logo de NexusRD" />
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
            <img className="brand-logo" src="https://iyyeczoamsoiwujbwgjh.supabase.co/storage/v1/object/public/img_products/landing/logo.webp" alt="Logo de NexusRD" />
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
            <img className="brand-logo" src="https://iyyeczoamsoiwujbwgjh.supabase.co/storage/v1/object/public/img_products/landing/logo.webp" alt="Logo de NexusRD" />
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
            <p>Las respuestas se guardaron en tu navegador. Ahora puedes exportar los resultados.</p>
            <div className="actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '24px' }}>
              <button className="primary" onClick={exportPDF}><FileText size={18} /> Descargar PDF</button>
              <button className="primary" onClick={shareViaWhatsApp}><Share2 size={18} /> Enviar PDF al equipo de NexusRD</button>
            </div>
            <p className="notice" style={{ marginTop: '16px', fontSize: '12px', color: '#677b82' }}>
              Los datos se almacenan solo en este navegador. Si limpias los datos del sitio, se perderán.
            </p>
            <p className="notice" style={{ marginTop: '8px', fontSize: '12px', color: '#677b82' }}>
              Al enviar: se abrirá WhatsApp hacia el equipo de NexusRD (+1 829-521-0521). Si tu dispositivo no permite adjuntar el PDF, este se descargará para que lo adjuntes manualmente.
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
          <img className="brand-logo" src="https://iyyeczoamsoiwujbwgjh.supabase.co/storage/v1/object/public/img_products/landing/logo.webp" alt="Logo de NexusRD" />
          <div><strong>Nexus<span>RD</span></strong><small>Servicios digitales</small></div>
        </div>
        <span className="secure"><ShieldCheck size={16} /> Cuestionario de requisitos</span>
      </header>
      <div className="container">
        <div className="eyebrow"><span className="dot" /> PROYECTO · COPI AUTOPINT</div>
        <h1>Construyamos la solución <em>correcta.</em></h1>
        <p className="intro">Queremos entender cómo trabaja tu negocio para diseñar un sistema que realmente te facilite el día a día. Responde con tranquilidad: cada pregunta incluye orientación.</p>

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
              {q.id === 'GEN01' || q.type.includes('multiple') || q.type.includes('checkbox') || q.type.includes('multi') ? (
                <div className="options">
                  {(q.id === 'GEN01' && q.options.length === 0
                    ? ['Inventario', 'Nómina', 'Finanzas', 'Facturación']
                    : q.options
                  )
                    .concat(q.allowOther ? ['Otro'] : [])
                    .map(o => {
                      const chosen = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                      return (
                        <label key={o} className={'option ' + (chosen.includes(o) ? 'selected' : '')}>
                          <input
                            type="checkbox"
                            value={o}
                            checked={chosen.includes(o)}
                            onChange={e => change(q, e.target.checked ? [...chosen, o] : chosen.filter(x => x !== o))}
                          />
                          <span className="check">{chosen.includes(o) && <Check size={14} />}</span>
                          {LABELS[fold(o) === 'nomina' ? 'Nomina' : fold(o) === 'facturacion' ? 'Facturacion' : o] ?? o}
                        </label>
                      );
                    })}
                  {hasOther(q) && (
                    <textarea
                      rows={3}
                      value={otherTexts[q.id] || ''}
                      onChange={e => changeOther(q.id, e.target.value)}
                      placeholder="Especifica cuál…"
                      aria-label={'Especifica Otro: ' + q.label}
                    />
                  )}
                </div>
              ) : q.type === 'radio' || q.type.includes('select') || q.type.includes('opcion') || q.type.includes('lista') ? (
                <div className="options">
                  {q.options.concat(q.allowOther ? ['Otro'] : []).map(o => (
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
          <button className="back" disabled={stage === 0 || busy} onClick={goBack}>
            <ArrowLeft size={17} /> Anterior
          </button>
          <button className="primary" disabled={busy} onClick={advance}>
            {stage === pages.length - 1 ? <CheckCircle2 size={17} /> : <ArrowRight size={17} />}
            {stage === pages.length - 1 ? 'Finalizar cuestionario' : 'Guardar y continuar'}
          </button>
        </div>
      </div>
      <footer>
        <span>© {new Date().getFullYear()} NexusRD · {FORM_VERSION}</span>
        <span>Diseñado para Copi Autopint · Con atención a cada detalle</span>
      </footer>
    </main>
  );
}