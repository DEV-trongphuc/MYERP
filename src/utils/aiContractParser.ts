import JSZip from 'jszip';
import api from '../api/axios';
import { parseDateToIso } from '../components/ui/VietnameseDateInput';

export interface ExtractedMilestone {
  name: string;
  amount: string;
  expected_pay_date: string;
  rawDate?: string;
}

export interface ExtractedContractData {
  fileName: string;
  fileSize: number;
  contractNumber?: string;
  studentName?: string;
  studentPhone?: string;
  studentEmail?: string;
  studentAddress?: string;
  studentIdCard?: string;
  programName?: string;
  totalAmount?: number;
  currency?: string;
  milestones: ExtractedMilestone[];
  rawTextPreview?: string;
}

/**
 * Clean & normalize money string like "15.373.500", "5,000,000", "292.096.500 đ"
 */
export function cleanMoneyNumber(raw: string): number {
  if (!raw) return 0;
  let s = String(raw).trim().replace(/[^\d\.,]/g, '');
  if (!s) return 0;

  // If both dot and comma exist: determine separator
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.split(',')[0].replace(/\D/g, '');
      return Number(s) || 0;
    } else {
      s = s.split('.')[0].replace(/\D/g, '');
      return Number(s) || 0;
    }
  }

  // If only dot exists and has 3 digits at end or multiple dots (Vietnamese standard format: 15.373.500)
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      return Number(s.replace(/\D/g, '')) || 0;
    }
    return Math.round(parseFloat(s) || 0);
  }

  // If only comma exists (English standard format: 15,373,500)
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      return Number(s.replace(/\D/g, '')) || 0;
    }
    return Math.round(parseFloat(s.replace(',', '.')) || 0);
  }

  return Number(s.replace(/\D/g, '')) || 0;
}

/**
 * Format milestone date into ISO YYYY-MM-DD
 */
export function formatMilestoneDate(dateStr: string): string {
  if (!dateStr) return new Date().toLocaleDateString('sv-SE');
  
  // Try Vietnamese date parser
  const parsed = parseDateToIso(dateStr);
  if (parsed) return parsed;

  // Match DD/MM/YYYY or DD.MM.YYYY
  const m = dateStr.match(/(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }

  return new Date().toLocaleDateString('sv-SE');
}

/**
 * Parse DOCX contract file using JSZip + DOMParser
 */
export async function parseDocxContract(file: File): Promise<ExtractedContractData> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Tệp không đúng định dạng Word (.docx) hoặc bị lỗi.');
  }

  const xmlText = await docXmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  // Extract all paragraphs
  const pNodes = xmlDoc.getElementsByTagName('w:p');
  const paragraphs: string[] = [];
  for (let i = 0; i < pNodes.length; i++) {
    const tNodes = pNodes[i].getElementsByTagName('w:t');
    let pText = '';
    for (let j = 0; j < tNodes.length; j++) {
      pText += tNodes[j].textContent || '';
    }
    const clean = pText.trim();
    if (clean) paragraphs.push(clean);
  }

  // Extract all tables
  const tblNodes = xmlDoc.getElementsByTagName('w:tbl');
  const tables: string[][][] = [];
  for (let i = 0; i < tblNodes.length; i++) {
    const rowNodes = tblNodes[i].getElementsByTagName('w:tr');
    const tableRows: string[][] = [];
    for (let j = 0; j < rowNodes.length; j++) {
      const cellNodes = rowNodes[j].getElementsByTagName('w:tc');
      const rowCells: string[] = [];
      for (let k = 0; k < cellNodes.length; k++) {
        const tNodes = cellNodes[k].getElementsByTagName('w:t');
        let cellText = '';
        for (let l = 0; l < tNodes.length; l++) {
          cellText += tNodes[l].textContent || '';
        }
        rowCells.push(cellText.trim());
      }
      if (rowCells.some(c => c.length > 0)) {
        tableRows.push(rowCells);
      }
    }
    if (tableRows.length > 0) {
      tables.push(tableRows);
    }
  }

  const fullText = paragraphs.join('\n') + '\n' + tables.map(t => t.map(r => r.join(' | ')).join('\n')).join('\n');

  // 1. Extract Student Info (Bên B / Bên C / Học viên)
  let studentName = '';
  let studentPhone = '';
  let studentEmail = '';
  let studentAddress = '';
  let studentIdCard = '';

  const INVALID_WORDS = [
    'TRÁCH NHIỆM', 'QUYỀN LỢI', 'BÊN A', 'BÊN B', 'BÊN C', 'ĐIỀU KHOẢN',
    'CỘNG HÒA', 'ĐỘC LẬP', 'TỰ DO', 'HẠNH PHÚC', 'VIỆT NAM', 'HỢP ĐỒNG',
    'ĐÀO TẠO', 'CHƯƠNG TRÌNH', 'HỌC PHÍ', 'THANH TOÁN', 'THỜI HẠN', 'QUY ĐỊNH',
    'THÔNG TIN', 'ĐẠI DIỆN', 'GIÁM ĐỐC', 'IDEAS', 'ESTIAM', 'VIỆN', 'TRƯỜNG',
    'PHẠM QUANG VINH', 'CHỮ KÝ', 'KÝ TÊN'
  ];

  const isValidName = (name: string): boolean => {
    if (!name || name.length < 3 || name.length > 40) return false;
    const upper = name.toUpperCase();
    for (const w of INVALID_WORDS) {
      if (upper.includes(w)) return false;
    }
    // Must contain letters and spaces
    return /^[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐa-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ\s\.]+$/.test(name);
  };

  // Scan all lines & tables for Bên B labeled fields
  const allLines = [...paragraphs, ...tables.flatMap(t => t.map(r => r.join(' ')))];

  for (const line of allLines) {
    // Exact Label Matching: Họ và tên / Học viên / Ông/Bà / Đại diện Bên B
    if (!studentName) {
      const matchExplicit = line.match(/(?:Họ\s*(?:và|&)?\s*tên|Tên\s*học\s*viên|Học\s*viên|Đại\s*diện\s*(?:bên\s*B|học\s*viên)|Ông\/Bà|Ông|Bà)\s*[:\.\-]\s*([A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐa-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ\s]{3,40})/i);
      if (matchExplicit) {
        const candidate = matchExplicit[1].trim();
        if (isValidName(candidate)) {
          studentName = candidate;
        }
      }
    }

    // Phone
    if (!studentPhone) {
      const matchPhone = line.match(/(?:Số\s*điện\s*thoại|Điện\s*thoại|SĐT|Phone|Tel)\s*[:\.\-]?\s*([\d\s\.\+]{9,15})/i);
      if (matchPhone) {
        const p = matchPhone[1].replace(/\D/g, '');
        if (p.length >= 9 && !p.startsWith('0282244')) {
          studentPhone = p;
        }
      }
    }

    // Email
    if (!studentEmail) {
      const matchEmail = line.match(/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/i);
      if (matchEmail) {
        const em = matchEmail[1].trim();
        if (!em.includes('ideas.edu.vn') && !em.includes('estiam.education')) {
          studentEmail = em;
        }
      }
    }

    // Address
    if (!studentAddress) {
      const matchAddr = line.match(/(?:Địa\s*chỉ(?:\s*liên\s*lạc|\s*thường\s*trú)?|Nơi\s*ở)\s*[:\.\-]?\s*([^\n\|\;]{10,120})/i);
      if (matchAddr) {
        const addr = matchAddr[1].trim();
        if (!addr.includes('Bạch Đằng') && !addr.includes('Tân Sơn Hòa')) {
          studentAddress = addr;
        }
      }
    }

    // CCCD / Passport
    if (!studentIdCard) {
      const matchId = line.match(/(?:Số\s*CCCD|Số\s*CMND|Số\s*Passport|Hộ\s*chiếu|CCCD|CMND)\s*[:\.\-]?\s*([A-Z0-9]{6,15})/i);
      if (matchId) {
        studentIdCard = matchId[1].trim();
      }
    }
  }

  // Fallback: If studentName not found or file name contains student name
  if (!studentName && file.name) {
    const fnClean = file.name.replace(/\.[^/.]+$/, '').replace(/[\(\)\d\-_]/g, ' ');
    const words = fnClean.split(/\s+/).filter(Boolean);
    const candidateWords = words.filter(w => !['IDEAS', 'DBA', 'ESTIAM', 'Ver', 'HD', 'HĐ', 'Hop', 'Dong'].includes(w));
    if (candidateWords.length >= 2) {
      studentName = candidateWords.join(' ');
    }
  }

  // 2. Extract Contract Number & Program
  let contractNumber = '';
  const matchContractNo = fullText.match(/Số\s*[:\.]?\s*([\d]+[\/\-_][A-Z0-9\-_]+)/i);
  if (matchContractNo) {
    contractNumber = matchContractNo[1].trim();
  }

  let programName = 'DBA ESTIAM';
  if (/DBA|Doctor of Business Administration/i.test(fullText)) {
    programName = 'DBA ESTIAM';
  } else if (/MBA|Master of Business/i.test(fullText)) {
    programName = 'MBA ESTIAM';
  } else if (/ESTIAM/i.test(fullText)) {
    programName = 'ESTIAM';
  }

  // 3. Extract Milestones (Lịch trình thanh toán)
  const milestones: ExtractedMilestone[] = [];
  let totalAmount = 0;

  for (const tbl of tables) {
    for (const row of tbl) {
      if (row.length === 0) continue;
      const firstCell = row[0] || '';
      const fullRowStr = row.join(' ');

      // Detect milestone row like "Đợt 01 Trước 10/09/2026" or "Đợt 1 - 10/09/2026"
      const dotMatch = firstCell.match(/Đợt\s*(\d+)[\s\:\-]*(?:Trước\s*)?([0-9\.\/\-]+)?/i) ||
                       fullRowStr.match(/Đợt\s*(\d+)[\s\:\-]*(?:Trước\s*)?([0-9\.\/\-]+)?/i);

      if (dotMatch) {
        const dotNum = parseInt(dotMatch[1], 10);
        let rawDate = dotMatch[2] || '';
        if (!rawDate) {
          const dFind = fullRowStr.match(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4})/);
          if (dFind) rawDate = dFind[1];
        }

        // Amount usually in subsequent cells
        let amount = 0;
        for (let cIdx = 1; cIdx < row.length; cIdx++) {
          const moneyVal = cleanMoneyNumber(row[cIdx]);
          if (moneyVal > 0) {
            amount = moneyVal;
            break;
          }
        }

        // Fallback: if not found in subsequent cells, search in first cell
        if (amount === 0) {
          const moneyVal = cleanMoneyNumber(firstCell.replace(/Đợt\s*\d+/i, '').replace(/(\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4})/g, ''));
          if (moneyVal > 0) amount = moneyVal;
        }

        const isoDate = formatMilestoneDate(rawDate);
        const displayName = `Đợt ${String(dotNum).padStart(2, '0')}${rawDate ? ` - Trước ${rawDate}` : ''}`;

        milestones.push({
          name: displayName,
          amount: String(amount),
          expected_pay_date: isoDate,
          rawDate: rawDate || undefined
        });
      }
    }
  }

  // Total contract amount
  const totalMatch = fullText.match(/Học\s*phí\s*VND\s*[:\|\-]?\s*([\d\.\,]{6,20})/i) ||
                     fullText.match(/Tổng\s*(?:cộng|học\s*phí|thanh\s*toán)\s*[:\|\-]?\s*([\d\.\,]{6,20})/i);
  if (totalMatch) {
    totalAmount = cleanMoneyNumber(totalMatch[1]);
  } else if (milestones.length > 0) {
    totalAmount = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    contractNumber: contractNumber || undefined,
    studentName: studentName || undefined,
    studentPhone: studentPhone || undefined,
    studentEmail: studentEmail || undefined,
    studentAddress: studentAddress || undefined,
    studentIdCard: studentIdCard || undefined,
    programName,
    totalAmount: totalAmount || undefined,
    currency: 'VND',
    milestones,
    rawTextPreview: fullText.substring(0, 500)
  };
}

/**
 * Parse Contract using Backend AI (Gemini Multimodal) - Supports PDF, DOCX, DOC, Images
 */
export async function parseContractViaAI(file: File, serverUrl?: string): Promise<ExtractedContractData> {
  try {
    let targetUrl = serverUrl;
    
    // If not yet uploaded, upload via multipart to extract-contract-info directly
    const fd = new FormData();
    fd.append('file', file);
    if (targetUrl) {
      fd.append('file_url', targetUrl);
    }

    const res = await api.post('/cloud-files/extract-contract-info', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (res.data && res.data.success && res.data.data) {
      const d = res.data.data;
      return {
        fileName: d.fileName || file.name,
        fileSize: file.size,
        contractNumber: d.contractNumber || undefined,
        studentName: d.studentName || undefined,
        studentPhone: d.studentPhone || undefined,
        studentEmail: d.studentEmail || undefined,
        studentAddress: d.studentAddress || undefined,
        studentIdCard: d.studentIdCard || undefined,
        programName: d.programName || 'DBA ESTIAM',
        totalAmount: Number(d.totalAmount) || undefined,
        currency: d.currency || 'VND',
        milestones: Array.isArray(d.milestones) ? d.milestones.map((m: any) => ({
          name: m.name,
          amount: String(m.amount),
          expected_pay_date: m.expected_pay_date || new Date().toLocaleDateString('sv-SE'),
          rawDate: m.rawDate
        })) : [],
        rawTextPreview: d.rawTextPreview
      };
    } else {
      throw new Error(res.data?.message || 'Không thể trích xuất hợp đồng từ AI.');
    }
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message || 'Lỗi xử lý trích xuất hợp đồng qua AI';
    throw new Error(msg);
  }
}

/**
 * Universal Contract Parser: Handles both DOCX and PDF contracts seamlessly
 */
export async function parseContractFile(file: File, uploadedUrl?: string): Promise<ExtractedContractData> {
  const isDocx = file.name.endsWith('.docx') || file.name.endsWith('.doc');
  const isPdf = file.name.endsWith('.pdf');

  if (!isDocx && !isPdf) {
    throw new Error('Định dạng tệp không được hỗ trợ. Vui lòng chọn tệp Word (.docx) hoặc PDF (.pdf).');
  }

  // If PDF, always use Backend Gemini Multimodal AI
  if (isPdf) {
    return await parseContractViaAI(file, uploadedUrl);
  }

  // If DOCX, try local fast DOMParser first; if no milestones found or error, fallback to AI
  try {
    const localResult = await parseDocxContract(file);
    if (localResult && localResult.milestones && localResult.milestones.length > 0) {
      return localResult;
    }
  } catch (localErr) {
    console.warn('Local DOCX parse failed, falling back to AI extraction:', localErr);
  }

  // Fallback to Backend AI
  return await parseContractViaAI(file, uploadedUrl);
}

