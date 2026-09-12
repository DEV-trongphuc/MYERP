/**
 * dateUtils.ts - Bộ tiện ích chuẩn hoá định dạng ngày tháng Việt Nam cho MYERP
 * Luôn đảm bảo:
 * - Hiển thị: DD/MM/YYYY (ví dụ: 12/09/2026)
 * - Hiển thị có giờ: HH:mm DD/MM/YYYY (ví dụ: 08:30 12/09/2026)
 * - Tháng năm: Tháng MM/YYYY (ví dụ: Tháng 09/2026)
 * - Gửi API / Database: ISO YYYY-MM-DD
 */

// Kiểm tra tính hợp lệ của ngày tháng năm
export function isValidCalendarDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  const maxDays = new Date(y, m, 0).getDate();
  return d >= 1 && d <= maxDays;
}

/**
 * Định dạng bất kỳ giá trị ngày nào (Date object, ISO string, 'YYYY-MM-DD', timestamp)
 * thành chuỗi DD/MM/YYYY chuẩn Việt Nam.
 */
export function formatDateVN(dateVal: string | number | Date | null | undefined, fallback: string = '—'): string {
  if (!dateVal) return fallback;

  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (!trimmed || trimmed === '0000-00-00' || trimmed === '0000-00-00 00:00:00') return fallback;

    // Trường hợp đã là DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Trường hợp chuẩn YYYY-MM-DD hoặc YYYY-MM-DD HH:mm:ss
    const isoMatch = trimmed.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
  }

  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return fallback;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return fallback;
  }
}

/**
 * Định dạng ngày giờ chuẩn Việt Nam: HH:mm DD/MM/YYYY (ví dụ 08:30 12/09/2026)
 */
export function formatDateTimeVN(
  dateVal: string | number | Date | null | undefined,
  fallback: string = '—',
  order: 'timeFirst' | 'dateFirst' = 'timeFirst'
): string {
  if (!dateVal) return fallback;

  try {
    let d: Date;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'string') {
      const trimmed = dateVal.trim();
      if (!trimmed || trimmed === '0000-00-00' || trimmed === '0000-00-00 00:00:00') return fallback;
      // Thay thế space hoặc '-' an toàn cho Safari / Chrome
      d = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(/-/g, '/'));
    } else {
      d = new Date(dateVal);
    }

    if (isNaN(d.getTime())) return fallback;

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    const datePart = `${day}/${month}/${year}`;
    const timePart = `${hours}:${minutes}`;

    return order === 'timeFirst' ? `${timePart} ${datePart}` : `${datePart} ${timePart}`;
  } catch {
    return fallback;
  }
}

/**
 * Định dạng tháng/năm: Tháng MM/YYYY (hoặc MM/YYYY)
 * Nhận chuỗi 'YYYY-MM' hoặc Date object hoặc ISO date
 */
export function formatMonthYearVN(monthVal: string | Date | null | undefined, prefix: boolean = true): string {
  if (!monthVal) return '';

  if (typeof monthVal === 'string') {
    const match = monthVal.trim().match(/^(\d{4})[-\/\.](\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      return prefix ? `Tháng ${m}/${y}` : `${m}/${y}`;
    }
  }

  try {
    const d = monthVal instanceof Date ? monthVal : new Date(monthVal);
    if (isNaN(d.getTime())) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    return prefix ? `Tháng ${m}/${y}` : `${m}/${y}`;
  } catch {
    return '';
  }
}

/**
 * Parse chuỗi ngày người dùng nhập dạng 'DD/MM/YYYY' hoặc 'DD-MM-YYYY' về chuẩn ISO 'YYYY-MM-DD'
 */
export function parseVnDateToIso(str: string | null | undefined): string | null {
  if (!str) return null;
  const trimmed = String(str).trim();
  if (!trimmed) return null;

  // 1. Nếu đã là ISO YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Định dạng VN: DD/MM/YYYY hoặc DD-MM-YYYY hoặc DD.MM.YYYY
  const vnMatch = trimmed.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/);
  if (vnMatch) {
    const d = parseInt(vnMatch[1], 10);
    const m = parseInt(vnMatch[2], 10);
    const y = parseInt(vnMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3. 8 ký tự số liền nhau DDMMYYYY
  const digitMatch = trimmed.match(/^(\d{8})$/);
  if (digitMatch) {
    const d = parseInt(trimmed.substring(0, 2), 10);
    const m = parseInt(trimmed.substring(2, 4), 10);
    const y = parseInt(trimmed.substring(4, 8), 10);
    if (isValidCalendarDate(y, m, d)) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Lấy thứ trong tuần tiếng Việt: Thứ Hai, Thứ Ba,... Chủ Nhật
 */
export function getDayOfWeekVN(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return '';
  try {
    const d = typeof dateVal === 'string' 
      ? new Date(dateVal.includes('T') ? dateVal : dateVal.replace(/-/g, '/')) 
      : dateVal;
    if (isNaN(d.getTime())) return '';
    const day = d.getDay();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[day];
  } catch {
    return '';
  }
}
