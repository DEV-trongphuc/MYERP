<?php
/**
 * StudentDocOcrService.php
 * Enterprise-Grade Automatic AI Vision & PDF/DOCX OCR Enrichment Service for Contacts/Students.
 *
 * 4-Layer Automation Capabilities:
 * 1. Multimodal AI OCR (Gemini 3.5 Flash Lite) across Images, PDFs, DOCX text + embedded DOCX images, Acceptance Letters, Admission Forms, CVs, Contracts, and Portrait Photos.
 * 2. Deterministic Vietnamese 12-digit CCCD decoding (Birth Century/Year, Gender, 63 Provinces) & Strict Validation (anti-Party-A contamination).
 * 3. Cross-profile Sibling Synchronization (matching Email or last 9 digits of Phone) + Smart Program/Project/Industry/Admission Date inference.
 * 4. Automatic "Suspect Contact" background detection & real-time Drawer state hydration.
 */

class StudentDocOcrService {
    private static array $vnProvinceCodes = [
        '001' => 'Hà Nội', '002' => 'Hà Giang', '004' => 'Cao Bằng', '006' => 'Bắc Kạn', '008' => 'Tuyên Quang',
        '010' => 'Lào Cai', '011' => 'Điện Biên', '012' => 'Lai Châu', '014' => 'Sơn La', '015' => 'Yên Bái',
        '017' => 'Hòa Bình', '019' => 'Thái Nguyên', '020' => 'Lạng Sơn', '022' => 'Quảng Ninh', '024' => 'Bắc Giang',
        '025' => 'Phú Thọ', '026' => 'Vĩnh Phúc', '027' => 'Bắc Ninh', '030' => 'Hải Dương', '031' => 'Hải Phòng',
        '033' => 'Hưng Yên', '034' => 'Thái Bình', '035' => 'Hà Nam', '036' => 'Nam Định', '037' => 'Ninh Bình',
        '038' => 'Thanh Hóa', '040' => 'Nghệ An', '042' => 'Hà Tĩnh', '044' => 'Quảng Bình', '045' => 'Quảng Trị',
        '046' => 'Thừa Thiên Huế', '048' => 'Đà Nẵng', '049' => 'Quảng Nam', '051' => 'Quảng Ngãi', '052' => 'Bình Định',
        '054' => 'Phú Yên', '056' => 'Khánh Hòa', '058' => 'Ninh Thuận', '060' => 'Bình Thuận', '062' => 'Kon Tum',
        '064' => 'Gia Lai', '066' => 'Đắk Lắk', '067' => 'Đắk Nông', '068' => 'Lâm Đồng', '070' => 'Bình Phước',
        '072' => 'Tây Ninh', '074' => 'Bình Dương', '075' => 'Đồng Nai', '077' => 'Bà Rịa - Vũng Tàu',
        '079' => 'Thành phố Hồ Chí Minh', '080' => 'Long An', '082' => 'Tiền Giang', '083' => 'Bến Tre',
        '084' => 'Trà Vinh', '086' => 'Vĩnh Long', '087' => 'Đồng Tháp', '089' => 'An Giang', '091' => 'Kiên Giang',
        '092' => 'Cần Thơ', '093' => 'Hậu Giang', '094' => 'Sóc Trăng', '095' => 'Bạc Liêu', '096' => 'Cà Mau'
    ];

    public static function shouldScanContact(PDO $db, int $contactId): bool {
        if ($contactId <= 0) return false;
        try {
            $stmt = $db->prepare("
                SELECT citizen_id, passport, company, job_title, industry, birthday, gender, address, city, avatar_url, program, admission_date, student_id, email, phone
                FROM contacts
                WHERE id = ? AND deleted_at IS NULL
                LIMIT 1
            ");
            $stmt->execute([$contactId]);
            $c = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$c) return false;

            $missingId = (trim((string)($c['citizen_id'] ?? '')) === '' && trim((string)($c['passport'] ?? '')) === '');
            $missingWork = (trim((string)($c['company'] ?? '')) === '' || trim((string)($c['job_title'] ?? '')) === '' || trim((string)($c['industry'] ?? '')) === '');
            $missingBio = (
                trim((string)($c['birthday'] ?? '')) === ''
                || strpos((string)($c['birthday'] ?? ''), '0000') === 0
                || trim((string)($c['gender'] ?? '')) === ''
                || trim((string)($c['address'] ?? '')) === ''
                || trim((string)($c['city'] ?? '')) === ''
                || trim((string)($c['avatar_url'] ?? '')) === ''
            );
            $missingStu = (
                trim((string)($c['program'] ?? '')) === ''
                || trim((string)($c['admission_date'] ?? '')) === ''
                || strpos((string)($c['admission_date'] ?? ''), '0000') === 0
                || trim((string)($c['student_id'] ?? '')) === ''
            );

            return ($missingId || $missingWork || $missingBio || $missingStu);
        } catch (\Throwable $e) {
            return false;
        }
    }

    public static function decodeVietnameseCccd(string $cccd): array {
        $digits = preg_replace('/\D/', '', $cccd);
        if (strlen($digits) !== 12) return [];
        // Exclude Party A (IDEAS representative)
        if ($digits === '034068027300') return [];

        $res = [];
        $provCode = substr($digits, 0, 3);
        if (isset(self::$vnProvinceCodes[$provCode])) {
            $res['origin_city'] = self::$vnProvinceCodes[$provCode];
        }

        $centuryGender = (int)$digits[3];
        $yy = (int)substr($digits, 4, 2);
        if (in_array($centuryGender, [0, 1, 2, 3], true)) {
            $res['gender'] = ($centuryGender % 2 === 0) ? 'Nam' : 'Nữ';
            $centuryBase = ($centuryGender <= 1) ? 1900 : 2000;
            $birthYear = $centuryBase + $yy;
            if ($birthYear >= 1940 && $birthYear <= 2010) {
                $res['birth_year'] = $birthYear;
            }
        }
        return $res;
    }

    public static function normalizeDateIso(string $raw, bool $isBirthDate = false): string {
        $raw = trim($raw);
        if ($raw === '' || strpos($raw, '0000') === 0 || strtolower($raw) === 'null') return '';

        $y = 0; $m = 0; $d = 0;
        if (preg_match('/^(\d{4})[\-\/\.](\d{1,2})[\-\/\.](\d{1,2})/', $raw, $matches)) {
            $y = (int)$matches[1];
            $m = (int)$matches[2];
            $d = (int)$matches[3];
        } elseif (preg_match('/^(\d{1,2})[\-\/\.](\d{1,2})[\-\/\.](\d{4})/', $raw, $matches)) {
            $d = (int)$matches[1];
            $m = (int)$matches[2];
            $y = (int)$matches[3];
        }

        if ($m > 12 && $d <= 12) {
            $tmp = $d; $d = $m; $m = $tmp;
        }

        if ($y <= 0 || $m <= 0 || $d <= 0 || !checkdate($m, $d, $y)) {
            return '';
        }

        if ($isBirthDate) {
            if ($y < 1940 || $y > 2010) return '';
        } else {
            if ($y < 2015 || $y > ((int)date('Y') + 1)) return '';
        }

        return sprintf('%04d-%02d-%02d', $y, $m, $d);
    }

    public static function cleanPassportNumber(string $raw): string {
        $clean = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', trim($raw)));
        if ($clean === '' || in_array($clean, ['NULL', 'NONE', 'NA', 'UNKNOWN', 'PASSPORT'], true)) return '';
        // Standard Passport format: 1-2 letters followed by 6-8 digits (e.g., C1234567, E01881509, P01234567, B1234567)
        if (preg_match('/^[A-Z]{1,2}\d{6,8}$/', $clean)) {
            return $clean;
        }
        return '';
    }

    public static function cleanCitizenId(string $raw, string $contactPhone = ''): string {
        $digits = preg_replace('/\D/', '', trim($raw));
        if ($digits === '' || $digits === '034068027300') return '';
        // Must be 9-digit CMND or 12-digit CCCD
        if (strlen($digits) !== 9 && strlen($digits) !== 12) return '';
        // Do not confuse with phone numbers
        $cleanPhone = preg_replace('/\D/', '', $contactPhone);
        if ($cleanPhone !== '' && strlen($cleanPhone) >= 9 && strpos($digits, substr($cleanPhone, -9)) !== false) {
            return '';
        }
        return $digits;
    }

    public static function cleanCompany(string $raw): string {
        $co = trim($raw);
        if ($co === '' || strtolower($co) === 'null' || strtolower($co) === 'n/a' || strtolower($co) === 'none') return '';
        // Exclude IDEAS or partner training school names mistakenly extracted as employer
        if (preg_match('/^(ideas|viện ideas|vien ideas|swiss umef|umef|ubis|estiam|sbs|ascencia|ipag|cesine|helbus)$/iu', $co)) {
            return '';
        }
        if (preg_match('/(39b trường sơn|b82 bạch đằng|công ty tnhh viện ideas|học viện ideas)/iu', $co)) {
            return '';
        }
        return $co;
    }

    public static function cleanAddress(string $raw): string {
        $addr = trim($raw);
        if ($addr === '' || strtolower($addr) === 'null' || strtolower($addr) === 'n/a') return '';
        // Exclude IDEAS office addresses from Contracts
        if (preg_match('/(39b\s*trường\s*sơn|b82\s*bạch\s*đằng|214\s*nam\s*kỳ\s*khởi\s*nghĩa)/iu', $addr)) {
            return '';
        }
        return $addr;
    }

    public static function normalizeCityName(string $rawCity, string $rawAddress = ''): string {
        $combined = trim($rawCity) . ' | ' . trim($rawAddress);
        $low = mb_strtolower($combined, 'UTF-8');
        if (trim($low, ' |') === '') return '';

        if (preg_match('/(hồ chí minh|tp\.?\s*hcm|tphcm|hcm|sài gòn|saigon|thủ đức|quận 1|quận 2|quận 3|quận 4|quận 5|quận 6|quận 7|quận 8|quận 9|quận 10|quận 11|quận 12|bình thạnh|phú nhuận|tân bình|tân phú|gò vấp|bình tân|nhà bè|hóc môn|củ chi|bình chánh)/iu', $low)) {
            return 'Thành phố Hồ Chí Minh';
        }
        if (preg_match('/(hà nội|ha noi|hanoi|cầu giấy|đống đa|ba đình|hoàn kiếm|hai bà trưng|thanh xuân|hoàng mai|long biên|nam từ liêm|bắc từ liêm|hà đông|tây hồ)/iu', $low)) {
            return 'Hà Nội';
        }
        foreach (self::$vnProvinceCodes as $code => $provName) {
            $pLow = mb_strtolower($provName, 'UTF-8');
            if (mb_strpos($low, $pLow, 0, 'UTF-8') !== false) {
                return $provName;
            }
        }
        if (preg_match('/(vũng tàu|bà rịa)/iu', $low)) return 'Bà Rịa - Vũng Tàu';
        if (preg_match('/(huế|thừa thiên)/iu', $low)) return 'Thừa Thiên Huế';
        if (preg_match('/(đà lạt|bảo lộc)/iu', $low)) return 'Lâm Đồng';
        if (preg_match('/(nha trang|cam ranh)/iu', $low)) return 'Khánh Hòa';
        if (preg_match('/(biên hòa|long thành|nhơn trạch)/iu', $low)) return 'Đồng Nai';
        if (preg_match('/(thủ dầu một|dĩ an|thuận an|bến cát|tân uyên)/iu', $low)) return 'Bình Dương';
        if (preg_match('/(phú quốc|rạch giá)/iu', $low)) return 'Kiên Giang';
        if (preg_match('/(buôn ma thuột)/iu', $low)) return 'Đắk Lắk';
        if (preg_match('/(quy nhơn)/iu', $low)) return 'Bình Định';
        if (preg_match('/(hạ long|cẩm phả|uông bí)/iu', $low)) return 'Quảng Ninh';
        if (preg_match('/(việt trì)/iu', $low)) return 'Phú Thọ';
        if (preg_match('/(vinh\b)/iu', $low)) return 'Nghệ An';
        if (preg_match('/(thanh hóa)/iu', $low)) return 'Thanh Hóa';
        if (preg_match('/(pleiku)/iu', $low)) return 'Gia Lai';
        if (preg_match('/(phan thiết)/iu', $low)) return 'Bình Thuận';

        $cleanCity = trim($rawCity);
        if ($cleanCity !== '' && strtolower($cleanCity) !== 'null') {
            return $cleanCity;
        }
        return '';
    }

    public static function scanAndEnrichContact(PDO $db, int $contactId, bool $forceOcr = false): array {
        if ($contactId <= 0) return ['updated' => false, 'reason' => 'invalid_contact_id'];

        $lockFile = sys_get_temp_dir() . "/myerp_ocr_lock_{$contactId}.lock";
        if (!$forceOcr && file_exists($lockFile) && (time() - @filemtime($lockFile)) < 5) {
            return ['updated' => false, 'reason' => 'debounced_in_flight'];
        }
        @file_put_contents($lockFile, (string)time());

        try {
            $stmtC = $db->prepare("
                SELECT c.*, p.name as project_name
                FROM contacts c
                LEFT JOIN projects p ON p.id = c.project_id
                WHERE c.id = ? AND c.deleted_at IS NULL
                LIMIT 1
            ");
            $stmtC->execute([$contactId]);
            $contact = $stmtC->fetch(PDO::FETCH_ASSOC);
            if (!$contact) return ['updated' => false, 'reason' => 'contact_not_found'];

            $stmtFiles = $db->prepare("
                SELECT id, name, file_path, mime_type, category
                FROM cloud_files
                WHERE contact_id = ? AND (is_link = 0 OR is_link IS NULL)
                ORDER BY id DESC
            ");
            $stmtFiles->execute([$contactId]);
            $files = $stmtFiles->fetchAll(PDO::FETCH_ASSOC);

            // Sort files so high-value identity & admission documents come first
            usort($files, function (array $a, array $b): int {
                $scoreFile = function (string $name): int {
                    $n = mb_strtolower($name, 'UTF-8');
                    if (preg_match('/(cccd|cmnd| căn cước|passport|hộ chiếu|id card|identification)/iu', $n)) return 100;
                    if (preg_match('/(admission|application|form|đăng ký|phiếu thông tin|cv|resume|curriculum|sơ yếu)/iu', $n)) return 90;
                    if (preg_match('/(acceptance|offer|thư mời|student card|thẻ sinh viên|hợp đồng|contract)/iu', $n)) return 80;
                    if (preg_match('/(degree|bằng|diploma|certificate)/iu', $n)) return 50;
                    if (preg_match('/(transcript|bảng điểm|bang diem|result)/iu', $n)) return 20;
                    return 60;
                };
                return $scoreFile((string)$b['name']) <=> $scoreFile((string)$a['name']);
            });

            $apiKey = trim((string)$db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'gemini_api_key'")->fetchColumn());
            if ($apiKey === '') {
                $apiKey = trim((string)($_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: ''));
            }
            $model = trim((string)$db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'gemini_model'")->fetchColumn()) ?: 'gemini-3.5-flash-lite';
            if (strpos($model, 'embedding') !== false) {
                $model = 'gemini-3.5-flash-lite';
            }

            $mergedExtracted = [];
            $photoCandidate = null;
            $fileUrlMap = [];

            // 1. Run Multimodal AI Document OCR if contact has files and needs any profile fields (or forceOcr=true)
            $needsDocOcr = $forceOcr
                || (trim((string)($contact['citizen_id'] ?? '')) === '' && trim((string)($contact['passport'] ?? '')) === '')
                || trim((string)($contact['company'] ?? '')) === ''
                || trim((string)($contact['job_title'] ?? '')) === ''
                || trim((string)($contact['industry'] ?? '')) === ''
                || trim((string)($contact['birthday'] ?? '')) === ''
                || strpos((string)($contact['birthday'] ?? ''), '0000') === 0
                || trim((string)($contact['gender'] ?? '')) === ''
                || trim((string)($contact['address'] ?? '')) === ''
                || trim((string)($contact['city'] ?? '')) === ''
                || trim((string)($contact['program'] ?? '')) === ''
                || trim((string)($contact['student_id'] ?? '')) === '';

            if (!empty($files) && $apiKey !== '' && $needsDocOcr) {
                $baseDir = dirname(__DIR__) . '/';
                $docxTexts = [];
                $binaryItems = [];

                foreach ($files as $f) {
                    $fid = (int)$f['id'];
                    $fname = (string)$f['name'];
                    $rel = ltrim((string)$f['file_path'], '/');
                    $p1 = $baseDir . $rel;
                    $p2 = $baseDir . 'uploads/' . $rel;
                    $path = file_exists($p1) ? $p1 : (file_exists($p2) ? $p2 : null);
                    if (!$path) continue;

                    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                    $nLow = mb_strtolower($fname, 'UTF-8');
                    $fullPublicUrl = 'https://myerp.ideas.edu.vn/backend/' . (strpos($rel, 'uploads/') === 0 ? $rel : 'uploads/' . $rel);
                    $fileUrlMap[$fid] = $fullPublicUrl;

                    if (in_array($ext, ['webp', 'jpg', 'jpeg', 'png'], true) && strpos($rel, 'deposits/') === false) {
                        if (preg_match('/(ảnh 4x6|anh 4x6|4x6|3x4|ảnh thẻ|anh the|hình the|hình thẻ|ảnh chân dung|chan dung|avatar|portrait|photo|picture)/iu', $nLow)) {
                            if (!$photoCandidate) {
                                $photoCandidate = $fullPublicUrl;
                            }
                            continue;
                        }
                    }

                    // Skip payment receipts (UNC / Deposit slips) from identity OCR
                    if (strpos($rel, 'deposits/') !== false || preg_match('/^(unc|ủy nhiệm chi|uy nhiem chi)\b/iu', $nLow)) {
                        continue;
                    }

                    if ($ext === 'docx') {
                        $d = self::extractDocxContent($path);
                        if (!empty($d['text'])) {
                            $docxTexts[] = "=== FILE #$fid: $fname (DOCX) ===\n" . mb_substr($d['text'], 0, 14000);
                        }
                        if ((strlen($d['text']) < 300 || preg_match('/(cccd|cmnd|passport|id|form|application|admission|hợp đồng|contract)/iu', $nLow)) && !empty($d['images'])) {
                            foreach ($d['images'] as $imgObj) {
                                $mType = $imgObj['ext'] === 'png' ? 'image/png' : ($imgObj['ext'] === 'webp' ? 'image/webp' : 'image/jpeg');
                                $comp = self::compressImageBytes($imgObj['bytes'], $mType);
                                $binaryItems[] = [
                                    'fid' => $fid,
                                    'label' => "Embedded image {$imgObj['name']} from File #$fid ($fname)",
                                    'mimeType' => $comp['mimeType'],
                                    'data' => $comp['data'],
                                    'rawLen' => $comp['rawLen']
                                ];
                            }
                        }
                    } elseif (in_array($ext, ['pdf', 'webp', 'png', 'jpg', 'jpeg'], true)) {
                        $rawBytes = @file_get_contents($path);
                        if (!$rawBytes) continue;
                        if ($ext === 'pdf') {
                            if (strlen($rawBytes) > 14 * 1024 * 1024) continue;
                            $binaryItems[] = [
                                'fid' => $fid,
                                'label' => "File #$fid: $fname (PDF)",
                                'mimeType' => 'application/pdf',
                                'data' => base64_encode($rawBytes),
                                'rawLen' => strlen($rawBytes)
                            ];
                        } else {
                            $mType = $ext === 'png' ? 'image/png' : ($ext === 'webp' ? 'image/webp' : 'image/jpeg');
                            $comp = self::compressImageBytes($rawBytes, $mType);
                            $binaryItems[] = [
                                'fid' => $fid,
                                'label' => "File #$fid: $fname (Image)",
                                'mimeType' => $comp['mimeType'],
                                'data' => $comp['data'],
                                'rawLen' => $comp['rawLen']
                            ];
                        }
                    }
                }

                $batches = [];
                $curBatch = [];
                $curBytes = 0;
                foreach ($binaryItems as $bi) {
                    if (!empty($curBatch) && (count($curBatch) >= 5 || ($curBytes + $bi['rawLen']) > 11 * 1024 * 1024)) {
                        $batches[] = $curBatch;
                        $curBatch = [];
                        $curBytes = 0;
                    }
                    $curBatch[] = $bi;
                    $curBytes += $bi['rawLen'];
                }
                if (!empty($curBatch) || (!empty($docxTexts) && empty($batches))) {
                    $batches[] = $curBatch;
                }

                $promptInstructions = <<<EOT
You are an expert Student Document OCR & Profile Extraction AI for MYERP (IDEAS Academy).
Analyze ALL provided documents (Passports, Vietnamese CCCD/CMND ID cards, Admission/Application Forms, Acceptance/Offer Letters, CVs/Resumes, Training Contracts, Degrees) and the current database record of this student, then extract the most complete and accurate profile in strict JSON format:
{
  "passport": "Passport number (e.g., C1234567, E01881509, P01234567, B1234567). Uppercase alphanumeric, no spaces. Null if not found.",
  "citizen_id": "12-digit Vietnamese CCCD / Personal ID No or 9-digit CMND of the student. Digits only. Null if not found.",
  "student_id": "Official Student ID / Registration Number from Acceptance Letter, Offer Letter, Student Card, or Admission Form (e.g., 'CH-UMEF-...', 'UBIS-...', 'ESTIAM-...', 'SBS-...', 'ASC-...'). Null if not found.",
  "birthday": "Date of birth in YYYY-MM-DD format (note: Vietnamese/European documents use DD/MM/YYYY). Must be actual birth date (year between 1945 and 2008), NEVER passport/CCCD issue or expiry date!",
  "gender": "'Nam' (Male/M) or 'Nữ' (Female/F). Null if unknown.",
  "address": "Fullest residential address (street, ward, district, province/city) or place of residence of the student.",
  "city": "Standardized Vietnamese province/city name (e.g., 'Thành phố Hồ Chí Minh', 'Hà Nội', 'Bình Dương', 'Đồng Nai', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'Bà Rịa - Vũng Tàu', 'Khánh Hòa', 'Lâm Đồng', etc.).",
  "company": "Current or most recent employer / company / organization where the student works (from Admission Form 'Company name', CV/Resume, or Contract). NEVER put 'IDEAS', 'Swiss UMEF', 'UBIS', 'ESTIAM', 'SBS', 'Ascencia', 'IPAG' unless the student is employed there.",
  "job_title": "Current or most recent job title / position / role of the student (from Admission Form 'Your position' / 'Title', CV/Resume, or Motivation Letter).",
  "industry": "Standardized industry category from: ['Ngân hàng (Banking)', 'Tài chính - Chứng khoán - Đầu tư', 'Bất động sản & Xây dựng', 'Y tế - Dược phẩm - Bệnh viện', 'Công nghệ - Viễn thông - Media', 'Sản xuất - Công nghiệp - Năng lượng', 'Giáo dục & Đào tạo', 'Thương mại - Dịch vụ & Bán lẻ', 'Vận tải - Logistics - XNK', 'F&B - Khách sạn - Du lịch', 'Bảo hiểm (Insurance)', 'Cơ quan Nhà nước / Hành chính công', 'Kế toán - Kiểm toán - Tư vấn Luật', 'Nông nghiệp - Thủy sản - Thực phẩm', 'Marketing - Truyền thông & Quảng cáo'].",
  "program": "Academic program / school code (e.g., 'EMBA', 'MBA', 'MBA HQ', 'DBA', 'MSC-AI', 'UBIS', 'ESTIAM', 'SBS', 'ASCENCIA', 'IPAG', 'TOP UP', 'CESINE', 'HELBUS'). Never output 'BBA' (use 'TOP UP' for Bachelor Top-up). Null if not found.",
  "admission_date": "Enrollment / admission / contract signing date in YYYY-MM-DD format if stated on Admission Form, Acceptance Letter, or Contract. Null if not found.",
  "email": "Student's personal/work email address if found in documents (never @ideas.edu.vn). Null if not found.",
  "phone": "Student's phone number if found in documents (never IDEAS hotline 028/0987363935). Null if not found.",
  "portrait_file_id": "If any attached image file is a clean portrait/headshot/4x6 ID photo of the student (not a card or document), return its integer File ID (e.g. 123), otherwise null."
}
CRITICAL RULES:
1. NEVER extract Party A (IDEAS Academy / Viện IDEAS) representative Mr. Phạm Quang Vinh's CCCD (034068027300) or IDEAS office addresses (39B Trường Sơn / B82 Bạch Đằng / 214 Nam Kỳ Khởi Nghĩa) from Contracts! Only extract Party B (the student).
2. Return ONLY valid JSON.
EOT;

                foreach ($batches as $bIdx => $batch) {
                    if (empty($batch) && empty($docxTexts)) continue;
                    $parts = [];
                    $contextText = "STUDENT DATABASE RECORD:\n" . json_encode([
                        'contact_id' => $contactId,
                        'full_name' => $contact['full_name'],
                        'current_passport' => $contact['passport'],
                        'current_citizen_id' => $contact['citizen_id'],
                        'current_student_id' => $contact['student_id'],
                        'current_company' => $contact['company'],
                        'current_job_title' => $contact['job_title'],
                        'current_industry' => $contact['industry'],
                        'current_birthday' => $contact['birthday'],
                        'current_gender' => $contact['gender'],
                        'current_address' => $contact['address'],
                        'current_city' => $contact['city'],
                        'current_program' => $contact['program']
                    ], JSON_UNESCAPED_UNICODE) . "\n\n";

                    if ($bIdx === 0 && !empty($docxTexts)) {
                        $contextText .= "ATTACHED DOCX TEXTS:\n" . implode("\n\n", $docxTexts) . "\n\n";
                    }
                    $parts[] = ['text' => $contextText];
                    foreach ($batch as $bi) {
                        $parts[] = ['text' => "Attached binary document -> " . $bi['label']];
                        $parts[] = ['inlineData' => ['mimeType' => $bi['mimeType'], 'data' => $bi['data']]];
                    }
                    $parts[] = ['text' => $promptInstructions];

                    $resp = self::callGemini($apiKey, $model, $parts);
                    if ($resp['ok'] && is_array($resp['data'])) {
                        foreach ($resp['data'] as $k => $v) {
                            if ($v !== null && $v !== '' && $v !== 'null' && $v !== 'N/A') {
                                if ($k === 'citizen_id') {
                                    $v = self::cleanCitizenId((string)$v, (string)($contact['phone'] ?? ''));
                                    if ($v === '') continue;
                                } elseif ($k === 'passport') {
                                    $v = self::cleanPassportNumber((string)$v);
                                    if ($v === '') continue;
                                } elseif ($k === 'birthday') {
                                    $v = self::normalizeDateIso((string)$v, true);
                                    if ($v === '') continue;
                                } elseif ($k === 'admission_date') {
                                    $v = self::normalizeDateIso((string)$v, false);
                                    if ($v === '') continue;
                                } elseif ($k === 'company') {
                                    $v = self::cleanCompany((string)$v);
                                    if ($v === '') continue;
                                } elseif ($k === 'address') {
                                    $v = self::cleanAddress((string)$v);
                                    if ($v === '') continue;
                                } elseif ($k === 'program') {
                                    $v = trim((string)$v);
                                    if (preg_match('/\bbba\b/i', $v)) $v = 'TOP UP';
                                } elseif ($k === 'portrait_file_id') {
                                    $pFid = (int)$v;
                                    if (!$photoCandidate && $pFid > 0 && isset($fileUrlMap[$pFid])) {
                                        $photoCandidate = $fileUrlMap[$pFid];
                                    }
                                    continue;
                                }

                                if (empty($mergedExtracted[$k])) {
                                    $mergedExtracted[$k] = $v;
                                }
                            }
                        }
                    }
                }
            }

            if ($photoCandidate) {
                $mergedExtracted['avatar_candidate'] = $photoCandidate;
            }

            // 2. Find sibling contacts (same email or last 9 digits of phone)
            $targetContacts = [$contact];
            $conds = [];
            $params = [$contactId];
            $normPhone = preg_replace('/\D/', '', (string)($contact['phone'] ?? $contact['mobile'] ?? ''));
            if (strlen($normPhone) >= 9) {
                $conds[] = "phone LIKE ?";
                $params[] = "%" . substr($normPhone, -9) . "%";
            }
            if (!empty($contact['email']) && strpos($contact['email'], '@') !== false) {
                $conds[] = "LOWER(TRIM(email)) = LOWER(TRIM(?))";
                $params[] = $contact['email'];
            }
            if (!empty($conds)) {
                $stmtSib = $db->prepare("
                    SELECT c.*, p.name as project_name
                    FROM contacts c
                    LEFT JOIN projects p ON p.id = c.project_id
                    WHERE c.deleted_at IS NULL AND c.id != ? AND (" . implode(" OR ", $conds) . ")
                ");
                $stmtSib->execute($params);
                foreach ($stmtSib->fetchAll(PDO::FETCH_ASSOC) as $sib) {
                    $targetContacts[] = $sib;
                }
            }

            // Merge any existing valid fields from siblings into $mergedExtracted as fallback
            foreach ($targetContacts as $tc) {
                foreach (['passport', 'citizen_id', 'student_id', 'birthday', 'gender', 'address', 'city', 'company', 'job_title', 'industry', 'program', 'admission_date'] as $f) {
                    $val = trim((string)($tc[$f] ?? ''));
                    if ($val !== '' && strpos($val, '0000') !== 0 && empty($mergedExtracted[$f])) {
                        if ($f === 'program' && preg_match('/\bbba\b/i', $val)) continue;
                        $mergedExtracted[$f] = $val;
                    }
                }
                if (trim((string)($tc['avatar_url'] ?? '')) !== '' && empty($mergedExtracted['avatar_candidate'])) {
                    $mergedExtracted['avatar_candidate'] = trim((string)$tc['avatar_url']);
                }
            }

            // 2b. Decode Vietnamese 12-digit CCCD (from OCR or DB) to enrich missing Gender or City
            $activeCccd = trim((string)($mergedExtracted['citizen_id'] ?? $contact['citizen_id'] ?? ''));
            if ($activeCccd !== '') {
                $cccdMeta = self::decodeVietnameseCccd($activeCccd);
                if (empty($mergedExtracted['gender']) && !empty($cccdMeta['gender'])) {
                    $mergedExtracted['gender'] = $cccdMeta['gender'];
                }
                if (empty($mergedExtracted['city']) && !empty($cccdMeta['origin_city'])) {
                    $mergedExtracted['city'] = $cccdMeta['origin_city'];
                }
            }

            // Normalize City from Address & City
            $normCity = self::normalizeCityName(
                (string)($mergedExtracted['city'] ?? $contact['city'] ?? ''),
                (string)($mergedExtracted['address'] ?? $contact['address'] ?? '')
            );
            if ($normCity !== '') {
                $mergedExtracted['city'] = $normCity;
            }

            // Pre-load active projects for matching program <-> project_id
            $projectsRows = [];
            try {
                $projectsRows = $db->query("SELECT id, name FROM projects WHERE deleted_at IS NULL")->fetchAll(PDO::FETCH_ASSOC);
            } catch (\Throwable $eP) {}

            // 3. Apply updates to target contact and its siblings
            $updatedCount = 0;
            $primaryUpdatedLabels = [];

            foreach ($targetContacts as $idx => $tc) {
                $tcId = (int)$tc['id'];
                $sets = [];
                $vals = [];
                $labels = [];

                // Passport
                if (trim((string)($tc['passport'] ?? '')) === '' && !empty($mergedExtracted['passport'])) {
                    $cleanPass = self::cleanPassportNumber((string)$mergedExtracted['passport']);
                    if ($cleanPass !== '') {
                        $sets[] = "passport = ?";
                        $vals[] = $cleanPass;
                        $labels[] = 'Passport';
                    }
                }

                // Citizen ID (CCCD/CMND)
                if (trim((string)($tc['citizen_id'] ?? '')) === '' && !empty($mergedExtracted['citizen_id'])) {
                    $cleanCccd = self::cleanCitizenId((string)$mergedExtracted['citizen_id'], (string)($tc['phone'] ?? ''));
                    if ($cleanCccd !== '') {
                        $sets[] = "citizen_id = ?";
                        $vals[] = $cleanCccd;
                        $labels[] = 'CCCD';
                    }
                }

                // Student ID
                if (trim((string)($tc['student_id'] ?? '')) === '' && !empty($mergedExtracted['student_id'])) {
                    $cleanSid = trim((string)$mergedExtracted['student_id']);
                    if ($cleanSid !== '' && strtolower($cleanSid) !== 'null') {
                        $sets[] = "student_id = ?";
                        $vals[] = $cleanSid;
                        $labels[] = 'ID Student';
                    }
                }

                // Birthday
                $curDob = trim((string)($tc['birthday'] ?? ''));
                $newDob = self::normalizeDateIso((string)($mergedExtracted['birthday'] ?? ''), true);
                if (($curDob === '' || strpos($curDob, '0000') === 0) && $newDob !== '') {
                    $sets[] = "birthday = ?";
                    $vals[] = $newDob;
                    $sets[] = "birth_date = ?";
                    $vals[] = $newDob;
                    $sets[] = "dob = ?";
                    $vals[] = $newDob;
                    $labels[] = 'Ngày sinh';
                }

                // Gender
                if (trim((string)($tc['gender'] ?? '')) === '' && !empty($mergedExtracted['gender'])) {
                    $g = mb_strtolower(trim((string)$mergedExtracted['gender']), 'UTF-8');
                    $normGen = '';
                    if (in_array($g, ['female', 'nữ', 'nu', 'f'], true)) $normGen = 'Nữ';
                    elseif (in_array($g, ['male', 'nam', 'm'], true)) $normGen = 'Nam';
                    if ($normGen !== '') {
                        $sets[] = "gender = ?";
                        $vals[] = $normGen;
                        $labels[] = 'Giới tính';
                    }
                }

                // City & Address (ensure both are populated if either is available so AddressSelect on UI is never blank)
                $curCity = trim((string)($tc['city'] ?? ''));
                $curAddr = trim((string)($tc['address'] ?? ''));
                $resolvedCity = $curCity !== '' ? $curCity : trim((string)($mergedExtracted['city'] ?? ''));
                $resolvedAddr = $curAddr !== '' ? $curAddr : trim((string)($mergedExtracted['address'] ?? ''));
                if ($resolvedAddr === '' && $resolvedCity !== '') {
                    $resolvedAddr = $resolvedCity;
                }
                if ($curCity === '' && $resolvedCity !== '') {
                    $sets[] = "city = ?";
                    $vals[] = $resolvedCity;
                    $labels[] = 'Tỉnh/TP';
                }
                if ($curAddr === '' && $resolvedAddr !== '') {
                    $sets[] = "address = ?";
                    $vals[] = $resolvedAddr;
                    $labels[] = 'Địa chỉ';
                }

                // Email (if empty on contact and extracted from CV/Admission Form)
                if (trim((string)($tc['email'] ?? '')) === '' && !empty($mergedExtracted['email'])) {
                    $candEmail = strtolower(trim((string)$mergedExtracted['email']));
                    if (filter_var($candEmail, FILTER_VALIDATE_EMAIL) && strpos($candEmail, '@ideas.edu.vn') === false) {
                        $sets[] = "email = ?";
                        $vals[] = $candEmail;
                        $labels[] = 'Email';
                    }
                }

                // Resolve Company & Department
                $resolvedCo = trim((string)($tc['company'] ?? ''));
                if ($resolvedCo === '') {
                    if (!empty($mergedExtracted['company'])) {
                        $resolvedCo = self::cleanCompany((string)$mergedExtracted['company']);
                    }
                    if ($resolvedCo === '' && trim((string)($tc['department'] ?? '')) !== '') {
                        $resolvedCo = self::cleanCompany((string)$tc['department']);
                    }
                    if ($resolvedCo !== '') {
                        $sets[] = "company = ?";
                        $vals[] = $resolvedCo;
                        $labels[] = 'Công ty';
                        if (trim((string)($tc['department'] ?? '')) === '') {
                            $sets[] = "department = ?";
                            $vals[] = $resolvedCo;
                        }
                    }
                }

                // Resolve Job Title
                $resolvedJob = trim((string)($tc['job_title'] ?? ''));
                if ($resolvedJob === '' && !empty($mergedExtracted['job_title'])) {
                    $resolvedJob = trim((string)$mergedExtracted['job_title']);
                    if ($resolvedJob !== '' && strtolower($resolvedJob) !== 'null') {
                        $sets[] = "job_title = ?";
                        $vals[] = $resolvedJob;
                        $labels[] = 'Chức vụ';
                    }
                }

                // Resolve Industry (from OCR or inferred from Company/Job Title/Notes)
                if (trim((string)($tc['industry'] ?? '')) === '') {
                    $ind = trim((string)($mergedExtracted['industry'] ?? ''));
                    if ($ind === '' || strtolower($ind) === 'null') {
                        $ind = self::inferIndustryFromText($resolvedCo . ' ' . $resolvedJob . ' ' . ($tc['notes'] ?? ''));
                    }
                    if ($ind !== '') {
                        $sets[] = "industry = ?";
                        $vals[] = $ind;
                        $labels[] = 'Ngành nghề';
                    }
                }

                // Resolve Program & Project ID
                $curProg = trim((string)($tc['program'] ?? ''));
                $resolvedProg = $curProg;
                if ($curProg === '') {
                    $resolvedProg = trim((string)($mergedExtracted['program'] ?? ''));
                    if ($resolvedProg === '' || strtolower($resolvedProg) === 'null') {
                        $resolvedProg = self::inferProgramFromContact($tc);
                    }
                    if (preg_match('/\bbba\b/i', $resolvedProg)) {
                        $resolvedProg = 'TOP UP';
                    }
                    if ($resolvedProg !== '') {
                        $sets[] = "program = ?";
                        $vals[] = $resolvedProg;
                        $labels[] = 'Chương trình';
                    }
                }
                if (empty($tc['project_id']) && $resolvedProg !== '' && !empty($projectsRows)) {
                    $matchedProjId = self::matchProjectIdByProgram($resolvedProg, $projectsRows);
                    if ($matchedProjId > 0) {
                        $sets[] = "project_id = ?";
                        $vals[] = $matchedProjId;
                    }
                }

                // Resolve Admission Date for Students
                $isStu = ($tc['status'] === 'customer' || $tc['customer_type'] === 'student' || in_array((int)($tc['stage_id'] ?? 0), [13, 14, 43, 44], true) || !empty($tc['student_id']));
                $curAdm = trim((string)($tc['admission_date'] ?? ''));
                if ($isStu && ($curAdm === '' || strpos($curAdm, '0000') === 0)) {
                    $admDt = self::normalizeDateIso((string)($mergedExtracted['admission_date'] ?? ''), false);
                    if ($admDt === '') {
                        $admDt = self::resolveAdmissionDate($db, $tcId);
                    }
                    if ($admDt !== '') {
                        $sets[] = "admission_date = ?";
                        $vals[] = $admDt;
                        $labels[] = 'Ngày nhập học';
                    }
                }

                // Resolve Avatar
                if (trim((string)($tc['avatar_url'] ?? '')) === '' && !empty($mergedExtracted['avatar_candidate'])) {
                    $sets[] = "avatar_url = ?";
                    $vals[] = trim((string)$mergedExtracted['avatar_candidate']);
                    $labels[] = 'Ảnh đại diện';
                }

                if (!empty($sets)) {
                    $vals[] = $tcId;
                    $db->prepare("UPDATE contacts SET " . implode(", ", $sets) . " WHERE id = ?")->execute($vals);
                    $updatedCount++;
                    if ($idx === 0) {
                        $primaryUpdatedLabels = array_values(array_unique($labels));
                    }
                }
            }

            // Log activity note on primary contact if fields were auto-populated
            if (!empty($primaryUpdatedLabels)) {
                try {
                    $tid = (int)($contact['tenant_id'] ?? 1);
                    $uid = (int)($contact['owner_id'] ?? 1);
                    $fieldsStr = implode(', ', $primaryUpdatedLabels);
                    $subject = "🤖 AI Tự động quét hồ sơ & điền thông tin";
                    $body = "Hệ thống AI OCR đã tự động phân tích tài liệu đính kèm và cập nhật các trường còn thiếu: {$fieldsStr}.";
                    $stmtAct = $db->prepare("
                        INSERT INTO activities (tenant_id, user_id, type, subject, body, related_type, related_id, contact_id, status, completed_at, created_at)
                        VALUES (?, ?, 'note', ?, ?, 'contact', ?, ?, 'completed', NOW(), NOW())
                    ");
                    $stmtAct->execute([$tid, $uid, $subject, $body, $contactId, $contactId]);
                } catch (\Throwable $eAct) {}
            }

            // Fetch fresh updated contact record so Frontend can hydrate formData instantaneously
            $stmtFresh = $db->prepare("
                SELECT c.*, p.name as project_name
                FROM contacts c
                LEFT JOIN projects p ON p.id = c.project_id
                WHERE c.id = ? AND c.deleted_at IS NULL
                LIMIT 1
            ");
            $stmtFresh->execute([$contactId]);
            $freshContact = $stmtFresh->fetch(PDO::FETCH_ASSOC) ?: null;

            return [
                'updated' => $updatedCount > 0,
                'updated_records' => $updatedCount,
                'updated_fields' => $primaryUpdatedLabels,
                'extracted' => $mergedExtracted,
                'contact' => $freshContact
            ];
        } catch (\Throwable $e) {
            error_log("StudentDocOcrService error for contact #$contactId: " . $e->getMessage());
            return ['updated' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Automatically find and scan "suspect" contacts:
     * Contacts that have uploaded files in cloud_files but still lack both citizen_id and passport,
     * and haven't had an AI auto-scan activity logged after their latest uploaded file.
     */
    public static function scanAllSuspectContacts(PDO $db, int $limit = 8): array {
        try {
            $sql = "
                SELECT c.id, c.full_name
                FROM contacts c
                WHERE c.deleted_at IS NULL
                  AND COALESCE(c.citizen_id, '') = ''
                  AND COALESCE(c.passport, '') = ''
                  AND EXISTS (
                      SELECT 1 FROM cloud_files cf
                      WHERE cf.contact_id = c.id
                        AND (cf.is_link = 0 OR cf.is_link IS NULL)
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM activities a
                      WHERE a.contact_id = c.id
                        AND a.deleted_at IS NULL
                        AND a.subject LIKE '%AI Tự động quét hồ sơ%'
                        AND a.created_at >= (
                            SELECT MAX(cf2.created_at)
                            FROM cloud_files cf2
                            WHERE cf2.contact_id = c.id
                        )
                  )
                ORDER BY c.id DESC
                LIMIT " . max(1, min(25, $limit));

            $rows = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
            $scanned = 0;
            $updated = 0;
            $details = [];

            foreach ($rows as $r) {
                $cid = (int)$r['id'];
                $scanned++;
                $res = self::scanAndEnrichContact($db, $cid, true);
                if (!empty($res['updated'])) {
                    $updated++;
                    $details[] = [
                        'contact_id' => $cid,
                        'full_name' => $r['full_name'],
                        'updated_fields' => $res['updated_fields'] ?? []
                    ];
                } else {
                    try {
                        $stmtMark = $db->prepare("
                            INSERT INTO activities (tenant_id, user_id, type, subject, body, related_type, related_id, contact_id, status, completed_at, created_at)
                            VALUES (1, 1, 'system', '🤖 AI Tự động quét hồ sơ (Đã kiểm tra)', 'Đã kiểm tra tệp đính kèm hiện tại (chưa phát hiện ảnh CCCD/Passport). Sẽ tự động quét lại khi có tệp mới tải lên.', 'contact', ?, ?, 'completed', NOW(), NOW())
                        ");
                        $stmtMark->execute([$cid, $cid]);
                    } catch (\Throwable $eM) {}
                }
            }

            return [
                'scanned_count' => $scanned,
                'updated_count' => $updated,
                'details' => $details
            ];
        } catch (\Throwable $e) {
            return ['scanned_count' => 0, 'updated_count' => 0, 'error' => $e->getMessage()];
        }
    }

    public static function matchProjectIdByProgram(string $program, array $projects): int {
        $pClean = mb_strtolower(trim($program), 'UTF-8');
        if ($pClean === '') return 0;
        foreach ($projects as $proj) {
            $nameLow = mb_strtolower(trim((string)($proj['name'] ?? '')), 'UTF-8');
            if ($nameLow !== '' && ($nameLow === $pClean || strpos($nameLow, $pClean) !== false || strpos($pClean, $nameLow) !== false)) {
                return (int)$proj['id'];
            }
        }
        return 0;
    }

    public static function inferProgramFromContact(array $c): string {
        $pName = trim((string)($c['project_name'] ?? ''));
        if ($pName !== '' && !preg_match('/\bbba\b/i', $pName)) return $pName;

        $haystack = (string)($c['tags'] ?? '') . ' | ' . (string)($c['notes'] ?? '') . ' | ' . (string)($c['intake'] ?? '') . ' | ' . (string)($c['student_id'] ?? '');
        if (preg_match('/Trường:\s*([^|\n\r,]+)/ui', $haystack, $m)) {
            $cand = trim($m[1]);
            if (!preg_match('/\bbba\b/i', $cand)) return $cand;
        }
        if (preg_match('/\b(MSC[\s\-]*AI|EMBA|MBA[\s\-]*HQ|MBA|DBA|UBIS|ASCENCIA|ESTIAM|IPAG|SBS|TOP[\s\-]*UP|BACHELOR|CESINE|PARIS[\s\-]*PG|HELBUS)\b/ui', $haystack, $m)) {
            return strtoupper(trim($m[1]));
        }
        return '';
    }

    public static function inferIndustryFromText(string $raw): string {
        $txt = mb_strtolower(trim($raw), 'UTF-8');
        if ($txt === '') return '';
        if (preg_match('/(hr|nhân sự|l&d|talent|training|coaching|giáo dục|education|teacher|lecturer|university|school|academy|đào tạo|giảng viên)/ui', $txt)) {
            return 'Giáo dục & Đào tạo';
        }
        if (preg_match('/(bank|ngân hàng|vietcombank|techcombank|vpbank|acb|mb|bidv|vietinbank|sacombank|hdbank|vib|tpbank|shb|ocb|msb|seabank|eximbank|lpbank|agribank|hsbc|shinhan|standard chartered|uob|citibank)/ui', $txt)) {
            return 'Ngân hàng (Banking)';
        }
        if (preg_match('/(finance|tài chính|kế toán|accounting|audit|tax|chứng khoán|trader|invest|quỹ|fund|ssi|vndirect|hsc|momo|zalopay|fintech)/ui', $txt)) {
            return 'Tài chính - Chứng khoán - Đầu tư';
        }
        if (preg_match('/(bảo hiểm|insurance|manulife|prudential|aia|dai-ichi|fwd|chubb|baoviet|generali|hanwha|sun life)/ui', $txt)) {
            return 'Bảo hiểm (Insurance)';
        }
        if (preg_match('/(it\b|software|tech|developer|engineer|data|ai\b|network|telecom|media|viễn thông|fpt|viettel|vnpt|mobifone|cmc|vng|kms|nashtech|công nghệ|phần mềm)/ui', $txt)) {
            return 'Công nghệ - Viễn thông - Media';
        }
        if (preg_match('/(pharma|dược|bệnh viện|hospital|clinic|y tế|medical|doctor|bác sĩ|nha khoa|thẩm mỹ|healthcare|sanofi|pfizer|astrazeneca|roche|novartis)/ui', $txt)) {
            return 'Y tế - Dược phẩm - Bệnh viện';
        }
        if (preg_match('/(real estate|bất động sản|xây dựng|construction|concrete|architect|kiến trúc|nội thất|vinhomes|novaland|khang điền|đất xanh|nam long|coteccons|hòa bình|masterise|cbri|savills|jll)/ui', $txt)) {
            return 'Bất động sản & Xây dựng';
        }
        if (preg_match('/(logistics|supply chain|vận tải|xuất nhập khẩu|import|export|shipping|forwarder|cảng|hàng hải|hàng không|vietjet|vietnam airlines|maersk|dhl|fedex)/ui', $txt)) {
            return 'Vận tải - Logistics - XNK';
        }
        if (preg_match('/(marketing|brand|quảng cáo|pr\b|agency|event|truyền thông|digital)/ui', $txt)) {
            return 'Marketing - Truyền thông & Quảng cáo';
        }
        if (preg_match('/(manufacturing|sản xuất|factory|nhà máy|quality|qa|qc|energy|dầu khí|petro|cơ khí|điện|samsung|intel|bosch|panasonic|lg|unilever|p&g|nestle|hòa phát)/ui', $txt)) {
            return 'Sản xuất - Công nghiệp - Năng lượng';
        }
        if (preg_match('/(hotel|khách sạn|resort|du lịch|travel|tour|restaurant|nhà hàng|f&b|cafe|hospitality|marriott|accor|vinpearl|hilton|intercontinental)/ui', $txt)) {
            return 'F&B - Khách sạn - Du lịch';
        }
        if (preg_match('/(luật|law|legal|lawyer|luật sư|công chứng|kiểm toán|deloitte|pwc|ey\b|kpmg)/ui', $txt)) {
            return 'Kế toán - Kiểm toán - Tư vấn Luật';
        }
        if (preg_match('/(nông nghiệp|thủy sản|thực phẩm|agri|food|cp group|masan|vinamilk|th true milk|greenfeed|cargill)/ui', $txt)) {
            return 'Nông nghiệp - Thủy sản - Thực phẩm';
        }
        if (preg_match('/(ubnd|sở |bộ |nhà nước|hành chính|công chức|viên chức|cục |chi cục|viện kiểm sát|tòa án)/ui', $txt)) {
            return 'Cơ quan Nhà nước / Hành chính công';
        }
        if (preg_match('/(retail|bán lẻ|thương mại|sales|kinh doanh|fmcg|distribution|phân phối|director|giám đốc|ceo|founder|manager|trưởng phòng)/ui', $txt)) {
            return 'Thương mại - Dịch vụ & Bán lẻ';
        }
        return '';
    }

    public static function resolveAdmissionDate(PDO $db, int $contactId): string {
        try {
            $stmtDep = $db->prepare("
                SELECT DATE(MIN(COALESCE(approved_at, created_at)))
                FROM deposits
                WHERE deleted_at IS NULL AND contact_id = ? AND status IN ('approved', 'completed', 'paid', 'pending')
            ");
            $stmtDep->execute([$contactId]);
            $dt = (string)$stmtDep->fetchColumn();
            if ($dt !== '' && strpos($dt, '0000') !== 0) return $dt;

            $stmtAct = $db->prepare("
                SELECT DATE(MIN(created_at))
                FROM activities
                WHERE deleted_at IS NULL AND contact_id = ?
                  AND (subject LIKE '%14%' OR subject LIKE '%Enrolled%' OR subject LIKE '%Học viên%' OR body LIKE '%14 – Enrolled%')
            ");
            $stmtAct->execute([$contactId]);
            $dt2 = (string)$stmtAct->fetchColumn();
            if ($dt2 !== '' && strpos($dt2, '0000') !== 0) return $dt2;
        } catch (\Throwable $e) {}
        return '';
    }

    private static function extractDocxContent(string $path): array {
        if (!class_exists('ZipArchive')) return ['text' => '', 'images' => []];
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) return ['text' => '', 'images' => []];
        $xml = $zip->getFromName('word/document.xml');
        $text = '';
        if ($xml) {
            $text = strip_tags(str_replace(['</w:p>', '</w:tr>', '</w:tc>', '<w:br/>', '<w:tab/>'], ["\n", "\n", " | ", "\n", " "], $xml));
            $text = html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
            $text = preg_replace("/[ \t]+/", " ", $text);
            $text = preg_replace("/\n\s*\n+/", "\n", trim($text));
        }
        $images = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $stat = $zip->statIndex($i);
            if ($stat && strpos($stat['name'], 'word/media/') === 0 && $stat['size'] > 15000) {
                $ext = strtolower(pathinfo($stat['name'], PATHINFO_EXTENSION));
                if (in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true)) {
                    $images[] = [
                        'name' => $stat['name'],
                        'size' => $stat['size'],
                        'bytes' => $zip->getFromIndex($i),
                        'ext' => $ext
                    ];
                }
            }
        }
        $zip->close();
        return ['text' => $text, 'images' => $images];
    }

    private static function compressImageBytes(string $bytes, string $mimeType): array {
        if (strlen($bytes) <= 900 * 1024 || !function_exists('imagecreatefromstring')) {
            return ['mimeType' => $mimeType, 'data' => base64_encode($bytes), 'rawLen' => strlen($bytes)];
        }
        $img = @imagecreatefromstring($bytes);
        if (!$img) {
            return ['mimeType' => $mimeType, 'data' => base64_encode($bytes), 'rawLen' => strlen($bytes)];
        }
        $w = imagesx($img);
        $h = imagesy($img);
        $maxDim = 1800;
        if ($w > $maxDim || $h > $maxDim) {
            $ratio = min($maxDim / $w, $maxDim / $h);
            $nw = (int)round($w * $ratio);
            $nh = (int)round($h * $ratio);
            $dst = imagecreatetruecolor($nw, $nh);
            $white = imagecolorallocate($dst, 255, 255, 255);
            imagefill($dst, 0, 0, $white);
            imagecopyresampled($dst, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
            imagedestroy($img);
            $img = $dst;
        }
        ob_start();
        imagejpeg($img, null, 82);
        $out = ob_get_clean();
        imagedestroy($img);
        return ['mimeType' => 'image/jpeg', 'data' => base64_encode((string)$out), 'rawLen' => strlen((string)$out)];
    }

    private static function callGemini(string $apiKey, string $model, array $parts): array {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/" . $model . ":generateContent?key=" . urlencode($apiKey);
        $payload = [
            'contents' => [['parts' => $parts]],
            'generationConfig' => [
                'temperature' => 0.05,
                'responseMimeType' => 'application/json'
            ]
        ];
        $jsonBody = json_encode($payload);
        for ($attempt = 1; $attempt <= 2; $attempt++) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
            curl_setopt($ch, CURLOPT_TIMEOUT, 60);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 12);
            curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($code === 200 && $res) {
                $j = json_decode((string)$res, true);
                $txt = $j['candidates'][0]['content']['parts'][0]['text'] ?? '';
                $txt = preg_replace('/^```json\s*/i', '', trim((string)$txt));
                $txt = preg_replace('/\s*```$/', '', (string)$txt);
                $parsed = json_decode((string)$txt, true);
                if (is_array($parsed)) return ['ok' => true, 'data' => $parsed];
            }
            if ($code === 429) {
                sleep(2);
                continue;
            }
            return ['ok' => false, 'code' => $code];
        }
        return ['ok' => false, 'code' => 0];
    }
}
