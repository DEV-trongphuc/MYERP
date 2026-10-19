<?php
// api/ai_training_core.php
// Core logic for AI Training (Embeddings & Vector DB)
// decouple from HTTP request so it can be run by Worker

// Prevent timeout — worker chạy ngầm, không giới hạn thời gian
set_time_limit(0);
ignore_user_abort(true);
ini_set('memory_limit', '1024M'); // Đủ RAM cho xử lý PDF lớn

require_once 'db_connect.php';

if (!function_exists('training_log')) {
    function training_log($msg)
    {
        if (is_array($msg) || is_object($msg))
            $msg = json_encode($msg);
        $logFile = __DIR__ . '/training_debug.log';
        $date = date('Y-m-d H:i:s');
        @file_put_contents($logFile, "[$date] $msg\n", FILE_APPEND);
    }
}

if (!function_exists('callGeminiBatchEmbedding')) {
    function callGeminiBatchEmbedding($texts, $apiKey)
    {
        if (empty($apiKey))
            return ['error' => 'API Key is empty'];

        $model = "gemini-embedding-001";
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:batchEmbedContents";

        $requests = [];
        foreach ($texts as $t) {
            $requests[] = [
                "model" => "models/{$model}",
                "content" => ["parts" => [["text" => $t]]]
            ];
        }

        $payload = ["requests" => $requests];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-goog-api-key: ' . $apiKey
        ]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // [FIX P37-ATC] Always verify SSL
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);   // [FIX P37-ATC] Hostname verification
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $result = json_decode($response, true);
        if ($httpCode !== 200) {
            $msg = $result['error']['message'] ?? 'Gemini API Error (HTTP ' . $httpCode . ')';
            return ['error' => $msg];
        }

        if (isset($result['embeddings'])) {
            return $result['embeddings'];
        }
        return ['error' => 'No embeddings returned'];
    }
}

// ============================================================
// CHUNK TEXT (GIỮ NGUYÊN LOGIC CŨ - cho TXT/Manual)
// ============================================================
if (!function_exists('chunkText')) {
    function chunkText($text, $chunkSize = 400, $overlap = 60)
    {
        if (mb_strlen($text) <= $chunkSize) {
            return [$text];
        }
        $chunks = [];
        $length = mb_strlen($text);
        $start = 0;
        while (
            $start <
            $length
        ) {
            $maxEnd = min($start + $chunkSize, $length);
            if ($maxEnd >= $length) {
                $chunk = mb_substr($text, $start);
                $chunks[] = trim($chunk);
                break;
            }

            // Find nearest sentence break to avoid cutting words
            $sub = mb_substr($text, $start, $chunkSize);
            $lastPunct = mb_strrpos($sub, '.');
            $breakPoint = $chunkSize;
            if ($lastPunct !== false && $lastPunct > ($chunkSize * 0.2)) {
                $breakPoint = $lastPunct + 1;
            }

            $chunk = mb_substr($text, $start, $breakPoint);
            $chunks[] = trim($chunk);

            $step = max(1, $breakPoint - $overlap);
            $start += $step;
        }
        return $chunks;
    }
}

// ============================================================
// CHUNK SECTION (MỚI - cho sách PDF/DOCX, giữ metadata trang/chương)
// ============================================================
if (!function_exists('chunkSection')) {
    function chunkSection(array $section, int $chunkSize = 700, int $overlap = 150): array
    {
        $content = trim($section['content'] ?? '');
        if (empty($content))
            return [];

        $baseMetadata = [
            'page_start' => $section['page_start'] ?? null,
            'page_end' => $section['page_end'] ?? null,
            'chapter_index' => $section['chapter_index'] ?? null,
            'chapter_title' => $section['chapter_title'] ?? '',
            'section_title' => $section['title'] ?? '',
        ];

        if (mb_strlen($content) <= $chunkSize) {
            return [
                array_merge($baseMetadata, [
                    'content' => $content,
                    'chunk_index' => 0,
                    'total_chunks' => 1,
                ])
            ];
        }

        $paragraphs = preg_split('/\n{2,}/', $content);
        $chunks = [];
        $buffer = '';
        $chunkIdx = 0;

        foreach ($paragraphs as $para) {
            $para = trim($para);
            if (empty($para))
                continue;

            if (mb_strlen($para) > $chunkSize) {
                if (!empty(trim($buffer))) {
                    $chunks[] = array_merge($baseMetadata, [
                        'content' => trim($buffer),
                        'chunk_index' => $chunkIdx++,
                    ]);
                    $buffer = mb_strlen($buffer) > $overlap ? mb_substr($buffer, -$overlap) : $buffer;
                }

                $sentences = preg_split('/(?<=[.!?:。])\s+ /u', $para, -1, PREG_SPLIT_NO_EMPTY);
                foreach ($sentences as $sent) {
                    $sent = trim($sent);
                    if (mb_strlen($buffer) + mb_strlen($sent) + 1 > $chunkSize && !empty(trim($buffer))) {
                        $chunks[] = array_merge($baseMetadata, [
                            'content' => trim($buffer),
                            'chunk_index' => $chunkIdx++,
                        ]);
                        $buffer = mb_strlen($buffer) > $overlap ? mb_substr($buffer, -$overlap) . ' ' : $buffer . ' ';
                    }
                    $buffer .= $sent . ' ';
                }
                continue;
            }

            if (mb_strlen($buffer) + mb_strlen($para) + 2 > $chunkSize && !empty(trim($buffer))) {
                $chunks[] = array_merge($baseMetadata, [
                    'content' => trim($buffer),
                    'chunk_index' => $chunkIdx++,
                ]);
                $buffer = mb_strlen($buffer) > $overlap ? mb_substr($buffer, -$overlap) . "\n\n" : '';
            }
            $buffer .= $para . "\n\n";
        }

        if (!empty(trim($buffer))) {
            $chunks[] = array_merge($baseMetadata, [
                'content' => trim($buffer),
                'chunk_index' => $chunkIdx,
            ]);
        }

        $total = count($chunks);
        foreach ($chunks as &$c) {
            $c['total_chunks'] = $total;
        }
        unset($c);

        return $chunks;
    }
}

if (!function_exists('updatePropertyTermStats')) {
    function updatePropertyTermStats($pdo, $propertyId)
    {
        try {
            $pdo->prepare("DELETE FROM ai_term_stats WHERE property_id = ?")->execute([$propertyId]);
            $stmt = $pdo->prepare("SELECT content FROM domation_ai_training_chunks WHERE property_id = ?");
            $stmt->execute([$propertyId]);
            $termDf = [];
            while ($content = $stmt->fetch(PDO::FETCH_COLUMN)) {
                $contentLower = mb_strtolower($content);
                $clean = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $contentLower);
                $words = preg_split('/\s+/u', $clean, -1, PREG_SPLIT_NO_EMPTY);
                $uniqueWordsInChunk = array_unique($words);
                foreach ($uniqueWordsInChunk as $w) {
                    if (mb_strlen($w) >= 2) {
                        $termDf[$w] = ($termDf[$w] ?? 0) + 1;
                    }
                }
                // Flush từng 10,000 terms để tránh OOM
                if (count($termDf) > 10000) {
                    flushTermStatsToDb($pdo, $propertyId, $termDf);
                    $termDf = [];
                }
            }
            if (!empty($termDf)) {
                flushTermStatsToDb($pdo, $propertyId, $termDf);
            }
        } catch (Exception $e) {
            error_log("updatePropertyTermStats Error: " . $e->getMessage());
        }
    }

    function flushTermStatsToDb($pdo, $propertyId, $data)
    {
        if (empty($data))
            return;
        $pdo->beginTransaction();
        try {
            // [FIX] Dùng ON DUPLICATE KEY UPDATE để tránh crash khi term đã tồn tại
            $stmt = $pdo->prepare(
                "INSERT INTO ai_term_stats (term, property_id, df) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE df = df + VALUES(df)"
            );
            foreach ($data as $term => $count) {
                $stmt->execute([mb_substr($term, 0, 100), $propertyId, $count]);
            }
            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}

if (!function_exists('ensureBookColumns')) {
    function ensureBookColumns($pdo)
    {
        $tables = ['domation_ai_training_docs', 'domation_ai_training_chunks'];
        foreach ($tables as $table) {
            $stmt = $pdo->query("SHOW COLUMNS FROM {$table}");
            $cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if ($table === 'domation_ai_training_docs') {
                if (!in_array('book_title', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_docs ADD COLUMN book_title VARCHAR(500) DEFAULT NULL");
                if (!in_array('book_author', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_docs ADD COLUMN book_author VARCHAR(255) DEFAULT NULL");
                if (!in_array('total_pages', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_docs ADD COLUMN total_pages INT DEFAULT NULL");
                if (!in_array('tags', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_docs ADD COLUMN tags TEXT DEFAULT NULL");
                if (!in_array('parent_id', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_docs ADD COLUMN parent_id VARCHAR(50) DEFAULT '0'");
                if (!in_array('is_global_workspace', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_docs ADD COLUMN is_global_workspace TINYINT(1) DEFAULT 0");
                if (!in_array('uploaded_by', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_docs ADD COLUMN uploaded_by VARCHAR(100) DEFAULT NULL");
            } else if ($table === 'domation_ai_training_chunks') {
                if (!in_array('tags', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN tags TEXT DEFAULT NULL");
                if (!in_array('page_start', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN page_start INT DEFAULT NULL");
                if (!in_array('page_end', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN page_end INT DEFAULT NULL");
                if (!in_array('chapter_index', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN chapter_index INT DEFAULT NULL");
                if (!in_array('chapter_title', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN chapter_title VARCHAR(500) DEFAULT NULL");
                if (!in_array('section_title', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN section_title VARCHAR(500) DEFAULT NULL");
                if (!in_array('chunk_index', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN chunk_index INT DEFAULT 0");
                if (!in_array('total_chunks', $cols))
                    $pdo->exec("ALTER TABLE domation_ai_training_chunks ADD COLUMN total_chunks INT DEFAULT 1");
            }
        }
    }
}

function processTrainingBuffer($pdo, $propertyId, $apiKey, $batch, &$processedDocIds)
{
    if (empty($batch))
        return 0;
    $texts = array_column($batch, 'metadata_text');
    $batchDocIds = array_values(array_unique(array_column($batch, 'doc_id')));

    // Heartbeat: Update status to show we are calling Gemini
    $ePlaceholders = str_repeat('?,', count($batchDocIds) - 1) . '?';
    $pdo->prepare("UPDATE domation_ai_training_docs SET error_message = 'Đang tạo vector (Embedding) cho " . count($batch) . " đoạn văn...' WHERE id IN ($ePlaceholders)")
        ->execute($batchDocIds);

    // [FIX] Retry tối đa 3 lần khi gặp 429 Rate Limit từ Gemini
    $maxRetries = 3;
    $embeddings = null;
    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        $embeddings = callGeminiBatchEmbedding($texts, $apiKey);
        if (!isset($embeddings['error'])) {
            break; // Thành công
        }
        $errMsg = $embeddings['error'];
        $isRateLimit = (
            stripos($errMsg, '429') !== false ||
            stripos($errMsg, 'quota') !== false ||
            stripos($errMsg, 'rate') !== false ||
            stripos($errMsg, 'Resource has been exhausted') !== false
        );
        if ($isRateLimit && $attempt < $maxRetries) {
            $sleepSec = 30 * $attempt; // 30s, 60s
            training_log("Rate limit hit (attempt {$attempt}/{$maxRetries}). Sleeping {$sleepSec}s before retry...");
            $pdo->prepare("UPDATE domation_ai_training_docs SET error_message = 'Rate limit API, đang đợi {$sleepSec}s để thử lại (lần {$attempt}/{$maxRetries})...' WHERE id IN ($ePlaceholders)")
                ->execute(array_values($batchDocIds));
            sleep($sleepSec);
        } else {
            // Lỗi không thể retry hoặc đã hết lần thử
            training_log("Gemini Embedding Error (final attempt {$attempt}/{$maxRetries}): " . $errMsg . " for property_id=" . $propertyId);
            if (!empty($batchDocIds)) {
                $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'error', error_message = ? WHERE id IN ($ePlaceholders)")
                    ->execute(array_merge([$errMsg], array_values($batchDocIds)));
            }
            return 0;
        }
    }

    if (isset($embeddings['error'])) {
        // Vẫn lỗi sau tất cả lần retry
        if (!empty($batchDocIds)) {
            $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'error', error_message = ? WHERE id IN ($ePlaceholders)")
                ->execute(array_merge([$embeddings['error']], array_values($batchDocIds)));
        }
        return 0;
    }

    // ★ Micro-Throttle: Tốc độ xử lý thả ga nhờ vào Auto-Retry Catch. Chỉ tạm nghỉ 0.5s để giữ an toàn HTTP connection.
    usleep(500000);

    $pdo->prepare("UPDATE domation_ai_training_docs SET error_message = 'Đã nhận vector, đang lưu " . count($batch) . " đoạn vào DB...' WHERE id IN ($ePlaceholders)")
        ->execute(array_values($batchDocIds));
    $cInserted = 0;
    $pdo->beginTransaction();
    try {
        $stmtInsert = $pdo->prepare("INSERT INTO domation_ai_training_chunks (id, doc_id, property_id, content,
            metadata_text, embedding, embedding_binary, vector_norm, tags, priority_level, page_start, page_end,
            chapter_index, chapter_title, section_title, chunk_index, total_chunks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?)");
        foreach ($batch as $index => $chunkItem) {
            $vector = $embeddings[$index]['values'] ?? null;
            if (!$vector)
                continue;
            $chunkId = bin2hex(random_bytes(18));
            $norm = 0;
            foreach ($vector as $v)
                $norm += $v * $v;
            $norm = sqrt($norm);
            $packed = pack('f*', ...$vector);
            $stmtInsert->execute([
                $chunkId,
                $chunkItem['doc_id'],
                $propertyId,
                $chunkItem['content'],
                $chunkItem['metadata_text'],
                json_encode($vector),
                $packed,
                $norm,
                $chunkItem['tags'] ?? '[]',
                $chunkItem['priority'] ?? 0,
                $chunkItem['page_start'] ?? null,
                $chunkItem['page_end'] ?? null,
                $chunkItem['chapter_index'] ?? null,
                $chunkItem['chapter_title'] ?? '',
                $chunkItem['section_title'] ?? '',
                $chunkItem['chunk_index'] ?? 0,
                $chunkItem['total_chunks'] ?? 1
            ]);
            $cInserted++;
        }
        if (!empty($batchDocIds)) {
            $ePlaceholders = str_repeat('?,', count($batchDocIds) - 1) . '?';
            $pdo->prepare("UPDATE domation_ai_training_docs SET error_message = 'Đã băm xong " . count($batch) . " đoạn, đang lưu vào bộ nhớ...' WHERE id IN ($ePlaceholders)")
                ->execute(array_values($batchDocIds));
            foreach ($batchDocIds as $bid)
                $processedDocIds[] = $bid;
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        training_log("Transaction error: " . $e->getMessage());
    }
    return $cInserted;
}

function trainDocsCore($pdo, $propertyId, $docIds, $adminId = null)
{
    $GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: '';
    ensureBookColumns($pdo);
    if (empty($docIds)) {
        $stmt = $pdo->prepare("SELECT id FROM domation_ai_training_docs WHERE property_id = ? AND status = 'pending' AND
            source_type != 'folder'");
        $stmt->execute([$propertyId]);
        $docIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
    if (empty($docIds))
        return ['success' => true, 'message' => 'Nothing to train'];

    try {
        $pdo->prepare("UPDATE ai_chatbot_settings SET gemini_cache_name = NULL, gemini_cache_expires_at = NULL WHERE
                property_id = ?")->execute([$propertyId]);
        $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);

        $stmtKey = $pdo->prepare("SELECT s.gemini_api_key, s.chunk_size, s.chunk_overlap, c.gemini_api_key as
            cat_key FROM ai_chatbot_settings s LEFT JOIN ai_chatbots b ON s.property_id = b.id LEFT JOIN
            ai_chatbot_settings c ON b.category_id = c.property_id WHERE s.property_id = ? LIMIT 1");
        $stmtKey->execute([$propertyId]);
        $propSettings = $stmtKey->fetch(PDO::FETCH_ASSOC) ?: [];
        $activeApiKey = (!empty($propSettings['gemini_api_key'])) ? $propSettings['gemini_api_key'] :
            ((!empty($propSettings['cat_key'])) ? $propSettings['cat_key'] : $GEMINI_API_KEY);

        require_once 'file_extractor.php';
        $placeholders = str_repeat('?,', count($docIds) - 1) . '?';
        $stmtDocs = $pdo->prepare("SELECT id, name, source_type, content, metadata, tags, priority FROM domation_ai_training_docs WHERE id IN ($placeholders)"); // [FIX P37-ATC] Explicit columns — content is MEDIUMTEXT but needed for text training
        $stmtDocs->execute($docIds);

        // [FIX] Chỉ DELETE chunks của các doc KHÔNG đang trong pipeline chunked_extraction
        // Nếu doc đang xử lý theo chunked pipeline (Pipeline A) → bỏ qua để tránh xóa nhầm
        $safeToDeleteIds = [];
        $tempRes = $pdo->prepare("SELECT id, metadata, status FROM domation_ai_training_docs WHERE id IN ($placeholders)");
        $tempRes->execute($docIds);
        foreach ($tempRes->fetchAll(PDO::FETCH_ASSOC) as $tempRow) {
            $tempMeta = json_decode($tempRow['metadata'] ?? '{}', true);
            if (!empty($tempMeta['chunked_extraction']) && $tempRow['status'] === 'processing') {
                training_log("trainDocsCore: SKIP delete chunks for doc {$tempRow['id']} — đang trong chunked pipeline");
                continue;
            }
            $safeToDeleteIds[] = $tempRow['id'];
        }
        if (!empty($safeToDeleteIds)) {
            $safePlaceholders = str_repeat('?,', count($safeToDeleteIds) - 1) . '?';
            $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id IN ($safePlaceholders)")->execute($safeToDeleteIds);
        }

        $processedDocIds = [];
        $successCount = 0;
        $chunkBuffer = [];
        $BATCH_SIZE = 20;

        while ($row = $stmtDocs->fetch(PDO::FETCH_ASSOC)) {
            training_log("Starting training for Document ID={$row['id']}, Name={$row['name']}");
            $meta = json_decode($row['metadata'] ?? '{}', true);
            $sourceType = $row['source_type'];
            $ext = strtolower(pathinfo($row['name'] ?? '', PATHINFO_EXTENSION));

            // [NEW] Skip PDFs that are handled by chunked extraction (they go through ai_pdf_chunk queue)
            if ($sourceType === 'upload' && $ext === 'pdf' && !empty($meta['chunked_extraction'])) {
                training_log("Skipping doc ID={$row['id']} (handled by ai_pdf_chunk queue)");
                continue;
            }

            if ($sourceType === 'upload' && in_array($ext, ['pdf', 'docx', 'doc'])) {
                set_time_limit(300); // Reset timer for each large file (5 min)
                $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'processing', error_message = 'Đang trích xuất nội dung từ file...' WHERE id = ?")->execute([$row['id']]);
                $filePath = __DIR__ . '/../uploads/ai_training/' . basename($meta['file_url'] ?? '');
                $bookData = extractTextFromFile($filePath, $ext, $activeApiKey);
                if (isset($bookData['error'])) {
                    training_log("FAILED Extraction: " . $bookData['error'] . " for file " . $row['name']);
                    $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'error', error_message = ? WHERE id =
            ?")->execute([$bookData['error'], $row['id']]);
                    training_log("Extraction error for {$row['name']}: " . $bookData['error']);
                    continue;
                }
                training_log("Successfully extracted text from {$row['name']}. Chapters found: " . count($bookData['chapters']));
                training_log("Extracted Meta: Title=" . ($bookData['title'] ?? 'N/A') . ", Author=" . ($bookData['author'] ?? 'N/A'));

                $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'processing', error_message = 'Đang băm nhỏ dữ liệu và tạo bộ nhớ vector...' WHERE id = ?")->execute([$row['id']]);

                // [FIX] Normalize metadata keys
                $bookTitle = $bookData['book_title'] ?? $bookData['title'] ?? $row['name'];
                $bookAuthor = $bookData['author'] ?? $bookData['book_author'] ?? '';
                $totalPages = $bookData['total_pages'] ?? null;

                // Reconstruct full text to save into DB so user can see what's extracted
                $fullExtractedText = "";
                if (is_array($bookData['chapters'])) {
                    foreach ($bookData['chapters'] as $chapter) {
                        $fullExtractedText .= "## " . ($chapter['title'] ?? 'Chapter') . "\n";
                        if (isset($chapter['sections']) && is_array($chapter['sections'])) {
                            foreach ($chapter['sections'] as $section) {
                                if (!empty($section['title']))
                                    $fullExtractedText .= "### " . $section['title'] . "\n";
                                $fullExtractedText .= ($section['content'] ?? '') . "\n\n";
                            }
                        }
                    }
                }

                // Limit to about 1M chars to avoid DB bloat if it's a massive book
                $fullExtractedText = mb_substr($fullExtractedText, 0, 1000000);

                $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'processing', error_message = 'Đã trích xuất xong, đang lưu vào cơ sở dữ liệu...' WHERE id = ?")->execute([$row['id']]);
                $pdo->prepare("UPDATE domation_ai_training_docs SET book_title = ?, book_author = ?, total_pages = ?, content = ? WHERE id = ?")
                    ->execute([$bookTitle, $bookAuthor, $totalPages, $fullExtractedText, $row['id']]);

                if (is_array($bookData['chapters'])) {
                    foreach ($bookData['chapters'] as $chapter) {
                        $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'processing', error_message = 'Đang xử lý Chương: " . ($chapter['title'] ?? $chapter['index'] ?? 'Untitled') . "...' WHERE id = ?")->execute([$row['id']]);
                        training_log("Processing Chapter: " . ($chapter['title'] ?? 'Untitled') . " (Index " . ($chapter['index'] ?? '?') . ")");

                        if (isset($chapter['sections']) && is_array($chapter['sections'])) {
                            foreach ($chapter['sections'] as $section) {
                                $section['chapter_index'] = $chapter['index'] ?? 0;
                                $section['chapter_title'] = $chapter['title'] ?? 'Untitled';
                                $sectionChunks = chunkSection($section, $propSettings['chunk_size'] ?? 700, $propSettings['chunk_overlap']
                                    ?? 150);
                                foreach ($sectionChunks as $chunk) {
                                    $metaText = "[BOOK: {$bookTitle}]\n[CHAPTER: {$chunk['chapter_title']}]\n[SECTION: {$chunk['section_title']}]\n";
                                    if (!empty($chunk['page_start']))
                                        $metaText .= "[Pages: {$chunk['page_start']}-{$chunk['page_end']}]\n";
                                    $metaText .= "[CONTENT]\n{$chunk['content']}";

                                    // Small reset during heavy loops
                                    if (count($chunkBuffer) % 50 === 0)
                                        set_time_limit(60);

                                    $chunkBuffer[] = array_merge($chunk, [
                                        'doc_id' => $row['id'],
                                        'metadata_text' => $metaText,
                                        'tags' => $row['tags'],
                                        'priority' => $row['priority']
                                    ]);

                                    // OPTIMIZATION: If buffer gets too large, process it early to avoid memory issues
                                    if (count($chunkBuffer) >= 50) {
                                        training_log("Processing intermediate batch of " . count($chunkBuffer) . " chunks for Document ID={$row['id']}.");
                                        $c = processTrainingBuffer($pdo, $propertyId, $activeApiKey, $chunkBuffer, $processedDocIds);
                                        $successCount += $c;
                                        $chunkBuffer = [];
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                $cSize = !empty($propSettings['chunk_size']) ? (int) $propSettings['chunk_size'] : 1000;
                $cOverlap = !empty($propSettings['chunk_overlap']) ? (int) $propSettings['chunk_overlap'] : 300;
                $textSegments = chunkText($row['content'], $cSize, $cOverlap);
                training_log("Chunked document ID={$row['id']} into " . count($textSegments) . " segments.");
                foreach ($textSegments as $segment) {
                    $richText = "[TITLE: {$row['name']}]\n[CONTENT]\n$segment";
                    $chunkBuffer[] = [
                        'doc_id' => $row['id'],
                        'content' => $segment,
                        'metadata_text' => $richText,
                        'tags' =>
                            $row['tags'],
                        'priority' => $row['priority']
                    ];
                }
            }

            if (count($chunkBuffer) >= $BATCH_SIZE) {
                training_log("Processing batch of " . count($chunkBuffer) . " chunks for Document ID={$row['id']}.");
                $successCount += processTrainingBuffer($pdo, $propertyId, $activeApiKey, $chunkBuffer, $processedDocIds);
                $chunkBuffer = [];
            }
        }
        if (!empty($chunkBuffer)) {
            training_log("Finalizing last batch of " . count($chunkBuffer) . " chunks.");
            $successCount += processTrainingBuffer($pdo, $propertyId, $activeApiKey, $chunkBuffer, $processedDocIds);
        }

        training_log("Training completed for Property ID=$propertyId. Successfully trained " . count($docIds) . " documents. Total chunks: $successCount");

        // Final safety: Any docs that were in the original request but haven't been marked 'trained' or 'error'
        // should be set to 'trained' now (e.g., if they were successfully processed but produced 0 chunks).
        if (!empty($docIds)) {
            $placeholders = str_repeat('?,', count($docIds) - 1) . '?';
            // Only update docs that haven't encountered an error
            $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'trained', updated_at = NOW(), error_message = NULL WHERE id IN
            ($placeholders) AND status = 'processing'")->execute($docIds);
        }

        // OPTIMIZATION: Only update stats and version if this is the LAST pending job for this property
        // This prevents clogging the server with redundant heavy computations
        $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM queue_jobs WHERE queue = 'ai_training' AND status = 'pending' AND payload LIKE ?");
        $stmtCheck->execute(['%"property_id":"' . $propertyId . '"%']);
        $pendingCount = (int) $stmtCheck->fetchColumn();

        if ($pendingCount === 0) {
            updatePropertyTermStats($pdo, $propertyId);
            $pdo->prepare("UPDATE ai_chatbot_settings SET ai_version = ai_version + 1 WHERE property_id = ?")->execute([$propertyId]);
        }

        return ['success' => true, 'trained_count' => count($docIds), 'chunks_created' => $successCount];
    } catch (Throwable $e) {
        // Fallback: If anything fails, set docs back to error so they aren't stuck in 'processing'
        training_log("CRITICAL ERROR in trainDocsCore: " . $e->getMessage() . " at " . $e->getFile() . ":" . $e->getLine());
        if (!empty($docIds)) {
            $placeholders = str_repeat('?,', count($docIds) - 1) . '?';
            $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'error', error_message = ? WHERE id IN ($placeholders) AND status = 'processing'")
                ->execute(array_merge([$e->getMessage()], $docIds));
        }
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

// =========================================================
// [NEW] MERGE ALL PDF CHUNKS → RUN EMBEDDING
// =========================================================

/**
 * Đọc toàn bộ kết quả từ ai_pdf_chunk_results, merge chapters theo thứ tự,
 * cập nhật doc content, rồi chạy embedding pipeline.
 */
function mergePdfChunksAndEmbed($pdo, $docId, $propertyId, $apiKey)
{
    training_log("mergePdfChunksAndEmbed: Starting for doc={$docId}");

    // [FIX] Atomic check: Only allow one worker to start the merging process
    // We update the error_message to a specific lock string and check if it was already set.
    $lockStr = 'MERGING_PROCESS_STARTED';
    $stmtLock = $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'processing', error_message = ? WHERE id = ? AND status = 'processing' AND (error_message IS NULL OR error_message != ?)");
    $stmtLock->execute([$lockStr, $docId, $lockStr]);

    if ($stmtLock->rowCount() === 0) {
        // Status was already changed by another worker or not in processing state
        training_log("mergePdfChunksAndEmbed: Lock failed (already merging or processed). DocID={$docId}");
        return;
    }

    // 1. Load doc row
    $stmtDoc = $pdo->prepare("SELECT id, name, metadata, tags, priority FROM domation_ai_training_docs WHERE id = ?"); // [FIX P37-ATC] Explicit columns — content not needed here (full text built from merged chunks)
    $stmtDoc->execute([$docId]);
    $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);
    if (!$doc) {
        training_log("mergePdfChunksAndEmbed: Doc not found: {$docId}");
        return;
    }

    // 2. Load all done chunks ordered by chunk_index
    $stmtChunks = $pdo->prepare("SELECT chunk_index, page_start, page_end, chapters_json FROM ai_pdf_chunk_results WHERE doc_id = ? AND status = 'done' ORDER BY chunk_index ASC");
    $stmtChunks->execute([$docId]);
    $chunkRows = $stmtChunks->fetchAll(PDO::FETCH_ASSOC);

    if (empty($chunkRows)) {
        training_log("mergePdfChunksAndEmbed: No done chunks found for doc={$docId}");
        $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'error', error_message = 'Không có dữ liệu trích xuất nào thành công' WHERE id = ?")->execute([$docId]);
        return;
    }

    // 3. Merge all chapters
    $mergedChapters = [];
    $chapterOffset = 0;
    $fullExtractedText = '';
    $totalPages = 0;

    foreach ($chunkRows as $chunkRow) {
        $parsed = json_decode($chunkRow['chapters_json'], true);
        if (!$parsed || empty($parsed['chapters']))
            continue;

        $totalPages = max($totalPages, (int) $chunkRow['page_end']);

        foreach ($parsed['chapters'] as $ch) {
            $ch['index'] = $ch['index'] + $chapterOffset;
            $mergedChapters[] = $ch;
            $fullExtractedText .= "## " . ($ch['title'] ?? 'Phần') . "\n";
            foreach ($ch['sections'] ?? [] as $sec) {
                if (!empty($sec['title']))
                    $fullExtractedText .= "### " . $sec['title'] . "\n";
                $fullExtractedText .= ($sec['content'] ?? '') . "\n\n";
            }
        }
        $chapterOffset += count($parsed['chapters']);
    }

    $fullExtractedText = mb_substr($fullExtractedText, 0, 1000000);
    $docName = $doc['name'] ?? 'Tài liệu';
    $meta = json_decode($doc['metadata'] ?? '{}', true);
    $bookTitle = $meta['book_title'] ?? $docName;
    $bookAuthor = $meta['book_author'] ?? '';

    training_log("mergePdfChunksAndEmbed: Merged " . count($mergedChapters) . " chapters from " . count($chunkRows) . " chunks. Total pages: {$totalPages}");

    // 4. Save merged content to doc
    $mergeMsg = 'Đã merge ' . count($chunkRows) . ' đoạn, đang tạo embedding...';
    $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'processing', error_message = ?, book_title = ?, book_author = ?, total_pages = ?, content = ? WHERE id = ?")
        ->execute([$mergeMsg, $bookTitle, $bookAuthor, $totalPages, $fullExtractedText, $docId]);

    // 5. Run embedding pipeline (reuse existing logic)
    $propSettings = [];
    try {
        $stmtKey = $pdo->prepare("SELECT chunk_size, chunk_overlap FROM ai_chatbot_settings WHERE property_id = ? LIMIT 1");
        $stmtKey->execute([$propertyId]);
        $propSettings = $stmtKey->fetch(PDO::FETCH_ASSOC) ?: [];
    } catch (Exception $e) {
    }

    $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id = ?")->execute([$docId]);

    $chunkBuffer = [];
    $processedDocIds = [];
    $successCount = 0;

    foreach ($mergedChapters as $chapter) {
        foreach ($chapter['sections'] ?? [] as $section) {
            $section['chapter_index'] = $chapter['index'] ?? 0;
            $section['chapter_title'] = $chapter['title'] ?? 'Untitled';
            $sectionChunks = chunkSection($section, $propSettings['chunk_size'] ?? 700, $propSettings['chunk_overlap'] ?? 150);

            foreach ($sectionChunks as $chunk) {
                $metaText = "[BOOK: {$bookTitle}]\n[CHAPTER: {$chunk['chapter_title']}]\n[SECTION: {$chunk['section_title']}]\n";
                if (!empty($chunk['page_start']))
                    $metaText .= "[Pages: {$chunk['page_start']}-{$chunk['page_end']}]\n";
                $metaText .= "[CONTENT]\n{$chunk['content']}";

                $chunkBuffer[] = array_merge($chunk, [
                    'doc_id' => $docId,
                    'metadata_text' => $metaText,
                    'tags' => $doc['tags'],
                    'priority' => $doc['priority'] ?? 0,
                ]);

                if (count($chunkBuffer) >= 20) {
                    $successCount += processTrainingBuffer($pdo, $propertyId, $apiKey, $chunkBuffer, $processedDocIds);
                    $chunkBuffer = [];
                }
            }
        }
    }
    if (!empty($chunkBuffer)) {
        $successCount += processTrainingBuffer($pdo, $propertyId, $apiKey, $chunkBuffer, $processedDocIds);
    }

    // 6. Mark doc as trained
    $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'trained', updated_at = NOW(), error_message = NULL WHERE id = ?")
        ->execute([$docId]);

    // 7. Update term stats + version
    updatePropertyTermStats($pdo, $propertyId);
    $pdo->prepare("UPDATE ai_chatbot_settings SET ai_version = ai_version + 1 WHERE property_id = ?")->execute([$propertyId]);

    // 8. Cleanup chunk results
    $pdo->prepare("DELETE FROM ai_pdf_chunk_results WHERE doc_id = ?")->execute([$docId]);

    training_log("mergePdfChunksAndEmbed: DONE for doc={$docId}. Chunks created: {$successCount}");
}

