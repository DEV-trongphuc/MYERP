<?php
/**
 * StudentDocOcrService.php
 * Automatic AI Vision & PDF/DOCX OCR Enrichment Service for Contacts/Students with Uploaded Files.
 *
 * 4-Layer Automation Capabilities:
 * 1. Scans all uploaded files (Images, PDFs, DOCX text + embedded DOCX images, 4x6 portrait photos) via Gemini 3.5 Flash Lite.
 * 2. Syncs missing fields across sibling records (matching Email or last 9 digits of Phone).
 * 3. Infers missing Student metadata: Program (from project/tags/notes/intake), Admission Date (from deposits/Stage 14), and Industry/Company.
 * 4. Automatically detects "suspect" contacts (has cloud_files but missing CCCD & Passport) and enriches them with audit logging.
 */

class StudentDocOcrService {
    public static function shouldScanContact(PDO $db, int $contactId): bool {
        if ($contactId <= 0) return false;
        try {
            $stmt = $db->prepare("
                SELECT citizen_id, passport, company, job_title, industry, birthday, gender, city, avatar_url, program, admission_date
                FROM contacts
                WHERE id = ? AND deleted_at IS NULL
                LIMIT 1
            ");
            $stmt->execute([$contactId]);
            $c = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$c) return false;

            $missingId = (trim((string)($c['citizen_id'] ?? '')) === '' && trim((string)($c['passport'] ?? '')) === '');
            $missingWork = (trim((string)($c['company'] ?? '')) === '' || trim((string)($c['job_title'] ?? '')) === '' || trim((string)($c['industry'] ?? '')) === '');
            $missingBio = (trim((string)($c['birthday'] ?? '')) === '' || trim((string)($c['gender'] ?? '')) === '' || trim((string)($c['city'] ?? '')) === '');
            $missingStu = (trim((string)($c['program'] ?? '')) === '' || trim((string)($c['admission_date'] ?? '')) === '' || strpos((string)($c['admission_date'] ?? ''), '0000') === 0);

            return ($missingId || $missingWork || $missingBio || $missingStu);
        } catch (\Throwable $e) {
            return false;
        }
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
                ORDER BY id ASC
            ");
            $stmtFiles->execute([$contactId]);
            $files = $stmtFiles->fetchAll(PDO::FETCH_ASSOC);

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

            // 1. Run Multimodal AI Document OCR if contact has files and needs ID/Work/Bio fields (or forceOcr=true)
            $needsDocOcr = $forceOcr
                || (trim((string)($contact['citizen_id'] ?? '')) === '' && trim((string)($contact['passport'] ?? '')) === '')
                || trim((string)($contact['company'] ?? '')) === ''
                || trim((string)($contact['job_title'] ?? '')) === ''
                || trim((string)($contact['birthday'] ?? '')) === ''
                || strpos((string)($contact['birthday'] ?? ''), '0000') === 0
                || trim((string)($contact['gender'] ?? '')) === '';

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

                    if (in_array($ext, ['webp', 'jpg', 'jpeg', 'png'], true) && preg_match('/(ảnh 4x6|4x6|ảnh thẻ|hình the|hình thẻ|hình 3x4|ảnh chân dung|portrait|photo|picture)/iu', $nLow)) {
                        if (!$photoCandidate && strpos($rel, 'deposits/') === false) {
                            $photoCandidate = 'https://myerp.ideas.edu.vn/backend/' . (strpos($rel, 'uploads/') === 0 ? $rel : 'uploads/' . $rel);
                        }
                        continue;
                    }

                    if (preg_match('/(acceptance_letter|bang diem|bảng điểm|bảng điểm|transcript|trans 01|trans 02|result-slip|phụ lục văn bằng|proposal)/iu', $nLow)) {
                        continue;
                    }

                    if ($ext === 'docx') {
                        $d = self::extractDocxContent($path);
                        if (!empty($d['text'])) {
                            $docxTexts[] = "=== FILE #$fid: $fname (DOCX) ===\n" . mb_substr($d['text'], 0, 12000);
                        }
                        if ((strlen($d['text']) < 200 || preg_match('/(cccd|cmnd|passport|id|form)/iu', $nLow)) && !empty($d['images'])) {
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
You are an expert Student Document OCR & Profile Extraction AI for MYERP.
Analyze ALL provided documents (Passports, CCCD/ID cards, Admission/Application Forms, CVs/Resumes, Contracts, Degrees) and the current DB record of this student, then extract the most complete and accurate profile in JSON format:
{
  "passport": "Passport number (e.g., C1234567, E01881509, P01234567). Uppercase, no spaces. Null if not found.",
  "citizen_id": "12-digit Vietnamese CCCD / Personal ID No or 9-digit CMND. Digits only. Null if not found.",
  "birthday": "Date of birth in YYYY-MM-DD format (documents use DD/MM/YYYY). Must be actual birth date (year < 2008), NEVER passport issue/expiry date!",
  "gender": "'Nam' or 'Nữ'",
  "address": "Fullest residential street address, ward, district, city, or place of birth/origin of the student.",
  "city": "Standardized Vietnamese province/city name in Vietnamese (e.g., 'Thành phố Hồ Chí Minh', 'Hà Nội', 'Bình Dương', 'Đồng Nai', 'Đà Nẵng', etc.).",
  "company": "Current or most recent company / employer / organization name from Admission Form ('Company name'), CV/Resume, or Motivation Letter.",
  "job_title": "Current or most recent job title / position from Admission Form ('Your position'), CV/Resume, or Motivation Letter.",
  "industry": "Standardized industry category from: ['Ngân hàng (Banking)', 'Tài chính - Chứng khoán - Đầu tư', 'Bất động sản & Xây dựng', 'Y tế - Dược phẩm - Bệnh viện', 'Công nghệ - Viễn thông - Media', 'Sản xuất - Công nghiệp - Năng lượng', 'Giáo dục & Đào tạo', 'Thương mại - Dịch vụ & Bán lẻ', 'Vận tải - Logistics - XNK', 'F&B - Khách sạn - Du lịch', 'Bảo hiểm (Insurance)', 'Cơ quan Nhà nước / Hành chính công', 'Kế toán - Kiểm toán - Tư vấn Luật', 'Nông nghiệp - Thủy sản - Thực phẩm', 'Marketing - Truyền thông & Quảng cáo'].",
  "program": "Academic program / school code if clearly stated in Admission Form or Contract (e.g., 'MSC-AI', 'EMBA', 'MBA HQ', 'DBA', 'UBIS', 'ESTIAM', 'SBS', 'ASCENCIA', 'IPAG', 'TOP UP'). Null if not found."
}
CRITICAL RULES:
1. NEVER extract Party A (IDEAS Academy) representative Mr. Pham Quang Vinh's CCCD (034068027300) or IDEAS office address (39B Truong Son / B82 Bach Dang) from Contracts! Only extract Party B (the student).
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
                        'current_company' => $contact['company'],
                        'current_job_title' => $contact['job_title'],
                        'current_industry' => $contact['industry'],
                        'current_birthday' => $contact['birthday'],
                        'current_gender' => $contact['gender'],
                        'current_address' => $contact['address'],
                        'current_city' => $contact['city']
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
                            if ($v !== null && $v !== '' && $v !== 'null') {
                                if ($k === 'citizen_id' && strpos((string)$v, '034068027300') !== false) continue;
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

            // Merge any existing fields from siblings into $mergedExtracted as fallback
            foreach ($targetContacts as $tc) {
                foreach (['passport', 'citizen_id', 'birthday', 'gender', 'address', 'city', 'company', 'job_title', 'industry', 'program'] as $f) {
                    $val = trim((string)($tc[$f] ?? ''));
                    if ($val !== '' && strpos($val, '0000') !== 0 && empty($mergedExtracted[$f])) {
                        $mergedExtracted[$f] = $val;
                    }
                }
                if (trim((string)($tc['avatar_url'] ?? '')) !== '' && empty($mergedExtracted['avatar_candidate'])) {
                    $mergedExtracted['avatar_candidate'] = trim((string)$tc['avatar_url']);
                }
            }

            // 3. Apply updates to target contact and its siblings
            $updatedCount = 0;
            $primaryUpdatedLabels = [];

            foreach ($targetContacts as $idx => $tc) {
                $tcId = (int)$tc['id'];
                $sets = [];
                $vals = [];
                $labels = [];

                if (trim((string)($tc['passport'] ?? '')) === '' && !empty($mergedExtracted['passport'])) {
                    $sets[] = "passport = ?";
                    $vals[] = trim((string)$mergedExtracted['passport']);
                    $labels[] = 'Passport';
                }
                if (trim((string)($tc['citizen_id'] ?? '')) === '' && !empty($mergedExtracted['citizen_id'])) {
                    $sets[] = "citizen_id = ?";
                    $vals[] = trim((string)$mergedExtracted['citizen_id']);
                    $labels[] = 'CCCD';
                }
                $curDob = trim((string)($tc['birthday'] ?? ''));
                $newDob = trim((string)($mergedExtracted['birthday'] ?? ''));
                if (($curDob === '' || strpos($curDob, '0000') === 0) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDob)) {
                    $sets[] = "birthday = ?";
                    $vals[] = $newDob;
                    $sets[] = "birth_date = ?";
                    $vals[] = $newDob;
                    $sets[] = "dob = ?";
                    $vals[] = $newDob;
                    $labels[] = 'Ngày sinh';
                }
                if (trim((string)($tc['gender'] ?? '')) === '' && !empty($mergedExtracted['gender'])) {
                    $g = trim((string)$mergedExtracted['gender']);
                    $normGen = (strtolower($g) === 'female' || $g === 'Nữ') ? 'Nữ' : ((strtolower($g) === 'male' || $g === 'Nam') ? 'Nam' : $g);
                    $sets[] = "gender = ?";
                    $vals[] = $normGen;
                    $labels[] = 'Giới tính';
                }
                if (trim((string)($tc['address'] ?? '')) === '' && !empty($mergedExtracted['address'])) {
                    $sets[] = "address = ?";
                    $vals[] = trim((string)$mergedExtracted['address']);
                    $labels[] = 'Địa chỉ';
                }
                if (trim((string)($tc['city'] ?? '')) === '' && !empty($mergedExtracted['city'])) {
                    $sets[] = "city = ?";
                    $vals[] = trim((string)$mergedExtracted['city']);
                    $labels[] = 'Tỉnh/TP';
                }

                // Resolve Company
                $resolvedCo = trim((string)($tc['company'] ?? ''));
                if ($resolvedCo === '') {
                    if (!empty($mergedExtracted['company'])) {
                        $resolvedCo = trim((string)$mergedExtracted['company']);
                    } elseif (trim((string)($tc['department'] ?? '')) !== '') {
                        $resolvedCo = trim((string)$tc['department']);
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
                    $sets[] = "job_title = ?";
                    $vals[] = $resolvedJob;
                    $labels[] = 'Chức vụ';
                }

                // Resolve Industry (from OCR or inferred from Company/Job Title)
                if (trim((string)($tc['industry'] ?? '')) === '') {
                    $ind = trim((string)($mergedExtracted['industry'] ?? ''));
                    if ($ind === '') {
                        $ind = self::inferIndustryFromText($resolvedCo . ' ' . $resolvedJob . ' ' . ($tc['notes'] ?? ''));
                    }
                    if ($ind !== '') {
                        $sets[] = "industry = ?";
                        $vals[] = $ind;
                        $labels[] = 'Ngành nghề';
                    }
                }

                // Resolve Program
                if (trim((string)($tc['program'] ?? '')) === '') {
                    $prog = trim((string)($mergedExtracted['program'] ?? ''));
                    if ($prog === '') {
                        $prog = self::inferProgramFromContact($tc);
                    }
                    if ($prog !== '') {
                        $sets[] = "program = ?";
                        $vals[] = $prog;
                        $labels[] = 'Chương trình';
                    }
                }

                // Resolve Admission Date for Students
                $isStu = ($tc['status'] === 'customer' || $tc['customer_type'] === 'student' || in_array((int)($tc['stage_id'] ?? 0), [13, 14, 43, 44], true) || !empty($tc['student_id']));
                $curAdm = trim((string)($tc['admission_date'] ?? ''));
                if ($isStu && ($curAdm === '' || strpos($curAdm, '0000') === 0)) {
                    $admDt = self::resolveAdmissionDate($db, $tcId);
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
                        $primaryUpdatedLabels = $labels;
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

            return [
                'updated' => $updatedCount > 0,
                'updated_records' => $updatedCount,
                'updated_fields' => $primaryUpdatedLabels,
                'extracted' => $mergedExtracted
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
                    // Record a marker activity so we don't re-scan files that genuinely contain no ID/Passport until a new file is uploaded
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

    public static function inferProgramFromContact(array $c): string {
        $pName = trim((string)($c['project_name'] ?? ''));
        if ($pName !== '') return $pName;

        $haystack = (string)($c['tags'] ?? '') . ' | ' . (string)($c['notes'] ?? '') . ' | ' . (string)($c['intake'] ?? '') . ' | ' . (string)($c['student_id'] ?? '');
        if (preg_match('/Trường:\s*([^|\n\r,]+)/ui', $haystack, $m)) {
            return trim($m[1]);
        }
        if (preg_match('/\b(MSC[\s\-]*AI|EMBA|MBA[\s\-]*HQ|MBA|DBA|UBIS|ASCENCIA|ESTIAM|IPAG|SBS|TOP[\s\-]*UP|BACHELOR|CESINE|PARIS[\s\-]*PG|HELBUS)\b/ui', $haystack, $m)) {
            return strtoupper(trim($m[1]));
        }
        return '';
    }

    public static function inferIndustryFromText(string $raw): string {
        $txt = mb_strtolower(trim($raw), 'UTF-8');
        if ($txt === '') return '';
        if (preg_match('/(hr|nhân sự|l&d|talent|training|coaching|giáo dục|education|teacher|lecturer|university|school|academy)/ui', $txt)) {
            return 'Giáo dục & Đào tạo';
        }
        if (preg_match('/(bank|ngân hàng|vietcombank|techcombank|vpbank|acb|mb|bidv|vietinbank|sacombank|hdbank|vib|tpbank|shb)/ui', $txt)) {
            return 'Ngân hàng (Banking)';
        }
        if (preg_match('/(finance|tài chính|kế toán|accounting|audit|tax|chứng khoán|trader|invest|quỹ|fund)/ui', $txt)) {
            return 'Tài chính - Chứng khoán - Đầu tư';
        }
        if (preg_match('/(bảo hiểm|insurance|manulife|prudential|AIA|dai-ichi|fwd|chubb|baoviet)/ui', $txt)) {
            return 'Bảo hiểm (Insurance)';
        }
        if (preg_match('/(it|software|tech|developer|engineer|data|ai|network|telecom|media|viễn thông|fpt|viettel|vnpt)/ui', $txt)) {
            return 'Công nghệ - Viễn thông - Media';
        }
        if (preg_match('/(pharma|dược|bệnh viện|hospital|clinic|y tế|medical|doctor|bác sĩ|nha khoa)/ui', $txt)) {
            return 'Y tế - Dược phẩm - Bệnh viện';
        }
        if (preg_match('/(real estate|bất động sản|xây dựng|construction|concrete|architect|kiến trúc|nội thất)/ui', $txt)) {
            return 'Bất động sản & Xây dựng';
        }
        if (preg_match('/(logistics|supply chain|vận tải|xuất nhập khẩu|import|export|shipping|forwarder|cảng)/ui', $txt)) {
            return 'Vận tải - Logistics - XNK';
        }
        if (preg_match('/(marketing|brand|quảng cáo|pr|agency|event|truyền thông)/ui', $txt)) {
            return 'Marketing - Truyền thông & Quảng cáo';
        }
        if (preg_match('/(manufacturing|sản xuất|factory|nhà máy|quality|qa|qc|energy|dầu khí|petro|cơ khí|điện)/ui', $txt)) {
            return 'Sản xuất - Công nghiệp - Năng lượng';
        }
        if (preg_match('/(hotel|khách sạn|resort|du lịch|travel|tour|restaurant|nhà hàng|f&b|cafe)/ui', $txt)) {
            return 'F&B - Khách sạn - Du lịch';
        }
        if (preg_match('/(retail|bán lẻ|thương mại|sales|kinh doanh|fmcg|distribution|phân phối)/ui', $txt)) {
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
