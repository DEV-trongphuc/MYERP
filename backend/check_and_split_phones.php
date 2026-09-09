<?php
// backend/check_and_split_phones.php
// Diagnostic and automated splitter: Detect and split multiple phone numbers in contacts and leads into phone (chính) and phone2 / mobile (phụ)

require_once __DIR__ . '/config/Config.php';
require_once __DIR__ . '/config/Database.php';

$pdo = Database::getInstance();
$isApply = in_array('--apply', $argv, true);

echo "=========================================================\n";
echo "   KIỂM TRA & TÁCH SỐ ĐIỆN THOẠI CHÍNH / PHỤ (MYERP)\n";
echo "   Chế độ: " . ($isApply ? "THỰC THI (--apply)" : "KIỂM TRA XEM TRƯỚC (--dry-run)") . "\n";
echo "=========================================================\n\n";

/**
 * Tách một chuỗi chứa nhiều SĐT thành mảng các số điện thoại hợp lệ
 */
function parseMultiplePhones(?string $raw): array {
    if (!$raw) return [];
    $raw = trim($raw);
    if (empty($raw)) return [];

    $results = [];

    // Trường hợp 1: Có ký tự phân cách (/ , ; - space | hoặc và)
    if (preg_match('/[\/,\r\n;|\&]|\s{2,}|\s+-\s+|\s+(?:hoặc|hoac|va|or|and)\s+/iu', $raw)) {
        $parts = preg_split('/[\/,\r\n;|\&]+|\s{2,}|\s+-\s+|\s+(?:hoặc|hoac|va|or|and)\s+/iu', $raw);
        foreach ($parts as $part) {
            $digits = preg_replace('/[^0-9]/', '', $part);
            if (strlen($digits) >= 9 && strlen($digits) <= 12) {
                if (!in_array($digits, $results, true)) {
                    $results[] = $digits;
                }
            }
        }
    }

    // Trường hợp 2: Ghép chuỗi số (18-35 số)
    if (count($results) < 2) {
        $digits = preg_replace('/[^0-9]/', '', $raw);
        if (!str_starts_with($digits, '0') && preg_match('/^[35789]/', $digits) && strlen($digits) >= 18) {
            $digits = '0' . $digits;
        }

        if (strlen($digits) >= 18) {
            // Tìm các số di động 10 số dạng 03x, 05x, 07x, 08x, 09x
            if (preg_match_all('/0[35789][0-9]{8}/', $digits, $matches)) {
                $uniqueMatches = [];
                foreach ($matches[0] as $m) {
                    if (!in_array($m, $uniqueMatches, true)) {
                        $uniqueMatches[] = $m;
                    }
                }
                if (count($uniqueMatches) >= 2) {
                    $results = $uniqueMatches;
                }
            }
            
            // Nếu 10 số đầu là số VN và phần còn lại là số phụ (có thể là số quốc tế hoặc đầu số cũ 11 số)
            if (count($results) < 2 && preg_match('/^(0[35789][0-9]{8})([0-9]{8,15})$/', $digits, $subM)) {
                $p2Str = $subM[2];
                // Nếu là số Lào 856... thì gắn dấu +
                if (str_starts_with($p2Str, '856')) {
                    $p2Str = '+' . $p2Str;
                }
                $results = [$subM[1], $p2Str];
            }
        }
    }

    // Trường hợp 3: 2 số cách nhau bởi đúng 1 khoảng trắng
    if (count($results) < 2 && strpos($raw, ' ') !== false) {
        $parts = explode(' ', $raw);
        $spaceMatches = [];
        foreach ($parts as $p) {
            $d = preg_replace('/[^0-9]/', '', $p);
            if (strlen($d) >= 9 && strlen($d) <= 11) {
                if (!in_array($d, $spaceMatches, true)) {
                    $spaceMatches[] = $d;
                }
            }
        }
        if (count($spaceMatches) >= 2) {
            $results = $spaceMatches;
        }
    }

    // Trường hợp 4: Chuỗi > 10 số (VD: trong leads có 16 số, 10 số đầu là số 1, phần còn lại là số 2)
    if (count($results) < 2) {
        $digits = preg_replace('/[^0-9]/', '', $raw);
        if (strlen($digits) > 10 && str_starts_with($digits, '0')) {
            $num1 = substr($digits, 0, 10);
            $num2 = substr($digits, 10);
            if (preg_match('/^0[35789][0-9]{8}$/', $num1) && strlen($num2) >= 4) {
                $results = [$num1, $num2];
            }
        }
    }

    return $results;
}

// ─────────────────────────────────────────────────────────────
// 1. KIỂM TRA BẢNG CONTACTS
// ─────────────────────────────────────────────────────────────
echo "[1] KIỂM TRA BẢNG CONTACTS...\n";
$stmtC = $pdo->query("
    SELECT id, full_name, phone, phone2, mobile 
    FROM contacts 
    WHERE deleted_at IS NULL 
      AND (
          phone LIKE '%/%' 
          OR phone LIKE '%,%' 
          OR phone LIKE '%;%' 
          OR phone LIKE '% - %'
          OR phone LIKE '%  %'
          OR LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '')) >= 18
      )
");
$allCandidatesC = $stmtC->fetchAll(PDO::FETCH_ASSOC);
echo "-> Số bản ghi contacts nghi vấn: " . count($allCandidatesC) . "\n";

$contactsToFix = [];
foreach ($allCandidatesC as $r) {
    $phones = parseMultiplePhones($r['phone'] ?? '');
    if (count($phones) >= 2) {
        $p1 = $phones[0];
        $p2 = implode(', ', array_slice($phones, 1));

        // Kiểm tra xem phone2 / mobile cũ có số hợp lệ khác không
        $oldP2 = trim($r['phone2'] ?? '');
        $oldMob = trim($r['mobile'] ?? '');
        $cleanOldP2 = preg_replace('/[^0-9]/', '', $oldP2);
        $cleanOldMob = preg_replace('/[^0-9]/', '', $oldMob);

        // Chỉ giữ old nếu có độ dài >= 9 số và khác p1, khác các số trong p2
        if (strlen($cleanOldP2) >= 9 && $cleanOldP2 !== $p1 && ('0' . $cleanOldP2) !== $p1 && !in_array($cleanOldP2, $phones, true)) {
            $p2 .= ', ' . $cleanOldP2;
        } elseif (strlen($cleanOldMob) >= 9 && $cleanOldMob !== $p1 && ('0' . $cleanOldMob) !== $p1 && !in_array($cleanOldMob, $phones, true)) {
            $p2 .= ', ' . $cleanOldMob;
        }

        $contactsToFix[] = [
            'id' => $r['id'],
            'name' => $r['full_name'],
            'raw_phone' => $r['phone'],
            'phone1' => $p1,
            'phone2' => $p2,
            'old_phone2' => $r['phone2'],
            'old_mobile' => $r['mobile']
        ];
    } else {
        echo "   [Bản ghi không đủ 2 SĐT]: ID {$r['id']} - {$r['full_name']} - '{$r['phone']}'\n";
    }
}

echo "-> Số contacts xác định chính xác để tách: " . count($contactsToFix) . "\n";
echo "10 ví dụ điển hình contacts:\n";
foreach (array_slice($contactsToFix, 0, 10) as $ex) {
    echo "  [ID: {$ex['id']}] {$ex['name']}\n";
    echo "    - Gốc:     '{$ex['raw_phone']}' (phone2 cũ: '{$ex['old_phone2']}', mobile cũ: '{$ex['old_mobile']}')\n";
    echo "    ➔ SĐT chính (phone):  '{$ex['phone1']}'\n";
    echo "    ➔ SĐT phụ (phone2 & mobile): '{$ex['phone2']}'\n\n";
}

// ─────────────────────────────────────────────────────────────
// 2. KIỂM TRA BẢNG LEADS
// ─────────────────────────────────────────────────────────────
echo "\n[2] KIỂM TRA BẢNG LEADS...\n";
$stmtL = $pdo->query("
    SELECT id, name, phone, phone2 
    FROM leads 
    WHERE (
          phone LIKE '%/%' 
          OR phone LIKE '%,%' 
          OR phone LIKE '%;%' 
          OR phone LIKE '% - %'
          OR phone LIKE '%  %'
          OR LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '')) >= 18
      )
");
$allCandidatesL = $stmtL->fetchAll(PDO::FETCH_ASSOC);
echo "-> Số bản ghi leads nghi vấn: " . count($allCandidatesL) . "\n";

$leadsToFix = [];
foreach ($allCandidatesL as $r) {
    $phones = parseMultiplePhones($r['phone'] ?? '');
    if (count($phones) >= 2) {
        $p1 = $phones[0];
        $p2 = implode(', ', array_slice($phones, 1));

        $oldP2 = trim($r['phone2'] ?? '');
        $cleanOldP2 = preg_replace('/[^0-9]/', '', $oldP2);
        if (strlen($cleanOldP2) >= 9 && $cleanOldP2 !== $p1 && !in_array($cleanOldP2, $phones, true)) {
            $p2 .= ', ' . $cleanOldP2;
        }

        $leadsToFix[] = [
            'id' => $r['id'],
            'name' => $r['name'],
            'raw_phone' => $r['phone'],
            'phone1' => $p1,
            'phone2' => $p2,
            'old_phone2' => $r['phone2']
        ];
    }
}

echo "-> Số leads xác định chính xác để tách: " . count($leadsToFix) . "\n";
echo "10 ví dụ điển hình leads:\n";
foreach (array_slice($leadsToFix, 0, 10) as $ex) {
    echo "  [ID: {$ex['id']}] {$ex['name']}\n";
    echo "    - Gốc:     '{$ex['raw_phone']}' (phone2 cũ: '{$ex['old_phone2']}')\n";
    echo "    ➔ SĐT chính (phone):  '{$ex['phone1']}'\n";
    echo "    ➔ SĐT phụ (phone2):   '{$ex['phone2']}'\n\n";
}

// ─────────────────────────────────────────────────────────────
// 3. THỰC THI NẾU CÓ CỜ --apply
// ─────────────────────────────────────────────────────────────
if ($isApply) {
    echo "\n[3] BẮT ĐẦU CẬP NHẬT DATABASE...\n";
    
    $upC = $pdo->prepare("
        UPDATE contacts 
        SET phone = ?, phone2 = ?, mobile = ?, updated_at = NOW() 
        WHERE id = ?
    ");
    $cSuccess = 0;
    foreach ($contactsToFix as $item) {
        $upC->execute([$item['phone1'], $item['phone2'], $item['phone2'], $item['id']]);
        $cSuccess++;
    }
    echo "-> Đã cập nhật thành công: $cSuccess contacts.\n";

    try {
        $leadCols = $pdo->query("DESCRIBE leads")->fetchAll(PDO::FETCH_COLUMN);
        $hasPhone2 = in_array('phone2', $leadCols, true);
        if (!$hasPhone2) {
            echo "-> Bảng leads chưa có cột phone2, đang tự động thêm cột phone2...\n";
            $pdo->exec("ALTER TABLE leads ADD COLUMN phone2 VARCHAR(50) NULL AFTER phone");
            $hasPhone2 = true;
        }

        $upL = $pdo->prepare("
            UPDATE leads 
            SET phone = ?, phone2 = ? 
            WHERE id = ?
        ");
        $lSuccess = 0;
        $lDuplicate = 0;
        foreach ($leadsToFix as $item) {
            $p2 = substr($item['phone2'], 0, 50);
            try {
                $upL->execute([$item['phone1'], $p2, $item['id']]);
                $lSuccess++;
            } catch (PDOException $e) {
                if ($e->getCode() == 23000) {
                    // Trùng phone trong leads: thử đảo số hoặc lưu phone2 và đánh dấu ghi chú
                    $lDuplicate++;
                    // Tìm xem bản ghi nào đang giữ số phone1
                    $stCheck = $pdo->prepare("SELECT id, name, phone, phone2 FROM leads WHERE phone = ? LIMIT 1");
                    $stCheck->execute([$item['phone1']]);
                    $existing = $stCheck->fetch(PDO::FETCH_ASSOC);
                    
                    // Thử cập nhật với phone2 làm chính nếu phone2 không trùng
                    $altSuccess = false;
                    if (!empty($p2)) {
                        $stCheck2 = $pdo->prepare("SELECT id FROM leads WHERE phone = ? LIMIT 1");
                        $stCheck2->execute([$p2]);
                        if (!$stCheck2->fetch()) {
                            // p2 chưa có trong leads, đảo p2 thành phone chính, p1 thành phone2
                            $upL->execute([$p2, $item['phone1'], $item['id']]);
                            $altSuccess = true;
                            $lSuccess++;
                            echo "  -> [Lead ID {$item['id']}] '{$item['name']}': Số {$item['phone1']} đã trùng với Lead #{$existing['id']}, đã đảo SĐT chính thành '$p2', SĐT phụ thành '{$item['phone1']}'.\n";
                        }
                    }
                    
                    if (!$altSuccess) {
                        // Cả 2 số đều đã tồn tại trong leads: Giữ phone hiện tại nhưng cập nhật phone2 để bảo toàn SĐT phụ
                        $upP2Only = $pdo->prepare("UPDATE leads SET phone2 = ? WHERE id = ?");
                        $upP2Only->execute([$p2, $item['id']]);
                        echo "  -> [Lead ID {$item['id']}] '{$item['name']}': Trùng số {$item['phone1']} với Lead #{$existing['id']}, đã lưu SĐT phụ '$p2'.\n";
                    }
                } else {
                    echo "  -> Lỗi lead {$item['id']}: " . $e->getMessage() . "\n";
                }
            }
        }
        echo "-> Đã cập nhật thành công: $lSuccess leads (trong đó $lDuplicate leads xử lý trùng lặp).\n";
        echo "\n[THÀNH CÔNG] Toàn bộ $cSuccess contacts và $lSuccess leads đã được xử lý tách SĐT chính / phụ an toàn!\n";
    } catch (Exception $ex) {
        echo "-> LỖI khi cập nhật leads: " . $ex->getMessage() . "\n";
    }
} else {
    echo "\n[GHI CHÚ] Chạy lại với cờ --apply để lưu các thay đổi trên vào database:\n";
    echo "php backend/check_and_split_phones.php --apply\n";
}
