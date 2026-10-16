<?php
// api/chat_rag.php – Optimized Hybrid Search with Synonym Boosting & MySQL Scoring

// ============================================================
// RAG TUNING CONSTANTS — adjust per domain without touching logic
// ============================================================
if (!defined('RAG_RRF_SCALE'))
    define('RAG_RRF_SCALE', 1800);  // Normalize RRF score to 0-100 range
if (!defined('RAG_RRF_K'))
    define('RAG_RRF_K', 60);    // Standard RRF k (Cormack et al.)
if (!defined('RAG_VEC_W_BASE'))
    define('RAG_VEC_W_BASE', 0.75);  // Base vector weight (short queries)
if (!defined('RAG_VEC_W_SCALE'))
    define('RAG_VEC_W_SCALE', 400.0); // Scale factor: weight += qLen / scale
if (!defined('RAG_VEC_W_MAX'))
    define('RAG_VEC_W_MAX', 0.95);  // Cap on vector weight (Stage-1 filter only; final ranking uses RRF).
// At 0.95: FTS = 5% for long queries. Lower to 0.85 if chatbot
// misses proper nouns / product codes (keyword-heavy domains).
if (!defined('RAG_EMBED_DIM'))
    define('RAG_EMBED_DIM', 3072);  // Expected embedding dimension (gemini-embedding-001)
// ============================================================

/**
 * Tính Cosine Similarity giữa 2 vector
 */
function fastCosineSimilarity($vecQ, $vecB, $normQ, $normB)
{
    if ($normQ == 0 || $normB == 0)
        return 0;

    $dimQ = count($vecQ);
    $dimB = count($vecB);

    // GUARD: Dimension mismatch = data corruption or model change — log and bail out
    if ($dimQ !== $dimB) {
        error_log("[RAG WARNING] fastCosineSimilarity: dimension mismatch (query={$dimQ}, doc={$dimB}). Expected " . RAG_EMBED_DIM . ". Check embedding model or vector_binary integrity.");
        return 0;
    }

    // OPTIMIZED: Dot product
    $dotProduct = 0;
    for ($i = 0; $i < $dimQ; $i++) {
        $dotProduct += $vecQ[$i] * $vecB[$i];
    }

    return $dotProduct / ($normQ * $normB);
}

/**
 * OPTIMIZATION B: Query Expansion with Vietnamese Synonyms
 * Giúp MySQL tìm thấy bản ghi kể cả khi user dùng từ khác (VD: "mức" -> "giá cost")
 */
function expandQueryWithSynonyms($query, $customSynonyms = [])
{
    // Default Hardcoded Synonyms (Fallback)
    $synonyms = [
        // ===== GIÁ / TIỀN =====
        'giá' => ['chi phí', 'bao nhiêu', 'tốn kém', 'mức', 'đắt', 'rẻ', 'vnd', 'vnd', 'dùng', 'tiền', 'báo giá', 'price', 'cost', 'học phí', 'phí', 'fee', 'budget'],
        // ===== MUA / ĐĂNG KÝ =====
        'mua' => ['đặt hàng', 'order', 'thanh toán', 'sở hữu', 'đăng ký', 'ghi danh', 'apply', 'enroll', 'buy', 'purchase', 'sign up', 'đóng tiền', 'ck'],
        // ===== Ở ĐÂU / ĐỊA CHỈ =====
        'ở đâu' => ['địa chỉ', 'vị trí', 'chỗ nào', 'tọa độ', 'map', 'location', 'address', 'nơi', 'cơ sở', 'tại đâu'],
        // ===== LIÊN HỆ =====
        'liên hệ' => ['gọi', 'sdt', 'hotline', 'email', 'nhắn tin', 'inbox', 'contact', 'hỗ trợ', 'tư vấn', 'chat', 'zalo'],
        // ===== ĐÁNH GIÁ =====
        'tốt không' => ['review', 'đánh giá', 'feedback', 'chất lượng', 'uy tín', 'có nên', 'ok không', 'ổn không', 'scam'],
        // ===== HƯỚNG DẪN =====
        'hướng dẫn' => ['cách làm', 'làm sao', 'thế nào', 'các bước', 'quy trình', 'guide', 'tutorial', 'how to'],
        // ===== KHUYẾN MÃI =====
        'khuyến mãi' => ['ưu đãi', 'giảm giá', 'voucher', 'code', 'quà tặng', 'bonus', 'deal', 'sale', 'free'],
        // ===== THỜI GIAN =====
        'khi nào' => ['thời gian', 'khai giảng', 'lịch học', 'hạn chót', 'deadline', 'mở khóa', 'bắt đầu', 'bao giờ'],
        // ===== ĐIỀU KIỆN / TRÌNH ĐỘ =====
        'điều kiện' => ['yêu cầu', 'đầu vào', 'cần gì', 'bằng cấp', 'kinh nghiệm', 'ielts', 'tiếng anh', 'ngoại ngữ', 'english', 'trình độ', 'năng lực', 'level'],
        'tiếng anh' => ['english', 'ngoại ngữ', 'ielts', 'toeic', 'toefl', 'vstep', 'b1', 'b2', 'giao tiếp'],
        'yếu' => ['kém', 'chưa tốt', 'mất gốc', 'không biết', 'lâu rồi không dùng', 'chậm', 'thấp', 'nợ bằng', 'thiếu'],
    ];

    // Merge with Custom Synonyms from DB
    if (!empty($customSynonyms)) {
        foreach ($customSynonyms as $k => $v) {
            if (isset($synonyms[$k])) {
                $synonyms[$k] = array_unique(array_merge($synonyms[$k], $v));
            } else {
                $synonyms[$k] = $v;
            }
        }
    }

    $queryLower = mb_strtolower($query);
    $extraTerms = [];

    foreach ($synonyms as $key => $words) {
        $found = false;
        if (mb_strpos($queryLower, $key) !== false)
            $found = true;
        else {
            foreach ($words as $word) {
                if (mb_strpos($queryLower, $word) !== false) {
                    $found = true;
                    break;
                }
            }
        }

        if ($found) {
            $extraTerms[] = $key;
            // Add top 3 synonyms
            $count = 0;
            foreach ($words as $w) {
                if ($count >= 3)
                    break;
                $extraTerms[] = $w;
                $count++;
            }
        }
    }

    if (empty($extraTerms))
        return $query;

    // GUARD: For long queries, synonym expansion adds noise more than signal.
    // Only append synonyms when query is short/medium (=60 chars).
    // Long queries already contain enough semantic signal for embedding.
    if (mb_strlen($query) > 60)
        return $query;

    return $query . ' ' . implode(' ', array_unique($extraTerms));
}

// --- Query Classification for intent detection ---
function classifyQuery($query)
{
    $qLower = mb_strtolower($query);

    $patterns = [
        'social' => '/^(chào|hi|hello|helo|hé lô|hey|alo|ê|hoi|hỏi|cho hỏi|chúc|cảm ơn|thanks|tạm biệt|bye|ok|vâng|dạ|ạ|yes|no)/ui',
        'price' => '/giá|bao nhiêu|chi phí|phí|tiền|cost|price/ui',
        'howto' => '/làm sao|cách|hướng dẫn|thế nào|how to|how do/ui',
        'comparison' => '/khác|so sánh|hơn|tốt hơn|vs|versus|compare/ui',
        'factual' => '/là gì|định nghĩa|nghĩa là|what is|define/ui',
        'location' => '/ở đâu|địa chỉ|nơi nào|where|location/ui',
        'timing' => '/(?:^|[^a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])(khi nào|lúc nào|bao giờ|mấy giờ|thời điểm|lịch|ngày|tháng|nam|deadline|kỳ|khai giảng|when|time|schedule|deadline)(?![a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])/ui',
    ];

    $types = [];
    foreach ($patterns as $type => $pattern) {
        if (preg_match($pattern, $qLower)) {
            $types[] = $type;
        }
    }

    return !empty($types) ? $types : ['general'];
}



function getEmbedding($pdo, $text, $apiKey)
{
    if (empty($apiKey))
        return ['error' => 'No API Key.'];
    $model = "gemini-embedding-001";
    $hash = md5($model . '|v1|' . mb_strtolower(trim($text)));
    try {
        $stmt = $pdo->prepare("SELECT vector_binary, vector FROM ai_vector_cache WHERE hash = ? AND created_at >= NOW() - INTERVAL 7 DAY LIMIT 1");
        $stmt->execute([$hash]);
        $cached = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($cached) {
            if (!empty($cached['vector_binary'])) {
                return array_values(unpack('f*', $cached['vector_binary']));
            }
            return json_decode($cached['vector'], true);
        }
    } catch (Exception $e) {
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:embedContent?key=" . $apiKey;
    $payload = ["content" => ["parts" => [["text" => $text]]]];
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $res = json_decode($response, true);
    $vector = $res['embedding']['values'] ?? null;
    if ($vector) {
        $packed = pack('f*', ...$vector);
        try {
            $pdo->prepare("INSERT INTO ai_vector_cache (hash, vector, vector_binary, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE vector=VALUES(vector), vector_binary=VALUES(vector_binary), created_at=NOW()")->execute([$hash, json_encode($vector), $packed]);
        } catch (Exception $e) {
            error_log("[chat_rag] Vector cache insert failed: " . $e->getMessage());
        }
    } else {
        $errorMsg = $res['error']['message'] ?? 'Unknown API Error (HTTP ' . $httpCode . ')';
        return ['error' => $errorMsg];
    }
    return $vector;
}

/**
 * ASYNC EMBEDDING: Initialize the request
 */
function getEmbeddingAsyncInit($text, $apiKey)
{
    $model = "gemini-embedding-001";
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:embedContent?key=" . $apiKey;
    $payload = ["content" => ["parts" => [["text" => $text]]]];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2_0);

    $mh = curl_multi_init();
    curl_multi_add_handle($mh, $ch);

    $active = null;
    do {
        $status = curl_multi_exec($mh, $active);
    } while ($status === CURLM_CALL_MULTI_PERFORM);

    return ['mh' => $mh, 'ch' => $ch, 'text' => $text];
}

/**
 * ASYNC EMBEDDING: Wait and finalize
 */
function getEmbeddingAsyncWait($handle, $pdo)
{
    if (!$handle)
        return null;
    $mh = $handle['mh'];
    $ch = $handle['ch'];

    $response = null;
    $httpCode = 0;

    try {
        $active = null;
        do {
            $status = curl_multi_exec($mh, $active);
            if ($active > 0) {
                $wait = curl_multi_select($mh, 1.0);
                if ($wait === -1) {
                    // select() failed — tiny sleep to avoid busy-loop
                    usleep(10000);
                }
            }
        } while ($active > 0 && $status === CURLM_OK);

        if ($status !== CURLM_OK) {
            error_log("[RAG ERROR] curl_multi_exec failed with status: {$status}");
        }

        $response = curl_multi_getcontent($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    } catch (Exception $e) {
        error_log("[RAG ERROR] getEmbeddingAsyncWait curl_multi exception: " . $e->getMessage());
    } finally {
        // Always clean up handles to prevent resource leaks
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
        curl_multi_close($mh);
    }

    if (!$response) {
        error_log("[RAG ERROR] getEmbeddingAsyncWait: empty response (HTTP {$httpCode})");
        return null;
    }

    $res = json_decode($response, true);
    $vector = $res['embedding']['values'] ?? null;

    if (!$vector) {
        $errMsg = $res['error']['message'] ?? "Unknown (HTTP {$httpCode})";
        error_log("[RAG ERROR] getEmbeddingAsyncWait: API error — {$errMsg}");
        return null;
    }

    try {
        $model = "gemini-embedding-001";
        $hash = md5($model . '|v1|' . mb_strtolower(trim($handle['text'])));
        $packed = pack('f*', ...$vector);
        $pdo->prepare("INSERT INTO ai_vector_cache (hash, vector, vector_binary, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE vector=VALUES(vector), vector_binary=VALUES(vector_binary), created_at=NOW()")->execute([$hash, json_encode($vector), $packed]);
    } catch (Exception $e) {
        // Cache failure is non-fatal
        error_log("[RAG WARN] Failed to cache embedding: " . $e->getMessage());
    }

    return $vector;
}

// --- HELPER: Query Expansion ---
function expandQueryForRAG($q, $context)
{
    // FIX: Removed unused $pdo and $propertyId parameters
    $historyText = $context['history_text'] ?? '';
    // If query is very short/ambiguous, append full history context
    if (mb_strlen($q) < 12) {
        if (!empty($historyText)) {
            return trim($q . " " . mb_substr($historyText, -300));
        } else {
            $lastUser = $context['last_user_msg'] ?? '';
            $lastBot = $context['last_bot_msg'] ?? '';
            return trim($q . " " . $lastUser . " " . mb_substr($lastBot, 0, 100));
        }
    }
    return $q;
}

function retrieveContext($pdo, $propertyId, $userMsg, $contextParams, $apiKey, $limit = 20)
{
    $perfStart = microtime(true);
    $ragStart = microtime(true);

    // SaaS Optimization: Strict debug flag parsing
    $debugEnabled = filter_var($contextParams['debug'] ?? false, FILTER_VALIDATE_BOOLEAN);

    // 1. Get Property Version & Settings
    $aiVersion = 1;
    $customSynonyms = [];
    $intentConfigs = []; // Available for later boosting logic

    try {
        // Fetch version AND intent_configs in one go to save DB calls
        $stmtVer = $pdo->prepare("SELECT ai_version, intent_configs FROM ai_chatbot_settings WHERE property_id = ? LIMIT 1");
        $stmtVer->execute([$propertyId]);
        $settingsParams = $stmtVer->fetch(PDO::FETCH_ASSOC);

        if ($settingsParams) {
            $aiVersion = $settingsParams['ai_version'] ?: 1;
            if (!empty($settingsParams['intent_configs'])) {
                $decoded = json_decode($settingsParams['intent_configs'], true);

                // Check if the config structure has a 'synonyms' key
                if (isset($decoded['synonyms'])) {
                    $customSynonyms = $decoded['synonyms'];
                }

                // Handle intent config legacy vs new structure
                if (isset($decoded[0]['regex'])) {
                    $intentConfigs = $decoded;
                } elseif (isset($decoded['intents'])) {
                    $intentConfigs = $decoded['intents'];
                }
            }
        }
    } catch (Exception $e) {
    }

    // 2. Query Analysis & Expansion
    // 💡 OPTIMIZATION: Chỉ loại bỏ các chỉ dẫn cụ thể trong ngoặc (VD: [Trả lời ngắn gọn])
    // Tránh nuốt mất text quan trọng của người dùng.
    $cleanUserMsg = preg_replace('/\[(trả lời|ngắn gọn|chi tiết|bằng tiếng|ngôn ngữ).*?\]/ui', '', $userMsg);
    $cleanUserMsg = trim($cleanUserMsg) ?: $userMsg;

    $queryTypes = classifyQuery($cleanUserMsg);
    $contextExpandedQuery = expandQueryForRAG($cleanUserMsg, $contextParams);

    // OPTIMIZATION B: Synonym Expansion (with Custom DB Synonyms)
    // FIX: Use expanded query so synonyms apply to history terms too
    $synonymQuery = expandQueryWithSynonyms($contextExpandedQuery, $customSynonyms);
    $cleanQuery = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $synonymQuery);

    // 3. Try Cache (Optimized key: Use clean user message only to avoid history noise)
    $normalizedMsg = mb_strtolower(trim($cleanUserMsg));

    // EARLY EXIT: Skip RAG for small talk detected in step 2.
    if (in_array('social', $queryTypes) && mb_strlen($normalizedMsg) < 20) {
        return ['results' => [], 'perf' => ['skipped' => true, 'reason' => 'social_small_talk']];
    }

    $configHash = md5(json_encode($customSynonyms) . json_encode($intentConfigs));
    $cacheKey = md5($propertyId . '_v' . $aiVersion . '_' . $configHash . '_' . $normalizedMsg);
    $noCache = $contextParams['nocache'] ?? false;

    try {
        if (!$noCache) {
            // L1 Cache: Memory (APCu) for lightning fast hits (5-10 mins)
            if (function_exists('apcu_fetch')) {
                $l1Result = apcu_fetch($cacheKey);
                if ($l1Result) {
                    $l1Result['perf']['cached'] = 'L1';
                    return $l1Result;
                }
            }

            // L2 Cache: MySQL (7 days)
            $stmt = $pdo->prepare("SELECT results FROM ai_rag_search_cache WHERE query_hash = ? AND property_id = ? AND created_at > (NOW() - INTERVAL 7 DAY) LIMIT 1");
            $stmt->execute([$cacheKey, $propertyId]);
            $cached = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($cached) {
                $output = json_decode($cached['results'], true);
                if ($output) {
                    $output['perf']['cached'] = 'L2';
                    // Re-fill L1 cache from L2
                    if (function_exists('apcu_store')) {
                        apcu_store($cacheKey, $output, 600);
                    }
                    return $output;
                }
            }
        }
    } catch (Exception $e) {
    }

    // 4. EMBEDDING ASYNC (Overlapping with MySQL)
    // FIX: Check cache for embedding first
    $vectorInput = $contextExpandedQuery;
    $model = "gemini-embedding-001";

    $embedHash = md5($model . '|v1|' . mb_strtolower(trim($vectorInput)));
    $qEmbed = null;
    $asyncHandle = null;

    try {
        $stmtCache = $pdo->prepare("SELECT vector_binary, vector FROM ai_vector_cache WHERE hash = ? AND created_at >= NOW() - INTERVAL 7 DAY LIMIT 1");
        $stmtCache->execute([$embedHash]);
        $cachedEmbed = $stmtCache->fetch(PDO::FETCH_ASSOC);
        if ($cachedEmbed) {
            if (!empty($cachedEmbed['vector_binary'])) {
                $qEmbed = array_values(unpack('f*', $cachedEmbed['vector_binary']));
            } else {
                $qEmbed = json_decode($cachedEmbed['vector'], true);
            }
        }
    } catch (Exception $e) {
    }

    if (!$qEmbed) {
        $asyncHandle = getEmbeddingAsyncInit($vectorInput, $apiKey);
    }

    // Using simple query expansion for Boolean Mode fallback
    $queryWords = array_slice(array_filter(explode(' ', mb_strtolower($cleanQuery)), function ($w) {
        return mb_strlen($w) >= 2;
    }), 0, 10);
    $relaxedQuery = "";
    foreach ($queryWords as $w)
        $relaxedQuery .= "$w* ";
    $relaxedQuery = trim($relaxedQuery);

    // 5. Retrieval Pool (MySQL Fulltext) - Parallel with Embedding

    // OPTIMIZED: Added ORDER BY to ensure pool quality before LIMIT
    $stmt = $pdo->prepare("
        (SELECT c.id, c.vector_norm, c.embedding_binary,
            MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE) as fts_score
        FROM domation_ai_training_chunks c
        JOIN domation_ai_training_docs d ON c.doc_id = d.id
        WHERE c.property_id = ? AND d.is_active = 1
        ORDER BY fts_score DESC
        LIMIT 300)
        UNION ALL
        (SELECT c.id, c.vector_norm, c.embedding_binary,
            MATCH(c.content) AGAINST(? IN BOOLEAN MODE) as fts_score
        FROM domation_ai_training_chunks c
        JOIN domation_ai_training_docs d ON c.doc_id = d.id
        WHERE c.property_id = ? AND d.is_active = 1
        ORDER BY fts_score DESC
        LIMIT 200)
    ");
    $stmt->execute([$cleanQuery, $propertyId, $relaxedQuery, $propertyId]);
    $rawResults = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Finalize Embedding if it was async
    if ($asyncHandle) {
        $qEmbed = getEmbeddingAsyncWait($asyncHandle, $pdo);
    }

    if (!$qEmbed || isset($qEmbed['error'])) {
        error_log("[RAG DEBUG] Embedding failed or empty");
        return ['results' => [], 'perf' => ['error' => 'Embedding Fail', 'time_ms' => 0]];
    }

    $normQ = 0;
    foreach ($qEmbed as $v)
        $normQ += $v * $v;
    $normQ = sqrt($normQ);

    // FIX: Normalize fts_score immediately to prevent NULL issues
    foreach ($rawResults as &$rr) {
        $rr['fts_score'] = (float) ($rr['fts_score'] ?? 0);
    }
    unset($rr);

    // OPTIMIZATION: Two-Stage Ranking to prevent memory overflow
    $vectorScores = [];
    $uniqueResults = [];
    $maxFtsScore = 1.0; // Safe default: prevents division-by-zero; harmless when pool is empty

    // Log empty FTS pool early — helps diagnose misconfigured FULLTEXT indexes
    if (empty($rawResults)) {
        error_log("[RAG DEBUG] FTS pool is empty for property_id={$propertyId}. Check FULLTEXT index and query: " . mb_substr($cleanQuery, 0, 120));
    }

    // CRITICAL FIX: Two-pass approach - find max FTS first
    // Pass 1: Find max FTS score
    foreach ($rawResults as $row) {
        $score = (float) $row['fts_score'];
        if ($score > $maxFtsScore)
            $maxFtsScore = $score;
    }

    // Pass 2: Calculate vector scores with correct threshold
    $skippedCount = 0;
    $calculatedCount = 0;
    $emptyVectorCount = 0;

    foreach ($rawResults as $row) {
        $id = $row['id'];
        $score = (float) $row['fts_score'];

        if (!isset($uniqueResults[$id]) || $score > ($uniqueResults[$id]['fts_score'] ?? 0)) {
            $uniqueResults[$id] = $row;
        }

        // OPTIMIZATION: Smart skip - only skip truly negligible scores
        // Skip if: score < 5% of max AND score < 0.05 absolute
        // This ensures we calculate vectors for most candidates when max_fts is low
        $shouldSkip = ($score < ($maxFtsScore * 0.05) && $score < 0.05);
        if ($shouldSkip) {
            $vectorScores[$id] = 0;
            $skippedCount++;
            continue;
        }

        // Calculate vector score
        $vecB = null;
        if (!empty($row['embedding_binary'])) {
            $vecB = array_values(unpack('f*', $row['embedding_binary']));
        }

        if (is_array($vecB) && count($vecB) > 0) {
            // SaaS Optimization: Strict pre-calculated vector_norm usage (No fallback in hot path)
            $normB = (float) ($row['vector_norm'] ?? 0);
            if ($normB > 0) {
                $vectorScores[$id] = fastCosineSimilarity($qEmbed, $vecB, $normQ, $normB);
                $calculatedCount++;
            } else {
                $vectorScores[$id] = 0;
            }
        } else {
            $vectorScores[$id] = 0;
            $emptyVectorCount++;
        }
    }

    error_log("[RAG DEBUG] Vector calculation: Skipped=$skippedCount, Calculated=$calculatedCount, EmptyVector=$emptyVectorCount, MaxFTS=$maxFtsScore");

    // Calculate preliminary scores (Vector + Keyword only, no boost yet)
    // FIX: Calculate weights once to avoid duplication
    $preliminaryScores = [];
    $qLen = mb_strlen($userMsg);
    $vectorWeight = min(RAG_VEC_W_MAX, RAG_VEC_W_BASE + ($qLen / RAG_VEC_W_SCALE));
    $keywordWeight = 1.0 - $vectorWeight;

    foreach ($uniqueResults as $id => $row) {
        $vectorScore = $vectorScores[$id] ?? 0;
        $keywordScore = min(1.0, (float) $row['fts_score'] / $maxFtsScore);
        $baseScore = ($vectorScore * $vectorWeight) + ($keywordScore * $keywordWeight);

        $preliminaryScores[] = [
            'id' => $id,
            'score' => $baseScore * 100,
            'vector_score' => $vectorScore,
            'keyword_score' => $keywordScore,
            'fts_score' => $row['fts_score']
        ];
    }

    // Sort and keep only top 100 candidates for RRF Stage 2
    // NOTE: Raised from 50?100. RRF works on *rank* not raw score, so cutting too
    // aggressively at Stage-1 (weighted blend) risks dropping candidates that RRF
    // would rerank highly. 100 is a good balance vs. memory cost.
    usort($preliminaryScores, function ($a, $b) {
        return $b['score'] <=> $a['score'];
    });

    $topCandidates = array_slice($preliminaryScores, 0, 100);
    $topIds = array_column($topCandidates, 'id');

    // STAGE 2: Fetch full content ONLY for top 100 (saves memory vs fetching all 500 raw)
    $scoredResults = [];
    if (!empty($topIds)) {
        $placeholders = implode(',', array_fill(0, count($topIds), '?'));
        $stmtFull = $pdo->prepare("
            SELECT c.id, c.doc_id, c.content, c.metadata_text, c.tags, c.relevance_boost,
                   c.page_start, c.page_end, c.chapter_title, c.section_title,
                   d.name as source_name, d.book_title, d.book_author, d.metadata,
                   COALESCE(d.updated_at, d.created_at) as doc_updated_at
            FROM domation_ai_training_chunks c
            JOIN domation_ai_training_docs d ON c.doc_id = d.id
            WHERE c.id IN ($placeholders)
        ");
        $stmtFull->execute($topIds);
        $fullData = [];
        foreach ($stmtFull->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $formattedContent = $row['content'];

            // Read cite_mode from caller context.
            // - ai_chatbot.php: does NOT pass cite_mode ? defaults to false (customer bot, no citations)
            // - ai_org_chatbot.php: passes $isCiteMode from UI toggle ? respects user's setting
            $citeMode = filter_var($contextParams['cite_mode'] ?? false, FILTER_VALIDATE_BOOLEAN);

            if ($citeMode) {

                // Generate Citation
                $citations = [];
                $bookTitle = $row['book_title'] ?: $row['source_name'];

                // Extract file URL from metadata
                $fileUrl = '';
                if (!empty($row['metadata'])) {
                    $meta = json_decode($row['metadata'], true);
                    $fileUrl = $meta['file_url'] ?? '';
                }

                if ($bookTitle)
                    $citations[] = "**{$bookTitle}**";

                if ($fileUrl)
                    $citations[] = "File gốc: $fileUrl";

                if (!empty($row['chapter_title']))
                    $citations[] = "Chuong: {$row['chapter_title']}";
                if (!empty($row['section_title']) && $row['section_title'] !== $row['chapter_title'])
                    $citations[] = "Mục: {$row['section_title']}";

                if (!empty($row['page_start'])) {
                    $pageRange = ($row['page_end'] && $row['page_end'] > $row['page_start']) ? "Trang {$row['page_start']}-{$row['page_end']}" : "Trang {$row['page_start']}";
                    // If we have a fileUrl, make the page range a link to encourage AI to copy it
                    if ($fileUrl) {
                        $citations[] = "[{$pageRange}]($fileUrl)";
                    } else {
                        $citations[] = "{$pageRange}";
                    }
                }

                // if (!empty($citations)) {
                //     $row['content'] = "[" . implode(" | ", $citations) . "]\n$formattedContent\n(Note: Bạn BẢT BUỘC phải trích dẫn nguồn bằng format [Trang X](link_file_goc) nếu sử dụng thông tin này)";
                // }
            }

            $fullData[$row['id']] = $row;
        }

        // Merge full data with preliminary scores
        foreach ($topCandidates as $candidate) {
            $id = $candidate['id'];
            if (isset($fullData[$id])) {
                $scoredResults[] = array_merge($candidate, $fullData[$id]);
            }
        }
    }

    // Load Intent Configs (already loaded at top, no need to reload)
    // FIX: Removed duplicate intent_configs loading

    if (empty($intentConfigs)) {
        $intentConfigs = [
            ['name' => 'price', 'regex' => '(?:^|[^a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])(giá|phí|tiền|vnd|bao nhiêu|nhiêu|d|k)(?![a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])', 'boost' => 1.3],
            ['name' => 'howto', 'regex' => '(?:^|[^a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])(cách|làm sao|hướng dẫn|bước|quy trình|thủ tục)(?![a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])', 'boost' => 1.25],
            ['name' => 'location', 'regex' => '(?:^|[^a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])(địa chỉ|ở đâu|vị trí|map|nơi|tọa độ)(?![a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])', 'boost' => 1.2],
            ['name' => 'timing', 'regex' => '(?:^|[^a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])(khi nào|lúc nào|bao giờ|lịch|ngày|tháng|deadline|khai giảng)(?![a-z0-9àáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ])', 'boost' => 1.5],
        ];
    }

    // RRF_SCALE & RRF_K are now defined at file top via RAG_RRF_SCALE / RAG_RRF_K constants

    $candidates = [];
    $docChunkCount = [];
    $userMsgLower = mb_strtolower($userMsg);

    $hasHistory = !empty($contextParams['history_text']) || !empty($contextParams['last_user_msg']);

    // --- ADVANCED RAG ALGORITHMS V2 (STATE OF THE ART) ---

    // 1. FUZZY MATCHING & TYPO CORRECTION (Pre-processing)
    // Fix typos in user query using Levenshtein against top candidates
    // (Simplification: We assume FTS handled basic matching, we act as a re-ranker)

    // 4. RANKING PREPARATION
    // NOTE: We must work on $scoredResults (Data with Content), NOT $uniqueResults (IDs only)

    // Calculate Term Freqs for IDF on the FETCHED SET ($scoredResults)
    $termFreqs = [];
    $totalDocs = count($scoredResults);
    $searchTerms = explode(' ', mb_strtolower($cleanQuery));

    if ($totalDocs > 0) {
        foreach ($scoredResults as $row) {
            $txt = mb_strtolower($row['content'] ?? '');
            foreach ($searchTerms as $term) {
                if (mb_strlen($term) < 3)
                    continue;
                if (mb_strpos($txt, $term) !== false) {
                    $termFreqs[$term] = ($termFreqs[$term] ?? 0) + 1;
                }
            }
        }
    }

    // Sort by Vector & FTS separately to get Ranks for RRF
    $rankedByVector = $scoredResults;
    uasort($rankedByVector, function ($a, $b) use ($vectorScores) {
        $scoreA = $vectorScores[$a['id']] ?? 0;
        $scoreB = $vectorScores[$b['id']] ?? 0;
        return $scoreB <=> $scoreA;
    });

    $rankedByKeyword = $scoredResults;
    uasort($rankedByKeyword, function ($a, $b) {
        return $b['fts_score'] <=> $a['fts_score'];
    });

    $vectorRanks = [];
    $rankIdx = 1;
    foreach ($rankedByVector as $r) {
        $vectorRanks[$r['id']] = $rankIdx++;
    }

    $keywordRanks = [];
    $rankIdx = 1;
    foreach ($rankedByKeyword as $r) {
        $keywordRanks[$r['id']] = $rankIdx++;
    }

    // RRF Constants — sourced from tuning constants at file top
    $k = RAG_RRF_K;

    $candidates = [];
    $contentLowerCache = []; // FIX: Initialize cache to prevent PHP warnings

    // 3. ENTITY DETECTION (Optimized: only for short-medium queries)
    $hasNumbers = false;
    $hasProperNouns = false;
    if ($qLen < 40) {
        $hasNumbers = preg_match('/[0-9]+/', $userMsg);
        $hasProperNouns = preg_match('/[A-ZĐ][a-zàáạảãâầấậẩẫăằắặẳẵeèéẹẻẽêềếệểễiìíịỉĩoòóọỏõôồốộổỗơờớợởỡuùúụủũưừứựửữyỳýỵỷỹ]{2,}/u', $userMsg);
    }

    // FIX: Standardize RRF Scale to be independent of candidate pool size
    // to ensure absolute Confidence scores are consistent.
    $currentRrfScale = RAG_RRF_SCALE;

    // [OPTIMIZATION] Apply a floor to maxFtsScore to prevent over-weighting poor matches
    $ftsScoreFloor = ($maxFtsScore > 0.1) ? $maxFtsScore : 1.0;

    // MAIN SCORING LOOP (Iterate over Scored Results with Content)
    foreach ($scoredResults as $row) {
        $id = $row['id']; // Chunk ID
        $vectorScoreRaw = $vectorScores[$id] ?? 0;
        $keywordScoreRaw = ($row['fts_score'] / $ftsScoreFloor);

        // --- ALGORITHM A: RECIPROCAL RANK FUSION (RRF) ---
        // Score = 1 / (k + rankV) + 1 / (k + rankK)
        $rankV = $vectorRanks[$id] ?? 999;
        $rankK = $keywordRanks[$id] ?? 999;

        // Dynamic Weighting inside RRF
        // If Entity present -> Penalize Vector Rank (make it act like it's lower rank)
        if ($hasNumbers || $hasProperNouns) {
            $rankV += 20; // Push vector rank down
        }

        $rrfScore = (1 / ($k + $rankV)) + (1 / ($k + $rankK));
        // RRF usually returns small float (0.03 range). Normalize to 0-100 scale later.

        // --- ALGORITHM B: IDF PENALTY ---
        // If content matches too many common terms -> Penalty
        $idfPenalty = 1.0;
        foreach ($searchTerms as $term) {
            if (mb_strlen($term) < 3)
                continue;
            if (mb_strpos(mb_strtolower($row['content']), $term) !== false) {
                // If term appears in > 50% of results, it's noise
                if (($termFreqs[$term] ?? 0) > ($totalDocs * 0.5)) {
                    $idfPenalty *= 0.95;
                }
            }
        }

        // --- ALGORITHM C: RECENCY BOOST ---
        // Ưu tiên doc mới cập nhật hơn khi nội dung tương tự (VD: học phí v1 vs học phí v2)
        $recencyBoost = 1.0;
        if (!empty($row['doc_updated_at'])) {
            $updatedTs = strtotime($row['doc_updated_at']);
            if ($updatedTs > 0) {
                $daysSinceUpdate = max(0, (time() - $updatedTs) / 86400);
                if ($daysSinceUpdate <= 7) {
                    $recencyBoost = 1.30; // Cập nhật trong 7 ngày: boost mạnh
                } elseif ($daysSinceUpdate <= 30) {
                    $recencyBoost = 1.15; // Trong 30 ngày: boost vừa
                } elseif ($daysSinceUpdate <= 90) {
                    $recencyBoost = 1.05; // Trong 90 ngày: boost nhỏ
                }
                // Sau 90 ngày: không boost (1.0)
            }
        }

        // --- ALGORITHM D: FUZZY MATCH BOOSTER (Optimized) ---
        // Only apply Levenshtein to METADATA (Title/Tags), not full content.
        // Full content fuzzy match is too slow and inaccurate for chunks vs query.
        // Only apply Levenshtein to METADATA (Title/Tags) for short queries with reasonable length
        $fuzzyBoost = 1.0;
        if ($qLen < 20 && mb_strlen($row['source_name'] ?? '') < 40) {
            // Check Source Name for typo tolerance - Optimized with length guards
            // [FIX] PHP levenshtein() has a hard limit of 255 chars — returns -1 for longer strings.
            // $userMsgLower can exceed this if the user sends a long message. Guard both strings.
            $s1 = mb_substr(mb_strtolower($row['source_name'] ?? ''), 0, 255);
            $s2 = mb_substr($userMsgLower, 0, 255);
            $distTitle = levenshtein($s1, $s2, 1, 1, 1);
            if ($distTitle !== -1 && $distTitle <= 2)
                $fuzzyBoost = 1.25;
        }

        // --- CONSOLIDATE SCORES ---
        // Multipliers from previous logic
        $multiplier = 1.0;
        // $contentLower already computed earlier or cache it
        if (!isset($contentLowerCache[$id])) {
            $contentLowerCache[$id] = mb_strtolower($row['content']);
        }
        $contentLower = $contentLowerCache[$id];

        $qLen = mb_strlen($userMsg);

        // Exact Phrase
        if ($qLen > 10 && mb_strpos($contentLower, $userMsgLower) !== false)
            $multiplier *= 1.5;

        // Source Match
        if (stripos($row['source_name'], $userMsg) !== false)
            $multiplier *= 1.25;

        // Proximity (Simplified from prev)
        if ($qLen > 5) {
            $proxScore = 0;
            $lastPos = -1;
            foreach ($searchTerms as $term) {
                if (mb_strlen($term) < 3)
                    continue;
                $p = mb_strpos($contentLower, $term);
                if ($p !== false) {
                    if ($lastPos != -1 && ($p - $lastPos) < 50)
                        $proxScore++;
                    $lastPos = $p;
                }
            }
            if ($proxScore > 0)
                $multiplier *= (1 + ($proxScore * 0.1));
        }

        // Tag Match
        if (!empty($row['tags'])) {
            if (stripos($row['tags'], $userMsg) !== false)
                $multiplier *= 1.35;
        }

        // Intent Match
        foreach ($intentConfigs as $cfg) {
            if (empty($cfg['regex']) || !isset($cfg['boost']))
                continue;
            $reg = '/' . $cfg['regex'] . '/ui';
            if (@preg_match($reg, '') === false)
                continue;
            if (preg_match($reg, $userMsgLower)) {
                $contentSnippet = mb_substr($row['content'], 0, 600);
                if (preg_match($reg, mb_strtolower($contentSnippet))) {
                    $multiplier *= (float) $cfg['boost'];
                }
            }
        }

        // Calculate Base Score via RRF
        $baseScore = $rrfScore * $currentRrfScale;

        // --- ALGORITHM E: SAFETY NET FOR SHORT NONSENSE ---
        // Word count fix: use Vietnamese-safe regex split
        $wordCount = count(preg_split('/\s+/u', trim($cleanQuery), -1, PREG_SPLIT_NO_EMPTY));

        if ($qLen < 20 && $wordCount < 4 && !$hasNumbers && !$hasProperNouns) {
            if ($keywordScoreRaw < 0.1) {
                $baseScore *= 0.3; // Severe penalty
            }
        }

        // CONDITIONAL BOOSTING: Only boost if base relevance > 22 (Threshold for "valid match")
        $finalMultiplier = 1.0;
        if ($baseScore > 22) {
            $finalMultiplier = $multiplier * $idfPenalty * $fuzzyBoost * $recencyBoost;
        }

        $finalScore = $baseScore * $finalMultiplier;

        // Cap Score
        if ($finalMultiplier < 1.4 && $finalScore > 98) {
            $finalScore = 98;
        } // Score 0-100 range

        $citeForContent = filter_var($contextParams['cite_mode'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $candidates[] = [
            'content' => $citeForContent
                ? "[DOCUMENT: " . $row['source_name'] . "]\n[CONTENT]\n" . $row['content']
                : $row['content'],
            'score' => $finalScore,
            'doc_id' => $row['doc_id'],
            'chunk_id' => $row['id'],
            'source_name' => $row['source_name'],
            'vector_score' => $vectorScoreRaw,
            'keyword_score' => $keywordScoreRaw,
            'debug_info' => [
                'rrf' => number_format($rrfScore, 5),
                'idf_p' => $idfPenalty,
                'mult' => $multiplier,
                'recency' => $recencyBoost,
                'rank_v' => $rankV,
                'rank_k' => $rankK
            ]
        ];
    }

    usort($candidates, function ($a, $b) {
        return $b['score'] <=> $a['score'];
    });

    // Dynamic Limit
    if (in_array('factual', $queryTypes) || in_array('howto', $queryTypes)) {
        $limit = ceil($limit * 1.5);
    }

    $selected = array_slice($candidates, 0, $limit);

    // Filter out very low quality results (< 25%) if we have at least some good ones
    if (count($selected) > 3 && $selected[0]['score'] > 60) {
        $selected = array_filter($selected, function ($item) {
            return $item['score'] > 25;
        });
    }

    $totalTime = round((microtime(true) - $perfStart) * 1000, 2);
    $output = [
        'results' => array_values($selected), // Reindex array
        'perf' => [
            'time_ms' => $totalTime,
            'rag_time_ms' => round((microtime(true) - $ragStart) * 1000, 2),
            'cached' => false,
            'ver' => $aiVersion,
            // DEBUG INFO
            'debug' => [
                'query_embedding_dims' => count($qEmbed),
                'raw_results_count' => count($rawResults),
                'unique_results_count' => count($uniqueResults),
                'vector_skipped' => $skippedCount ?? 0,
                'vector_calculated' => $calculatedCount ?? 0,
                'vector_empty' => $emptyVectorCount ?? 0,
                'max_fts_score' => round($maxFtsScore, 2),
                'vector_threshold' => 'f < ' . round($maxFtsScore * 0.05, 2) . ' && f < 0.05'
            ]
        ],
        'max_score' => (!empty($candidates) ? $candidates[0]['score'] : 0)
    ];

    try {
        // OPTIMIZATION: Strip debug_info before caching to prevent DB bloat
        $cacheOutput = $output;
        if (!$debugEnabled) {
            // Remove detailed chunk debug and top-level debug
            foreach ($cacheOutput['results'] as &$r) {
                unset($r['debug_info']);
            }
            unset($cacheOutput['perf']['debug']);
        }

        // Save to L1 (Memory)
        if (function_exists('apcu_store') && !$debugEnabled) {
            apcu_store($cacheKey, $cacheOutput, 600);
        }

        // Save to L2 (MySQL)
        $pdo->prepare("INSERT INTO ai_rag_search_cache (query_hash, property_id, results, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE results=VALUES(results), created_at=NOW()")->execute([$cacheKey, $propertyId, json_encode($cacheOutput)]);
    } catch (Exception $e) {
    }

    return $output;
}
