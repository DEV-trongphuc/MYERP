/**
 * Danh mục các ngân hàng Việt Nam & Helper tạo mã VietQR chuẩn NAPAS
 * Đồng bộ danh sách & logo chính thức từ VietQR API (https://api.vietqr.io/v2/banks)
 */

export interface VietnamBank {
  name: string;
  shortName: string;
  code: string;
  bin: string;
  logo?: string;
  aliases?: string[];
}

export const VIETNAM_BANKS: VietnamBank[] = [
  {
    "name": "Ngân hàng TMCP Ngoại Thương Việt Nam",
    "shortName": "Vietcombank",
    "code": "VCB",
    "bin": "970436",
    "logo": "https://cdn.vietqr.io/img/VCB.png",
    "aliases": [
      "vcb",
      "vietcombank",
      "vietcom bank",
      "vietcom",
      "ngoại thương",
      "ngoai thuong"
    ]
  },
  {
    "name": "Ngân hàng TMCP Kỹ thương Việt Nam",
    "shortName": "Techcombank",
    "code": "TCB",
    "bin": "970407",
    "logo": "https://cdn.vietqr.io/img/TCB.png",
    "aliases": [
      "tcb",
      "techcombank",
      "techcom bank",
      "techcom",
      "kỹ thương",
      "ky thuong"
    ]
  },
  {
    "name": "Ngân hàng TMCP Quân đội",
    "shortName": "MBBank",
    "code": "MB",
    "bin": "970422",
    "logo": "https://cdn.vietqr.io/img/MB.png",
    "aliases": [
      "mb",
      "mbbank",
      "mb bank",
      "military bank",
      "quân đội",
      "quan doi"
    ]
  },
  {
    "name": "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
    "shortName": "BIDV",
    "code": "BIDV",
    "bin": "970418",
    "logo": "https://cdn.vietqr.io/img/BIDV.png",
    "aliases": [
      "bidv",
      "đầu tư và phát triển",
      "dau tu va phat trien",
      "đầu tư phát triển"
    ]
  },
  {
    "name": "Ngân hàng TMCP Công thương Việt Nam",
    "shortName": "VietinBank",
    "code": "ICB",
    "bin": "970415",
    "logo": "https://cdn.vietqr.io/img/ICB.png",
    "aliases": [
      "icb",
      "vietinbank",
      "vietin bank",
      "vietin",
      "ctg",
      "công thương",
      "cong thuong"
    ]
  },
  {
    "name": "Ngân hàng TMCP Á Châu",
    "shortName": "ACB",
    "code": "ACB",
    "bin": "970416",
    "logo": "https://cdn.vietqr.io/img/ACB.png",
    "aliases": [
      "acb",
      "acbank",
      "ac bank",
      "á châu",
      "a chau"
    ]
  },
  {
    "name": "Ngân hàng TMCP Việt Nam Thịnh Vượng",
    "shortName": "VPBank",
    "code": "VPB",
    "bin": "970432",
    "logo": "https://cdn.vietqr.io/img/VPB.png",
    "aliases": [
      "vpb",
      "vpbank",
      "vp bank",
      "việt nam thịnh vượng",
      "viet nam thinh vuong"
    ]
  },
  {
    "name": "Ngân hàng TMCP Tiên Phong",
    "shortName": "TPBank",
    "code": "TPB",
    "bin": "970423",
    "logo": "https://cdn.vietqr.io/img/TPB.png",
    "aliases": [
      "tpb",
      "tpbank",
      "tp bank",
      "tiên phong",
      "tien phong"
    ]
  },
  {
    "name": "Ngân hàng TMCP Sài Gòn Thương Tín",
    "shortName": "Sacombank",
    "code": "STB",
    "bin": "970403",
    "logo": "https://cdn.vietqr.io/img/STB.png",
    "aliases": [
      "stb",
      "sacombank",
      "sacom bank",
      "sacom",
      "sài gòn thương tín",
      "sai gon thuong tin"
    ]
  },
  {
    "name": "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
    "shortName": "Agribank",
    "code": "VBA",
    "bin": "970405",
    "logo": "https://cdn.vietqr.io/img/VBA.png",
    "aliases": [
      "vba",
      "agribank",
      "agri bank",
      "agri",
      "nông nghiệp",
      "nong nghiep"
    ]
  },
  {
    "name": "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh",
    "shortName": "HDBank",
    "code": "HDB",
    "bin": "970437",
    "logo": "https://cdn.vietqr.io/img/HDB.png",
    "aliases": [
      "hdb",
      "hdbank",
      "hd bank",
      "hd",
      "phát triển tp.hcm",
      "phat trien tp.hcm",
      "phat trien tphcm",
      "phát triển tp hcm",
      "phat trien",
      "ngân hàng hd",
      "ngan hang hd"
    ]
  },
  {
    "name": "Ngân hàng TMCP Quốc tế Việt Nam",
    "shortName": "VIB",
    "code": "VIB",
    "bin": "970441",
    "logo": "https://cdn.vietqr.io/img/VIB.png",
    "aliases": [
      "vib",
      "vib bank",
      "quốc tế",
      "quoc te"
    ]
  },
  {
    "name": "Ngân hàng TMCP Sài Gòn - Hà Nội",
    "shortName": "SHB",
    "code": "SHB",
    "bin": "970443",
    "logo": "https://cdn.vietqr.io/img/SHB.png",
    "aliases": [
      "shb",
      "sh bank",
      "sài gòn - hà nội",
      "sai gon ha noi"
    ]
  },
  {
    "name": "Ngân hàng TMCP Hàng Hải Việt Nam",
    "shortName": "MSB",
    "code": "MSB",
    "bin": "970426",
    "logo": "https://cdn.vietqr.io/img/MSB.png",
    "aliases": [
      "msb",
      "ms bank",
      "maritime bank",
      "hàng hải",
      "hang hai"
    ]
  },
  {
    "name": "Ngân hàng TMCP Phương Đông",
    "shortName": "OCB",
    "code": "OCB",
    "bin": "970448",
    "logo": "https://cdn.vietqr.io/img/OCB.png",
    "aliases": [
      "ocb",
      "oc bank",
      "phương đông",
      "phuong dong"
    ]
  },
  {
    "name": "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam",
    "shortName": "Eximbank",
    "code": "EIB",
    "bin": "970431",
    "logo": "https://cdn.vietqr.io/img/EIB.png",
    "aliases": [
      "eib",
      "eximbank",
      "exim bank",
      "xuất nhập khẩu",
      "xuat nhap khau"
    ]
  },
  {
    "name": "Ngân hàng TMCP Lộc Phát Việt Nam",
    "shortName": "LPBank",
    "code": "LPB",
    "bin": "970449",
    "logo": "https://cdn.vietqr.io/img/LPB.png",
    "aliases": [
      "lpb",
      "lpbank",
      "lp bank",
      "lộc phát",
      "loc phat",
      "lienvietpostbank",
      "lien viet post bank",
      "bưu điện liên việt"
    ]
  },
  {
    "name": "Ngân hàng TMCP Bản Việt",
    "shortName": "VietCapitalBank",
    "code": "VCCB",
    "bin": "970454",
    "logo": "https://cdn.vietqr.io/img/VCCB.png",
    "aliases": [
      "bvbank",
      "bv bank",
      "bản việt",
      "ban viet",
      "vietcapital bank",
      "vccb"
    ]
  },
  {
    "name": "Ngân hàng TMCP Bắc Á",
    "shortName": "BacABank",
    "code": "BAB",
    "bin": "970409",
    "logo": "https://cdn.vietqr.io/img/BAB.png",
    "aliases": [
      "bab",
      "bacabank",
      "bac a bank",
      "bắc á",
      "bac a"
    ]
  },
  {
    "name": "Ngân hàng TMCP Đại Chúng Việt Nam",
    "shortName": "PVcomBank",
    "code": "PVCB",
    "bin": "970412",
    "logo": "https://cdn.vietqr.io/img/PVCB.png",
    "aliases": [
      "pvcb",
      "pvcombank",
      "pvcom bank",
      "đại chúng",
      "dai chung"
    ]
  },
  {
    "name": "Ngân hàng TNHH MTV Shinhan Việt Nam",
    "shortName": "ShinhanBank",
    "code": "SHBVN",
    "bin": "970424",
    "logo": "https://cdn.vietqr.io/img/SHBVN.png",
    "aliases": [
      "shbvn",
      "shinhan",
      "shinhan bank"
    ]
  },
  {
    "name": "Ngân hàng TNHH MTV Woori Việt Nam",
    "shortName": "Woori",
    "code": "WVN",
    "bin": "970457",
    "logo": "https://cdn.vietqr.io/img/WVN.png",
    "aliases": [
      "woo",
      "woori",
      "woori bank",
      "wvn"
    ]
  },
  {
    "name": "Ngân hàng TMCP Kiên Long",
    "shortName": "KienLongBank",
    "code": "KLB",
    "bin": "970452",
    "logo": "https://cdn.vietqr.io/img/KLB.png",
    "aliases": [
      "klb",
      "kienlongbank",
      "kien long bank",
      "kiên long",
      "kien long"
    ]
  },
  {
    "name": "Ngân hàng TMCP Việt Á",
    "shortName": "VietABank",
    "code": "VAB",
    "bin": "970427",
    "logo": "https://cdn.vietqr.io/img/VAB.png",
    "aliases": [
      "vab",
      "vietabank",
      "viet a bank",
      "việt á",
      "viet a"
    ]
  },
  {
    "name": "Ngân hàng TMCP Nam Á",
    "shortName": "NamABank",
    "code": "NAB",
    "bin": "970428",
    "logo": "https://cdn.vietqr.io/img/NAB.png",
    "aliases": [
      "nab",
      "nam a bank",
      "namabank",
      "nam á",
      "nam a"
    ]
  },
  {
    "name": "Ngân hàng TMCP Thịnh vượng và Phát triển",
    "shortName": "PGBank",
    "code": "PGB",
    "bin": "970430",
    "logo": "https://cdn.vietqr.io/img/PGB.png",
    "aliases": [
      "pgb",
      "pgbank",
      "pg bank",
      "thịnh vượng và phát triển",
      "xăng dầu",
      "xang dau"
    ]
  },
  {
    "name": "Ngân hàng TMCP Sài Gòn Công Thương",
    "shortName": "SaigonBank",
    "code": "SGICB",
    "bin": "970400",
    "logo": "https://cdn.vietqr.io/img/SGICB.png",
    "aliases": [
      "sgicb",
      "saigonbank",
      "saigon bank",
      "sài gòn công thương"
    ]
  },
  {
    "name": "Ngân hàng TMCP Bảo Việt",
    "shortName": "BaoVietBank",
    "code": "BVB",
    "bin": "970438",
    "logo": "https://cdn.vietqr.io/img/BVB.png",
    "aliases": [
      "bvb",
      "baoviet bank",
      "baovietbank",
      "bảo việt",
      "bao viet"
    ]
  },
  {
    "name": "TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank",
    "shortName": "CAKE",
    "code": "CAKE",
    "bin": "546034",
    "logo": "https://cdn.vietqr.io/img/CAKE.png",
    "aliases": [
      "cake",
      "cake by vpbank"
    ]
  },
  {
    "name": "Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)",
    "shortName": "Timo",
    "code": "TIMO",
    "bin": "963388",
    "logo": "https://vietqr.net/portal-service/resources/icons/TIMO.png",
    "aliases": [
      "timo",
      "timo bank"
    ]
  },
  {
    "name": "Tổng Công ty Dịch vụ số Viettel - Chi nhánh tập đoàn công nghiệp viễn thông Quân Đội",
    "shortName": "ViettelMoney",
    "code": "VTLMONEY",
    "bin": "971005",
    "logo": "https://cdn.vietqr.io/img/VIETTELMONEY.png",
    "aliases": [
      "viettel money",
      "viettelpay",
      "viettelmoney"
    ]
  },
  {
    "name": "VNPT Money",
    "shortName": "VNPTMoney",
    "code": "VNPTMONEY",
    "bin": "971011",
    "logo": "https://cdn.vietqr.io/img/VNPTMONEY.png",
    "aliases": [
      "vnpt money",
      "vnptpay",
      "vnptmoney"
    ]
  },
  {
    "name": "Ngân hàng TMCP Đông Nam Á",
    "shortName": "SeABank",
    "code": "SEAB",
    "bin": "970440",
    "logo": "https://cdn.vietqr.io/img/SEAB.png",
    "aliases": [
      "seab",
      "seabank",
      "sea bank",
      "đông nam á",
      "dong nam a"
    ]
  },
  {
    "name": "Ngân hàng TMCP An Bình",
    "shortName": "ABBANK",
    "code": "ABB",
    "bin": "970425",
    "logo": "https://cdn.vietqr.io/img/ABB.png",
    "aliases": [
      "abb",
      "abbank",
      "an bình",
      "an binh"
    ]
  },
  {
    "name": "Ngân hàng TMCP Việt Nam Thương Tín",
    "shortName": "VietBank",
    "code": "VIETBANK",
    "bin": "970433",
    "logo": "https://cdn.vietqr.io/img/VIETBANK.png",
    "aliases": [
      "vietbank",
      "việt nam thương tín",
      "viet nam thuong tin"
    ]
  },
  {
    "name": "Ngân hàng Hợp tác xã Việt Nam",
    "shortName": "COOPBANK",
    "code": "COOPBANK",
    "bin": "970446",
    "logo": "https://cdn.vietqr.io/img/COOPBANK.png",
    "aliases": [
      "coopbank",
      "hợp tác xã",
      "hop tac xa"
    ]
  },
  {
    "name": "Ngân hàng Đại chúng TNHH Kasikornbank",
    "shortName": "KBank",
    "code": "KBank",
    "bin": "668888",
    "logo": "https://cdn.vietqr.io/img/KBANK.png",
    "aliases": [
      "kbank",
      "kasikornbank"
    ]
  },
  {
    "name": "Ngân hàng TNHH MTV HSBC (Việt Nam)",
    "shortName": "HSBC",
    "code": "HSBC",
    "bin": "458761",
    "logo": "https://cdn.vietqr.io/img/HSBC.png",
    "aliases": [
      "hsbc",
      "hsbc vietnam"
    ]
  },
  {
    "name": "Ngân hàng TNHH MTV Standard Chartered Bank Việt Nam",
    "shortName": "StandardChartered",
    "code": "SCVN",
    "bin": "970410",
    "logo": "https://cdn.vietqr.io/img/SCVN.png",
    "aliases": [
      "scvn",
      "standard chartered"
    ]
  },
  {
    "name": "Ngân hàng TNHH MTV CIMB Việt Nam",
    "shortName": "CIMB",
    "code": "CIMB",
    "bin": "422589",
    "logo": "https://cdn.vietqr.io/img/CIMB.png"
  },
  {
    "name": "DBS Bank Ltd - Chi nhánh Thành phố Hồ Chí Minh",
    "shortName": "DBSBank",
    "code": "DBS",
    "bin": "796500",
    "logo": "https://cdn.vietqr.io/img/DBS.png"
  },
  {
    "name": "Ngân hàng Citibank, N.A. - Chi nhánh Hà Nội",
    "shortName": "Citibank",
    "code": "CITIBANK",
    "bin": "533948",
    "logo": "https://cdn.vietqr.io/img/CITIBANK.png"
  },
  {
    "name": "Ngân hàng TNHH MTV Hong Leong Việt Nam",
    "shortName": "HongLeong",
    "code": "HLBVN",
    "bin": "970442",
    "logo": "https://cdn.vietqr.io/img/HLBVN.png"
  },
  {
    "name": "Ngân hàng United Overseas - Chi nhánh TP. Hồ Chí Minh",
    "shortName": "UnitedOverseas",
    "code": "UOB",
    "bin": "970458",
    "logo": "https://cdn.vietqr.io/img/UOB.png"
  },
  {
    "name": "Ngân hàng Thương mại TNHH MTV Xây dựng Việt Nam",
    "shortName": "CBBank",
    "code": "CBB",
    "bin": "970444",
    "logo": "https://cdn.vietqr.io/img/CBB.png"
  },
  {
    "name": "Ngân hàng Thương mại TNHH MTV Dầu Khí Toàn Cầu",
    "shortName": "GPBank",
    "code": "GPB",
    "bin": "970408",
    "logo": "https://cdn.vietqr.io/img/GPB.png"
  },
  {
    "name": "Ngân hàng Liên doanh Việt - Nga",
    "shortName": "VRB",
    "code": "VRB",
    "bin": "970421",
    "logo": "https://cdn.vietqr.io/img/VRB.png"
  },
  {
    "name": "Ngân hàng TNHH Indovina",
    "shortName": "IndovinaBank",
    "code": "IVB",
    "bin": "970434",
    "logo": "https://cdn.vietqr.io/img/IVB.png"
  },
  {
    "name": "Ngân hàng TNHH MTV Public Việt Nam",
    "shortName": "PublicBank",
    "code": "PBVN",
    "bin": "970439",
    "logo": "https://cdn.vietqr.io/img/PBVN.png"
  },
  {
    "name": "Công ty Tài chính TNHH MTV Mirae Asset (Việt Nam) ",
    "shortName": "MAFC",
    "code": "MAFC",
    "bin": "977777",
    "logo": "https://cdn.vietqr.io/img/MAFC.png"
  },
  {
    "name": "Ngân hàng Chính sách Xã hội",
    "shortName": "VBSP",
    "code": "VBSP",
    "bin": "999888",
    "logo": "https://cdn.vietqr.io/img/VBSP.png"
  },
  {
    "name": "Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh TP. Hồ Chí Minh",
    "shortName": "IBKHCM",
    "code": "IBK - HCM",
    "bin": "970456",
    "logo": "https://cdn.vietqr.io/img/IBK.png"
  },
  {
    "name": "Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh Hà Nội",
    "shortName": "IBKHN",
    "code": "IBK - HN",
    "bin": "970455",
    "logo": "https://cdn.vietqr.io/img/IBK.png"
  },
  {
    "name": "Ngân hàng KEB Hana – Chi nhánh Thành phố Hồ Chí Minh",
    "shortName": "KEBHanaHCM",
    "code": "KEBHANAHCM",
    "bin": "970466",
    "logo": "https://cdn.vietqr.io/img/KEBHANAHCM.png"
  },
  {
    "name": "Ngân hàng KEB Hana – Chi nhánh Hà Nội",
    "shortName": "KEBHANAHN",
    "code": "KEBHANAHN",
    "bin": "970467",
    "logo": "https://cdn.vietqr.io/img/KEBHANAHN.png"
  },
  {
    "name": "Ngân hàng Kookmin - Chi nhánh Thành phố Hồ Chí Minh",
    "shortName": "KookminHCM",
    "code": "KBHCM",
    "bin": "970463",
    "logo": "https://cdn.vietqr.io/img/KBHCM.png"
  },
  {
    "name": "Ngân hàng Kookmin - Chi nhánh Hà Nội",
    "shortName": "KookminHN",
    "code": "KBHN",
    "bin": "970462",
    "logo": "https://cdn.vietqr.io/img/KBHN.png"
  },
  {
    "name": "Ngân hàng TNHH MTV Việt Nam Hiện Đại",
    "shortName": "MBV",
    "code": "MBV",
    "bin": "970414",
    "logo": "https://cdn.vietqr.io/img/MBV.png"
  },
  {
    "name": "CTCP Dịch Vụ Di Động Trực Tuyến",
    "shortName": "MoMo",
    "code": "momo",
    "bin": "971025",
    "logo": "https://cdn.vietqr.io/img/momo.png",
    "aliases": [
      "momo",
      "ví momo"
    ]
  },
  {
    "name": "Ngân hàng TMCP Quốc Dân",
    "shortName": "NCB",
    "code": "NCB",
    "bin": "970419",
    "logo": "https://cdn.vietqr.io/img/NCB.png"
  },
  {
    "name": "Ngân hàng Nonghyup - Chi nhánh Hà Nội",
    "shortName": "Nonghyup",
    "code": "NHB HN",
    "bin": "801011",
    "logo": "https://cdn.vietqr.io/img/NHB.png"
  },
  {
    "name": "Ngân hàng TMCP Đại Chúng Việt Nam Ngân hàng số",
    "shortName": "PVcomBank Pay",
    "code": "PVDB",
    "bin": "971133",
    "logo": "https://cdn.vietqr.io/img/PVCB.png"
  },
  {
    "name": "Ngân hàng TMCP Sài Gòn",
    "shortName": "SCB",
    "code": "SCB",
    "bin": "970429",
    "logo": "https://cdn.vietqr.io/img/SCB.png"
  },
  {
    "name": "TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank",
    "shortName": "Ubank",
    "code": "Ubank",
    "bin": "546035",
    "logo": "https://cdn.vietqr.io/img/UBANK.png"
  },
  {
    "name": "Ngân hàng TNHH MTV Số Vikki",
    "shortName": "Vikki",
    "code": "Vikki",
    "bin": "970406",
    "logo": "https://cdn.vietqr.io/img/Vikki.png"
  }
];

/**
 * Cache các ngân hàng đã fetch động từ VietQR API
 */
let cachedDynamicBanks: VietnamBank[] | null = null;

/**
 * Lấy logo chính thức của ngân hàng (từ CDN VietQR)
 */
export function getBankLogoUrl(bankInput?: string | VietnamBank | null): string | undefined {
  if (!bankInput) return undefined;
  if (typeof bankInput === 'object' && bankInput !== null) {
    if (bankInput.logo) return bankInput.logo;
    if (bankInput.code) return `https://cdn.vietqr.io/img/${bankInput.code.toUpperCase()}.png`;
  }
  const found = findBank(String(bankInput));
  if (found?.logo) return found.logo;
  if (found?.code) {
    return `https://cdn.vietqr.io/img/${found.code.toUpperCase()}.png`;
  }
  const clean = String(bankInput).trim();
  if (/^[A-Za-z0-9_]+$/.test(clean) && clean.length <= 12) {
    return `https://cdn.vietqr.io/img/${clean.toUpperCase()}.png`;
  }
  return undefined;
}

/**
 * Hàm chuẩn hóa chuỗi để tìm kiếm ngân hàng (loại bỏ từ thừa, dấu tiếng Việt tùy chọn)
 */
export function normalizeBankQuery(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\b(ngân hàng|ngan hang|nh|tmcp|thương mại cổ phần|thuong mai co phan|chi nhánh|chi nhanh|tnhh|viet nam|việt nam)\b/gi, ' ')
    .replace(/[()[\]\-–—.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chuẩn hóa chuỗi chỉ giữ lại chữ cái và số (không khoảng trắng, không dấu đặc biệt)
 */
function toCompactAlphanumeric(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Danh sách ngân hàng hiện hành (ưu tiên dữ liệu đã sync)
 */
export function getActiveBankList(): VietnamBank[] {
  if (cachedDynamicBanks && cachedDynamicBanks.length > 0) {
    return cachedDynamicBanks;
  }
  return VIETNAM_BANKS;
}

/**
 * Tải & đồng bộ danh sách ngân hàng mới nhất từ VietQR API trong nền (không chặn UI)
 */
export async function fetchAndCacheVietQrBanks(): Promise<VietnamBank[]> {
  try {
    const res = await fetch('https://api.vietqr.io/v2/banks');
    if (!res.ok) return VIETNAM_BANKS;
    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) {
      const activeList = VIETNAM_BANKS;
      const merged: VietnamBank[] = activeList.map(base => {
        const fresh = json.data.find((item: any) => item.bin === base.bin || item.code?.toUpperCase() === base.code.toUpperCase());
        return fresh ? { ...base, logo: fresh.logo || base.logo } : base;
      });
      // Bổ sung ngân hàng mới chưa có trong list
      json.data.forEach((fresh: any) => {
        if (!merged.some(b => b.bin === fresh.bin || b.code?.toUpperCase() === fresh.code?.toUpperCase())) {
          merged.push({
            name: fresh.name,
            shortName: fresh.shortName || fresh.short_name,
            code: fresh.code,
            bin: fresh.bin,
            logo: fresh.logo || `https://cdn.vietqr.io/img/${fresh.code}.png`
          });
        }
      });
      cachedDynamicBanks = merged;
      return merged;
    }
  } catch (err) {
    // Yên lặng fallback về static VIETNAM_BANKS
  }
  return VIETNAM_BANKS;
}

/**
 * Tìm mã BIN ngân hàng dựa trên tên ngân hàng hoặc mã code
 */
export function findBankBin(bankInput: string): string | undefined {
  if (!bankInput) return undefined;
  const rawQuery = bankInput.toLowerCase().trim();
  const bankList = getActiveBankList();

  // 1. Tìm chính xác theo BIN số (6 chữ số)
  if (/^\d{6}$/.test(rawQuery)) {
    return rawQuery;
  }

  // 2. Tìm chính xác theo code, BIN hoặc shortName
  const exact = bankList.find(
    b => b.bin === rawQuery || b.code.toLowerCase() === rawQuery || b.shortName.toLowerCase() === rawQuery
  );
  if (exact) return exact.bin;

  // 3. So khớp dạng compact không dấu và không khoảng trắng (Ví dụ: "hd bank" -> "hdbank", "hdb" -> "hdb")
  const compactQuery = toCompactAlphanumeric(bankInput);
  if (compactQuery) {
    const compactMatch = bankList.find(b => {
      const compactShort = toCompactAlphanumeric(b.shortName);
      const compactCode = toCompactAlphanumeric(b.code);
      if (compactQuery === compactShort || compactQuery === compactCode) return true;
      if (b.aliases && b.aliases.some(a => toCompactAlphanumeric(a) === compactQuery)) return true;
      return false;
    });
    if (compactMatch) return compactMatch.bin;
  }

  // 4. Tìm theo aliases trực tiếp
  const aliasMatch = bankList.find(
    b => b.aliases && b.aliases.some(a => rawQuery === a || rawQuery.includes(a) || a.includes(rawQuery))
  );
  if (aliasMatch) return aliasMatch.bin;

  // 5. Tìm theo chuỗi đã chuẩn hóa (bỏ qua 'ngân hàng', 'tmcp', v.v.)
  const cleanQuery = normalizeBankQuery(bankInput);
  if (cleanQuery) {
    const cleanMatch = bankList.find(b => {
      const cleanName = normalizeBankQuery(b.name);
      const cleanShort = normalizeBankQuery(b.shortName);
      return (
        cleanQuery.includes(cleanShort) ||
        cleanShort.includes(cleanQuery) ||
        cleanName.includes(cleanQuery) ||
        cleanQuery.includes(cleanName) ||
        (b.aliases && b.aliases.some(a => cleanQuery.includes(normalizeBankQuery(a))))
      );
    });
    if (cleanMatch) return cleanMatch.bin;
  }

  // 6. Compact contains search (Ví dụ: "hdbanknhontrach" chứa "hdbank")
  if (compactQuery) {
    const compactContainsMatch = bankList.find(b => {
      const compactShort = toCompactAlphanumeric(b.shortName);
      const compactCode = toCompactAlphanumeric(b.code);
      if (compactQuery.startsWith(compactShort) || compactQuery.startsWith(compactCode)) return true;
      if (compactQuery.includes(compactShort) && compactShort.length >= 3) return true;
      if (b.aliases && b.aliases.some(a => {
        const ca = toCompactAlphanumeric(a);
        return ca.length >= 3 && (compactQuery.startsWith(ca) || compactQuery.includes(ca));
      })) return true;
      return false;
    });
    if (compactContainsMatch) return compactContainsMatch.bin;
  }

  // 7. Fallback contains search
  const fuzzy = bankList.find(
    b => rawQuery.includes(b.shortName.toLowerCase()) || 
         b.name.toLowerCase().includes(rawQuery) ||
         rawQuery.includes(b.code.toLowerCase())
  );
  if (fuzzy) return fuzzy.bin;

  return undefined;
}

/**
 * Tìm ngân hàng theo tên hoặc mã
 */
export function findBank(bankInput: string): VietnamBank | undefined {
  if (!bankInput) return undefined;
  const bin = findBankBin(bankInput);
  const bankList = getActiveBankList();
  if (bin) {
    return bankList.find(b => b.bin === bin);
  }
  const query = bankInput.toLowerCase().trim();
  const compactQuery = toCompactAlphanumeric(bankInput);
  return bankList.find(
    b => b.bin === query || 
         b.code.toLowerCase() === query || 
         b.shortName.toLowerCase() === query ||
         (compactQuery && toCompactAlphanumeric(b.shortName) === compactQuery) ||
         (compactQuery && toCompactAlphanumeric(b.code) === compactQuery) ||
         query.includes(b.shortName.toLowerCase()) || 
         b.name.toLowerCase().includes(query)
  );
}

/**
 * Chuẩn hóa tên ngân hàng sang tên viết tắt chuẩn quốc gia (Ví dụ: 'HD bank' -> 'HDBank')
 */
export function standardizeBankName(bankInput?: string | null): string {
  if (!bankInput) return '';
  const found = findBank(bankInput);
  return found ? found.shortName : bankInput.trim();
}

export interface VietQrOptions {
  bankBinOrCode: string;
  accountNumber: string;
  accountName?: string;
  amount?: number;
  memo?: string;
  template?: 'compact2' | 'compact' | 'qr_only' | 'print';
}

/**
 * Tạo URL mã VietQR từ cổng dịch vụ img.vietqr.io
 */
export function getVietQrUrl(options: VietQrOptions): string {
  const { bankBinOrCode, accountNumber, accountName, amount, memo, template = 'compact2' } = options;
  if (!bankBinOrCode || !accountNumber) return '';

  // Xóa khoảng trắng trong STK
  const cleanAcc = accountNumber.replace(/\s+/g, '');
  if (!cleanAcc) return '';
  
  // Lấy BIN nếu đầu vào là tên ngân hàng hoặc mã ngân hàng
  let bin = findBankBin(bankBinOrCode);
  if (!bin) {
    const trimmed = bankBinOrCode.trim();
    // Nếu là mã chuẩn không chứa dấu cách (như VCB, HDB, TCB...)
    if (/^[A-Za-z0-9_]+$/.test(trimmed)) {
      bin = trimmed;
    } else {
      // Cố gắng tìm lần nữa bằng standardizeBankName
      const std = standardizeBankName(trimmed);
      const secondBin = findBankBin(std);
      if (secondBin) {
        bin = secondBin;
      } else {
        console.warn(`[VietQR] Không xác định được mã BIN hợp lệ cho ngân hàng "${bankBinOrCode}". Tránh sinh sai mã chuyển tiền.`);
        return '';
      }
    }
  }

  let url = `https://img.vietqr.io/image/${bin}-${cleanAcc}-${template}.png`;
  const params: string[] = [];

  if (amount && amount > 0) {
    params.push(`amount=${Math.round(amount)}`);
  }
  if (memo && memo.trim()) {
    params.push(`addInfo=${encodeURIComponent(memo.trim())}`);
  }
  if (accountName && accountName.trim()) {
    params.push(`accountName=${encodeURIComponent(accountName.trim())}`);
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  return url;
}
