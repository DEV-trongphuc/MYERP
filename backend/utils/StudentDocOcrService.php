<?php
/**
 * StudentDocOcrService.php
 * Automatic AI Vision & PDF/DOCX OCR Enrichment Service for Contacts/Students with Uploaded Files.
 * Whenever a contact has attached documents (cloud_files) and is missing CCCD/Passport or profile fields,
 * this service scans the documents via Gemini 3.5 Flash Lite and populates missing fields + sibling records.
 */

class StudentDocOcrService {
    public static function shouldScanContact(PDO $db, int $contactId): bool {
        if ($contactId <= 0) return false;
        try {
            $stmt = $db->prepare("
                SELECT citizen_id, passport, company, job_title, industry, birthday, gender, city, avatar_url
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

            return ($missingId || $missingWork || $missingBio);
        } catch (\Throwable $e) {
            return false;
        }
    }

    public static function scanAndEnrichContact(PDO $db, int $contactId): array {
        if ($contactId <= 0) return ['updated' => false, 'reason' => 'invalid_contact_id'];

        try {
            $stmtC = $db->prepare("SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL LIMIT 1");
            $stmtC->execute([$contactId]);
            $contact = $stmtC->fetch(PDO::FETCH_ASSOC);
            if (!$contact) return ['updated' => false, 'reason' => 'contact_not_found'];

            $stmtFiles = $db->prepare("SELECT id, name, file_path, mime_type, category FROM cloud_files WHERE contact_id = ? ORDER BY id ASC");
            $stmtFiles->execute([$contactId]);
            $files = $stmtFiles->fetchAll(PDO::FETCH_ASSOC);
            if (empty($files)) return ['updated' => false, 'reason' => 'no_files'];

            $apiKey = trim((string)$db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'gemini_api_key'")->fetchColumn());
            if ($apiKey === '') {
                $apiKey = trim((string)($_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: ''));
            }
            if ($apiKey === '') return ['updated' => false, 'reason' => 'no_api_key'];

            $model = trim((string)$db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'gemini_model'")->fetchColumn()) ?: 'gemini-3.5-flash-lite';
            $baseDir = dirname(__DIR__) . '/';

            $docxTexts = [];
            $binaryItems = [];
            $photoCandidate = null;

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
            if (!empty($curBatch) || empty($batches)) {
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
  "industry": "Standardized industry category from: ['Ngân hàng (Banking)', 'Tài chính - Chứng khoán - Đầu tư', 'Bất động sản & Xây dựng', 'Y tế - Dược phẩm - Bệnh viện', 'Công nghệ - Viễn thông - Media', 'Sản xuất - Công nghiệp - Năng lượng', 'Giáo dục & Đào tạo', 'Thương mại - Dịch vụ & Bán lẻ', 'Vận tải - Logistics - XNK', 'F&B - Khách sạn - Du lịch', 'Bảo hiểm (Insurance)', 'Cơ quan Nhà nước / Hành chính công', 'Kế toán - Kiểm toán - Tư vấn Luật', 'Nông nghiệp - Thủy sản - Thực phẩm', 'Marketing - Truyền thông & Quảng cáo']."
}
CRITICAL RULES:
1. NEVER extract Party A (IDEAS Academy) representative Mr. Pham Quang Vinh's CCCD (034068027300) or IDEAS office address (39B Truong Son / B82 Bach Dang) from Contracts! Only extract Party B (the student).
2. Return ONLY valid JSON.
EOT;

            $mergedExtracted = [];
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

            $mergedExtracted['avatar_candidate'] = $photoCandidate;
            if (empty($mergedExtracted)) {
                return ['updated' => false, 'reason' => 'nothing_extracted'];
            }

            // Apply to contact and any sibling contacts
            $targetContacts = [$contact];
            $conds = [];
            $params = [$contactId];
            $normPhone = preg_replace('/\D/', '', (string)($contact['phone'] ?? ''));
            if (strlen($normPhone) >= 8) {
                $conds[] = "phone LIKE ?";
                $params[] = "%" . substr($normPhone, -8) . "%";
            }
            if (!empty($contact['email']) && strpos($contact['email'], '@') !== false) {
                $conds[] = "LOWER(TRIM(email)) = LOWER(TRIM(?))";
                $params[] = $contact['email'];
            }
            if (!empty($conds)) {
                $stmtSib = $db->prepare("SELECT * FROM contacts WHERE deleted_at IS NULL AND id != ? AND (" . implode(" OR ", $conds) . ")");
                $stmtSib->execute($params);
                foreach ($stmtSib->fetchAll(PDO::FETCH_ASSOC) as $sib) {
                    $targetContacts[] = $sib;
                }
            }

            $updatedCount = 0;
            foreach ($targetContacts as $tc) {
                $tcId = (int)$tc['id'];
                $sets = [];
                $vals = [];

                if (trim((string)($tc['passport'] ?? '')) === '' && !empty($mergedExtracted['passport'])) {
                    $sets[] = "passport = ?";
                    $vals[] = trim((string)$mergedExtracted['passport']);
                }
                if (trim((string)($tc['citizen_id'] ?? '')) === '' && !empty($mergedExtracted['citizen_id'])) {
                    $sets[] = "citizen_id = ?";
                    $vals[] = trim((string)$mergedExtracted['citizen_id']);
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
                }
                if (trim((string)($tc['gender'] ?? '')) === '' && !empty($mergedExtracted['gender'])) {
                    $g = trim((string)$mergedExtracted['gender']);
                    $normGen = (strtolower($g) === 'female' || $g === 'Nữ') ? 'Nữ' : ((strtolower($g) === 'male' || $g === 'Nam') ? 'Nam' : $g);
                    $sets[] = "gender = ?";
                    $vals[] = $normGen;
                }
                if (trim((string)($tc['address'] ?? '')) === '' && !empty($mergedExtracted['address'])) {
                    $sets[] = "address = ?";
                    $vals[] = trim((string)$mergedExtracted['address']);
                }
                if (trim((string)($tc['city'] ?? '')) === '' && !empty($mergedExtracted['city'])) {
                    $sets[] = "city = ?";
                    $vals[] = trim((string)$mergedExtracted['city']);
                }
                if (trim((string)($tc['company'] ?? '')) === '' && !empty($mergedExtracted['company'])) {
                    $sets[] = "company = ?";
                    $vals[] = trim((string)$mergedExtracted['company']);
                    if (trim((string)($tc['department'] ?? '')) === '') {
                        $sets[] = "department = ?";
                        $vals[] = trim((string)$mergedExtracted['company']);
                    }
                }
                if (trim((string)($tc['job_title'] ?? '')) === '' && !empty($mergedExtracted['job_title'])) {
                    $sets[] = "job_title = ?";
                    $vals[] = trim((string)$mergedExtracted['job_title']);
                }
                if (trim((string)($tc['industry'] ?? '')) === '' && !empty($mergedExtracted['industry'])) {
                    $sets[] = "industry = ?";
                    $vals[] = trim((string)$mergedExtracted['industry']);
                }
                if (trim((string)($tc['avatar_url'] ?? '')) === '' && !empty($mergedExtracted['avatar_candidate'])) {
                    $sets[] = "avatar_url = ?";
                    $vals[] = trim((string)$mergedExtracted['avatar_candidate']);
                }

                if (!empty($sets)) {
                    $vals[] = $tcId;
                    $db->prepare("UPDATE contacts SET " . implode(", ", $sets) . " WHERE id = ?")->execute($vals);
                    $updatedCount++;
                }
            }

            return ['updated' => $updatedCount > 0, 'updated_records' => $updatedCount, 'extracted' => $mergedExtracted];
        } catch (\Throwable $e) {
            error_log("StudentDocOcrService error for contact #$contactId: " . $e->getMessage());
            return ['updated' => false, 'error' => $e->getMessage()];
        }
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
