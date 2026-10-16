<?php
/**
 * api/ai_force_retrain_all.php
 * Script to force retrain ALL active documents across ALL properties.
 * Useful when chunking logic or embedding model changes.
 *
 * [SECURITY] Requires CLI execution OR a pre-configured secret token.
 * Set RETRAINING_SECRET env var, then call: ?secret=<value>
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'ai_training.php'; // Provides: callGeminiBatchEmbedding, chunkText, updatePropertyTermStats

// [SECURITY] Maintenance script � CLI or secret token required
$cliSecret = getenv('RETRAINING_SECRET') ?: '';
$reqSecret = $_GET['secret'] ?? '';
if (PHP_SAPI !== 'cli' && (empty($cliSecret) || $reqSecret !== $cliSecret)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden � CLI or secret required']);
    exit;
}

header('Content-Type: text/plain; charset=utf-8');
header('X-Content-Type-Options: nosniff');

try {
    echo "--- MailFlow Pro: AI GLOBAL RETRAINING ---\n";
    echo "Time: " . date('Y-m-d H:i:s') . "\n\n";
    if (ob_get_level() > 0) ob_end_flush();
    flush();

    // 1. Get all active documents grouped by property_id
    $stmt = $pdo->query("SELECT id, property_id FROM domation_ai_training_docs WHERE is_active = 1");
    $docsByProperty = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $docsByProperty[$row['property_id']][] = $row['id'];
    }

    $totalDocs     = 0;
    $totalChunks   = 0;
    $propertyCount = count($docsByProperty);

    echo "Found {$propertyCount} properties to process.\n";

    foreach ($docsByProperty as $propertyId => $docIds) {
        echo "Processing Property: [{$propertyId}] with " . count($docIds) . " documents...\n";
        flush();

        // Fetch property settings (API key, chunk config)
        $stmtSet = $pdo->prepare("SELECT gemini_api_key, chunk_size, chunk_overlap FROM ai_chatbot_settings WHERE property_id = ?");
        $stmtSet->execute([$propertyId]);
        $settings = $stmtSet->fetch(PDO::FETCH_ASSOC) ?: [];

        $apiKey  = !empty($settings['gemini_api_key']) ? $settings['gemini_api_key'] : (getenv('GEMINI_API_KEY') ?: '');
        $cSize   = $settings['chunk_size']    ?? 400;
        $cOverlap = $settings['chunk_overlap'] ?? 60;

        if (empty($apiKey)) {
            echo "SKIP [{$propertyId}]: No Gemini API key configured.\n";
            continue;
        }

        // Fetch all active non-folder docs for this property
        $stmtDocs = $pdo->prepare("
            SELECT id, name, content, tags, priority
            FROM domation_ai_training_docs
            WHERE property_id = ? AND is_active = 1 AND source_type != 'folder'
        ");
        $stmtDocs->execute([$propertyId]);
        $docs = $stmtDocs->fetchAll(PDO::FETCH_ASSOC);

        if (empty($docs)) {
            echo "SKIP [{$propertyId}]: No documents found.\n";
            continue;
        }

        // Clear old chunks for this property's docs
        $docIdsArr    = array_column($docs, 'id');
        $placeholders = implode(',', array_fill(0, count($docIdsArr), '?'));
        $pdo->prepare("DELETE FROM domation_ai_training_chunks WHERE doc_id IN ($placeholders)")->execute($docIdsArr);

        // Build chunks for all docs
        $allChunks = [];
        foreach ($docs as $doc) {
            // chunkText() is provided by ai_training.php
            $segments = chunkText($doc['content'], $cSize, $cOverlap);
            $tagsArr  = json_decode($doc['tags'] ?? '[]', true) ?: [];

            foreach ($segments as $seg) {
                $metadata = "[TITLE: {$doc['name']}]\n[CONTENT]\n$seg";
                if (!empty($tagsArr)) {
                    $metadata .= "\n[TAGS]\n- " . implode("\n- ", $tagsArr);
                }
                $allChunks[] = [
                    'doc_id'        => $doc['id'],
                    'content'       => $seg,
                    'metadata_text' => $metadata,
                    'tags'          => $doc['tags'],
                    'priority'      => $doc['priority']
                ];
            }
        }

        echo "  Chunks prepared: " . count($allChunks) . ". Embedding...\n";
        flush();

        // Batch embed (Gemini limit = 20 per batch)
        $batchSize     = 20;
        $batches       = array_chunk($allChunks, $batchSize);
        $successCount  = 0;

        $stmtIns = $pdo->prepare("
            INSERT INTO domation_ai_training_chunks
                (id, doc_id, property_id, content, metadata_text, embedding, embedding_binary, vector_norm, tags, priority_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        foreach ($batches as $batchIdx => $batch) {
            $texts      = array_column($batch, 'metadata_text');
            // callGeminiBatchEmbedding() is provided by ai_training.php
            $embeddings = callGeminiBatchEmbedding($texts, $apiKey);

            if (isset($embeddings['error'])) {
                echo "  Batch " . ($batchIdx + 1) . " ERROR: " . $embeddings['error'] . "\n";
                continue;
            }

            $pdo->beginTransaction();
            try {
                foreach ($batch as $i => $chunk) {
                    $vector = $embeddings[$i]['values'] ?? null;
                    if (!$vector) continue;

                    $chunkId = bin2hex(random_bytes(18));
                    $norm    = 0;
                    foreach ($vector as $v) $norm += $v * $v;
                    $norm    = sqrt($norm);
                    $packed  = pack('f*', ...$vector);

                    $stmtIns->execute([
                        $chunkId,
                        $chunk['doc_id'],
                        $propertyId,
                        $chunk['content'],
                        $chunk['metadata_text'],
                        json_encode($vector),
                        $packed,
                        $norm,
                        $chunk['tags'] ?: '[]',
                        $chunk['priority'] ?: 0
                    ]);
                    $successCount++;
                }
                $pdo->commit();
            } catch (Exception $e) {
                $pdo->rollBack();
                echo "  Batch " . ($batchIdx + 1) . " DB ERROR: " . $e->getMessage() . "\n";
            }

            if (($batchIdx + 1) % 5 === 0) {
                echo "  Processed " . (($batchIdx + 1) * $batchSize) . " chunks...\n";
                flush();
            }
        }

        // Update BM25 term stats � updatePropertyTermStats() from ai_training.php
        updatePropertyTermStats($pdo, $propertyId);

        // Mark docs as trained + clear RAG cache
        $pdo->prepare("UPDATE domation_ai_training_docs SET status = 'trained', updated_at = NOW() WHERE property_id = ? AND is_active = 1")->execute([$propertyId]);
        $pdo->prepare("DELETE FROM ai_rag_search_cache WHERE property_id = ?")->execute([$propertyId]);

        $totalDocs   += count($docIds);
        $totalChunks += $successCount;

        echo "Done Property [{$propertyId}]. Chunks created: {$successCount}\n";
        echo "-------------------------------------------\n";
        flush();
    }

    echo "--- GLOBAL RETRAINING COMPLETE ---\n";
    echo "Total Documents Processed: {$totalDocs}\n";
    echo "Total Chunks Created: {$totalChunks}\n";

} catch (Exception $e) {
    echo "CRITICAL ERROR: " . $e->getMessage() . "\n";
}
