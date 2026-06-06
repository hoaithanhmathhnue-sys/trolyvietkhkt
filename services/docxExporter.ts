/**
 * DOCX Exporter Service
 * Chuyển đổi Markdown sang file .docx thực sự sử dụng thư viện docx
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  LevelFormat,
  ShadingType,
} from 'docx';

interface ParsedElement {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code';
  level?: number;
  content: string;
  items?: string[];
  isOrdered?: boolean;
  rows?: string[][];
}

/**
 * Parse inline formatting (bold, italic) và trả về array TextRun
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];

  // Regex để tìm bold (**text** hoặc __text__) và italic (*text* hoặc _text_)
  const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|`([^`]+)`|([^*_`]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      // Bold text
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[4]) {
      // Italic text
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5]) {
      // Code inline
      runs.push(new TextRun({ text: match[5], font: 'Consolas', shading: { fill: 'E8E8E8' } }));
    } else if (match[6]) {
      // Normal text
      runs.push(new TextRun({ text: match[6] }));
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: text }));
  }

  return runs;
}

/**
 * Parse Markdown thành các elements
 */
function parseMarkdown(markdown: string): ParsedElement[] {
  const lines = markdown.split('\n');
  const elements: ParsedElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      elements.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2]
      });
      i++;
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      elements.push({ type: 'list', content: '', items, isOrdered: true });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      elements.push({ type: 'list', content: '', items, isOrdered: false });
      continue;
    }

    // Table
    if (line.includes('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        const row = lines[i].split('|')
          .map(cell => cell.trim())
          .filter(cell => cell && !cell.match(/^[-:]+$/));
        if (row.length > 0) {
          rows.push(row);
        }
        i++;
      }
      if (rows.length > 0) {
        elements.push({ type: 'table', content: '', rows });
      }
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      let codeContent = '';
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent += lines[i] + '\n';
        i++;
      }
      i++; // Skip closing ```
      elements.push({ type: 'code', content: codeContent.trim() });
      continue;
    }

    // Regular paragraph
    elements.push({ type: 'paragraph', content: line });
    i++;
  }

  return elements;
}

/**
 * Chuyển đổi parsed elements thành docx children
 */
function elementsToDocxChildren(elements: ParsedElement[], numberingConfig: any[]): any[] {
  const children: any[] = [];
  let listCounter = 0;

  for (const element of elements) {
    switch (element.type) {
      case 'heading':
        const headingLevel = element.level === 1 ? HeadingLevel.HEADING_1 :
          element.level === 2 ? HeadingLevel.HEADING_2 :
            element.level === 3 ? HeadingLevel.HEADING_3 :
              HeadingLevel.HEADING_4;
        children.push(new Paragraph({
          heading: headingLevel,
          children: parseInlineFormatting(element.content),
          spacing: { before: 240, after: 120 }
        }));
        break;

      case 'paragraph':
        children.push(new Paragraph({
          children: parseInlineFormatting(element.content),
          spacing: { after: 120 },
          alignment: AlignmentType.JUSTIFIED
        }));
        break;

      case 'list':
        const refName = element.isOrdered ? `numbered-${listCounter}` : `bullet-${listCounter}`;

        // Add numbering config
        numberingConfig.push({
          reference: refName,
          levels: [{
            level: 0,
            format: element.isOrdered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
            text: element.isOrdered ? '%1.' : '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }]
        });

        for (const item of element.items || []) {
          children.push(new Paragraph({
            numbering: { reference: refName, level: 0 },
            children: parseInlineFormatting(item),
            spacing: { after: 60 }
          }));
        }
        listCounter++;
        break;

      case 'table':
        if (element.rows && element.rows.length > 0) {
          // Tìm số cột lớn nhất trong bảng để đảm bảo tất cả hàng đều có đủ cột
          const maxColCount = Math.max(...element.rows.map(row => row.length));
          const colWidth = Math.floor(9360 / maxColCount);
          const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
          const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

          const tableRows = element.rows.map((row, rowIndex) => {
            // Đảm bảo mỗi hàng có đủ số cột
            const normalizedRow = [...row];
            while (normalizedRow.length < maxColCount) {
              normalizedRow.push(''); // Thêm cell rỗng nếu thiếu
            }

            return new TableRow({
              tableHeader: rowIndex === 0,
              children: normalizedRow.map(cell =>
                new TableCell({
                  borders: cellBorders,
                  width: { size: colWidth, type: WidthType.DXA },
                  shading: rowIndex === 0 ? { fill: 'D5E8F0', type: ShadingType.CLEAR } : undefined,
                  children: [new Paragraph({
                    children: parseInlineFormatting(cell),
                    alignment: AlignmentType.CENTER
                  })]
                })
              )
            });
          });

          children.push(new Table({
            columnWidths: Array(maxColCount).fill(colWidth),
            rows: tableRows
          }));
        }
        break;

      case 'code':
        const codeLines = element.content.split('\n');
        for (const codeLine of codeLines) {
          children.push(new Paragraph({
            children: [new TextRun({
              text: codeLine,
              font: 'Consolas',
              size: 20 // 10pt
            })],
            shading: { fill: 'F5F5F5' },
            spacing: { after: 0 }
          }));
        }
        // Add spacing after code block
        children.push(new Paragraph({ spacing: { after: 120 } }));
        break;
    }
  }

  return children;
}

/**
 * Lọc bỏ các lệnh điều hướng và hướng dẫn của AI khỏi nội dung xuất Word.
 */
function cleanMarkdownForExport(markdown: string): string {
  if (!markdown) return markdown;

  let cleaned = markdown;

  // 0. Sanitize HTML tags từ AI output
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/?(p|div|span|b|i|em|strong|u|s|del|ins|mark|sub|sup|small|big|center|blockquote|pre|code|h[1-6])(\s[^>]*)?>/gi, '');

  // 1. Hộp thoại viền (┌─┐ ... └─┘) - xóa toàn bộ block
  cleaned = cleaned.replace(/┌[─]+┐[\s\S]*?└[─]+┘/g, '');

  // 2. Block MENU NAVIGATION - xóa từ 📱 MENU đến hết các dòng Bước liền kề
  cleaned = cleaned.replace(/📱\s*\**\s*MENU\s+NAVIGATION\s*\**[^\n]*(?:\n[^\n]*(?:Bước|•|\-|\*|\s*$)[^\n]*)*/g, '');

  // 3. Dòng trạng thái Bước - bắt BẤT KỲ dòng nào chứa "Bước X:" kèm trạng thái
  //    VD: "• Bước 7: Viết Giải pháp 4 (🔵 Đang thực hiện)"
  //    VD: "• Bước 6: Viết GP 2 & 3 (🔵 Đang thực hiện - Viết GP 3)"
  //    VD: "• Bước 8: Viết Phần V, VI & Phụ lục (Đợi lệnh)"
  cleaned = cleaned.replace(/^[^\n]*Bước\s+\d+[^\n]*(?:Đang thực hiện|Chờ lệnh|Đợi lệnh|CHỜ LỆNH|ĐANG THỰC HIỆN|Hoàn thành|🔵)[^\n]*$/gm, '');

  // 3b. Dòng sót chứa trạng thái bước bị tách dòng
  cleaned = cleaned.replace(/^[^\n]*\(Đang thực hiện[^)]*\)[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*\((?:Chờ|Chờ lệnh|Đợi lệnh|Hoàn thành)\)[^\n]*$/gm, '');

  // 4. Câu hỏi xác nhận / đề nghị tiếp tục từ AI (mọi dòng chứa ❓)
  cleaned = cleaned.replace(/^[^\n]*❓[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*Bạn đã sẵn sàng để tôi[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*Bạn muốn tôi tiếp tục[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*Bạn có muốn tôi[^\n]*$/gm, '');

  // 5. Dòng "Lệnh tiếp theo của bạn:"
  cleaned = cleaned.replace(/\*{0,2}Lệnh tiếp theo của bạn:?\*{0,2}[\s\S]*?(?=\n\n[A-ZĐ0-9#📋]|$)/gm, '');

  // 6. Xác nhận / hộp thoại đồng ý
  cleaned = cleaned.replace(/^[^\n]*✅\s*Đồng ý[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*✏️\s*Bạn có thể[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*\*\*Nếu bạn đồng ý[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*tiếp bằng nút\s*"Chỉnh sửa"[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*nút\s*"Chỉnh sửa"[^\n]*$/gm, '');

  // 7. Kết thúc giải pháp và hướng dẫn copy
  cleaned = cleaned.replace(/✅\s*KẾT THÚC GIẢI PHÁP[^\n]*/gm, '');
  cleaned = cleaned.replace(/📋\s*HƯỚNG DẪN COPY[\s\S]*?(?:font chữ.*?cỡ chữ\)?|$)/g, '');

  // 8. Đường kẻ trang trí dài (━━━, ───, ═══)
  cleaned = cleaned.replace(/^[━─═]{5,}\s*$/gm, '');

  // 9. Dấu phân cách ---
  cleaned = cleaned.replace(/^\s*---\s*$/gm, '');

  // 10. Lệnh prompt sót "BẮT ĐẦU phản hồi bằng MENU NAVIGATION"
  cleaned = cleaned.replace(/^[^\n]*BẮT ĐẦU phản hồi bằng MENU NAVIGATION[^\n]*$/gm, '');

  // 11. Emoji rác đơn lẻ đầu dòng
  cleaned = cleaned.replace(/^\s*[📱🔵]\s*$/gm, '');

  // 12. Các pattern AI phổ biến khác đứng riêng một dòng
  cleaned = cleaned.replace(/^[^\n]*(?:Tôi sẽ tiếp tục|Tôi sẽ triển khai tiếp)[^\n]*$/gm, '');

  // 13. Metadata phụ lục batch - strip phần phân tích/liệt kê danh sách
  // "BƯỚC 1: PHÂN TÍCH VÀ LIỆT KÊ DANH SÁCH PHỤ LỤC" + nội dung phân tích cho đến "PHỤ LỤC 1:"
  cleaned = cleaned.replace(/[📋📎]\s*BƯỚC\s+\d+\s*:\s*[^\n]*[\s\S]*?(?=##?\s*PHỤ LỤC\s+\d+|$)/gi, '');

  // 14. Dòng separator giữa các batch
  cleaned = cleaned.replace(/^[^\n]*---\s*HẾT PHẦN\s+\d+\/\d+[^\n]*$/gm, '');
  cleaned = cleaned.replace(/^[^\n]*TIẾP TỤC PHẦN\s+\d+[^\n]*$/gm, '');

  // 15. Dòng "HOÀN THÀNH TẠO TÀI LIỆU PHỤ LỤC"
  cleaned = cleaned.replace(/^[^\n]*✅\s*HOÀN THÀNH TẠO TÀI LIỆU PHỤ LỤC[^\n]*$/gm, '');

  // 16. Dòng metadata batch đơn lẻ (📎 NHIỆM VỤ, 📎 TIẾP TỤC TẠO...)
  cleaned = cleaned.replace(/^[^\n]*📎\s*(?:NHIỆM VỤ|TIẾP TỤC TẠO PHỤ LỤC)[^\n]*$/gm, '');

  // 17. Dòng "Dựa trên DANH SÁCH PHỤ LỤC đã liệt kê..." hoặc "Dựa trên NỘI DUNG SKKN..."
  cleaned = cleaned.replace(/^Dựa trên (?:DANH SÁCH PHỤ LỤC|NỘI DUNG SKKN|NỘI DUNG ĐỀ TÀI KHKT|NỘI DUNG ĐỀ TÀI)[^\n]*$/gm, '');

  // 18. Dòng "Danh sách này bao gồm..." (metadata phân tích)
  cleaned = cleaned.replace(/^Danh sách này bao gồm[^\n]*$/gm, '');

  // 19. Emoji trang trí đơn lẻ đầu dòng (📎📋⚠️) kèm text metadata
  cleaned = cleaned.replace(/^[^\n]*[📎⚠️]\s*(?:QUAN TRỌNG|LƯU Ý|CHỈ VIẾT)[^\n]*$/gm, '');

  // 20. Dọn dẹp khoảng trắng thừa: 3+ dòng trống → 2 dòng trống
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Xuất Markdown sang file .docx
 */
export async function exportMarkdownToDocx(rawMarkdown: string, filename: string): Promise<void> {
  const markdown = cleanMarkdownForExport(rawMarkdown);
  const elements = parseMarkdown(markdown);
  const numberingConfig: any[] = [];
  const children = elementsToDocxChildren(elements, numberingConfig);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 28 } // 14pt
        }
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 32, bold: true, font: 'Times New Roman' },
          paragraph: { spacing: { before: 240, after: 120 } }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 28, bold: true, font: 'Times New Roman' },
          paragraph: { spacing: { before: 200, after: 100 } }
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, bold: true, font: 'Times New Roman' },
          paragraph: { spacing: { before: 160, after: 80 } }
        }
      ]
    },
    numbering: {
      config: numberingConfig
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch margins
        }
      },
      children: children
    }]
  });

  // Generate blob and download
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
