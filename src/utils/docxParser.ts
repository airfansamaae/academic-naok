import JSZip from 'jszip';

export interface DocxParsedRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSizePt?: number;
}

export interface DocxParsedParagraph {
  type: 'paragraph';
  align: 'left' | 'center' | 'right' | 'justify';
  runs: DocxParsedRun[];
  imageSrc?: string | null;
  isPageBreak?: boolean;
}

export interface DocxParsedTableCell {
  text: string;
  runs: DocxParsedRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  bgColor?: string;
  bold?: boolean;
  fontSizePt?: number;
  colSpan?: number;
  rowSpan?: number;
}

export interface DocxParsedTableRow {
  cells: DocxParsedTableCell[];
  isHeader?: boolean;
}

export interface DocxParsedTable {
  type: 'table';
  rows: (string[] | DocxParsedTableCell[])[];
  tableRows?: DocxParsedTableRow[];
  borderColors?: {
    outer?: string;
    inner?: string;
  };
}

export interface DocxParsedImage {
  type: 'image';
  dataUrl: string;
  alt?: string;
}

export type DocxElement = DocxParsedParagraph | DocxParsedTable | DocxParsedImage;

export interface DocxParsedPage {
  pageNumber: number;
  elements: DocxElement[];
}

export interface DocxParseResult {
  pages: DocxParsedPage[];
  totalPages: number;
  rawText: string;
}

/**
 * Parses any DOCX file (Uint8Array, ArrayBuffer, or base64 Data URL)
 * directly into authentic structured A4 pages.
 * 100% deterministic, never hangs, never spins indefinitely.
 */
export async function parseDocxBinary(
  input: Uint8Array | ArrayBuffer | string
): Promise<DocxParseResult> {
  try {
    let data: Uint8Array | ArrayBuffer;
    if (typeof input === 'string') {
      let b64 = input;
      if (input.includes(';base64,')) {
        b64 = input.split(';base64,')[1];
      }
      const raw = atob(b64.trim());
      const u8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        u8[i] = raw.charCodeAt(i);
      }
      data = u8;
    } else {
      data = input;
    }

    const zip = await JSZip.loadAsync(data);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      return { pages: [], totalPages: 0, rawText: '' };
    }

    const xml = await docXmlFile.async('text');

    // Extract embedded media images
    const mediaMap: Record<string, string> = {};
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (relsFile) {
      try {
        const relsXml = await relsFile.async('text');
        const relRegex = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
        let rMatch: RegExpExecArray | null;
        while ((rMatch = relRegex.exec(relsXml)) !== null) {
          const id = rMatch[1];
          let target = rMatch[2];
          if (!target.startsWith('media/') && !target.startsWith('word/media/')) {
            target = 'media/' + target.replace(/^(\.\.\/)+/, '');
          }
          const zipPath = target.startsWith('word/') ? target : 'word/' + target;
          const mFile = zip.file(zipPath);
          if (mFile) {
            const mB64 = await mFile.async('base64');
            const ext = zipPath.split('.').pop() || 'png';
            mediaMap[id] = `data:image/${ext};base64,${mB64}`;
          }
        }
      } catch (e) {
        console.warn('Could not parse rels:', e);
      }
    }

    // Clean comments
    const cleanXml = xml.replace(/<!--[\s\S]*?-->/g, '');
    const bodyMatch = cleanXml.match(/<w:body(?:\s+[^>]*)?>([\s\S]*?)<\/w:body>/);
    if (!bodyMatch) {
      return { pages: [], totalPages: 0, rawText: '' };
    }
    const bodyXml = bodyMatch[1];

    const elements: DocxElement[] = [];
    let rawText = '';

    // Regex to scan body elements (w:p and w:tbl) in natural document order
    const elemRegex = /<(w:p|w:tbl)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/g;
    let match: RegExpExecArray | null;

    while ((match = elemRegex.exec(bodyXml)) !== null) {
      const tag = match[1];
      const content = match[2];

      if (tag === 'w:p') {
        const isBreak = /<w:br\s+[^>]*w:type="page"/.test(content) || /<w:lastRenderedPageBreak\s*\/>/.test(content);
        const jcMatch = content.match(/<w:jc\s+[^>]*w:val="([^"]+)"/);
        let align: 'left' | 'center' | 'right' | 'justify' = 'left';
        if (jcMatch) {
          if (jcMatch[1] === 'center') align = 'center';
          else if (jcMatch[1] === 'right') align = 'right';
          else if (jcMatch[1] === 'both') align = 'justify';
        }

        // Image check
        let imageSrc: string | null = null;
        const imgMatch = content.match(/r:embed="([^"]+)"/);
        if (imgMatch && mediaMap[imgMatch[1]]) {
          imageSrc = mediaMap[imgMatch[1]];
        }

        const runs: DocxParsedRun[] = [];
        const runRegex = /<w:r(?:\s+[^>]*)?>([\s\S]*?)<\/w:r>/g;
        let rMatch: RegExpExecArray | null;

        while ((rMatch = runRegex.exec(content)) !== null) {
          const rContent = rMatch[1];
          const isBold = /<w:b(?:\s*\/|\s+[^>]*\/)?>/.test(rContent);
          const isItalic = /<w:i(?:\s*\/|\s+[^>]*\/)?>/.test(rContent);
          const isUnderline = /<w:u(?:\s*\/|\s+[^>]*\/)?>/.test(rContent);
          const colorMatch = rContent.match(/<w:color\s+[^>]*w:val="([^"]+)"/);
          const szMatch = rContent.match(/<w:sz\s+[^>]*w:val="([^"]+)"/);
          const fontSizePt = szMatch ? Math.round(parseInt(szMatch[1], 10) / 2) : 16;

          const tMatch = rContent.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/);
          if (tMatch) {
            const text = tMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&apos;/g, "'");
            runs.push({
              text,
              bold: isBold,
              italic: isItalic,
              underline: isUnderline,
              color: colorMatch ? `#${colorMatch[1]}` : undefined,
              fontSizePt
            });
            rawText += text + ' ';
          }
        }

        if (runs.length > 0 || isBreak || imageSrc) {
          elements.push({
            type: 'paragraph',
            align,
            runs,
            imageSrc,
            isPageBreak: isBreak
          });
          rawText += '\n';
        }
      } else if (tag === 'w:tbl') {
        const rows: string[][] = [];
        const tableRows: DocxParsedTableRow[] = [];

        // Parse table borders
        let outerBorderColor = '#475569';
        let innerBorderColor = '#94A3B8';
        const borderTopMatch = content.match(/<w:top\s+[^>]*w:color="([^"]+)"/);
        if (borderTopMatch && borderTopMatch[1] && borderTopMatch[1].toLowerCase() !== 'auto') {
          outerBorderColor = `#${borderTopMatch[1]}`;
        }
        const insideHMatch = content.match(/<w:insideH\s+[^>]*w:color="([^"]+)"/);
        if (insideHMatch && insideHMatch[1] && insideHMatch[1].toLowerCase() !== 'auto') {
          innerBorderColor = `#${insideHMatch[1]}`;
        }

        const trRegex = /<w:tr(?:\s+[^>]*)?>([\s\S]*?)<\/w:tr>/g;
        let trMatch: RegExpExecArray | null;

        while ((trMatch = trRegex.exec(content)) !== null) {
          const trContent = trMatch[1];
          const isHeaderRow = /<w:tblHeader\s*\/>/.test(trContent) || tableRows.length === 0;
          const parsedCells: DocxParsedTableCell[] = [];
          const stringCells: string[] = [];

          const tcRegex = /<w:tc(?:\s+[^>]*)?>([\s\S]*?)<\/w:tc>/g;
          let tcMatch: RegExpExecArray | null;

          while ((tcMatch = tcRegex.exec(trContent)) !== null) {
            const tcContent = tcMatch[1];

            // Background color from w:tcPr -> w:shd
            let bgColor: string | undefined;
            const shdMatch = tcContent.match(/<w:shd\s+[^>]*w:fill="([^"]+)"/);
            if (shdMatch && shdMatch[1]) {
              const fillVal = shdMatch[1].trim();
              if (fillVal.toLowerCase() !== 'auto' && fillVal.toLowerCase() !== 'clear' && fillVal.toLowerCase() !== 'none') {
                bgColor = fillVal.startsWith('#') ? fillVal : `#${fillVal}`;
              }
            }

            // ColSpan from w:gridSpan
            let colSpan: number | undefined;
            const gridSpanMatch = tcContent.match(/<w:gridSpan\s+[^>]*w:val="(\d+)"/);
            if (gridSpanMatch) {
              colSpan = parseInt(gridSpanMatch[1], 10);
            }

            // Cell paragraph alignment
            let cellAlign: 'left' | 'center' | 'right' | 'justify' | undefined;
            const jcMatch = tcContent.match(/<w:jc\s+[^>]*w:val="([^"]+)"/);
            if (jcMatch) {
              const val = jcMatch[1];
              if (val === 'center') cellAlign = 'center';
              else if (val === 'right') cellAlign = 'right';
              else if (val === 'both') cellAlign = 'justify';
              else cellAlign = 'left';
            }

            // Extract runs from cell
            const cellRuns: DocxParsedRun[] = [];
            const runRegex = /<w:r(?:\s+[^>]*)?>([\s\S]*?)<\/w:r>/g;
            let rMatch: RegExpExecArray | null;
            let cellText = '';
            let hasBold = false;
            let maxFontSize = isHeaderRow ? 14 : 13;

            while ((rMatch = runRegex.exec(tcContent)) !== null) {
              const rContent = rMatch[1];
              const isBold = /<w:b(?:\s*\/|\s+[^>]*\/)?>/.test(rContent);
              if (isBold) hasBold = true;
              const isItalic = /<w:i(?:\s*\/|\s+[^>]*\/)?>/.test(rContent);
              const isUnderline = /<w:u(?:\s*\/|\s+[^>]*\/)?>/.test(rContent);
              const colorMatch = rContent.match(/<w:color\s+[^>]*w:val="([^"]+)"/);
              const szMatch = rContent.match(/<w:sz\s+[^>]*w:val="([^"]+)"/);
              const fontSizePt = szMatch ? Math.round(parseInt(szMatch[1], 10) / 2) : undefined;
              if (fontSizePt && fontSizePt > maxFontSize) maxFontSize = fontSizePt;

              const tMatch = rContent.match(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/);
              if (tMatch) {
                const text = tMatch[1]
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&apos;/g, "'");
                cellRuns.push({
                  text,
                  bold: isBold,
                  italic: isItalic,
                  underline: isUnderline,
                  color: colorMatch ? `#${colorMatch[1]}` : undefined,
                  fontSizePt
                });
                cellText += text;
              }
            }

            // Fallback if no <w:r> found but text exists
            if (!cellText) {
              cellText = tcContent
                .replace(/<w:p(?:\s+[^>]*)?>/g, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .trim();
            }

            parsedCells.push({
              text: cellText,
              runs: cellRuns.length > 0 ? cellRuns : [{ text: cellText, bold: hasBold || isHeaderRow, fontSizePt: maxFontSize }],
              align: cellAlign || (isHeaderRow ? 'center' : 'left'),
              bgColor,
              bold: hasBold || isHeaderRow,
              fontSizePt: maxFontSize,
              colSpan
            });

            stringCells.push(cellText);
            rawText += cellText + '\t';
          }

          if (parsedCells.length > 0) {
            tableRows.push({
              cells: parsedCells,
              isHeader: isHeaderRow
            });
            rows.push(stringCells);
            rawText += '\n';
          }
        }

        if (tableRows.length > 0) {
          elements.push({
            type: 'table',
            rows,
            tableRows,
            borderColors: {
              outer: outerBorderColor,
              inner: innerBorderColor
            }
          });
        }
      }
    }

    // Paginate into realistic A4 pages
    // Standard A4 paper is 210mm x 297mm (~1:1.414).
    // An A4 page comfortably accommodates ~14-18 standard paragraphs or 1-2 tables.
    const pages: DocxParsedPage[] = [];
    let currentPage: DocxParsedPage = { pageNumber: 1, elements: [] };
    let currentItemsOnPage = 0;
    const maxItemsPerPage = 14;

    for (const el of elements) {
      const isBreak = el.type === 'paragraph' && el.isPageBreak;
      if (isBreak && currentPage.elements.length > 0) {
        pages.push(currentPage);
        currentPage = { pageNumber: pages.length + 1, elements: [] };
        currentItemsOnPage = 0;
      }

      currentPage.elements.push(el);
      currentItemsOnPage += el.type === 'table' ? Math.max(3, el.rows.length) : 1;

      if (currentItemsOnPage >= maxItemsPerPage) {
        pages.push(currentPage);
        currentPage = { pageNumber: pages.length + 1, elements: [] };
        currentItemsOnPage = 0;
      }
    }

    if (currentPage.elements.length > 0 || pages.length === 0) {
      pages.push(currentPage);
    }

    return {
      pages,
      totalPages: pages.length,
      rawText: rawText.trim()
    };
  } catch (err) {
    console.error('Error parsing docx binary:', err);
    return { pages: [], totalPages: 0, rawText: '' };
  }
}
