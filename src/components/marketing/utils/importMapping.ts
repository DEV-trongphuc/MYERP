/**
 * Shared CSV/Excel subscriber import parsing, header mapping, and custom-attribute extraction.
 * Used by both ImportSubscribersModal (Audience page) and AudienceSelector (Campaign Wizard Quick Import).
 */

export const VALID_SUBSCRIBER_HEADERS: Record<string, string[]> = {
    email: [
        'email', 'e-mail', 'email address', 'email_address', 'mail', 'gmail',
        'địa chỉ email', 'dia chi email', 'thư điện tử', 'thu dien tu'
    ],
    firstName: [
        'firstname', 'first name', 'first_name', 'given name',
        'họ và tên', 'ho va ten', 'họ tên', 'ho ten', 'full name', 'fullname',
        'tên khách hàng', 'ten khach hang', 'tên học viên', 'ten hoc vien',
        'tên giảng viên', 'ten giang vien', 'tên gv', 'ten gv', 'giảng viên', 'giang vien',
        'tên khách', 'ten khach', 'người liên hệ', 'nguoi lien he',
        'customer name', 'customer_name', 'user name', 'username',
        'tên', 'ten', 'name'
    ],
    lastName: [
        'lastname', 'last name', 'last_name', 'family name', 'surname',
        'họ', 'ho', 'họ đệm', 'ho dem'
    ],
    phoneNumber: [
        'phonenumber', 'phone number', 'phone_number', 'phone', 'telephone', 'mobile',
        'số điện thoại', 'so dien thoai', 'điện thoại', 'dien thoai',
        'sđt', 'sdt', 'di động', 'di dong', 'zalo'
    ],
    jobTitle: [
        'jobtitle', 'job title', 'job_title', 'job',
        'danh xưng', 'danh xung', 'xưng hô', 'xung ho', 'salutation', 'honorific',
        'học hàm', 'hoc ham', 'học vị', 'hoc vi',
        'chức danh', 'chuc danh', 'chức vụ', 'chuc vu',
        'vị trí', 'vi tri', 'vị trí công việc', 'vi tri cong viec',
        'title', 'nghề nghiệp', 'nghe nghiep', 'công việc', 'cong viec'
    ],
    companyName: [
        'companyname', 'company name', 'company_name', 'company',
        'tên công ty', 'ten cong ty', 'công ty', 'cong ty',
        'tổ chức', 'to chuc', 'organization', 'đơn vị', 'don vi',
        'đơn vị công tác', 'don vi cong tac', 'trường', 'truong', 'cơ quan', 'co quan'
    ],
    city: ['city', 'thành phố', 'thanh pho', 'tỉnh', 'tinh', 'tỉnh thành', 'tinh thanh', 'tỉnh/thành', 'khu vực', 'khu vuc', 'địa điểm', 'dia diem'],
    country: ['country', 'quốc gia', 'quoc gia', 'đất nước', 'dat nuoc'],
    gender: ['gender', 'giới tính', 'gioi tinh', 'sex'],
    dateOfBirth: ['dob', 'birthday', 'birth date', 'date of birth', 'date_of_birth', 'ngày sinh', 'ngay sinh', 'năm sinh', 'nam sinh'],
    anniversaryDate: ['anniversary', 'anniversary_date', 'ngày kỷ niệm', 'ngay ky niem', 'kỷ niệm', 'ky niem'],
    tags: ['tags', 'tag', 'nhãn', 'nhan', 'phân loại', 'phan loai'],
    source: ['source', 'nguồn', 'nguon', 'kênh', 'kenh'],
    salesperson: ['salesperson', 'sales', 'người phụ trách', 'nguoi phu trach', 'nhân viên', 'nhan vien', 'pic'],
    joinedAt: ['joinedat', 'joined_at', 'joined at', 'created_at', 'ngày tham gia', 'ngay tham gia', 'ngày tạo', 'ngay tao'],
};

export const STANDARD_SUBSCRIBER_PAYLOAD_KEYS = new Set<string>([
    'id', 'email', 'firstName', 'lastName', 'fullName', 'phoneNumber', 'phone',
    'jobTitle', 'companyName', 'company', 'city', 'country', 'gender',
    'dateOfBirth', 'anniversaryDate', 'tags', 'source', 'salesperson',
    'joinedAt', 'status', 'listIds', 'stats', 'customAttributes', 'customFields',
    'custom_attributes', 'job_title', 'first_name', 'last_name', 'phone_number',
    'company_name', 'date_of_birth', 'anniversary_date', 'joined_at'
]);

const NON_PERSON_NAME_HINTS = [
    'công ty', 'cong ty', 'trường', 'truong', 'đơn vị', 'don vi',
    'khóa', 'khoa', 'lớp', 'lop', 'sản phẩm', 'san pham',
    'chương trình', 'chuong trinh', 'cơ quan', 'co quan',
    'tổ chức', 'to chuc', 'cty', 'company', 'organization',
    'khóa học', 'khoa hoc', 'sự kiện', 'su kien', 'chiến dịch', 'chien dich',
    'voucher', 'mã', 'ma '
];

const SALUTATION_OR_TITLE_KEYS = new Set(['jobTitle']);

export const detectCsvDelimiter = (str: string): string => {
    const firstNonEmpty = str.split(/\r?\n/).find(line => line.trim().length > 0) || '';
    if (firstNonEmpty.includes('\t')) return '\t';
    // Count outside quotes when deciding between ';' and ','
    let commas = 0;
    let semis = 0;
    let inQuotes = false;
    for (let i = 0; i < firstNonEmpty.length; i++) {
        const ch = firstNonEmpty[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (!inQuotes) {
            if (ch === ',') commas++;
            else if (ch === ';') semis++;
        }
    }
    return semis > commas ? ';' : ',';
};

export const parseCsvRows = (csvText: string, delimiter: string): string[][] => {
    const result: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentVal += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            currentRow.push(currentVal);
            currentVal = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentVal);
            if (currentRow.some(cell => cell.trim() !== '')) {
                result.push(currentRow);
            }
            currentRow = [];
            currentVal = '';
        } else {
            currentVal += char;
        }
    }

    if (currentVal !== '' || currentRow.length > 0) {
        currentRow.push(currentVal);
        if (currentRow.some(cell => cell.trim() !== '')) {
            result.push(currentRow);
        }
    }

    return result;
};

export const formatNameFromEmail = (email: string): string => {
    if (!email) return 'User';
    const localPart = email.split('@')[0];
    const cleaned = localPart.replace(/[^a-zA-Z]/g, '');
    if (!cleaned) return 'User';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
};

const normalizeHeaderForMatch = (header: string): string =>
    header.toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * Matches an Excel/CSV column header to a canonical Subscriber key.
 * Uses a two-pass check: exact normalized phrase across ALL standard keys first,
 * then whole-word token fallback with guards against false positives (e.g. "Tên công ty" -> companyName).
 */
export const matchStandardSubscriberHeader = (rawHeader: string): string | null => {
    const lowerHeader = normalizeHeaderForMatch(rawHeader);
    if (!lowerHeader) return null;

    // Pass 1: exact normalized match across every standard field
    for (const [key, patterns] of Object.entries(VALID_SUBSCRIBER_HEADERS)) {
        if (patterns.some(p => lowerHeader === p.toLowerCase())) {
            return key;
        }
    }

    // Pass 2: token-level match with anti-collision guard on short person-name tokens
    const tokens = lowerHeader.split(/[\s_\-/().,:]+/).filter(Boolean);
    const hasNonPersonHint = NON_PERSON_NAME_HINTS.some(h => lowerHeader.includes(h));

    for (const [key, patterns] of Object.entries(VALID_SUBSCRIBER_HEADERS)) {
        for (const p of patterns) {
            const lp = p.toLowerCase();
            if (lp.includes(' ')) {
                if (lowerHeader.includes(lp)) return key;
                continue;
            }
            if (key === 'firstName' && hasNonPersonHint && (lp === 'tên' || lp === 'ten' || lp === 'name')) {
                continue;
            }
            if (tokens.includes(lp)) {
                return key;
            }
        }
    }

    return null;
};

/**
 * Extracts non-empty custom attributes from a subscriber row object, merging any pre-built customAttributes.
 */
export const extractCustomAttributesFromRow = (row: Record<string, any>): Record<string, any> => {
    const customAttr: Record<string, any> = {};

    const prebuilt = row.customAttributes && typeof row.customAttributes === 'object' ? row.customAttributes : null;
    if (prebuilt) {
        Object.entries(prebuilt).forEach(([k, v]) => {
            const cleanKey = k.trim();
            if (cleanKey && v !== undefined && v !== null && String(v).trim() !== '') {
                customAttr[cleanKey] = typeof v === 'string' ? v.trim() : v;
            }
        });
    }

    Object.keys(row).forEach(key => {
        if (STANDARD_SUBSCRIBER_PAYLOAD_KEYS.has(key)) return;
        const val = row[key];
        if (typeof val === 'function') return;
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            customAttr[key] = typeof val === 'string' ? val.trim() : val;
        }
    });

    return customAttr;
};

export interface ParsedSubscriberImportResult {
    rows: Record<string, any>[];
    columnMapping: Record<number, string>;
    originalHeaders: Record<number, string>;
    headers: string[];
    warnings: string[];
    totalRawRows: number;
    hasEmail: boolean;
    hasPhone: boolean;
    hasName: boolean;
    missingRequiredIdentifiers: boolean;
}

export const parseSubscriberImportData = (rawData: string): ParsedSubscriberImportResult => {
    const delimiter = detectCsvDelimiter(rawData);
    const parsedAll = parseCsvRows(rawData.trim(), delimiter);

    if (parsedAll.length === 0) {
        return {
            rows: [],
            columnMapping: {},
            originalHeaders: {},
            headers: [],
            warnings: [],
            totalRawRows: 0,
            hasEmail: false,
            hasPhone: false,
            hasName: false,
            missingRequiredIdentifiers: true,
        };
    }

    const headerRow = parsedAll[0].map(h => h.trim().replace(/^['"]+|['"]+$/g, ''));
    const columnMapping: Record<number, string> = {};
    const originalHeaders: Record<number, string> = {};
    const usedKeys = new Set<string>();

    headerRow.forEach((header, index) => {
        if (!header) return; // Skip blank trailing columns from SheetJS CSV export
        originalHeaders[index] = header;
        const matchedKey = matchStandardSubscriberHeader(header);
        if (matchedKey && !usedKeys.has(matchedKey)) {
            columnMapping[index] = matchedKey;
            usedKeys.add(matchedKey);
        } else {
            columnMapping[index] = header;
        }
    });

    const mappedKeys = Object.values(columnMapping);
    const hasEmail = mappedKeys.includes('email');
    const hasPhone = mappedKeys.includes('phoneNumber');
    const hasName = mappedKeys.includes('firstName') || mappedKeys.includes('lastName');

    const isHeaderRowData = headerRow.some(header => {
        if (!header) return false;
        if (header.includes('@') && header.includes('.')) return true;
        const cleanPhone = header.replace(/[^0-9]/g, '');
        return (cleanPhone.startsWith('0') || cleanPhone.startsWith('84')) && cleanPhone.length >= 9 && cleanPhone.length <= 12;
    });

    const warnings: string[] = [];
    if (isHeaderRowData) {
        warnings.push('Phát hiện dòng tiêu đề đầu tiên có thể chứa dữ liệu khách hàng (Email/SĐT). Có vẻ như tệp của bạn đang thiếu hàng tiêu đề cột.');
    }
    if (!hasEmail) {
        warnings.push('Thiếu cột tiêu đề Email (hệ thống sẽ không thể gửi email cho các liên hệ này).');
    }
    if (!hasPhone) {
        warnings.push('Thiếu cột tiêu đề Số điện thoại (hệ thống sẽ không thể gửi tin nhắn ZNS/SMS cho các liên hệ này).');
    }
    if (!hasName) {
        warnings.push('Thiếu cột tiêu đề Họ & Tên (liên hệ sẽ được đặt tên tạm thời dựa trên Email/SĐT).');
    }

    if (!hasEmail && !hasPhone) {
        return {
            rows: [],
            columnMapping,
            originalHeaders,
            headers: Object.values(columnMapping),
            warnings,
            totalRawRows: Math.max(0, parsedAll.length - 1),
            hasEmail,
            hasPhone,
            hasName,
            missingRequiredIdentifiers: true,
        };
    }

    const rows = parsedAll.slice(1).map(values => {
        const trimmedValues = values.map(v => v.trim());
        if (trimmedValues.length === 0 || trimmedValues.every(v => !v)) return null;

        const rowObj: Record<string, any> = {};
        Object.keys(columnMapping).forEach(indexStr => {
            const index = Number(indexStr);
            const key = columnMapping[index];
            rowObj[key] = trimmedValues[index] ?? '';
        });

        if (rowObj.email && !rowObj.firstName) {
            rowObj.firstName = formatNameFromEmail(rowObj.email);
        }

        return rowObj;
    }).filter((r): r is Record<string, any> => Boolean(r && ((r.email && r.email.includes('@')) || r.phoneNumber)));

    return {
        rows,
        columnMapping,
        originalHeaders,
        headers: rows.length > 0 ? Object.keys(rows[0]) : Object.values(columnMapping),
        warnings,
        totalRawRows: rows.length,
        hasEmail,
        hasPhone,
        hasName,
        missingRequiredIdentifiers: false,
    };
};

/**
 * Enriches parsed preview rows with `customAttributes` right before submitting to the backend.
 * Preserves all unmapped columns + non-canonical mapped headers (e.g. "Danh xưng" when mapped to jobTitle)
 * so both canonical tags ({{jobtitle}}) and original Excel header tags ({{Danh xưng}}) work everywhere.
 */
export const attachCustomAttributesForImport = (
    rows: Record<string, any>[],
    columnMapping: Record<number, string>,
    originalHeaders: Record<number, string>
): Record<string, any>[] => {
    const headerAliases: Array<{ key: string; origHeader: string }> = [];
    Object.keys(columnMapping).forEach(idxStr => {
        const idx = Number(idxStr);
        const key = columnMapping[idx];
        const origHeader = (originalHeaders[idx] || '').trim();
        if (origHeader && key !== origHeader && SALUTATION_OR_TITLE_KEYS.has(key)) {
            headerAliases.push({ key, origHeader });
        }
    });

    return rows.map(row => {
        const customAttr = extractCustomAttributesFromRow(row);
        headerAliases.forEach(({ key, origHeader }) => {
            const v = row[key];
            if (v !== undefined && v !== null && String(v).trim() !== '' && !(origHeader in customAttr)) {
                customAttr[origHeader] = String(v).trim();
            }
        });
        return {
            ...row,
            customAttributes: customAttr,
        };
    });
};
