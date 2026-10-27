import * as XLSX from 'xlsx';

/* ---------- Thuế suất & giảm trừ chuẩn Luật Thuế TNCN ---------- */
export const RULES = {
  old: {
    self: 11e6,
    dep: 4.4e6,
    br: [
      [5e6, 0.05],
      [10e6, 0.10],
      [18e6, 0.15],
      [32e6, 0.20],
      [52e6, 0.25],
      [80e6, 0.30],
      [Infinity, 0.35],
    ] as Array<[number, number]>,
    label: 'Biểu lũy tiến 7 bậc · giảm trừ bản thân 11 tr/tháng · NPT 4,4 tr/tháng',
  },
  new: {
    self: 15.5e6,
    dep: 6.2e6,
    br: [
      [10e6, 0.05],
      [30e6, 0.10],
      [60e6, 0.20],
      [100e6, 0.30],
      [Infinity, 0.35],
    ] as Array<[number, number]>,
    label: 'Biểu lũy tiến 5 bậc · giảm trừ bản thân 15,5 tr/tháng · NPT 6,2 tr/tháng (từ kỳ tính thuế 2026)',
  },
};

export const rulesFor = (y: number) => (y >= 2026 ? RULES.new : RULES.old);

export function prog(t: number, br: Array<[number, number]>, mult = 1): number {
  if (!(t > 0)) return 0;
  let tax = 0;
  let prev = 0;
  for (const [cap, r] of br) {
    const c = cap * mult;
    const part = Math.min(t, c) - prev;
    if (part > 0) tax += part * r;
    if (t <= c) break;
    prev = c;
  }
  return Math.round(tax);
}

/* ---------- Helpers ---------- */
export const fmt = (n: any): string => Math.round(Number(n || 0)).toLocaleString('vi-VN');

export const norm = (s: any): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function num(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim();
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : neg ? -n : n;
}

const isDate = (v: any): v is Date => Object.prototype.toString.call(v) === '[object Date]';

export const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

export const uid = (): string => Math.random().toString(36).slice(2, 10);
export const ymKey = (y: number, m: number): string => `${y}-${String(m).padStart(2, '0')}`;
export const ymParse = (s: string): { y: number; m: number } => {
  const [y, m] = String(s || iso(TODAY).slice(0, 7)).split('-').map(Number);
  return { y: y || TODAY.getFullYear(), m: m || TODAY.getMonth() + 1 };
};
export const ymLabel = (k: string): string => {
  const { y, m } = ymParse(k);
  return `${String(m).padStart(2, '0')}/${y}`;
};
export const dmy = (s?: string | null): string => {
  if (!s) return '';
  const parts = String(s).slice(0, 10).split('-');
  if (parts.length !== 3) return String(s);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};
export const dParse = (s?: string | null): Date | null => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00') : null);
export const daysBetween = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / 86400000);

export function toIsoDate(v: any): string {
  if (v == null || v === '') return '';
  if (isDate(v)) return isNaN(v.getTime()) ? '' : iso(v);
  if (typeof v === 'number' && v > 20000 && (XLSX as any).SSF) {
    const d = (XLSX as any).SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : '';
  }
  const s = String(v).trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/))) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return '';
}

/* ---------- Tham số pháp lý ---------- */
export const LAW = {
  luongCoSo: (y: number, m: number) => (y * 12 + m >= 2026 * 12 + 7 ? 2530000 : 2340000),
  vung: (y: number, _m?: number) =>
    y >= 2026 ? [0, 5310000, 4730000, 4140000, 3680000] : [0, 4960000, 4410000, 3860000, 3450000],
  anTrua: (y: number, m: number, cfg: AzCompanyCfg) => (y * 12 + m >= 2026 * 12 + 7 ? cfg.anTrua2 : cfg.anTrua1),
  casual: (y: number, m: number, cfg: AzCompanyCfg) => (y * 12 + m >= 2026 * 12 + 7 ? cfg.casualNew : cfg.casualOld),
  rateNLD: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 },
  rateDN: { huu: 0.14, om: 0.03, tnld: 0.005, bhyt: 0.03, bhtn: 0.01, kpcd: 0.02 },
};

export const CODES: Array<[string, string, number, 'work' | 'paid' | 'kl' | 'om']> = [
  ['X', 'Đi làm đủ ngày', 1, 'work'],
  ['N', 'Nửa ngày', 0.5, 'work'],
  ['P', 'Nghỉ phép năm', 1, 'paid'],
  ['L', 'Nghỉ lễ, Tết', 1, 'paid'],
  ['R', 'Nghỉ có lương khác', 1, 'paid'],
  ['KL', 'Nghỉ không lương', 0, 'kl'],
  ['O', 'Ốm, thai sản (BHXH trả)', 0, 'om'],
];
export const CODE: Record<string, [string, string, number, 'work' | 'paid' | 'kl' | 'om']> = Object.fromEntries(
  CODES.map((c) => [c[0], c])
);

export const CT_TYPES: Record<string, string> = {
  KXD: 'HĐLĐ không xác định thời hạn',
  XD: 'HĐLĐ xác định thời hạn',
  TV: 'Hợp đồng thử việc',
  DV: 'HĐ dịch vụ / cộng tác viên',
};

export const CO_FIELDS: Array<[string, string, string, string]> = [
  ['mst', 'MST doanh nghiệp *', '', 'VD: 0101234567'],
  ['tenNNT', 'Tên doanh nghiệp *', 'wide', 'VD: CÔNG TY TNHH VIỆN QUỐC TẾ IDEAS'],
  ['dchiNNT', 'Địa chỉ', 'wide', ''],
  ['tenXaNNT', 'Phường/xã', '', ''],
  ['maXaNNT', 'Mã phường/xã', '', ''],
  ['tenTinhNNT', 'Tỉnh/thành phố', '', ''],
  ['maTinhNNT', 'Mã tỉnh', '', ''],
  ['maCQTNoiNop', 'Mã CQT nơi nộp *', '', 'VD: 70100'],
  ['tenCQTNoiNop', 'Tên CQT nơi nộp', '', ''],
  ['nguoiKy', 'Người ký tờ khai', '', ''],
  ['nganhNgheKD', 'Ngành nghề KD', 'wide', ''],
  ['dthoaiNNT', 'Điện thoại', '', ''],
  ['emailNNT', 'Email', '', ''],
];

export const EMP_FIELDS: Array<[string, Array<[string, string, string?, any?]>]> = [
  [
    'Thông tin cá nhân',
    [
      ['ma', 'Mã nhân viên'],
      ['ten', 'Họ và tên *', 'wide'],
      ['gt', 'Giới tính', '', ['Nam', 'Nữ']],
      ['ns', 'Ngày sinh', '', 'date'],
      ['qt', 'Quốc tịch'],
      ['cccd', 'Số CCCD / hộ chiếu'],
      ['mst', 'MST cá nhân'],
      ['diaChi', 'Nơi cư trú', 'wide'],
      ['sdt', 'Điện thoại'],
      ['email', 'Email'],
    ],
  ],
  [
    'Công việc',
    [
      ['viTri', 'Vị trí việc làm / chức danh'],
      ['phong', 'Phòng ban'],
      ['trinhDo', 'Trình độ chuyên môn, kỹ thuật'],
      ['bacNghe', 'Bậc trình độ kỹ năng nghề'],
      ['vaoLam', 'Ngày bắt đầu làm việc', '', 'date'],
      ['nghiViec', 'Ngày chấm dứt HĐ / nghỉ việc', '', 'date'],
      ['lyDoNghi', 'Lý do chấm dứt', 'wide'],
    ],
  ],
  [
    'Lương & bảo hiểm',
    [
      ['luongCB', 'Lương cơ bản (theo HĐ)', '', 'money'],
      ['bh', 'Tham gia BHXH bắt buộc', '', ['Có', 'Không']],
      ['luongBH', 'Lương đóng BH (để trống = tự tính)', '', 'money'],
      ['soBHXH', 'Số sổ BHXH'],
      ['doanVien', 'Đoàn viên công đoàn (trừ đoàn phí 1%)', '', ['Không', 'Có']],
    ],
  ],
  [
    'Thuế TNCN',
    [
      ['cuTru', 'Cá nhân cư trú', '', ['Có', 'Không']],
      ['npt', 'Số người phụ thuộc', '', 'number'],
      ['gtbt', 'Giảm trừ bản thân tại công ty này', '', ['Có', 'Không']],
      ['uyq', 'Ủy quyền quyết toán thay', '', ['Có', 'Không']],
    ],
  ],
  [
    'Ngân hàng',
    [
      ['nh', 'Ngân hàng'],
      ['stk', 'Số tài khoản'],
      ['cn', 'Chi nhánh'],
    ],
  ],
  [
    'Sổ quản lý lao động (Nghị định 145/2020/NĐ-CP)',
    [
      ['nangLuong', 'Nâng bậc, nâng lương', 'wide', 'text'],
      ['daoTao', 'Học nghề, đào tạo, bồi dưỡng', 'wide', 'text'],
      ['kyLuat', 'Kỷ luật lao động, trách nhiệm vật chất', 'wide', 'text'],
      ['tnld', 'Tai nạn lao động, bệnh nghề nghiệp', 'wide', 'text'],
      ['ghiChu', 'Ghi chú', 'wide', 'text'],
    ],
  ],
];

/* ---------- Types ---------- */
export interface AzAllowance {
  id: string;
  name: string;
  tax: 'chiu' | 'antrua' | 'mien';
  prorate: boolean;
  bh: boolean;
}

export interface AzCompanyCfg {
  vung: number;
  congChuan: 'lich' | number;
  t7: 'nghi' | 'nua' | 'lam';
  kpcd: boolean;
  payLag: number;
  otMode: 'chenh' | 'toanbo';
  otCap: number;
  anTrua1: number;
  anTrua2: number;
  casualOld: number;
  casualNew: number;
  kkType: 'Q' | 'M';
  autoFull: boolean;
}

export interface AzEmployee {
  id: string;
  user_id?: number;
  avatar_url?: string | null;
  ma: string;
  ten: string;
  gt: string;
  ns: string;
  qt: string;
  diaChi: string;
  cccd: string;
  mst: string;
  trinhDo: string;
  bacNghe: string;
  viTri: string;
  phong: string;
  vaoLam: string;
  nghiViec: string;
  lyDoNghi: string;
  cuTru: string;
  bh: string;
  soBHXH: string;
  luongCB: number;
  luongBH: number;
  pc: Record<string, number>;
  npt: number;
  gtbt: string;
  uyq: string;
  doanVien: string;
  nh: string;
  stk: string;
  cn: string;
  sdt: string;
  email: string;
  nangLuong: string;
  daoTao: string;
  kyLuat: string;
  tnld: string;
  ghiChu: string;
  [key: string]: any;
}

export interface AzContract {
  id: string;
  db_id?: number;
  empId: string;
  loai: 'KXD' | 'XD' | 'TV' | 'DV';
  so: string;
  tu: string;
  den: string;
  luong: number;
  ghiChu: string;
}

export interface AzMonthData {
  att: Record<string, { d: Record<string, string> }>;
  var: Record<
    string,
    {
      ot1?: number | string;
      ot2?: number | string;
      ot3?: number | string;
      thuong?: number | string;
      khacMien?: number | string;
      thueOverride?: number | string;
      tamUng?: number | string;
      khauTru?: number | string;
      giamTruKhac?: number | string;
      [key: string]: any;
    }
  >;
}

export interface AzCompany {
  id: string;
  info: Record<string, string>;
  cfg: AzCompanyCfg;
  allowances: AzAllowance[];
  employees: AzEmployee[];
  contracts: AzContract[];
  months: Record<string, AzMonthData>;
  tpl?: { kk?: string; qtt?: string } | null;
  sample?: boolean;
}

export interface AzDatabase {
  v: number;
  companies: Record<string, AzCompany>;
  active: string;
  ui: {
    tab: string;
    ym: string;
    q?: string;
    ctFilter?: string;
    ckNote?: string;
    soYear?: number;
    tax?: {
      kkNum?: number | null;
      kkYear?: number | null;
      qttYear?: number | null;
    };
  };
  manual?: {
    kk: Record<string, number>;
    qtt: Record<string, number>;
  };
}

export function defaultCfg(): AzCompanyCfg {
  return {
    vung: 1,
    congChuan: 'lich',
    t7: 'nghi',
    kpcd: true,
    payLag: 0,
    otMode: 'chenh',
    otCap: 40,
    anTrua1: 730000,
    anTrua2: 1200000,
    casualOld: 2000000,
    casualNew: 5000000,
    kkType: 'Q',
    autoFull: true,
  };
}

export function defaultAllowances(): AzAllowance[] {
  return [
    { id: 'trachnhiem', name: 'PC trách nhiệm', tax: 'chiu', prorate: true, bh: true },
    { id: 'xangxe', name: 'PC xăng xe', tax: 'chiu', prorate: true, bh: false },
    { id: 'dienthoai', name: 'PC điện thoại', tax: 'chiu', prorate: true, bh: false },
    { id: 'chuyencan', name: 'Chuyên cần', tax: 'chiu', prorate: false, bh: false },
    { id: 'antrua', name: 'Ăn trưa (tiền mặt)', tax: 'antrua', prorate: true, bh: false },
  ];
}

export function blankEmp(): AzEmployee {
  return {
    id: uid(),
    ma: '',
    ten: '',
    gt: 'Nam',
    ns: '',
    qt: 'Việt Nam',
    diaChi: '',
    cccd: '',
    mst: '',
    trinhDo: '',
    bacNghe: '',
    viTri: '',
    phong: '',
    vaoLam: iso(TODAY),
    nghiViec: '',
    lyDoNghi: '',
    cuTru: 'Có',
    bh: 'Có',
    soBHXH: '',
    luongCB: 0,
    luongBH: 0,
    pc: {},
    npt: 0,
    gtbt: 'Có',
    uyq: 'Có',
    doanVien: 'Không',
    nh: '',
    stk: '',
    cn: '',
    sdt: '',
    email: '',
    nangLuong: '',
    daoTao: '',
    kyLuat: '',
    tnld: '',
    ghiChu: '',
  };
}

export function newCompany(name = ''): AzCompany {
  const info: Record<string, string> = Object.fromEntries(CO_FIELDS.map(([k]) => [k, '']));
  info.tenNNT = name || '';
  return {
    id: uid(),
    info,
    cfg: defaultCfg(),
    allowances: defaultAllowances(),
    employees: [],
    contracts: [],
    months: {},
    tpl: null,
    sample: false,
  };
}

export function sampleCompany(): AzCompany {
  const c = newCompany('CÔNG TY MẪU A-Z (dữ liệu minh hoạ)');
  c.sample = true;
  Object.assign(c.info, {
    mst: '0000000000',
    dchiNNT: 'Địa chỉ minh hoạ',
    maCQTNoiNop: '00000',
    tenCQTNoiNop: 'Cơ quan thuế minh hoạ',
    nguoiKy: 'NGUOI KY MINH HOA',
  });
  const E = (o: Partial<AzEmployee>): AzEmployee => ({ ...blankEmp(), id: uid(), vaoLam: '', ...o });
  const em: AzEmployee[] = [
    E({
      ma: 'NV001',
      ten: 'Nguyễn Văn An (mẫu)',
      ns: '1985-03-12',
      cccd: '079085000001',
      mst: '8000000001',
      trinhDo: 'Đại học Kinh tế',
      viTri: 'Giám đốc',
      phong: 'Ban giám đốc',
      vaoLam: '2020-01-02',
      luongCB: 25000000,
      pc: { trachnhiem: 3000000, xangxe: 1000000, dienthoai: 500000, antrua: 1040000 },
      npt: 2,
      nh: 'Vietcombank',
      stk: '0001000000001',
      cn: 'Đồng Nai',
      doanVien: 'Có',
    }),
    E({
      ma: 'NV002',
      ten: 'Trần Thị Bình (mẫu)',
      gt: 'Nữ',
      ns: '1992-07-21',
      cccd: '079192000002',
      mst: '8000000002',
      trinhDo: 'Cao đẳng Kế toán',
      viTri: 'Kế toán',
      phong: 'Kế toán',
      vaoLam: '2024-11-01',
      luongCB: 12000000,
      pc: { dienthoai: 300000, chuyencan: 500000, antrua: 1040000 },
      npt: 1,
      nh: 'Techcombank',
      stk: '0002000000002',
    }),
    E({
      ma: 'NV003',
      ten: 'Lê Văn Cường (mẫu)',
      ns: '1996-11-02',
      cccd: '079096000003',
      mst: '8000000003',
      trinhDo: 'Trung cấp Cơ khí',
      bacNghe: 'Bậc 3/7',
      viTri: 'Kỹ thuật viên',
      phong: 'Sản xuất',
      vaoLam: '2023-05-15',
      luongCB: 9000000,
      pc: { xangxe: 500000, chuyencan: 500000, antrua: 1040000 },
      nh: 'BIDV',
      stk: '0003000000003',
    }),
    E({
      ma: 'NV004',
      ten: 'Phạm Thị Dung (mẫu)',
      gt: 'Nữ',
      ns: '2001-02-14',
      cccd: '079201000004',
      trinhDo: 'Đại học',
      viTri: 'Nhân viên kinh doanh',
      phong: 'Kinh doanh',
      vaoLam: '2026-09-01',
      luongCB: 8500000,
      pc: { antrua: 1040000 },
      bh: 'Không',
      uyq: 'Không',
      nh: 'ACB',
      stk: '0004000000004',
    }),
    E({
      ma: 'CTV01',
      ten: 'Hoàng Minh Đức (mẫu)',
      ns: '1990-09-09',
      cccd: '079090000005',
      mst: '8000000005',
      viTri: 'Cộng tác viên bán hàng',
      phong: 'Kinh doanh',
      vaoLam: '2026-07-01',
      luongCB: 6000000,
      bh: 'Không',
      uyq: 'Không',
      nh: 'MB',
      stk: '0005000000005',
    }),
    E({
      ma: 'NN001',
      ten: 'John Smith (mẫu)',
      qt: 'Hoa Kỳ',
      ns: '1980-05-05',
      cccd: 'P0000006',
      mst: '8000000006',
      trinhDo: 'Thạc sĩ Kỹ thuật',
      viTri: 'Chuyên gia kỹ thuật',
      phong: 'Sản xuất',
      vaoLam: '2026-07-01',
      cuTru: 'Không',
      luongCB: 60000000,
      uyq: 'Không',
      nh: 'HSBC',
      stk: '0006000000006',
    }),
  ];
  c.employees = em;
  const C = (e: AzEmployee, loai: AzContract['loai'], so: string, tu: string, den: string, luong: number): AzContract => ({
    id: uid(),
    empId: e.id,
    loai,
    so,
    tu,
    den,
    luong,
    ghiChu: '',
  });
  c.contracts = [
    C(em[0], 'KXD', '01/2020/HĐLĐ', '2020-01-02', '', 25000000),
    C(em[1], 'XD', '05/2024/HĐLĐ', '2024-11-01', '2025-10-31', 11000000),
    C(em[1], 'XD', '09/2025/HĐLĐ', '2025-11-01', '2026-10-31', 12000000),
    C(em[2], 'KXD', '03/2023/HĐLĐ', '2023-05-15', '', 9000000),
    C(em[3], 'TV', '02/2026/HĐTV', '2026-09-01', '2026-10-31', 8500000),
    C(em[4], 'DV', '01/2026/HĐDV', '2026-07-01', '2026-12-31', 6000000),
    C(em[5], 'XD', '04/2026/HĐLĐ', '2026-07-01', '2027-06-30', 60000000),
  ];
  for (const m of [7, 8, 9]) {
    const k = ymKey(2026, m);
    c.months[k] = { att: {}, var: {} };
    fillFull(c, k, false);
    const a = c.months[k].att;
    if (m === 8) {
      a[em[1].id].d['12'] = 'P';
      a[em[1].id].d['13'] = 'P';
      a[em[2].id].d['20'] = 'KL';
    }
    if (m === 9) {
      a[em[2].id].d['10'] = 'O';
      a[em[2].id].d['11'] = 'O';
    }
    c.months[k].var[em[2].id] = { ot1: m === 8 ? 20 : 12, ot2: m === 8 ? 8 : 0, ot3: m === 9 ? 8 : 0 };
    c.months[k].var[em[0].id] = { thuong: m === 9 ? 5000000 : 0 };
    c.months[k].var[em[1].id] = { tamUng: m === 7 ? 2000000 : 0 };
  }
  markHolidays(c, '2026-09');
  return c;
}

/* ---------- Lịch & chấm công ---------- */
export const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const HOLIDAYS = ['01-01', '04-30', '05-01', '09-02'];

export function monthDays(y: number, m: number, cfg: AzCompanyCfg) {
  const dim = new Date(y, m, 0).getDate();
  const days: Array<{ d: number; dow: number; w: number }> = [];
  let std = 0;
  for (let d = 1; d <= dim; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    let w = 1;
    if (dow === 0) w = 0;
    else if (dow === 6) w = cfg.t7 === 'nghi' ? 0 : cfg.t7 === 'nua' ? 0.5 : 1;
    days.push({ d, dow, w });
    std += w;
  }
  const congChuan = cfg.congChuan === 'lich' ? std : Number(cfg.congChuan) || std;
  return { days, std, congChuan, dim };
}

export function inService(e: AzEmployee, y: number, m: number): boolean {
  const s = `${y}-${String(m).padStart(2, '0')}-01`;
  const eom = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
  if (e.vaoLam && e.vaoLam > eom) return false;
  if (e.nghiViec && e.nghiViec < s) return false;
  return true;
}

export function serviceDay(e: AzEmployee, y: number, m: number, d: number): boolean {
  const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (!e.vaoLam || ds >= e.vaoLam) && (!e.nghiViec || ds <= e.nghiViec);
}

export function ensureMonth(c: AzCompany, k: string): AzMonthData {
  if (!c.months[k]) c.months[k] = { att: {}, var: {} };
  if (!c.months[k].att) c.months[k].att = {};
  if (!c.months[k].var) c.months[k].var = {};
  return c.months[k];
}

export function fillFull(c: AzCompany, k: string, onlyEmpty = true, empId: string | null = null): void {
  const { y, m } = ymParse(k);
  const md = monthDays(y, m, c.cfg);
  const mo = ensureMonth(c, k);
  for (const e of c.employees) {
    if (empId && e.id !== empId) continue;
    if (!inService(e, y, m)) continue;
    const a = mo.att[e.id] || (mo.att[e.id] = { d: {} });
    for (const { d, w } of md.days) {
      const key = String(d);
      if (onlyEmpty && a.d[key]) continue;
      if (!serviceDay(e, y, m, d)) {
        delete a.d[key];
        continue;
      }
      if (w === 1) a.d[key] = 'X';
      else if (w === 0.5) a.d[key] = 'N';
      else delete a.d[key];
    }
  }
}

export function markHolidays(c: AzCompany, k: string): void {
  const { y, m } = ymParse(k);
  const mo = ensureMonth(c, k);
  for (const e of c.employees) {
    if (!inService(e, y, m)) continue;
    const a = mo.att[e.id] || (mo.att[e.id] = { d: {} });
    for (const h of HOLIDAYS) {
      const [hm, hd] = h.split('-').map(Number);
      if (hm === m && serviceDay(e, y, m, hd)) a.d[String(hd)] = 'L';
    }
  }
}

export function attSummary(c: AzCompany, e: AzEmployee, k: string) {
  const { y, m } = ymParse(k);
  const md = monthDays(y, m, c.cfg);
  const a = c.months[k]?.att?.[e.id];
  const s = { work: 0, paid: 0, kl: 0, om: 0, P: 0, L: 0, R: 0, marked: false, congTL: 0, congChuan: md.congChuan };
  if (a && a.d && Object.keys(a.d).length) {
    s.marked = true;
    for (const v of Object.values(a.d)) {
      const cd = CODE[v];
      if (!cd) continue;
      if (cd[3] === 'work') s.work += cd[2];
      else if (cd[3] === 'paid') {
        s.paid += 1;
        (s as any)[v] = ((s as any)[v] || 0) + 1;
      } else if (cd[3] === 'kl') s.kl++;
      else s.om++;
    }
  } else if (c.cfg.autoFull) {
    for (const { d, w } of md.days) {
      if (w && serviceDay(e, y, m, d)) s.work += w;
    }
  }
  s.congTL = s.work + s.paid;
  s.congChuan = md.congChuan;
  return s;
}

/* ---------- Hợp đồng ---------- */
export function empContracts(c: AzCompany, empId: string): AzContract[] {
  return (c.contracts || []).filter((x) => x.empId === empId).sort((a, b) => (a.tu || '').localeCompare(b.tu || ''));
}

export function contractAt(c: AzCompany, empId: string, dateStr: string): AzContract | null {
  const list = empContracts(c, empId).filter((x) => (!x.tu || x.tu <= dateStr) && (!x.den || x.den >= dateStr));
  return list[list.length - 1] || null;
}

export function contractForMonth(c: AzCompany, empId: string, y: number, m: number): AzContract | null {
  const eom = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
  const som = `${y}-${String(m).padStart(2, '0')}-01`;
  const list = empContracts(c, empId).filter((x) => (!x.tu || x.tu <= eom) && (!x.den || x.den >= som));
  return list[list.length - 1] || null;
}

export function ctMonths(ct: AzContract): number {
  if (!ct.den || !ct.tu) return 999;
  const a = dParse(ct.tu);
  const b = dParse(ct.den);
  if (!a || !b) return 999;
  return (b.getTime() - a.getTime()) / 86400000 / 30.4;
}

export function isLabour(ct: AzContract | null): boolean {
  if (!ct) return true;
  if (ct.loai === 'KXD') return true;
  if (ct.loai === 'XD') return ctMonths(ct) >= 2.95;
  return false;
}

export interface AzContractAlert {
  lv: 'bad' | 'warn' | 'info';
  e: AzEmployee;
  ct?: AzContract;
  text: string;
  sort: number;
}

export function contractAlerts(c: AzCompany): AzContractAlert[] {
  const out: AzContractAlert[] = [];
  for (const e of c.employees || []) {
    const offDate = dParse(e.nghiViec);
    if (e.nghiViec && offDate && offDate < TODAY) continue;
    const list = empContracts(c, e.id);
    if (!list.length) {
      out.push({ lv: 'warn', e, text: 'Chưa có hợp đồng nào', sort: 50 });
      continue;
    }
    const last = list[list.length - 1];
    if (last.den) {
      const denDate = dParse(last.den);
      if (denDate) {
        const left = daysBetween(TODAY, denDate);
        const nm = last.loai === 'TV' ? 'Thử việc' : 'Hợp đồng';
        if (left < 0) {
          out.push({
            lv: 'bad',
            e,
            ct: last,
            text: `${nm} ${last.so || ''} đã hết hạn ${-left} ngày (${dmy(last.den)}), chưa có hợp đồng mới`,
            sort: left,
          });
        } else if (left <= 30) {
          out.push({
            lv: 'warn',
            e,
            ct: last,
            text: `${nm} ${last.so || ''} còn ${left} ngày, hết hạn ${dmy(last.den)}`,
            sort: left,
          });
        }
      }
    }
    const xd = list.filter((x) => x.loai === 'XD').length;
    if (xd >= 2 && last.loai === 'XD' && last.den) {
      out.push({
        lv: 'info',
        e,
        ct: last,
        text: `Đã ký ${xd} HĐ xác định thời hạn. Nếu tiếp tục làm việc, hợp đồng tiếp theo phải là HĐ không xác định thời hạn (khoản 2 Điều 20 Bộ luật Lao động 2019)`,
        sort: 100,
      });
    }
  }
  return out.sort((a, b) => a.sort - b.sort);
}

/* ---------- Tính lương chuẩn Kế Toán A-Z ---------- */
export interface AzPayRow {
  e: AzEmployee;
  k: string;
  y: number;
  m: number;
  s: ReturnType<typeof attSummary>;
  v: Record<string, any>;
  luongCB: number;
  lTheoCong: number;
  pcList: Array<{ a: AzAllowance; amt: number; val: number }>;
  pc: number;
  luongGio: number;
  otH: number;
  ot: number;
  otMien: number;
  thuong: number;
  khacMien: number;
  gross: number;
  pcMien: number;
  mien: number;
  tnct: number;
  ct: AzContract | null;
  hdld: boolean;
  resident: boolean;
  foreign: boolean;
  bhOn: boolean;
  luongBH: number;
  nld: { bhxh: number; bhyt: number; bhtn: number };
  bhNLD: number;
  dn: { bhxh: number; bhyt: number; bhtn: number; kpcd: number };
  bhDN: number;
  doanPhi: number;
  py: number;
  pm: number;
  npt: number;
  noSelf: boolean;
  gt: number;
  khacGT: number;
  method: string;
  tntt: number;
  thue: number;
  thueManual?: boolean;
  tamUng: number;
  khauTru: number;
  net: number;
}

export function calcPay(c: AzCompany, e: AzEmployee, k: string): AzPayRow {
  const { y, m } = ymParse(k);
  const cfg = c.cfg;
  const s = attSummary(c, e, k);
  const v = c.months[k]?.var?.[e.id] || {};
  const ratio = s.congChuan > 0 ? s.congTL / s.congChuan : 0;
  const workRatio = s.congChuan > 0 ? s.work / s.congChuan : 0;
  const luongCB = Number(e.luongCB || 0);
  const lTheoCong = Math.round(luongCB * ratio);
  const pcList = (c.allowances || []).map((a) => {
    const amt = num(e.pc?.[a.id]) || 0;
    const val = a.prorate ? Math.round(amt * (a.tax === 'antrua' ? workRatio : ratio)) : amt;
    return { a, amt, val };
  });
  const pc = pcList.reduce((t, x) => t + x.val, 0);
  const H = (num(v.ot1) || 0) + (num(v.ot2) || 0) + (num(v.ot3) || 0);
  const luongGio = s.congChuan > 0 ? luongCB / s.congChuan / 8 : 0;
  const otH = H;
  const ot = Math.round(luongGio * (1.5 * (num(v.ot1) || 0) + 2 * (num(v.ot2) || 0) + 3 * (num(v.ot3) || 0)));
  const f = H > 0 ? Math.min(H, cfg.otCap || 40) / H : 0;
  const otMien = Math.round(f * (cfg.otMode === 'toanbo' ? ot : ot - luongGio * H));
  const thuong = num(v.thuong) || 0;
  const khacMien = num(v.khacMien) || 0;
  const gross = lTheoCong + pc + ot + thuong + khacMien;
  const capAT = LAW.anTrua(y, m, cfg);
  const pcMien = pcList.reduce(
    (t, x) => t + (x.a.tax === 'mien' ? x.val : x.a.tax === 'antrua' ? Math.min(x.val, capAT) : 0),
    0
  );
  const mien = pcMien + otMien + khacMien;
  const tnct = Math.max(0, gross - mien);

  // Bảo hiểm
  const ct = contractForMonth(c, e.id, y, m);
  const hdld = isLabour(ct) && !(ct && (ct.loai === 'TV' || ct.loai === 'DV'));
  const resident = e.cuTru !== 'Không';
  const foreign = Boolean(e.qt && norm(e.qt) !== 'viet nam');
  const bhOn = e.bh === 'Có' && s.kl + s.om < 14 && s.congTL > 0;
  const base =
    num(e.luongBH) ||
    luongCB + (c.allowances || []).filter((a) => a.bh).reduce((t, a) => t + (num(e.pc?.[a.id]) || 0), 0);
  const capXH = 20 * LAW.luongCoSo(y, m);
  const capTN = 20 * LAW.vung(y, m)[cfg.vung || 1];
  const luongBH = bhOn ? base : 0;
  const bXH = Math.min(luongBH, capXH);
  const bTN = foreign ? 0 : Math.min(luongBH, capTN);
  const R1 = LAW.rateNLD;
  const R2 = LAW.rateDN;
  const nld = {
    bhxh: Math.round(bXH * R1.bhxh),
    bhyt: Math.round(bXH * R1.bhyt),
    bhtn: Math.round(bTN * R1.bhtn),
  };
  const bhNLD = nld.bhxh + nld.bhyt + nld.bhtn;
  const dn = {
    bhxh: Math.round(bXH * (R2.huu + R2.om + R2.tnld)),
    bhyt: Math.round(bXH * R2.bhyt),
    bhtn: Math.round(bTN * R2.bhtn),
    kpcd: cfg.kpcd ? Math.round(bXH * R2.kpcd) : 0,
  };
  const bhDN = dn.bhxh + dn.bhyt + dn.bhtn;
  const doanPhi =
    e.doanVien === 'Có' && bhOn ? Math.min(Math.round(bXH * 0.01), Math.round(LAW.luongCoSo(y, m) * 0.1)) : 0;

  // Thời điểm trả & thuế
  let py = y;
  let pm = m;
  if (cfg.payLag) {
    pm = m + 1;
    if (pm > 12) {
      pm = 1;
      py = y + 1;
    }
  }
  const RU = rulesFor(py);
  const npt = num(e.npt) || 0;
  const noSelf = e.gtbt === 'Không';
  const gt = noSelf ? 0 : RU.self + RU.dep * npt;
  const khacGT = num(v.giamTruKhac) || 0;
  let method = 'Lũy tiến';
  let tntt = 0;
  let thue = 0;
  if (!resident) {
    method = 'Không cư trú 20%';
    tntt = tnct;
    thue = Math.round(tnct * 0.2);
  } else if (!hdld) {
    method = 'Vãng lai 10%';
    tntt = tnct;
    thue = tnct >= LAW.casual(py, pm, cfg) ? Math.round(tnct * 0.1) : 0;
  } else {
    method = 'Lũy tiến';
    tntt = Math.max(0, tnct - gt - bhNLD - khacGT);
    thue = prog(tntt, RU.br);
  }
  let thueManual = false;
  if (v.thueOverride != null && v.thueOverride !== '') {
    thue = num(v.thueOverride) || 0;
    thueManual = true;
  }
  const tamUng = num(v.tamUng) || 0;
  const khauTru = num(v.khauTru) || 0;
  const net = gross - bhNLD - doanPhi - thue - tamUng - khauTru;

  return {
    e,
    k,
    y,
    m,
    s,
    v,
    luongCB,
    lTheoCong,
    pcList,
    pc,
    luongGio,
    otH,
    ot,
    otMien,
    thuong,
    khacMien,
    gross,
    pcMien,
    mien,
    tnct,
    ct,
    hdld,
    resident,
    foreign,
    bhOn,
    luongBH,
    nld,
    bhNLD,
    dn,
    bhDN,
    doanPhi,
    py,
    pm,
    npt,
    noSelf,
    gt,
    khacGT,
    method,
    tntt,
    thue,
    thueManual,
    tamUng,
    khauTru,
    net,
  };
}

export function payroll(c: AzCompany, k: string): AzPayRow[] {
  const { y, m } = ymParse(k);
  return (c.employees || []).filter((e) => inService(e, y, m)).map((e) => calcPay(c, e, k));
}

export function slipLines(r: AzPayRow): Array<[string, any, number?]> {
  const L: Array<[string, any, number?]> = [];
  L.push(['h', 'Thu nhập']);
  L.push([`Lương theo công (${r.s.congTL}/${r.s.congChuan} công)`, r.lTheoCong]);
  r.pcList.filter((x) => x.val).forEach((x) => L.push([x.a.name, x.val]));
  if (r.ot) L.push([`Làm thêm giờ (${r.otH} giờ)`, r.ot]);
  if (r.thuong) L.push(['Thưởng', r.thuong]);
  if (r.khacMien) L.push(['Thu nhập khác không chịu thuế', r.khacMien]);
  L.push(['tot', 'Tổng thu nhập', r.gross]);
  L.push(['h', 'Khấu trừ']);
  L.push(['BHXH 8%', r.nld.bhxh], ['BHYT 1,5%', r.nld.bhyt], ['BHTN 1%', r.nld.bhtn]);
  if (r.doanPhi) L.push(['Đoàn phí công đoàn', r.doanPhi]);
  L.push([`Thuế TNCN (${r.method})`, r.thue]);
  if (r.tamUng) L.push(['Tạm ứng', r.tamUng]);
  if (r.khauTru) L.push(['Khấu trừ khác', r.khauTru]);
  L.push(['tot', 'Thực lĩnh', r.net]);
  L.push(['h', 'Căn cứ tính thuế']);
  L.push(
    ['Thu nhập miễn thuế (ăn trưa trong mức, chênh lệch làm thêm…)', r.mien],
    ['Thu nhập chịu thuế', r.tnct],
    [`Giảm trừ gia cảnh (${r.npt} NPT)`, r.gt],
    ['Thu nhập tính thuế', r.tntt]
  );
  return L;
}

/* ---------- Thuế TNCN 05/KK & 05/QTT chuẩn HTKK ---------- */
export interface AzTaxRec {
  src: string;
  year: number;
  month: number;
  salYear: number;
  salMonth: number;
  name: string;
  mst: string;
  cccd: string;
  resident: boolean;
  hdld: boolean;
  tnct: number;
  bh: number;
  npt: number;
  khac: number;
  thue: number;
  thueIn: number;
  uyq: boolean | null;
  noSelf: boolean;
  key: string;
}

export function allTaxRecords(c: AzCompany): AzTaxRec[] {
  const recs: AzTaxRec[] = [];
  for (const k of Object.keys(c.months || {}).sort()) {
    for (const r of payroll(c, k)) {
      if (!(r.gross > 0)) continue;
      const e = r.e;
      recs.push({
        src: `Bảng lương ${k}`,
        year: r.py,
        month: r.pm,
        salYear: r.y,
        salMonth: r.m,
        name: e.ten,
        mst: e.mst || '',
        cccd: e.cccd || '',
        resident: r.resident,
        hdld: r.hdld,
        tnct: r.tnct,
        bh: r.bhNLD,
        npt: r.hdld && r.resident ? r.npt : 0,
        khac: r.khacGT,
        thue: r.thue,
        thueIn: r.thue,
        uyq: e.uyq === 'Có' ? true : e.uyq === 'Không' ? false : null,
        noSelf: r.noSelf,
        key: 'e:' + e.id,
      });
    }
  }
  return recs;
}

export function groupPersons(rows: AzTaxRec[]) {
  const map = new Map<string, any>();
  for (const r of rows) {
    let p = map.get(r.key);
    if (!p) {
      p = {
        key: r.key,
        name: r.name,
        mst: r.mst,
        cccd: r.cccd,
        resident: r.resident,
        hdld: false,
        tnct: 0,
        bh: 0,
        khac: 0,
        nptMonths: 0,
        nptMax: 0,
        thue: 0,
        months: new Set<number>(),
        uyq: null as boolean | null,
        noSelf: false,
      };
      map.set(r.key, p);
    }
    p.mst = p.mst || r.mst;
    p.cccd = p.cccd || r.cccd;
    if (!r.resident) p.resident = false;
    if (r.hdld) p.hdld = true;
    p.tnct += r.tnct;
    p.bh += r.bh;
    p.khac += r.khac;
    p.thue += r.thue;
    if (r.thue > 0) p.tnctW = (p.tnctW || 0) + r.tnct;
    if (r.hdld && r.resident) {
      p.nptMonths += r.npt;
      p.nptMax = Math.max(p.nptMax, r.npt);
    }
    p.months.add(r.month);
    if (r.uyq != null) p.uyq = r.uyq;
    if (r.noSelf) p.noSelf = true;
  }
  return [...map.values()];
}

export const KK_ROWS: Array<[string, string, string?, number?]> = [
  ['16', 'Tổng số người lao động', 'total'],
  ['17', 'Trong đó: Cá nhân cư trú có hợp đồng lao động', 'sub'],
  ['18', 'Tổng số cá nhân đã khấu trừ thuế [18]=[19]+[20]', 'total'],
  ['19', 'Cá nhân cư trú', 'sub'],
  ['20', 'Cá nhân không cư trú', 'sub'],
  ['21', 'Tổng thu nhập chịu thuế trả cho cá nhân [21]=[22]+[23]', 'total'],
  ['22', 'Cá nhân cư trú', 'sub'],
  ['23', 'Cá nhân không cư trú', 'sub'],
  ['24', 'Trong đó: TNCT từ phí mua BH nhân thọ, BH không bắt buộc khác của DNBH không thành lập tại VN', 'sub', 1],
  ['25', 'Trong đó: TNCT được miễn (theo chỉ tiêu HTKK, nếu có)', 'sub', 1],
  ['25_1', 'Chỉ tiêu [25.1] trên HTKK (nếu có)', 'sub', 1],
  ['26', 'Tổng TNCT trả cho cá nhân thuộc diện phải khấu trừ thuế [26]=[27]+[28]', 'total'],
  ['27', 'Cá nhân cư trú', 'sub'],
  ['28', 'Cá nhân không cư trú', 'sub'],
  ['29', 'Tổng số thuế TNCN đã khấu trừ [29]=[30]+[31]', 'total'],
  ['30', 'Cá nhân cư trú', 'sub'],
  ['31', 'Cá nhân không cư trú', 'sub'],
  ['32', 'Trong đó: Thuế đã khấu trừ trên phí mua BH nhân thọ, BH không bắt buộc khác', 'sub', 1],
  ['15', 'Chỉ tiêu [15] trên HTKK (giữ 0 nếu không phát sinh)', 'sub', 1],
];

export const QTT_ROWS: Array<[string, string, string?, number?]> = [
  ['grp', 'Nghĩa vụ khấu trừ thuế của tổ chức trả thu nhập'],
  ['16', 'Tổng số người lao động', 'total'],
  ['17', 'Trong đó: Cá nhân cư trú có hợp đồng lao động', 'sub'],
  ['18', 'Tổng số cá nhân đã khấu trừ thuế [18]=[19]+[20]', 'total'],
  ['19', 'Cá nhân cư trú', 'sub'],
  ['20', 'Cá nhân không cư trú', 'sub'],
  ['21', 'Tổng số cá nhân thuộc diện được miễn, giảm thuế theo Hiệp định', 'total', 1],
  ['22', 'Tổng số cá nhân giảm trừ gia cảnh', 'total'],
  ['23', 'Tổng thu nhập chịu thuế trả cho cá nhân [23]=[24]+[25]', 'total'],
  ['24', 'Cá nhân cư trú', 'sub'],
  ['25', 'Cá nhân không cư trú', 'sub'],
  ['26', 'Trong đó: TNCT từ phí mua BH nhân thọ, BH không bắt buộc khác của DNBH không thành lập tại VN', 'sub', 1],
  ['27', 'Trong đó: TNCT được miễn theo hợp đồng dầu khí', 'sub', 1],
  ['28', 'Tổng TNCT trả cho cá nhân thuộc diện phải khấu trừ thuế [28]=[29]+[30]', 'total'],
  ['29', 'Cá nhân cư trú', 'sub'],
  ['30', 'Cá nhân không cư trú', 'sub'],
  ['31', 'Tổng số thuế TNCN đã khấu trừ [31]=[32]+[33]', 'total'],
  ['32', 'Cá nhân cư trú', 'sub'],
  ['33', 'Cá nhân không cư trú', 'sub'],
  ['34', 'Trong đó: Thuế đã khấu trừ trên phí mua BH nhân thọ, BH không bắt buộc khác', 'sub', 1],
  ['grp', 'Nghĩa vụ quyết toán thay cho cá nhân'],
  ['35', 'Tổng số cá nhân ủy quyền cho tổ chức quyết toán thay', 'total'],
  ['36', 'Tổng số thuế TNCN đã khấu trừ', 'total'],
  ['37', 'Trong đó: Thuế đã khấu trừ tại tổ chức trước khi điều chuyển', 'sub', 1],
  ['38', 'Tổng số thuế TNCN phải nộp', 'total'],
  ['39', 'Tổng số thuế được miễn do còn phải nộp sau QT từ 50.000 đ trở xuống', 'total'],
  ['40', 'Tổng số thuế TNCN còn phải nộp [38]−[36]−[39] > 0', 'total'],
  ['41', 'Tổng số thuế TNCN đã nộp thừa [38]−[36]−[39] < 0', 'total'],
];

export function computeKK(
  recs: AzTaxRec[],
  range: { y: number; m1: number; m2: number },
  manualKK: Record<string, number> = {}
) {
  const { y, m1, m2 } = range;
  const rows = recs.filter((r) => r.year === y && r.month >= m1 && r.month <= m2);
  const ps = groupPersons(rows);
  const res = ps.filter((p) => p.resident);
  const non = ps.filter((p) => !p.resident);
  const wRes = res.filter((p) => p.thue > 0);
  const wNon = non.filter((p) => p.thue > 0);
  const sum = (a: any[], k: string) => a.reduce((s, p) => s + (p[k] || 0), 0);
  const M = manualKK || {};
  const v: Record<string, number> = {
    ct15: M.ct15 ?? 0,
    ct16: ps.length,
    ct17: res.filter((p) => p.hdld).length,
    ct19: wRes.length,
    ct20: wNon.length,
    ct22: sum(res, 'tnct'),
    ct23: sum(non, 'tnct'),
    ct24: M.ct24 ?? 0,
    ct25: M.ct25 ?? 0,
    ct25_1: M.ct25_1 ?? 0,
    ct27: sum(wRes, 'tnct'),
    ct28: sum(wNon, 'tnct'),
    ct30: sum(wRes, 'thue'),
    ct31: sum(wNon, 'thue'),
    ct32: M.ct32 ?? 0,
  };
  v.ct18 = v.ct19 + v.ct20;
  v.ct21 = v.ct22 + v.ct23;
  v.ct26 = v.ct27 + v.ct28;
  v.ct29 = v.ct30 + v.ct31;
  for (const k in v) v[k] = Math.round(v[k]);
  return { v, ps, rows };
}

export function computeQTT(recs: AzTaxRec[], qttYear: number, manualQTT: Record<string, number> = {}) {
  const y = qttYear;
  const R = rulesFor(y);
  const rows = recs.filter((r) => r.year === y);
  const ps = groupPersons(rows);
  const res = ps.filter((p) => p.resident);
  const non = ps.filter((p) => !p.resident);
  const wRes = res.filter((p) => p.thue > 0);
  const wNon = non.filter((p) => p.thue > 0);
  const sum = (a: any[], k: string) => a.reduce((s, p) => s + (p[k] || 0), 0);
  const bk1 = res.filter((p) => p.hdld);
  const bk2 = ps.filter((p) => !(p.resident && p.hdld));
  for (const p of bk1) {
    p.auth = p.noSelf ? false : p.uyq ?? true;
    p.gt = p.noSelf ? 0 : R.self * 12 + R.dep * p.nptMonths;
    p.tntt = Math.max(0, p.tnct - p.gt - p.bh - p.khac);
    p.payable = prog(p.tntt, R.br, 12);
    const d = p.payable - p.thue;
    p.thua = d < 0 ? -d : 0;
    p.conNop = d > 0 ? d : 0;
    p.mien = p.auth && d > 0 && d <= 50000 ? d : 0;
  }
  const auth = bk1.filter((p) => p.auth);
  const M = manualQTT || {};
  const v: Record<string, number> = {
    ct16: ps.length,
    ct17: bk1.length,
    ct19: wRes.length,
    ct20: wNon.length,
    ct21: M.ct21 ?? 0,
    ct22: bk1.length,
    ct24: sum(res, 'tnct'),
    ct25: sum(non, 'tnct'),
    ct26: M.ct26 ?? 0,
    ct27: M.ct27 ?? 0,
    ct29: sum(wRes, 'tnct'),
    ct30: sum(wNon, 'tnct'),
    ct32: sum(wRes, 'thue'),
    ct33: sum(wNon, 'thue'),
    ct34: M.ct34 ?? 0,
    ct35: auth.length,
    ct36: sum(auth, 'thue'),
    ct37: M.ct37 ?? 0,
    ct38: sum(auth, 'payable'),
    ct39: sum(auth, 'mien'),
  };
  v.ct18 = v.ct19 + v.ct20;
  v.ct23 = v.ct24 + v.ct25;
  v.ct28 = v.ct29 + v.ct30;
  v.ct31 = v.ct32 + v.ct33;
  const net = v.ct38 - v.ct36 - v.ct39;
  v.ct40 = Math.max(0, net);
  v.ct41 = Math.max(0, -net);
  for (const k in v) v[k] = Math.round(v[k]);
  return { v, ps, bk1, bk2, auth, R };
}

/* ---------- Mẫu XML HTKK Chuẩn ---------- */
export const DEFAULT_TPL_KK = `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue">
  <HSoKhaiThue id="ID_1">
    <TTinChung>
      <TTinDVu>
        <maDVu>HTKK</maDVu>
        <tenDVu>HỖ TRỢ KÊ KHAI THUẾ</tenDVu>
        <pbanDVu>5.7.8</pbanDVu>
        <ttinNhaCCapDVu>41985DA4BD837F9D64BA8D18591EC331</ttinNhaCCapDVu>
      </TTinDVu>
      <TTinTKhaiThue>
        <TKhaiThue>
          <maTKhai>864</maTKhai>
          <tenTKhai>TK khấu trừ thuế thu nhập cá nhân Mẫu 05/KK-TNCN (TT80/2021)</tenTKhai>
          <moTaBMau>(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính)</moTaBMau>
          <pbanTKhaiXML>2.9.3</pbanTKhaiXML>
          <loaiTKhai>C</loaiTKhai>
          <soLan>0</soLan>
          <KyKKhaiThue>
            <kieuKy>Q</kieuKy>
            <kyKKhai>3/2026</kyKKhai>
            <kyKKhaiTuNgay>01/07/2026</kyKKhaiTuNgay>
            <kyKKhaiDenNgay>30/09/2026</kyKKhaiDenNgay>
            <kyKKhaiTuThang />
            <kyKKhaiDenThang />
          </KyKKhaiThue>
          <maCQTNoiNop></maCQTNoiNop>
          <tenCQTNoiNop></tenCQTNoiNop>
          <ngayLapTKhai>2026-10-02</ngayLapTKhai>
          <GiaHan>
            <maLyDoGiaHan />
            <lyDoGiaHan />
          </GiaHan>
          <nguoiKy></nguoiKy>
          <ngayKy>2026-10-02</ngayKy>
          <nganhNgheKD></nganhNgheKD>
        </TKhaiThue>
        <NNT>
          <mst></mst>
          <tenNNT></tenNNT>
          <dchiNNT></dchiNNT>
          <tenXaNNT></tenXaNNT>
          <maXaNNT></maXaNNT>
          <maHuyenNNT />
          <tenHuyenNNT />
          <maTinhNNT></maTinhNNT>
          <tenTinhNNT></tenTinhNNT>
          <dthoaiNNT />
          <faxNNT />
          <emailNNT />
        </NNT>
      </TTinTKhaiThue>
    </TTinChung>
    <CTieuTKhaiChinh>
      <mst_cu></mst_cu>
      <ct15>0</ct15>
      <ct16>0</ct16>
      <ct17>0</ct17>
      <ct18>0</ct18>
      <ct19>0</ct19>
      <ct20>0</ct20>
      <ct21>0</ct21>
      <ct22>0</ct22>
      <ct23>0</ct23>
      <ct24>0</ct24>
      <ct25>0</ct25>
      <ct25_1>0</ct25_1>
      <ct26>0</ct26>
      <ct27>0</ct27>
      <ct28>0</ct28>
      <ct29>0</ct29>
      <ct30>0</ct30>
      <ct31>0</ct31>
      <ct32>0</ct32>
    </CTieuTKhaiChinh>
  </HSoKhaiThue>
</HSoThueDTu>`;

export const DEFAULT_TPL_QTT = `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue">
  <HSoKhaiThue id="ID_1">
    <TTinChung>
      <TTinDVu>
        <maDVu>HTKK</maDVu>
        <tenDVu>HỖ TRỢ KÊ KHAI THUẾ</tenDVu>
        <pbanDVu>5.7.9</pbanDVu>
        <ttinNhaCCapDVu>EE71B1F35C870757F8C69F274D98AB35</ttinNhaCCapDVu>
      </TTinDVu>
      <TTinTKhaiThue>
        <TKhaiThue>
          <maTKhai>953</maTKhai>
          <tenTKhai>TỜ KHAI QUYẾT TOÁN THUẾ THU NHẬP CÁ NHÂN (Mẫu số 05/QTT-TNCN)</tenTKhai>
          <moTaBMau>(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính)</moTaBMau>
          <pbanTKhaiXML>2.9.3</pbanTKhaiXML>
          <loaiTKhai>C</loaiTKhai>
          <soLan>0</soLan>
          <KyKKhaiThue>
            <kieuKy>Y</kieuKy>
            <kyKKhai>2025</kyKKhai>
            <kyKKhaiTuNgay />
            <kyKKhaiDenNgay />
            <kyKKhaiTuThang>01/2025</kyKKhaiTuThang>
            <kyKKhaiDenThang>12/2025</kyKKhaiDenThang>
          </KyKKhaiThue>
          <maCQTNoiNop></maCQTNoiNop>
          <tenCQTNoiNop></tenCQTNoiNop>
          <ngayLapTKhai>2026-10-14</ngayLapTKhai>
          <GiaHan>
            <maLyDoGiaHan />
            <lyDoGiaHan />
          </GiaHan>
          <nguoiKy></nguoiKy>
          <ngayKy>2026-10-14</ngayKy>
          <nganhNgheKD></nganhNgheKD>
        </TKhaiThue>
        <NNT>
          <mst></mst>
          <tenNNT></tenNNT>
          <dchiNNT></dchiNNT>
          <tenXaNNT></tenXaNNT>
          <maXaNNT></maXaNNT>
          <maHuyenNNT />
          <tenHuyenNNT />
          <maTinhNNT></maTinhNNT>
          <tenTinhNNT></tenTinhNNT>
          <dthoaiNNT />
          <faxNNT />
          <emailNNT />
        </NNT>
      </TTinTKhaiThue>
    </TTinChung>
    <CTieuTKhaiChinh>
      <mst_cu></mst_cu>
      <Header>
        <toChucCoQTTTheoUyQuyen>0</toChucCoQTTTheoUyQuyen>
        <ma_THQuyetToan>01</ma_THQuyetToan>
        <ten_THQuyetToan>QT định kỳ</ten_THQuyetToan>
        <hanNop />
      </Header>
      <NVuKhauTruThue>
        <ct16>0</ct16>
        <ct17>0</ct17>
        <ct18>0</ct18>
        <ct19>0</ct19>
        <ct20>0</ct20>
        <ct21>0</ct21>
        <ct22>0</ct22>
        <ct23>0</ct23>
        <ct24>0</ct24>
        <ct25>0</ct25>
        <ct26>0</ct26>
        <ct27>0</ct27>
        <ct28>0</ct28>
        <ct29>0</ct29>
        <ct30>0</ct30>
        <ct31>0</ct31>
        <ct32>0</ct32>
        <ct33>0</ct33>
        <ct34>0</ct34>
      </NVuKhauTruThue>
      <NVuQToanThay>
        <ct35>0</ct35>
        <ct36>0</ct36>
        <ct37>0</ct37>
        <ct38>0</ct38>
        <ct39>0</ct39>
        <ct40>0</ct40>
        <ct41>0</ct41>
      </NVuQToanThay>
    </CTieuTKhaiChinh>
  </HSoKhaiThue>
</HSoThueDTu>`;

const ddmmyyyy = (d: number, m: number, y: number) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

export function buildXml(tpl: string, coInfo: Record<string, string>, ngay: string, values: Record<string, any>): string {
  const doc = new DOMParser().parseFromString(tpl, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Mẫu XML không đọc được');
  const set = (tag: string, val: any) => {
    const e = doc.getElementsByTagName(tag)[0];
    if (!e) return;
    const s = val == null ? '' : String(val);
    if (s === '' && !e.textContent) return;
    e.textContent = s;
  };
  CO_FIELDS.forEach(([k]) => set(k, coInfo[k] || ''));
  set('mst_cu', coInfo.mst || '');
  set('ngayLapTKhai', ngay);
  set('ngayKy', ngay);
  set('loaiTKhai', 'C');
  set('soLan', '0');
  for (const [k, v] of Object.entries(values)) set(k, v);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc.documentElement);
}

export function buildKKXml(
  co: AzCompany,
  kkType: 'Q' | 'M',
  kkNum: number,
  kkYear: number,
  v: Record<string, number>,
  ngay = iso(TODAY)
): string {
  const m1 = kkType === 'Q' ? (kkNum - 1) * 3 + 1 : kkNum;
  const m2 = kkType === 'Q' ? kkNum * 3 : kkNum;
  const last = new Date(kkYear, m2, 0).getDate();
  const per =
    kkType === 'Q'
      ? { kieuKy: 'Q', kyKKhai: `${kkNum}/${kkYear}` }
      : { kieuKy: 'M', kyKKhai: `${String(m1).padStart(2, '0')}/${kkYear}` };
  const tpl = co.tpl?.kk || DEFAULT_TPL_KK;
  return buildXml(tpl, co.info, ngay, {
    ...per,
    kyKKhaiTuNgay: ddmmyyyy(1, m1, kkYear),
    kyKKhaiDenNgay: ddmmyyyy(last, m2, kkYear),
    kyKKhaiTuThang: '',
    kyKKhaiDenThang: '',
    ...v,
  });
}

export function buildQTTXml(co: AzCompany, qttYear: number, v: Record<string, number>, ngay = iso(TODAY)): string {
  const tpl = co.tpl?.qtt || DEFAULT_TPL_QTT;
  return buildXml(tpl, co.info, ngay, {
    kieuKy: 'Y',
    kyKKhai: String(qttYear),
    kyKKhaiTuNgay: '',
    kyKKhaiDenNgay: '',
    kyKKhaiTuThang: `01/${qttYear}`,
    kyKKhaiDenThang: `12/${qttYear}`,
    ...v,
  });
}

export function getKKFileName(mst: string, kkType: 'Q' | 'M', kkNum: number, kkYear: number): string {
  const p = kkType === 'Q' ? `Q${kkNum}${kkYear}` : `M${String(kkNum).padStart(2, '0')}${kkYear}`;
  return `${mst || '0000000000'}000-05_KK_TNCN_TT80-${p}-L00.xml`;
}

export function getQTTFileName(mst: string, qttYear: number): string {
  return `${mst || '0000000000'}000-05_QTT_TNCN_TT80-Y${qttYear}-L00.xml`;
}

export function bk1Aoa(qtt: ReturnType<typeof computeQTT>): any[][] {
  const head = [
    '[06] STT',
    '[07] Họ và tên',
    '[08] MST',
    '[09] Số CCCD/CMND',
    '[10] Ủy quyền QT thay',
    '[12] Tổng TNCT',
    '[13] TNCT tại tổ chức trước điều chuyển',
    '[14] TNCT miễn giảm theo Hiệp định',
    '[15] TNCT miễn theo HĐ dầu khí',
    '[16] Số NPT',
    '[17] Tổng giảm trừ gia cảnh',
    '[18] Từ thiện, nhân đạo, khuyến học',
    '[19] Bảo hiểm bắt buộc',
    '[20] Quỹ hưu trí tự nguyện',
    '[21] Thu nhập tính thuế',
    '[22] Thuế đã khấu trừ',
    '[23] Thuế đã khấu trừ trước điều chuyển',
    '[24] Thuế phải nộp',
    '[25] Thuế đã nộp thừa',
    '[26] Thuế còn phải nộp',
    '[27] Thuế được miễn (≤ 50.000 đ)',
  ];
  const rows = qtt.bk1.map((p: any, i: number) => [
    i + 1,
    p.name,
    p.mst,
    p.cccd,
    p.auth ? 'x' : '',
    p.tnct,
    0,
    0,
    0,
    p.nptMax,
    p.gt,
    p.khac,
    p.bh,
    0,
    p.tntt,
    p.thue,
    0,
    p.auth ? p.payable : '',
    p.auth ? p.thua : '',
    p.auth ? p.conNop : '',
    p.auth ? p.mien : '',
  ]);
  return [head, ...rows];
}

export function bk2Aoa(qtt: ReturnType<typeof computeQTT>): any[][] {
  const head = [
    'STT',
    'Họ và tên',
    'MST',
    'Số CCCD/CMND/Hộ chiếu',
    'Cá nhân không cư trú',
    'Tổng TNCT',
    'Thuế TNCN đã khấu trừ',
  ];
  return [
    head,
    ...qtt.bk2.map((p: any, i: number) => [i + 1, p.name, p.mst, p.cccd, p.resident ? '' : 'x', p.tnct, p.thue]),
  ];
}

/* ---------- Sổ quản lý lao động (Nghị định 145/2020/NĐ-CP) ---------- */
export const SO_HEAD = [
  'STT',
  'Họ và tên',
  'Giới tính',
  'Ngày sinh',
  'Quốc tịch',
  'Nơi cư trú',
  'Số CCCD/CMND/Hộ chiếu',
  'Trình độ chuyên môn, kỹ thuật',
  'Bậc trình độ kỹ năng nghề',
  'Vị trí việc làm',
  'Loại hợp đồng lao động',
  'Thời điểm bắt đầu làm việc',
  'Tham gia BHXH',
  'Tiền lương',
  'Nâng bậc, nâng lương',
  'Số ngày nghỉ trong năm',
  'Số giờ làm thêm',
  'Học nghề, đào tạo, bồi dưỡng',
  'Kỷ luật, trách nhiệm vật chất',
  'Tai nạn lao động, bệnh nghề nghiệp',
  'Thời điểm chấm dứt HĐ và lý do',
];

export function soRows(c: AzCompany, year: number): any[][] {
  return (c.employees || []).map((e, i) => {
    let phep = 0;
    let ot = 0;
    for (const [k, mo] of Object.entries(c.months || {})) {
      if (!k.startsWith(year + '-')) continue;
      const a = mo.att?.[e.id];
      if (a && a.d) phep += Object.values(a.d).filter((x) => x === 'P').length;
      const v = mo.var?.[e.id];
      if (v) ot += (num(v.ot1) || 0) + (num(v.ot2) || 0) + (num(v.ot3) || 0);
    }
    const ct = contractAt(c, e.id, iso(TODAY)) || empContracts(c, e.id).slice(-1)[0];
    const pcTotal = (c.allowances || []).reduce((t, a) => t + (num(e.pc?.[a.id]) || 0), 0);
    return [
      i + 1,
      e.ten,
      e.gt,
      dmy(e.ns),
      e.qt,
      e.diaChi,
      e.cccd,
      e.trinhDo,
      e.bacNghe,
      e.viTri,
      ct ? CT_TYPES[ct.loai] + (ct.so ? ` (${ct.so})` : '') : '',
      dmy(e.vaoLam),
      e.bh === 'Có' ? `Có${e.soBHXH ? ' · sổ ' + e.soBHXH : ''}` : 'Không',
      `${fmt(e.luongCB)}${pcTotal ? ` + PC ${fmt(pcTotal)}` : ''}`,
      e.nangLuong,
      phep,
      ot,
      e.daoTao,
      e.kyLuat,
      e.tnld,
      e.nghiViec ? `${dmy(e.nghiViec)}${e.lyDoNghi ? ' · ' + e.lyDoNghi : ''}` : '',
    ];
  });
}

/* ---------- Nhập nhân viên từ Excel ---------- */
export const IMPORT_MAP: Array<[string, RegExp]> = [
  ['ma', /^ma( nv| nhan vien)?$|ma so nv/],
  ['ten', /ho (va )?ten|ten nhan vien/],
  ['gt', /gioi tinh/],
  ['ns', /ngay sinh/],
  ['qt', /quoc tich/],
  ['diaChi', /noi cu tru|dia chi|thuong tru/],
  ['cccd', /cccd|cmnd|can cuoc|ho chieu|dinh danh/],
  ['mst', /\bmst\b|ma so thue/],
  ['trinhDo', /trinh do/],
  ['bacNghe', /bac nghe|bac tho|ky nang nghe/],
  ['viTri', /vi tri|chuc vu|chuc danh/],
  ['phong', /phong ban|bo phan|^phong$/],
  ['vaoLam', /ngay vao|bat dau lam|ngay lam viec/],
  ['nghiViec', /ngay nghi|cham dut/],
  ['luongCB', /luong co ban|luong cb|muc luong|luong hop dong/],
  ['luongBH', /luong (dong|tinh) (bh|bao hiem)/],
  ['npt', /phu thuoc|npt/],
  ['cuTru', /cu tru/],
  ['bh', /tham gia bh|dong bhxh/],
  ['soBHXH', /so so|so bhxh/],
  ['nh', /ngan hang/],
  ['stk', /so tai khoan|stk|so tk/],
  ['cn', /chi nhanh/],
  ['sdt', /dien thoai|sdt/],
  ['email', /email/],
  ['ctLoai', /loai hop dong|loai hd/],
  ['ctSo', /so hop dong|so hd/],
  ['ctTu', /hd tu ngay|ngay ky|hieu luc tu/],
  ['ctDen', /hd den ngay|het han|den ngay/],
];

export function importEmployeesIntoCompany(c: AzCompany, aoa: any[][]): { added: number; updated: number; error?: string } {
  let hr = -1;
  let map: Record<string, number> = {};
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const h = (aoa[i] || []).map((x) => norm(x));
    const mm: Record<string, number> = {};
    h.forEach((t, j) => {
      if (!t) return;
      for (const [f, re] of IMPORT_MAP) {
        if (mm[f] == null && re.test(t)) {
          mm[f] = j;
          break;
        }
      }
    });
    (c.allowances || []).forEach((a) => {
      const j = h.findIndex((t) => t && t === norm(a.name));
      if (j >= 0) mm['pc:' + a.id] = j;
    });
    if (mm.ten != null && Object.keys(mm).length > (Object.keys(map).length || 1)) {
      hr = i;
      map = mm;
    }
  }
  if (hr < 0) return { added: 0, updated: 0, error: 'Không tìm thấy cột Họ và tên trong file Excel' };
  let added = 0;
  let updated = 0;
  for (let i = hr + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const ten = String(r[map.ten] ?? '').trim();
    if (!ten || /^(tong|cong)\b/.test(norm(ten)) || /^\d+$/.test(ten)) continue;
    const cccd = String(r[map.cccd] ?? '').replace(/[\s'’]/g, '');
    const mst = String(r[map.mst] ?? '').replace(/[\s'’]/g, '');
    let e = c.employees.find(
      (x) => (cccd && x.cccd === cccd) || (mst && x.mst === mst) || (!cccd && !mst && norm(x.ten) === norm(ten))
    );
    const isNew = !e;
    if (!e) e = blankEmp();
    for (const [f] of IMPORT_MAP) {
      if (map[f] == null || f.startsWith('ct')) continue;
      const v = r[map[f]];
      if (v == null || v === '') continue;
      if (['ns', 'vaoLam', 'nghiViec'].includes(f)) e[f] = toIsoDate(v) || e[f];
      else if (['luongCB', 'luongBH', 'npt'].includes(f)) e[f] = num(v) || 0;
      else if (f === 'cuTru' || f === 'bh') e[f] = /^(khong|k|0|no)$/.test(norm(v)) ? 'Không' : 'Có';
      else if (f === 'gt') e[f] = /nu/.test(norm(v)) ? 'Nữ' : 'Nam';
      else e[f] = String(v).replace(/^'/, '').trim();
    }
    e.ten = ten;
    e.cccd = cccd || e.cccd;
    e.mst = mst || e.mst;
    (c.allowances || []).forEach((a) => {
      const j = map['pc:' + a.id];
      if (j != null && r[j] != null && r[j] !== '') e!.pc[a.id] = num(r[j]) || 0;
    });
    if (isNew) {
      c.employees.push(e);
      added++;
    } else {
      updated++;
    }
    if (map.ctLoai != null && r[map.ctLoai]) {
      const t = norm(r[map.ctLoai]);
      const loai: AzContract['loai'] = /khong xac dinh|kxd/.test(t)
        ? 'KXD'
        : /thu viec|tv/.test(t)
        ? 'TV'
        : /dich vu|ctv|cong tac|khoan/.test(t)
        ? 'DV'
        : 'XD';
      const tu = toIsoDate(r[map.ctTu]) || e.vaoLam;
      const den = toIsoDate(r[map.ctDen]);
      if (!c.contracts.some((x) => x.empId === e!.id && x.tu === tu && x.loai === loai)) {
        c.contracts.push({
          id: uid(),
          empId: e.id,
          loai,
          so: String(r[map.ctSo] ?? ''),
          tu,
          den: loai === 'KXD' ? '' : den,
          luong: e.luongCB,
          ghiChu: '',
        });
      }
    }
  }
  return { added, updated };
}

export function empTemplateAoa(c: AzCompany): string[] {
  return [
    'Mã NV',
    'Họ và tên',
    'Giới tính',
    'Ngày sinh',
    'Quốc tịch',
    'Nơi cư trú',
    'Số CCCD/Hộ chiếu',
    'MST cá nhân',
    'Trình độ chuyên môn',
    'Bậc nghề',
    'Vị trí/Chức vụ',
    'Phòng ban',
    'Ngày vào làm',
    'Lương cơ bản',
    'Lương đóng BH',
    'Tham gia BH (Có/Không)',
    'Số sổ BHXH',
    'Cư trú (Có/Không)',
    'Số người phụ thuộc',
    'Ngân hàng',
    'Số tài khoản',
    'Chi nhánh',
    'Điện thoại',
    'Email',
    'Loại hợp đồng',
    'Số hợp đồng',
    'HĐ từ ngày',
    'HĐ đến ngày',
    ...(c.allowances || []).map((a) => a.name),
  ];
}

/* ---------- Xuất file Excel & XML ---------- */
const COPY_WATERMARK = 'Hệ thống Quản trị Doanh nghiệp MYERP · Kế Toán A-Z Nhân Sự & Lương';

function sheetX(aoa: any[][], widths?: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (widths || aoa[Math.min(aoa.length - 1, 3)] || []).map((w: any, i: number) => ({
    wch: typeof w === 'number' ? w : Math.max(10, Math.min(40, String(aoa[3]?.[i] ?? w ?? '').length + 2)),
  }));
  return ws;
}

function headerRows(c: AzCompany, title: string, sub?: string) {
  const i = c.info || {};
  return [[i.tenNNT || ''], [`MST: ${i.mst || ''}`], [title], [sub || ''], []];
}

export function downloadExcelSheets(filename: string, sheets: Array<[string, XLSX.WorkSheet]>): void {
  const wb = XLSX.utils.book_new();
  sheets.forEach(([n, ws]) => XLSX.utils.book_append_sheet(wb, ws, n));
  XLSX.writeFile(wb, filename);
}

export function exportEmployeeTemplateExcel(c: AzCompany): void {
  const head = empTemplateAoa(c);
  const sampleRow = [
    'NV001',
    'Nguyễn Văn A',
    'Nam',
    '15/03/1990',
    'Việt Nam',
    'Số 1, đường A, phường B',
    '079090000001',
    '8000000001',
    'Đại học',
    '',
    'Kế toán',
    'Kế toán',
    '01/06/2024',
    12000000,
    '',
    'Có',
    '',
    'Có',
    1,
    'Vietcombank',
    '0001000000001',
    '',
    '',
    '',
    'Xác định thời hạn',
    '01/2024/HĐLĐ',
    '01/06/2024',
    '31/05/2027',
    ...(c.allowances || []).map(() => ''),
  ];
  downloadExcelSheets('Mau_nhap_nhan_vien.xlsx', [['Nhan vien', sheetX([head, sampleRow], head.map(() => 16))]]);
}

export function exportEmployeesExcel(c: AzCompany): void {
  const head = empTemplateAoa(c);
  const rows = (c.employees || []).map((e) => {
    const ct = empContracts(c, e.id).slice(-1)[0];
    return [
      e.ma,
      e.ten,
      e.gt,
      dmy(e.ns),
      e.qt,
      e.diaChi,
      e.cccd,
      e.mst,
      e.trinhDo,
      e.bacNghe,
      e.viTri,
      e.phong,
      dmy(e.vaoLam),
      e.luongCB,
      e.luongBH || '',
      e.bh,
      e.soBHXH,
      e.cuTru,
      e.npt,
      e.nh,
      e.stk,
      e.cn,
      e.sdt,
      e.email,
      ct ? CT_TYPES[ct.loai] : '',
      ct?.so || '',
      dmy(ct?.tu),
      dmy(ct?.den),
      ...(c.allowances || []).map((a) => num(e.pc?.[a.id]) || ''),
    ];
  });
  downloadExcelSheets('Danh_sach_nhan_vien.xlsx', [['Nhan vien', sheetX([head, ...rows], head.map(() => 16))]]);
}

export function exportContractsExcel(c: AzCompany): void {
  const byE = Object.fromEntries((c.employees || []).map((e) => [e.id, e]));
  const aoa = [
    ['Nhân viên', 'Số HĐ', 'Loại', 'Từ ngày', 'Đến ngày', 'Mức lương', 'Ghi chú'],
    ...(c.contracts || []).map((x) => [
      byE[x.empId]?.ten || '',
      x.so,
      CT_TYPES[x.loai] || x.loai,
      dmy(x.tu),
      dmy(x.den),
      x.luong,
      x.ghiChu,
    ]),
  ];
  downloadExcelSheets('Hop_dong_lao_dong.xlsx', [['Hop dong', sheetX(aoa, [26, 16, 30, 12, 12, 14, 24])]]);
}

export function exportAttendanceExcel(c: AzCompany, k: string): void {
  const { y, m } = ymParse(k);
  const md = monthDays(y, m, c.cfg);
  const head = [
    'STT',
    'Họ và tên',
    ...md.days.map((d) => `${d.d}`),
    'Công làm',
    'Phép',
    'Lễ',
    'Nghỉ KL',
    'Ốm',
    'Công TL',
    'TC thường',
    'TC nghỉ tuần',
    'TC lễ',
  ];
  const body = (c.employees || [])
    .filter((e) => inService(e, y, m))
    .map((e, i) => {
      const a = c.months[k]?.att?.[e.id] || { d: {} };
      const s = attSummary(c, e, k);
      const v = c.months[k]?.var?.[e.id] || {};
      return [
        i + 1,
        e.ten,
        ...md.days.map((d) => a.d[String(d.d)] || ''),
        s.work,
        s.P,
        s.L,
        s.kl,
        s.om,
        s.congTL,
        v.ot1 || 0,
        v.ot2 || 0,
        v.ot3 || 0,
      ];
    });
  const aoa = [
    ...headerRows(
      c,
      `BẢNG CHẤM CÔNG THÁNG ${ymLabel(k)}`,
      'X: đủ ngày · N: nửa ngày · P: phép · L: lễ · R: nghỉ có lương · KL: không lương · O: ốm/thai sản'
    ),
    head,
    ...body,
    [],
    [COPY_WATERMARK],
  ];
  downloadExcelSheets(`Cham_cong_${k}.xlsx`, [
    ['Cham cong', sheetX(aoa, head.map((_, j) => (j === 1 ? 26 : j < 2 ? 5 : 4)))],
  ]);
}

export function exportPayrollExcel(c: AzCompany, k: string): void {
  const rows = payroll(c, k);
  const head = [
    'STT',
    'Mã NV',
    'Họ và tên',
    'Chức vụ',
    'Lương cơ bản',
    'Công chuẩn',
    'Công tính lương',
    'Lương theo công',
    ...(c.allowances || []).map((a) => a.name),
    'Tiền làm thêm',
    'Thưởng',
    'TN khác miễn thuế',
    'Tổng thu nhập',
    'TN miễn thuế',
    'TN chịu thuế',
    'Lương đóng BH',
    'BHXH 8%',
    'BHYT 1,5%',
    'BHTN 1%',
    'Đoàn phí',
    'Số NPT',
    'Giảm trừ gia cảnh',
    'TN tính thuế',
    'Thuế TNCN',
    'Tạm ứng',
    'Khấu trừ khác',
    'Thực lĩnh',
    'Ký nhận',
  ];
  const body = rows.map((r, i) => [
    i + 1,
    r.e.ma,
    r.e.ten,
    r.e.viTri,
    r.luongCB,
    r.s.congChuan,
    r.s.congTL,
    r.lTheoCong,
    ...r.pcList.map((x) => x.val),
    r.ot,
    r.thuong,
    r.khacMien,
    r.gross,
    r.mien,
    r.tnct,
    r.luongBH,
    r.nld.bhxh,
    r.nld.bhyt,
    r.nld.bhtn,
    r.doanPhi,
    r.npt,
    r.gt,
    r.tntt,
    r.thue,
    r.tamUng,
    r.khauTru,
    r.net,
    '',
  ]);
  const sumRow = head.map((_, j) =>
    j === 2
      ? 'Tổng cộng'
      : j >= 4 && j !== 5 && j !== 6 && typeof body[0]?.[j] === 'number'
      ? body.reduce((t, r) => t + (Number(r[j]) || 0), 0)
      : ''
  );
  const aoa = [
    ...headerRows(c, `BẢNG THANH TOÁN TIỀN LƯƠNG THÁNG ${ymLabel(k)}`),
    head,
    ...body,
    sumRow,
    [],
    ['Người lập biểu', '', '', 'Kế toán trưởng', '', '', '', 'Giám đốc'],
    [],
    [],
    [],
    [COPY_WATERMARK],
  ];
  const ws = sheetX(aoa, head.map((_, j) => (j === 2 ? 26 : j === 3 ? 18 : 13)));
  const dn = rows.map((r, i) => [
    i + 1,
    r.e.ten,
    r.luongBH,
    r.dn.bhxh,
    r.dn.bhyt,
    r.dn.bhtn,
    r.dn.kpcd,
    r.nld.bhxh + r.nld.bhyt + r.nld.bhtn,
    r.bhNLD + r.bhDN,
  ]);
  const ws2 = sheetX(
    [
      ...headerRows(c, `BẢNG TRÍCH BẢO HIỂM THÁNG ${ymLabel(k)}`),
      [
        'STT',
        'Họ và tên',
        'Lương đóng BH',
        'BHXH DN 17,5%',
        'BHYT DN 3%',
        'BHTN DN 1%',
        'KPCĐ 2%',
        'BH NLĐ 10,5%',
        'Tổng BH phải nộp',
      ],
      ...dn,
    ],
    [6, 26, 14, 14, 14, 14, 14, 14, 16]
  );
  downloadExcelSheets(`Bang_luong_${k}.xlsx`, [
    ['Bang luong', ws],
    ['Trich BH', ws2],
  ]);
}

export function exportPayslipsExcel(c: AzCompany, k: string): void {
  const rows = payroll(c, k);
  const aoa: any[][] = [];
  for (const r of rows) {
    aoa.push(
      [c.info.tenNNT],
      [`PHIẾU LƯƠNG THÁNG ${ymLabel(k)}`],
      [`Họ và tên: ${r.e.ten}`, '', `Chức vụ: ${r.e.viTri || ''}`]
    );
    for (const x of slipLines(r)) {
      if (x[0] === 'h') aoa.push([String(x[1]).toUpperCase()]);
      else if (x[0] === 'tot') aoa.push([x[1], x[2]]);
      else aoa.push([x[0], x[1]]);
    }
    aoa.push(['Người nhận ký', '', 'Người lập phiếu'], [], ['- - - - - - - - - - - - - - - - - - - -'], []);
  }
  aoa.push([COPY_WATERMARK]);
  downloadExcelSheets(`Phieu_luong_${k}.xlsx`, [['Phieu luong', sheetX(aoa, [52, 18, 26])]]);
}

export function exportBankTransferExcel(c: AzCompany, k: string, ckNote?: string): void {
  const rows = payroll(c, k).filter((r) => r.net > 0);
  const nd = ckNote || `Luong thang ${ymLabel(k)}`;
  const aoa = [
    ['STT', 'Họ và tên', 'Số tài khoản', 'Ngân hàng', 'Chi nhánh', 'Số tiền', 'Nội dung'],
    ...rows.map((r, i) => [i + 1, r.e.ten, r.e.stk, r.e.nh, r.e.cn, r.net, nd]),
  ];
  const ws = sheetX(aoa, [6, 28, 20, 18, 18, 16, 26]);
  rows.forEach((r, i) => {
    const cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: 2 })];
    if (cell) {
      cell.t = 's';
      cell.v = String(r.e.stk || '');
    }
  });
  downloadExcelSheets(`Chi_luong_ngan_hang_${k}.xlsx`, [['Chi luong', ws]]);
}

export function exportQttAppendicesExcel(qtt: ReturnType<typeof computeQTT>, qttYear: number): void {
  const b1 = bk1Aoa(qtt);
  const b2 = bk2Aoa(qtt);
  const ws1 = XLSX.utils.aoa_to_sheet(b1);
  ws1['!cols'] = b1[0].map((h) => ({ wch: Math.max(10, Math.min(36, String(h).length + 2)) }));
  const ws2 = XLSX.utils.aoa_to_sheet(b2);
  ws2['!cols'] = b2[0].map((h) => ({ wch: Math.max(10, Math.min(36, String(h).length + 2)) }));
  downloadExcelSheets(`Bang_ke_QTT_TNCN_${qttYear}.xlsx`, [
    ['05-1BK', ws1],
    ['05-2BK', ws2],
  ]);
}

export function exportLaborBookExcel(c: AzCompany, year: number): void {
  const aoa = [
    ...headerRows(c, `SỔ QUẢN LÝ LAO ĐỘNG NĂM ${year}`, 'Theo khoản 2 Điều 3 Nghị định 145/2020/NĐ-CP'),
    SO_HEAD,
    ...soRows(c, year),
    [],
    [COPY_WATERMARK],
  ];
  downloadExcelSheets(`So_quan_ly_lao_dong_${year}.xlsx`, [
    ['So QLLD', sheetX(aoa, SO_HEAD.map((_, j) => (j === 1 ? 26 : j === 0 ? 5 : 18)))],
  ]);
}
