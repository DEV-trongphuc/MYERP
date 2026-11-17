<?php
// backend/controllers/ai_training_handler.php
// IDEAS DATA CRM - AI Training and Settings controller handler

if (!class_exists('TenantConfigService') && file_exists(__DIR__ . '/../config/TenantConfigService.php')) {
    require_once __DIR__ . '/../config/TenantConfigService.php';
}

try {
    $createdBy = $decodedUser['name'] ?? 'Admin';
    $actionType = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false) {
            $actionType = $_POST['action'] ?? '';
        } else {
            $input = json_decode(file_get_contents('php://input'), true);
            $actionType = $input['action'] ?? '';
        }
    } else {
        $actionType = $_GET['action_type'] ?? '';
    }

    $userRole = strtolower($decodedUser['role'] ?? '');
    $aiWriteScope = function_exists('getModulePermissionScope')
        ? getModulePermissionScope($conn, $decodedUser, 'ai', 'write')
        : 'none';
    $settingsWriteScope = function_exists('getModulePermissionScope')
        ? getModulePermissionScope($conn, $decodedUser, 'settings', 'write')
        : 'none';
    $canManageAI = (function_exists('apiDoesUserSatisfyRoles') && apiDoesUserSatisfyRoles($conn, $decodedUser, ['admin', 'superadmin', 'super_admin', 'director'], 'settings', 'write'))
        || in_array($userRole, ['admin', 'superadmin', 'super_admin', 'director'], true)
        || $aiWriteScope === 'all'
        || $settingsWriteScope === 'all';

    // Public / Read actions: list_docs can be accessed by all authenticated users.
    // Admin-only actions: get_settings, update_settings, create_folder, add_manual, update_doc, delete_doc, delete_batch, toggle_batch, train_docs, upload_training_file
    $adminOnlyActions = [
        'get_settings',
        'update_settings',
        'create_folder',
        'add_manual',
        'update_doc',
        'delete_doc',
        'delete_batch',
        'toggle_batch',
        'train_docs',
        'upload_training_file'
    ];

    if (in_array($actionType, $adminOnlyActions, true) && !$canManageAI) {
        http_response_code(403);
        echo json_encode([
            'success' => false, 
            'message' => 'Chỉ Quản trị viên (Admin/Super Admin) mới có quyền truy cập thông số RAG hoặc chỉnh sửa tri thức AI'
        ]);
        exit;
    }

    $tidRag = (int)($decodedUser['tenant_id'] ?? 1);
    if ($actionType === 'get_settings') {
        $rawRag = get_system_setting($conn, 'rag_settings', $tidRag);
        $settings = [];
        if (!empty($rawRag)) {
            $settings = json_decode((string)$rawRag, true) ?: [];
        }

        // Fill defaults
        $defaultBotName = 'AI ' . (trim((string)get_system_setting($conn, 'company_name', $tidRag)) ?: 'ERP');
        $settings['is_enabled'] = isset($settings['is_enabled']) ? (int)$settings['is_enabled'] : 1;
        $settings['bot_name'] = $settings['bot_name'] ?? $defaultBotName;
        $settings['welcome_msg'] = $settings['welcome_msg'] ?? 'Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?';
        $settings['persona_prompt'] = $settings['persona_prompt'] ?? 'Bạn là trợ lý ảo chuyên nghiệp.';
        $settings['similarity_threshold'] = isset($settings['similarity_threshold']) ? (float)$settings['similarity_threshold'] : 0.45;
        $settings['top_k'] = isset($settings['top_k']) ? (int)$settings['top_k'] : 8;
        $settings['chunk_size'] = isset($settings['chunk_size']) ? (int)$settings['chunk_size'] : 700;
        $settings['chunk_overlap'] = isset($settings['chunk_overlap']) ? (int)$settings['chunk_overlap'] : 150;
        $settings['temperature'] = isset($settings['temperature']) ? (float)$settings['temperature'] : 0.2;
        $settings['max_output_tokens'] = isset($settings['max_output_tokens']) ? (int)$settings['max_output_tokens'] : 1024;
        $settings['history_limit'] = isset($settings['history_limit']) ? (int)$settings['history_limit'] : 10;
        $settings['brand_color'] = $settings['brand_color'] ?? '#BD1D2D';

        echo json_encode(['success' => true, 'data' => $settings]);
    }
    elseif ($actionType === 'update_settings') {
        $defaultBotName = 'AI ' . (trim((string)get_system_setting($conn, 'company_name', $tidRag)) ?: 'ERP');
        $settings = [
            'is_enabled' => (int)($input['is_enabled'] ?? 1),
            'bot_name' => trim($input['bot_name'] ?? $defaultBotName),
            'welcome_msg' => trim($input['welcome_msg'] ?? 'Chào bạn! Tôi có thể giúp gì cho bạn hôm nay?'),
            'persona_prompt' => trim($input['persona_prompt'] ?? 'Bạn là trợ lý ảo chuyên nghiệp.'),
            'similarity_threshold' => (float)($input['similarity_threshold'] ?? 0.45),
            'top_k' => (int)($input['top_k'] ?? 8),
            'chunk_size' => (int)($input['chunk_size'] ?? 700),
            'chunk_overlap' => (int)($input['chunk_overlap'] ?? 150),
            'temperature' => (float)($input['temperature'] ?? 0.2),
            'max_output_tokens' => (int)($input['max_output_tokens'] ?? 1024),
            'history_limit' => (int)($input['history_limit'] ?? 10),
            'brand_color' => trim($input['brand_color'] ?? '#BD1D2D')
        ];

        $valJson = json_encode($settings, JSON_UNESCAPED_UNICODE);
        try {
            $stmt = $conn->prepare("INSERT INTO system_settings (tenant_id, setting_key, setting_value) VALUES (?, 'rag_settings', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->bind_param("is", $tidRag, $valJson);
            $stmt->execute();
            $stmt->close();
        } catch (\Throwable $eRag) {
            if ($tidRag === 1) {
                $stmt = $conn->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('rag_settings', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
                $stmt->bind_param("ss", $valJson, $valJson);
                $stmt->execute();
                $stmt->close();
            }
        }
        if (class_exists('TenantConfigService')) {
            TenantConfigService::invalidateCache($tidRag);
        }

        echo json_encode(['success' => true, 'message' => 'Cập nhật cấu hình RAG thành công']);
    }
    elseif ($actionType === 'list_docs') {
        $orgBrandLabel = strtoupper(trim((string)get_system_setting($conn, 'company_name', $tidRag)) ?: 'CRM');
        // Auto-seed CRM & Financial Slang Dictionary if not existing for this tenant
        $checkDoc = $conn->prepare("SELECT id FROM ai_training_docs WHERE name = 'Từ điển Thuật ngữ Kinh doanh & Tài chính CRM' AND tenant_id = ? LIMIT 1");
        if ($checkDoc) {
            $checkDoc->bind_param("i", $tidRag);
            $checkDoc->execute();
            if (!$checkDoc->get_result()->fetch_assoc()) {
                $slangContent = "BỘ TỪ ĐIỂN THUẬT NGỮ KINH DOANH & TÀI CHÍNH CRM ({$orgBrandLabel} SLANG & BUSINESS DICTIONARY)\n\n"
                    . "1. ĐƠN VỊ TIỀN TỆ THƯỜNG DÙNG:\n"
                    . "- 'củ', 'chai': Triệu đồng VNĐ. Ví dụ: '5 củ' = 5.000.000 VNĐ; '10 chai' = 10.000.000 VNĐ; '50 củ' = 50.000.000 VNĐ.\n\n"
                    . "2. CHĂM SÓC KHÁCH HÀNG & CRM:\n"
                    . "- 'lead ngâm', 'bỏ quên', 'chưa chăm sóc > N ngày': Khách hàng / học viên tiềm năng không có tương tác (cuộc gọi, ghi chú, gặp mặt) trong khoảng thời gian N ngày (thường là 7 ngày hoặc 90 ngày). Khi phát hiện, cần gọi công cụ search_contacts hoặc export_crm_leads_advanced kèm tham số stale_days để xuất danh sách và bàn giao lại.\n"
                    . "- 'bù data', 'bù lead': Nghiệp vụ bù data cho chuyên viên tư vấn khi nhận phải số điện thoại trùng hoặc rác. Sử dụng công cụ manage_lead_round_distribution với action 'compensate_consultant'.\n"
                    . "- 'vòng phân bổ', 'vòng xoay lead': Cơ chế chia đều cơ hội học viên (Fair Share) cho các nhóm kinh doanh theo ca trực.\n\n"
                    . "3. TIẾN ĐỘ & TÀI CHÍNH:\n"
                    . "- 'cháy deadline', 'trễ hạn': Đối với công việc cá nhân, gọi get_my_tasks với filter='overdue'. Đối với đề xuất thanh toán chi phí (PO), gọi filter_expenses_advanced với deadline_status='overdue'.\n"
                    . "- 'leaderboard', 'top sale', 'bảng xếp hạng': Xếp hạng doanh số tuyển sinh và số tiền thu cọc của các chuyên viên tư vấn, gọi get_sales_leaderboard.\n"
                    . "- 'hồ sơ nhập học': Danh mục giấy tờ xét tuyển bao gồm CCCD/Hộ chiếu, Bằng tốt nghiệp ĐH, Bảng điểm ĐH, CV tiếng Anh, Bản dịch công chứng, Hợp đồng tư vấn đào tạo. Gọi get_academic_students_filter để kiểm tra tình trạng thiếu.";
                $docName = 'Từ điển Thuật ngữ Kinh doanh & Tài chính CRM';
                $tags = 'từ điển, thuật ngữ, slang, crm, tài chính, sale';
                $src = 'manual';
                $status = 'trained';
                $cBy = 'Hệ thống';
                $ins = $conn->prepare("INSERT INTO ai_training_docs (name, content, tags, source_type, parent_id, created_by, status, is_active, tenant_id) VALUES (?, ?, ?, ?, 0, ?, ?, 1, ?)");
                if ($ins) {
                    $ins->bind_param("ssssssi", $docName, $slangContent, $tags, $src, $cBy, $status, $tidRag);
                    $ins->execute();
                    $ins->close();
                }
            }
            $checkDoc->close();
        }

        $stmt = $conn->prepare("SELECT id, name, content, tags, source_type, parent_id, is_active, status, file_path, file_size, created_at, updated_at, created_by, version FROM ai_training_docs WHERE tenant_id = ? ORDER BY id DESC");
        $stmt->bind_param("i", $tidRag);
        $stmt->execute();
        $res = $stmt->get_result();
        $docs = [];
        while ($row = $res->fetch_assoc()) {
            $row['batch_id'] = $row['parent_id'];
            $docs[] = $row;
        }
        $stmt->close();
        echo json_encode(['success' => true, 'data' => $docs]);
    }
    elseif ($actionType === 'create_folder') {
        $name = trim($input['name'] ?? '');
        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Tên thư mục không được để trống']);
            exit;
        }
        $source_type = 'folder';
        $stmt = $conn->prepare("INSERT INTO ai_training_docs (tenant_id, name, source_type, parent_id, created_by) VALUES (?, ?, ?, 0, ?)");
        $stmt->bind_param("isss", $tidRag, $name, $source_type, $createdBy);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã tạo thư mục thành công']);
    }
    elseif ($actionType === 'add_manual') {
        $name = trim($input['name'] ?? '');
        $content = $input['content'] ?? '';
        $tags = trim($input['tags'] ?? '');
        $parentId = (int)($input['batch_id'] ?? 0);
        
        if (empty($name)) {
            echo json_encode(['success' => false, 'message' => 'Tiêu đề không được để trống']);
            exit;
        }
        
        $source_type = (strpos($content, 'URL_TO_CRAWL:') === 0) ? 'web' : 'manual';
        
        $stmt = $conn->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, tags, source_type, parent_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("issssis", $tidRag, $name, $content, $tags, $source_type, $parentId, $createdBy);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã thêm tài liệu thành công']);
    }
    elseif ($actionType === 'update_doc') {
        $id = (int)($input['id'] ?? 0);
        
        if ($id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID không hợp lệ']);
            exit;
        }

        if (isset($input['is_active'])) {
            $isActive = (int)$input['is_active'];
            $stmt = $conn->prepare("UPDATE ai_training_docs SET is_active = ? WHERE id = ? AND tenant_id = ?");
            $stmt->bind_param("iii", $isActive, $id, $tidRag);
            $stmt->execute();
            $stmt->close();
            echo json_encode(['success' => true, 'message' => 'Đã cập nhật trạng thái tài liệu']);
        } else {
            $name = trim($input['name'] ?? '');
            $content = $input['content'] ?? '';
            $tags = trim($input['tags'] ?? '');
            $parentId = (int)($input['parent_id'] ?? 0);

            if (empty($name)) {
                echo json_encode(['success' => false, 'message' => 'Tiêu đề không được để trống']);
                exit;
            }

            $stmt = $conn->prepare("UPDATE ai_training_docs SET name = ?, content = ?, tags = ?, parent_id = ?, version = COALESCE(version, 1) + 1, status = 'pending' WHERE id = ? AND tenant_id = ?");
            $stmt->bind_param("sssiii", $name, $content, $tags, $parentId, $id, $tidRag);
            $stmt->execute();
            $stmt->close();
            echo json_encode(['success' => true, 'message' => 'Đã cập nhật tài liệu thành công']);
        }
    }
    elseif ($actionType === 'delete_doc') {
        $id = (int)($input['doc_id'] ?? 0);
        if ($id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID không hợp lệ']);
            exit;
        }
        
        $stmt = $conn->prepare("UPDATE ai_training_docs SET parent_id = 0 WHERE parent_id = ? AND tenant_id = ?");
        $stmt->bind_param("ii", $id, $tidRag);
        $stmt->execute();
        $stmt->close();

        $delChunks = $conn->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ? AND tenant_id = ?");
        if ($delChunks) {
            $delChunks->bind_param("ii", $id, $tidRag);
            $delChunks->execute();
            $delChunks->close();
        }

        $stmt = $conn->prepare("DELETE FROM ai_training_docs WHERE id = ? AND tenant_id = ?");
        $stmt->bind_param("ii", $id, $tidRag);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã xóa tài liệu thành công']);
    }
    elseif ($actionType === 'delete_batch') {
        $id = (int)($input['batch_id'] ?? 0);
        if ($id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID thư mục không hợp lệ']);
            exit;
        }
        
        // Delete child chunks & children scoped to tenant
        $delChildChunks = $conn->prepare("DELETE FROM ai_training_chunks WHERE tenant_id = ? AND doc_id IN (SELECT id FROM ai_training_docs WHERE parent_id = ? AND tenant_id = ?)");
        if ($delChildChunks) {
            $delChildChunks->bind_param("iii", $tidRag, $id, $tidRag);
            $delChildChunks->execute();
            $delChildChunks->close();
        }

        $stmt = $conn->prepare("DELETE FROM ai_training_docs WHERE parent_id = ? AND tenant_id = ?");
        $stmt->bind_param("ii", $id, $tidRag);
        $stmt->execute();
        $stmt->close();

        // Delete the folder itself
        $stmt = $conn->prepare("DELETE FROM ai_training_docs WHERE id = ? AND tenant_id = ?");
        $stmt->bind_param("ii", $id, $tidRag);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã xóa thư mục và tất cả tài liệu con thành công']);
    }
    elseif ($actionType === 'toggle_batch') {
        $id = (int)($input['batch_id'] ?? 0);
        $isActive = (int)($input['is_active'] ?? 1);
        if ($id <= 0) {
            echo json_encode(['success' => false, 'message' => 'ID thư mục không hợp lệ']);
            exit;
        }

        // Toggle children
        $stmt = $conn->prepare("UPDATE ai_training_docs SET is_active = ? WHERE parent_id = ? AND tenant_id = ?");
        $stmt->bind_param("iii", $isActive, $id, $tidRag);
        $stmt->execute();
        $stmt->close();

        // Toggle folder itself
        $stmt = $conn->prepare("UPDATE ai_training_docs SET is_active = ? WHERE id = ? AND tenant_id = ?");
        $stmt->bind_param("iii", $isActive, $id, $tidRag);
        $stmt->execute();
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Đã cập nhật trạng thái thư mục']);
    }
    elseif ($actionType === 'train_docs') {
        $docIds = $input['doc_ids'] ?? [];
        if (empty($docIds) || !is_array($docIds)) {
            echo json_encode(['success' => false, 'message' => 'Không có tài liệu nào để huấn luyện']);
            exit;
        }

        $apiKey = get_system_setting($conn, 'gemini_api_key', $tidRag);
        if (empty($apiKey) && $tidRag !== 1) {
            $apiKey = get_system_setting($conn, 'gemini_api_key', 1);
        }
        if (empty($apiKey)) {
            echo json_encode(['success' => false, 'message' => 'Vui lòng cấu hình Gemini API Key trước khi huấn luyện']);
            exit;
        }

        // Load RAG settings for chunk_size and chunk_overlap
        $chunkSize = 700;
        $chunkOverlap = 150;
        $rawRagCfg = get_system_setting($conn, 'rag_settings', $tidRag);
        if (!empty($rawRagCfg)) {
            $ragSettings = json_decode((string)$rawRagCfg, true);
            $chunkSize = isset($ragSettings['chunk_size']) ? (int)$ragSettings['chunk_size'] : 700;
            $chunkOverlap = isset($ragSettings['chunk_overlap']) ? (int)$ragSettings['chunk_overlap'] : 150;
        }

        $successCount = 0;
        $errorMsg = '';

        $markStatusStmt = $conn->prepare("UPDATE ai_training_docs SET status = ? WHERE id = ? AND tenant_id = ?");

        foreach ($docIds as $idVal) {
            $id = (int)$idVal;
            if ($id <= 0) continue;

            // Query the document details
            $stmt = $conn->prepare("SELECT name, content, source_type, file_path FROM ai_training_docs WHERE id = ? AND tenant_id = ?");
            if (!$stmt) continue;
            $stmt->bind_param("ii", $id, $tidRag);
            $stmt->execute();
            $doc = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$doc) continue;

            $rawText = '';
            $sourceType = $doc['source_type'];

            // 1. Text extraction based on document type
            if ($sourceType === 'file') {
                $filePath = $doc['file_path'];
                $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
                if ($ext === 'txt') {
                    // Local TXT file
                    $fullPath = $_SERVER['DOCUMENT_ROOT'] . $filePath;
                    if (!file_exists($fullPath)) {
                        $fullPath = __DIR__ . '/../..' . $filePath;
                        if (!file_exists($fullPath)) {
                            $fullPath = __DIR__ . '/../' . $filePath;
                        }
                    }
                    if (file_exists($fullPath)) {
                        $rawText = file_get_contents($fullPath);
                    }
                } elseif ($ext === 'pdf') {
                    // PDF file - extract via Gemini multimodal OCR
                    $rawText = extract_pdf_text_via_gemini($filePath, $apiKey);
                    if (strpos($rawText, 'Lỗi:') === 0 || empty($rawText)) {
                        $errorMsg = "Không thể đọc văn bản từ PDF. Vui lòng kiểm tra API Key.";
                        if ($markStatusStmt) {
                            $errSt = 'error';
                            $markStatusStmt->bind_param("sii", $errSt, $id, $tidRag);
                            $markStatusStmt->execute();
                        }
                        continue;
                    }
                } else {
                    $rawText = $doc['content']; // Fallback
                }
            } elseif ($sourceType === 'web') {
                // Crawl web URL if content starts with URL_TO_CRAWL:
                $contentField = $doc['content'];
                if (strpos($contentField, 'URL_TO_CRAWL: ') === 0) {
                    $urlToFetch = trim(substr($contentField, 14));
                    $rawText = fetch_web_content($urlToFetch);
                    if (empty($rawText)) {
                        $errorMsg = "Không thể lấy nội dung từ đường dẫn website: " . $urlToFetch;
                        if ($markStatusStmt) {
                            $errSt = 'error';
                            $markStatusStmt->bind_param("sii", $errSt, $id, $tidRag);
                            $markStatusStmt->execute();
                        }
                        continue;
                    }
                } else {
                    $rawText = $contentField;
                }
            } else {
                // Manual text document
                $rawText = $doc['content'];
            }

            if (empty($rawText)) {
                $errorMsg = "Nội dung tài liệu trống";
                if ($markStatusStmt) {
                    $errSt = 'error';
                    $markStatusStmt->bind_param("sii", $errSt, $id, $tidRag);
                    $markStatusStmt->execute();
                }
                continue;
            }

            // Save the extracted text back into `content` in the database to display in preview mode
            $upStmt = $conn->prepare("UPDATE ai_training_docs SET content = ? WHERE id = ? AND tenant_id = ?");
            if ($upStmt) {
                $upStmt->bind_param("sii", $rawText, $id, $tidRag);
                $upStmt->execute();
                $upStmt->close();
            }

            // 2. Chunk text
            $chunks = chunk_text($rawText, $chunkSize, $chunkOverlap);

            // 3. Generate embeddings with incremental cache lookup & batching
            $hasError = false;
            $processedChunks = [];
            $uncachedChunks = [];
            $uncachedIndices = [];

            foreach ($chunks as $idx => $chunk) {
                $chunk = trim($chunk);
                if (empty($chunk)) continue;

                $hash = md5('models/gemini-embedding-001|v1beta|' . mb_strtolower($chunk));
                $vector = null;
                $vectorNorm = 0.0;

                // Check cache first
                $stmtCache = $conn->prepare("SELECT vector, vector_norm FROM ai_vector_cache WHERE hash = ? LIMIT 1");
                if ($stmtCache) {
                    $stmtCache->bind_param("s", $hash);
                    $stmtCache->execute();
                    $resCache = $stmtCache->get_result()->fetch_assoc();
                    $stmtCache->close();
                    if ($resCache && !empty($resCache['vector'])) {
                        $vector = json_decode($resCache['vector'], true);
                        $vectorNorm = (float)($resCache['vector_norm'] ?? 0.0);
                    }
                }

                if (is_array($vector) && $vectorNorm > 0.0) {
                    $processedChunks[$idx] = [
                        'content' => $chunk,
                        'vector' => $vector,
                        'norm' => $vectorNorm
                    ];
                } else {
                    $uncachedChunks[] = $chunk;
                    $uncachedIndices[] = $idx;
                }
            }

            // Call Gemini API only for cache misses
            if (!empty($uncachedChunks)) {
                $chunkBatches = array_chunk($uncachedChunks, 100);
                $batchIndexOffset = 0;

                foreach ($chunkBatches as $batchIdx => $batchChunks) {
                    // Pacing delay to avoid Gemini RPM limit (HTTP 429)
                    if ($batchIdx > 0) {
                        usleep(300000); // 300ms
                    }

                    $vectors = generate_batch_embeddings($batchChunks, $apiKey);
                    if (empty($vectors) || count($vectors) !== count($batchChunks)) {
                        $hasError = true;
                        break;
                    }

                    foreach ($batchChunks as $idx => $chunk) {
                        $vector = $vectors[$idx];
                        if ($vector === null) {
                            $hasError = true;
                            break;
                        }

                        // Calculate norm
                        $vectorNorm = 0.0;
                        if (is_array($vector)) {
                            foreach ($vector as $v) {
                                $vectorNorm += $v * $v;
                            }
                            $vectorNorm = sqrt($vectorNorm);
                        }

                        $originalIdx = $uncachedIndices[$batchIndexOffset + $idx];
                        $processedChunks[$originalIdx] = [
                            'content' => $chunk,
                            'vector' => $vector,
                            'norm' => $vectorNorm
                        ];

                        // Cache the vector & norm for future use
                        $hash = md5('models/gemini-embedding-001|v1beta|' . mb_strtolower($chunk));
                        $vectorJson = json_encode($vector);
                        $stmtSaveCache = $conn->prepare("INSERT INTO ai_vector_cache (hash, vector, vector_norm) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE vector = ?, vector_norm = ?");
                        if ($stmtSaveCache) {
                            $stmtSaveCache->bind_param("ssssd", $hash, $vectorJson, $vectorNorm, $vectorJson, $vectorNorm);
                            $stmtSaveCache->execute();
                            $stmtSaveCache->close();
                        }
                    }
                    if ($hasError) break;
                    $batchIndexOffset += count($batchChunks);
                }
            }

            // Save all chunks to training chunks table
            if (!$hasError) {
                // Delete existing chunks for this doc first to prevent duplication (prepared & tenant-scoped)
                $delOldChunks = $conn->prepare("DELETE FROM ai_training_chunks WHERE doc_id = ? AND tenant_id = ?");
                if ($delOldChunks) {
                    $delOldChunks->bind_param("ii", $id, $tidRag);
                    $delOldChunks->execute();
                    $delOldChunks->close();
                }

                $cStmt = $conn->prepare("INSERT INTO ai_training_chunks (tenant_id, doc_id, chunk_index, content, vector, vector_norm) VALUES (?, ?, ?, ?, ?, ?)");
                if ($cStmt) {
                    foreach ($processedChunks as $chunkIndex => $pChunk) {
                        $vectorJson = json_encode($pChunk['vector']);
                        $cIdxInt = (int)$chunkIndex;
                        $cContent = (string)$pChunk['content'];
                        $cNorm = (float)$pChunk['norm'];
                        $cStmt->bind_param("iiissd", $tidRag, $id, $cIdxInt, $cContent, $vectorJson, $cNorm);
                        $cStmt->execute();
                    }
                    $cStmt->close();
                }

                if ($markStatusStmt) {
                    $trainedSt = 'trained';
                    $markStatusStmt->bind_param("sii", $trainedSt, $id, $tidRag);
                    $markStatusStmt->execute();
                }
                $successCount++;
            } else {
                $errorMsg = "Lỗi khi gọi API tạo Vector Embedding của Google Gemini.";
                if ($markStatusStmt) {
                    $errSt = 'error';
                    $markStatusStmt->bind_param("sii", $errSt, $id, $tidRag);
                    $markStatusStmt->execute();
                }
            }
        }
        if ($markStatusStmt) {
            $markStatusStmt->close();
        }

        if ($successCount > 0) {
            echo json_encode(['success' => true, 'message' => "Đã hoàn tất huấn luyện thành công $successCount tài liệu!"]);
        } else {
            echo json_encode(['success' => false, 'message' => !empty($errorMsg) ? $errorMsg : 'Huấn luyện thất bại']);
        }
    }
    elseif ($actionType === 'upload_training_file') {
        if (!isset($_FILES['file'])) {
            echo json_encode(['success' => false, 'message' => 'Không tìm thấy file tải lên']);
            exit;
        }
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            echo json_encode(['success' => false, 'message' => 'Lỗi tải file: ' . $file['error']]);
            exit;
        }

        $uploadDir = __DIR__ . "/../uploads/tenant_{$tidRag}/";
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedTrainExts = ['txt', 'pdf', 'md', 'csv', 'json', 'doc', 'docx'];
        if (!in_array($ext, $allowedTrainExts, true)) {
            echo json_encode(['success' => false, 'message' => "Định dạng file .{$ext} không được hỗ trợ cho huấn luyện AI"]);
            exit;
        }
        $cleanName = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $file['name']);
        $filename = time() . '_' . uniqid() . '_' . $cleanName;
        $targetPath = $uploadDir . $filename;

        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            $relativeUrl = "/backend/uploads/tenant_{$tidRag}/" . $filename;
            
            $content = '';
            if ($ext === 'txt' || $ext === 'md' || $ext === 'csv' || $ext === 'json') {
                $content = file_get_contents($targetPath);
            } else {
                $content = "Tài liệu đính kèm: " . $file['name'];
            }

            $parentId = (int)($_POST['folder_id'] ?? 0);
            $name = $file['name'];
            $source_type = 'file';
            $file_size = $file['size'];

            $stmt = $conn->prepare("INSERT INTO ai_training_docs (tenant_id, name, content, source_type, parent_id, file_path, file_size, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->bind_param("isssisds", $tidRag, $name, $content, $source_type, $parentId, $relativeUrl, $file_size, $createdBy);
            $stmt->execute();
            $stmt->close();

            echo json_encode(['success' => true, 'message' => 'Đã tải lên tài liệu thành công']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Không thể lưu file trên máy chủ']);
        }
    }
    else {
        echo json_encode(['success' => false, 'message' => 'Thao tác không được hỗ trợ']);
    }
} catch (Exception $ex) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $ex->getMessage()]);
}
