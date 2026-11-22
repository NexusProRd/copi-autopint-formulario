import jsPDF from 'jspdf';

type Item = { id: string; label: string; answer: string };
type Section = { name: string; items: Item[] };

export function makePDF(version: string, modules: string[], sections: Section[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const { width, height } = doc.internal.pageSize;
  const margin = 42;
  const bodyWidth = width - 2 * margin;
  const bottom = height - 62;
  const lineHeight = 14;
  let y = margin;

  function style(size: number, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(20, 42, 52);
  }

  function write(lines: string[], indent = 0) {
    for (const line of lines) {
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
  }

  function header() {
    style(15, true);
    write(['NexusRD · Cuestionario de requisitos']);
    style(10);
    write(['Copi Autopint · ' + version]);
    y += 10;
  }

  function nextPage() {
    doc.addPage();
    y = margin;
    header();
  }

  header();
  style(10);
  write(doc.splitTextToSize('Módulos: ' + modules.join(', '), bodyWidth));
  y += 12;

  for (const section of sections) {
    const heading = () => {
      style(11, true);
      write([section.name]);
      y += 6;
    };
    if (y + 5 * lineHeight > bottom) nextPage();
    heading();

    for (const { id, label, answer } of section.items) {
      style(10, true);
      const title: string[] = doc.splitTextToSize(id + ' · ' + label, bodyWidth);
      style(10);
      const lines: string[] = doc.splitTextToSize('Respuesta: ' + answer, bodyWidth - 10);
      const space = (title.length + lines.length) * lineHeight;
      const fullPage = bottom - (margin + 2 * lineHeight + 10 + lineHeight + 6);
      if ((space <= fullPage && y + space > bottom) || y + (title.length + 1) * lineHeight > bottom) {
        nextPage();
        heading();
      }
      let index = 0;
      do {
        style(10, true);
        write(title);
        style(10);
        if (index) write(['Respuesta (continuación):'], 10);
        const fit = Math.floor((bottom - y) / lineHeight);
        write(lines.slice(index, index + fit), 10);
        index += fit;
        if (index < lines.length) {
          nextPage();
          heading();
        }
      } while (index < lines.length);
      y += 10;
    }
  }

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    style(9);
    doc.text(`NexusRD · Página ${page} de ${total}`, width / 2, height - 32, { align: 'center' });
  }
  return doc;
}

