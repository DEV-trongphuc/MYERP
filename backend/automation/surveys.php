<?php
// api/surveys.php — Survey Builder API (Auth Required)
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once 'db_connect.php';
require_once 'auth_middleware.php';

$workspace_id = get_current_workspace_id();
$action = $_GET['action'] ?? 'list';
if ($action === '') {
    $action = 'list';
}
$id     = $_GET['id'] ?? null;
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    switch ($action) {

        // ─── LIST ────────────────────────────────────────────────────────────
        case 'list': {
            $stmt = $pdo->prepare("
                SELECT s.*,
                    (SELECT COUNT(*) FROM survey_responses r WHERE r.survey_id = s.id) AS response_count,
                    u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email,
                    u_creator.phone AS creator_phone, u_creator.avatar_url AS creator_avatar,
                    u_creator.job_title AS creator_job_title, u_creator.department AS creator_department,
                    u_creator.role AS creator_role
                FROM surveys s
                LEFT JOIN users u_creator ON u_creator.id = s.created_by
                WHERE (s.workspace_id = ? OR (? = 1 AND s.workspace_id IS NULL))
                ORDER BY s.updated_at DESC
            ");
            $stmt->execute([$workspace_id, $workspace_id]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$row) {
                $decodedBlocks = json_decode($row['blocks_json'] ?? '[]', true);
                $normBlocks = normalizeSurveyBlocks(is_array($decodedBlocks) ? $decodedBlocks : []);
                $row['blocks_json']    = $normBlocks;
                $row['blocks']         = $normBlocks;
                $row['settings_json']  = json_decode($row['settings_json'] ?? '{}', true) ?: new stdClass();
                $row['settings']       = $row['settings_json'];
                $row['thank_you_page'] = json_decode($row['thank_you_page'] ?? '{}', true) ?: new stdClass();
                $row['thankYouPage']   = $row['thank_you_page'];
                $coverStyle = json_decode($row['cover_style'] ?? '{}', true) ?: [];
                if (empty($coverStyle['cardShadow'])) {
                    $coverStyle['cardShadow'] = 'none';
                }
                $row['cover_style']    = $coverStyle;
                $row['theme']          = $coverStyle;
                $row['creator']        = domationFormatCreator($row);
            }
            unset($row);
            echo json_encode(['success' => true, 'data' => $rows], JSON_UNESCAPED_UNICODE);
            break;
        }

        // ─── GET SINGLE ──────────────────────────────────────────────────────
        case 'get': {
            $stmt = $pdo->prepare("
                SELECT s.*,
                    u_creator.id AS creator_id, u_creator.full_name AS creator_name, u_creator.email AS creator_email,
                    u_creator.phone AS creator_phone, u_creator.avatar_url AS creator_avatar,
                    u_creator.job_title AS creator_job_title, u_creator.department AS creator_department,
                    u_creator.role AS creator_role
                FROM surveys s
                LEFT JOIN users u_creator ON u_creator.id = s.created_by
                WHERE s.id = ? AND (s.workspace_id = ? OR (? = 1 AND s.workspace_id IS NULL))
            ");
            $stmt->execute([$id, $workspace_id, $workspace_id]);
            $survey = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$survey) { http_response_code(404); echo json_encode(['success' => false, 'error' => 'Not found']); exit; }
            $decodedBlocks = json_decode($survey['blocks_json'] ?? '[]', true);
            $normBlocks = normalizeSurveyBlocks(is_array($decodedBlocks) ? $decodedBlocks : []);
            $survey['blocks_json']   = $normBlocks;
            $survey['blocks']        = $normBlocks;
            $survey['settings_json'] = json_decode($survey['settings_json'] ?? '{}', true) ?: new stdClass();
            $survey['settings']      = $survey['settings_json'];
            $survey['thank_you_page']= json_decode($survey['thank_you_page'] ?? '{}', true) ?: new stdClass();
            $survey['thankYouPage']  = $survey['thank_you_page'];
            $coverStyle = json_decode($survey['cover_style'] ?? '{}', true) ?: [];
            if (empty($coverStyle['cardShadow'])) {
                $coverStyle['cardShadow'] = 'none';
            }
            $survey['cover_style']   = $coverStyle;
            $survey['theme']         = $coverStyle;
            $survey['creator']       = domationFormatCreator($survey);
            echo json_encode(['success' => true, 'data' => $survey], JSON_UNESCAPED_UNICODE);
            break;
        }

        // ─── QR CODE GENERATOR ───────────────────────────────────────────────
        case 'qr': {
            $stmt = $pdo->prepare("SELECT id, name, slug FROM surveys WHERE id = ? AND (workspace_id = ? OR (? = 1 AND workspace_id IS NULL))");
            $stmt->execute([$id, $workspace_id, $workspace_id]);
            $survey = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$survey) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Not found']);
                exit;
            }
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'crm.ideas.edu.vn';
            $surveyUrl = $protocol . '://' . $host . '/s/' . ($survey['slug'] ?? $survey['id']);
            $qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=12&data=' . urlencode($surveyUrl);
            echo json_encode([
                'success' => true,
                'data' => [
                    'url' => $surveyUrl,
                    'qr_image_url' => $qrImageUrl
                ]
            ]);
            break;
        }

        // ─── CREATE ──────────────────────────────────────────────────────────
        case 'create': {
            $requestedId = isset($input['id']) && is_string($input['id']) && preg_match('/^[0-9a-fA-F\-]{36}$/', $input['id']) ? $input['id'] : null;
            $newId   = $requestedId ?: generateUUID();
            $name    = trim($input['name'] ?? 'Khảo sát mới');
            $baseSlug= clean_slug($name);
            $slug    = $baseSlug . '-' . substr($newId, 0, 6);

            $presetBlocks = [];
            if (!empty($input['blocks_json']) && is_array($input['blocks_json'])) {
                $presetBlocks = normalizeSurveyBlocks($input['blocks_json']);
            } elseif ($name === 'Khảo sát NPS') {
                $presetBlocks = [
                    [
                        'id' => generateUUID(),
                        'type' => 'nps',
                        'label' => 'Bạn sẵn sàng giới thiệu sản phẩm của chúng tôi cho bạn bè/đồng nghiệp ở mức nào? (Từ 0-10)',
                        'title' => 'Bạn sẵn sàng giới thiệu sản phẩm của chúng tôi cho bạn bè/đồng nghiệp ở mức nào? (Từ 0-10)',
                        'required' => true,
                        'scale' => 10,
                        'minValue' => 0,
                        'maxValue' => 10,
                        'minLabel' => 'Rất không hài lòng',
                        'maxLabel' => 'Rất hài lòng',
                    ],
                    [
                        'id' => generateUUID(),
                        'type' => 'short_text',
                        'label' => 'Lý do chính cho điểm số của bạn là gì? (Tùy chọn)',
                        'title' => 'Lý do chính cho điểm số của bạn là gì? (Tùy chọn)',
                        'required' => false,
                        'placeholder' => 'Nhập chia sẻ của bạn...',
                    ],
                ];
            } elseif ($name === 'Phản hồi sản phẩm') {
                $presetBlocks = [
                    [
                        'id' => generateUUID(),
                        'type' => 'single_choice',
                        'label' => 'Bạn đánh giá chất lượng sản phẩm như thế nào?',
                        'title' => 'Bạn đánh giá chất lượng sản phẩm như thế nào?',
                        'required' => true,
                        'options' => [
                            ['id' => generateUUID(), 'label' => 'Rất tốt', 'value' => 'Rất tốt'],
                            ['id' => generateUUID(), 'label' => 'Tốt', 'value' => 'Tốt'],
                            ['id' => generateUUID(), 'label' => 'Bình thường', 'value' => 'Bình thường'],
                            ['id' => generateUUID(), 'label' => 'Kém', 'value' => 'Kém'],
                        ],
                    ],
                    [
                        'id' => generateUUID(),
                        'type' => 'long_text',
                        'label' => 'Bạn muốn chúng tôi cải thiện điều gì?',
                        'title' => 'Bạn muốn chúng tôi cải thiện điều gì?',
                        'required' => false,
                        'placeholder' => 'Nhập góp ý của bạn...',
                    ],
                ];
            } elseif ($name === 'Đánh giá dịch vụ') {
                $presetBlocks = [
                    [
                        'id' => generateUUID(),
                        'type' => 'star_rating',
                        'label' => 'Vui lòng đánh giá chất lượng phục vụ của nhân viên:',
                        'title' => 'Vui lòng đánh giá chất lượng phục vụ của nhân viên:',
                        'required' => true,
                        'maxStars' => 5,
                        'minValue' => 1,
                        'maxValue' => 5,
                        'ratingIcon' => 'star',
                    ],
                    [
                        'id' => generateUUID(),
                        'type' => 'short_text',
                        'label' => 'Góp ý thêm (Tùy chọn)',
                        'title' => 'Góp ý thêm (Tùy chọn)',
                        'required' => false,
                        'placeholder' => 'Nhập góp ý thêm...',
                    ],
                ];
            } elseif ($name === 'Khảo sát thị trường') {
                $presetBlocks = [
                    [
                        'id' => generateUUID(),
                        'type' => 'single_choice',
                        'label' => 'Sản phẩm nào bạn quan tâm nhất?',
                        'title' => 'Sản phẩm nào bạn quan tâm nhất?',
                        'required' => true,
                        'options' => [
                            ['id' => generateUUID(), 'label' => 'Phần mềm tự động hóa', 'value' => 'Phần mềm tự động hóa'],
                            ['id' => generateUUID(), 'label' => 'Truyền thông Email', 'value' => 'Truyền thông Email'],
                            ['id' => generateUUID(), 'label' => 'Tạo Khảo sát', 'value' => 'Tạo Khảo sát'],
                            ['id' => generateUUID(), 'label' => 'Khác', 'value' => 'Khác'],
                        ],
                    ],
                ];
            } elseif ($name === 'Mẫu Quiz (Trắc nghiệm)') {
                $presetBlocks = [
                    [
                        'id' => generateUUID(),
                        'type' => 'single_choice',
                        'label' => 'Câu 1: Câu hỏi trắc nghiệm của bạn là gì?',
                        'title' => 'Câu 1: Câu hỏi trắc nghiệm của bạn là gì?',
                        'required' => true,
                        'options' => [
                            ['id' => generateUUID(), 'label' => 'Đáp án A', 'value' => 'Đáp án A'],
                            ['id' => generateUUID(), 'label' => 'Đáp án B', 'value' => 'Đáp án B'],
                            ['id' => generateUUID(), 'label' => 'Đáp án C', 'value' => 'Đáp án C'],
                        ],
                    ],
                    [
                        'id' => generateUUID(),
                        'type' => 'single_choice',
                        'label' => 'Câu 2: Chọn đáp án đúng',
                        'title' => 'Câu 2: Chọn đáp án đúng',
                        'required' => true,
                        'options' => [
                            ['id' => generateUUID(), 'label' => 'Sự thật', 'value' => 'Sự thật'],
                            ['id' => generateUUID(), 'label' => 'Giả định', 'value' => 'Giả định'],
                        ],
                    ],
                ];
            } elseif ($name === 'Mẫu Check-in Event') {
                $presetBlocks = [
                    [
                        'id' => generateUUID(),
                        'type' => 'short_text',
                        'label' => 'Họ và Tên',
                        'title' => 'Họ và Tên',
                        'required' => true,
                        'placeholder' => 'Nhập họ và tên của bạn...',
                    ],
                    [
                        'id' => generateUUID(),
                        'type' => 'phone',
                        'label' => 'Số điện thoại',
                        'title' => 'Số điện thoại',
                        'required' => true,
                        'placeholder' => '0912 345 678',
                    ],
                    [
                        'id' => generateUUID(),
                        'type' => 'single_choice',
                        'label' => 'Bạn đã nhận quà sự kiện chưa?',
                        'title' => 'Bạn đã nhận quà sự kiện chưa?',
                        'required' => true,
                        'options' => [
                            ['id' => generateUUID(), 'label' => 'Đã nhận', 'value' => 'Đã nhận'],
                            ['id' => generateUUID(), 'label' => 'Chưa nhận', 'value' => 'Chưa nhận'],
                        ],
                    ],
                ];
            }

            $blocks_json = json_encode($presetBlocks, JSON_UNESCAPED_UNICODE);
            $defaultSettingsArr = ['showProgressBar'=>true,'progressBarStyle'=>'bar','allowPartialSubmit'=>false,'trackIp'=>true,'trackLocation'=>false];
            $defaultThankYouArr = ['title'=>'Cảm ơn bạn! 🎉','message'=>'Phản hồi của bạn đã được ghi nhận.','showSocialShare'=>false];
            $defaultCoverArr    = [
                'primaryColor' => '#BD1D2D',
                'backgroundColor' => '#f8fafc',
                'cardBackground' => '#ffffff',
                'textColor' => '#1e293b',
                'borderRadius' => '12px',
                'cardShadow' => 'none',
                'coverStyle' => 'minimal',
                'coverHeight' => 'md'
            ];

            $defaultSettings  = json_encode($defaultSettingsArr, JSON_UNESCAPED_UNICODE);
            $defaultThankYou  = json_encode($defaultThankYouArr, JSON_UNESCAPED_UNICODE);
            $defaultCover     = json_encode($defaultCoverArr, JSON_UNESCAPED_UNICODE);

            $currentUserId = get_current_user_id();
            $stmt = $pdo->prepare("
                INSERT INTO surveys (id, workspace_id, name, slug, status, blocks_json, settings_json, thank_you_page, cover_style, created_by, updated_by)
                VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$newId, $workspace_id, $name, $slug, $blocks_json, $defaultSettings, $defaultThankYou, $defaultCover, $currentUserId, $currentUserId]);

            // Auto-sync survey_questions on create
            if (!empty($presetBlocks)) {
                $qStmt = $pdo->prepare("INSERT INTO survey_questions (id, survey_id, block_id, type, label, options_json, required, order_index, target_attribute) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $order = 0;
                foreach ($presetBlocks as $b) {
                    $isLayout = in_array($b['type'] ?? '', ['section_header', 'image_block', 'divider', 'page_break', 'button_block', 'link_block', 'banner_block']);
                    if (!$isLayout) {
                        $opts = isset($b['options']) ? json_encode($b['options'], JSON_UNESCAPED_UNICODE) : null;
                        $req = !empty($b['required']) ? 1 : 0;
                        $label = $b['label'] ?? ($b['title'] ?? 'Câu hỏi ' . ($order + 1));
                        $blockId = $b['id'] ?? generateUUID();
                        $targetAttr = $b['targetAttribute'] ?? ($b['target_attribute'] ?? null);
                        $qStmt->execute([generateUUID(), $newId, $blockId, $b['type'] ?? 'short_text', $label, $opts, $req, $order, $targetAttr]);
                        $order++;
                    }
                }
            }

            $nowIso = date('Y-m-d H:i:s');
            echo json_encode([
                'success' => true,
                'data' => [
                    'id' => $newId,
                    'workspace_id' => $workspace_id,
                    'name' => $name,
                    'slug' => $slug,
                    'status' => 'draft',
                    'blocks' => $presetBlocks,
                    'blocks_json' => $presetBlocks,
                    'settings' => $defaultSettingsArr,
                    'settings_json' => $defaultSettingsArr,
                    'thankYouPage' => $defaultThankYouArr,
                    'thank_you_page' => $defaultThankYouArr,
                    'theme' => $defaultCoverArr,
                    'cover_style' => $defaultCoverArr,
                    'response_count' => 0,
                    'created_by' => $currentUserId,
                    'creator' => get_current_user_info(),
                    'created_at' => $nowIso,
                    'updated_at' => $nowIso,
                ]
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        // ─── UPDATE (auto-save) ───────────────────────────────────────────────
        case 'update': {
            // Validate slug if it is being updated
            if (isset($input['slug'])) {
                $rawSlug = trim($input['slug']);
                if (empty($rawSlug)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Slug không được để trống']);
                    exit;
                }
                $cleanSlug = preg_replace('/[^a-z0-9\-]+/', '-', strtolower($rawSlug));
                $cleanSlug = preg_replace('/-+/', '-', trim($cleanSlug, '-'));
                
                // Check uniqueness
                $stmtCheck = $pdo->prepare("SELECT id FROM surveys WHERE slug = ? AND id != ?");
                $stmtCheck->execute([$cleanSlug, $id]);
                if ($stmtCheck->fetchColumn()) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Slug này đã tồn tại, vui lòng chọn đường dẫn khác']);
                    exit;
                }
                $input['slug'] = $cleanSlug; // overwrite with cleaned slug
            }

            $allowedFields = ['name','slug','status','blocks_json','settings_json','thank_you_page','cover_style',
                              'target_list_id','flow_trigger_id','response_limit','close_at','require_login',
                              'allow_anonymous','one_per_email'];
            $sets = []; $params = [];
            foreach ($allowedFields as $f) {
                if (!array_key_exists($f, $input)) continue;
                $val = in_array($f, ['blocks_json','settings_json','thank_you_page','cover_style'])
                    ? json_encode($input[$f]) : $input[$f];
                $sets[]   = "`$f` = ?";
                $params[] = $val;
            }
            if (empty($sets)) { echo json_encode(['success' => true, 'message' => 'Nothing to update']); break; }
            $sets[] = "`updated_by` = ?";
            $params[] = get_current_user_id();
            $params[] = $id;
            $params[] = $workspace_id;
            $pdo->prepare("UPDATE surveys SET " . implode(', ', $sets) . " WHERE id = ? AND workspace_id = ?")->execute($params);

            // [FIX] Auto-sync survey_questions for Analytics
            if (isset($input['blocks_json']) && is_array($input['blocks_json'])) {
                $blocks = $input['blocks_json'];
                $pdo->prepare("DELETE FROM survey_questions WHERE survey_id = ?")->execute([$id]);
                $qStmt = $pdo->prepare("INSERT INTO survey_questions (id, survey_id, block_id, type, label, options_json, required, order_index, target_attribute) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $order = 0;
                foreach ($blocks as $b) {
                    $isLayout = in_array($b['type'] ?? '', ['section_header', 'image_block', 'divider', 'page_break', 'button_block', 'link_block', 'banner_block']);
                    if (!$isLayout) {
                        $opts = isset($b['options']) ? json_encode($b['options'], JSON_UNESCAPED_UNICODE) : null;
                        $req = isset($b['required']) && $b['required'] ? 1 : 0;
                        $label = !empty($b['label']) ? $b['label'] : (!empty($b['content']) ? $b['content'] : (!empty($b['title']) ? $b['title'] : 'Câu hỏi ' . ($order + 1)));
                        $blockId = $b['id'] ?? generateUUID();
                        $targetAttr = $b['targetAttribute'] ?? ($b['target_attribute'] ?? null);
                        $qStmt->execute([generateUUID(), $id, $blockId, $b['type'] ?? 'unknown', $label, $opts, $req, $order, $targetAttr]);
                        $order++;
                    }
                }
            }

            echo json_encode(['success' => true]);
            break;
        }

        // ─── PUBLISH ─────────────────────────────────────────────────────────
        case 'publish': {
            $pdo->prepare("UPDATE surveys SET status = 'active', updated_by = ? WHERE id = ? AND workspace_id = ?")->execute([get_current_user_id(), $id, $workspace_id]);
            echo json_encode(['success' => true, 'message' => 'Survey published']);
            break;
        }

        // ─── PAUSE ───────────────────────────────────────────────────────────
        case 'pause': {
            $pdo->prepare("UPDATE surveys SET status = 'paused', updated_by = ? WHERE id = ? AND workspace_id = ?")->execute([get_current_user_id(), $id, $workspace_id]);
            echo json_encode(['success' => true]);
            break;
        }

        // ─── DELETE ──────────────────────────────────────────────────────────
        case 'delete': {
            $stmtOwn = $pdo->prepare("SELECT id FROM surveys WHERE id = ? AND workspace_id = ?");
            $stmtOwn->execute([$id, $workspace_id]);
            if (!$stmtOwn->fetchColumn()) {
                echo json_encode(['success' => false, 'error' => 'Not found or forbidden']);
                break;
            }
            $pdo->beginTransaction();
            try {
                $pdo->prepare("DELETE FROM survey_answer_details WHERE survey_id = ?")->execute([$id]);
                $pdo->prepare("DELETE FROM survey_responses WHERE survey_id = ?")->execute([$id]);
                $pdo->prepare("DELETE FROM survey_questions WHERE survey_id = ?")->execute([$id]);
                $pdo->prepare("DELETE FROM surveys WHERE id = ?")->execute([$id]);
                $pdo->commit();
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                error_log('[surveys.php] delete error: ' . $e->getMessage());
                echo json_encode(['success' => false, 'error' => 'Lỗi hệ thống khi xóa khảo sát.']);
            }
            break;
        }

        // ─── RESPONDENTS (TAB ĐỐI TƯỢNG) ──────────────────────────────────────
        case 'respondents': {
            $stmtOwn = $pdo->prepare("SELECT id FROM surveys WHERE id = ? AND workspace_id = ?");
            $stmtOwn->execute([$id, $workspace_id]);
            if (!$stmtOwn->fetchColumn()) {
                echo json_encode(['success' => false, 'error' => 'Not found or forbidden']);
                break;
            }

            // Auto-heal existing test responses where source_channel was direct_link or subscriber_id was unlinked
            try {
                $pdo->prepare("
                    UPDATE survey_responses 
                    SET source_channel = 'email_embed' 
                    WHERE survey_id = ? AND source_channel = 'direct_link' 
                    AND (utm_source = 'mailflow' OR utm_medium = 'email' OR utm_campaign IS NOT NULL)
                ")->execute([$id]);

                // Heal unlinked responses
                $unlinkedStmt = $pdo->prepare("SELECT id, answers_json FROM survey_responses WHERE survey_id = ? AND subscriber_id IS NULL");
                $unlinkedStmt->execute([$id]);
                $unlinkedRows = $unlinkedStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($unlinkedRows as $u) {
                    $uAns = json_decode($u['answers_json'] ?? '[]', true) ?: [];
                    $uEmail = null;
                    foreach ($uAns as $a) {
                        if (($a['type'] ?? '') === 'email' && !empty($a['answer_text'])) {
                            $uEmail = strtolower(trim($a['answer_text']));
                            break;
                        }
                    }
                    if ($uEmail) {
                        $sFind = $pdo->prepare("SELECT id FROM subscribers WHERE email = ? LIMIT 1");
                        $sFind->execute([$uEmail]);
                        $foundSubId = $sFind->fetchColumn();
                        if ($foundSubId) {
                            $pdo->prepare("UPDATE survey_responses SET subscriber_id = ?, source_channel = 'email_embed' WHERE id = ?")->execute([$foundSubId, $u['id']]);
                        }
                    }
                }
            } catch (Exception $e) { /* non-blocking */ }

            $stmt = $pdo->prepare("
                SELECT r.*,
                    COALESCE(r.contact_id, s.contact_id, ct.id) AS contact_id,
                    COALESCE(s.email, ct.email) AS subscriber_email,
                    COALESCE(NULLIF(TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))), ''), s.first_name, ct.full_name, 'Ẩn danh') AS subscriber_name,
                    COALESCE(s.phone_number, ct.phone) AS subscriber_phone
                FROM survey_responses r
                LEFT JOIN subscribers s ON s.id = r.subscriber_id
                LEFT JOIN contacts ct ON ct.id = COALESCE(r.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                WHERE r.survey_id = ?
                ORDER BY r.submitted_at DESC
            ");
            $stmt->execute([$id]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch block definitions to format answers
            $surveyStmt = $pdo->prepare("SELECT blocks_json FROM surveys WHERE id = ?");
            $surveyStmt->execute([$id]);
            $rawBlocks = json_decode($surveyStmt->fetchColumn() ?: '[]', true) ?: [];
            $blocks = normalizeSurveyBlocks(is_array($rawBlocks) ? $rawBlocks : []);
            $blocksMap = [];
            foreach ($blocks as $b) {
                if (!empty($b['id'])) $blocksMap[$b['id']] = $b;
            }

            foreach ($rows as &$row) {
                $rawAnswers = json_decode($row['answers_json'] ?? '[]', true) ?: [];
                $formattedAnswers = [];
                foreach ($rawAnswers as $ans) {
                    $bId = $ans['block_id'] ?? ($ans['question_id'] ?? '');
                    $block = $blocksMap[$bId] ?? null;
                    $qType = $ans['type'] ?? ($block['type'] ?? 'short_text');
                    $qLabel = !empty($ans['label']) ? $ans['label'] : (!empty($block['label']) ? $block['label'] : (!empty($block['question']) ? $block['question'] : 'Câu hỏi'));
                    
                    $val = '';
                    if (isset($ans['answer_text'])) {
                        $val = resolveChoiceLabel($ans['answer_text'], $block, $qType);
                    } elseif (isset($ans['answer_num'])) {
                        $val = $ans['answer_num'];
                    } elseif (isset($ans['answer_json'])) {
                        if (is_array($ans['answer_json'])) {
                            $val = implode(', ', array_map(fn($item) => resolveChoiceLabel($item, $block, $qType), $ans['answer_json']));
                        } else {
                            $val = resolveChoiceLabel($ans['answer_json'], $block, $qType);
                        }
                    }

                    $formattedAnswers[] = [
                        'block_id'       => $bId,
                        'question'       => $qLabel,
                        'question_title' => $qLabel,
                        'type'           => $qType,
                        'answer'         => $val,
                        'answer_text'    => $val,
                    ];

                    // Fallback to extract email / name / phone if subscriber info is still missing
                    if (empty($row['subscriber_email']) && ($qType === 'email' || filter_var($ans['answer_text'] ?? '', FILTER_VALIDATE_EMAIL))) {
                        $row['subscriber_email'] = $ans['answer_text'];
                    }
                    if (($row['subscriber_name'] === 'Ẩn danh' || empty($row['subscriber_name'])) && $qType === 'short_text' && !empty($ans['answer_text'])) {
                        $lblLow = mb_strtolower($qLabel);
                        if (strpos($lblLow, 'tên') !== false || strpos($lblLow, 'name') !== false || strpos($lblLow, 'họ') !== false) {
                            $row['subscriber_name'] = $ans['answer_text'];
                        }
                    }
                    if (empty($row['subscriber_phone']) && ($qType === 'phone' || strpos(mb_strtolower($qLabel), 'điện thoại') !== false || strpos(mb_strtolower($qLabel), 'phone') !== false)) {
                        $row['subscriber_phone'] = $ans['answer_text'];
                    }
                }

                if (empty($row['contact_id']) && class_exists('DomationContactMatcher')) {
                    try {
                        $matchedCid = DomationContactMatcher::findExistingContactId(
                            $pdo,
                            !empty($row['subscriber_email']) ? (string)$row['subscriber_email'] : null,
                            !empty($row['subscriber_phone']) ? (string)$row['subscriber_phone'] : null
                        );
                        if ($matchedCid) {
                            $row['contact_id'] = $matchedCid;
                        }
                    } catch (Throwable $e) {
                        // non-blocking
                    }
                }

                $row['answers'] = $formattedAnswers;
                unset($row['answers_json']);
            }
            unset($row);

            echo json_encode(['success' => true, 'data' => $rows], JSON_UNESCAPED_UNICODE);
            break;
        }

        // ─── RESPONSES LIST (RAW WITH PAGINATION) ───────────────────────────────
        case 'responses': {
            $stmtOwn = $pdo->prepare("SELECT id FROM surveys WHERE id = ? AND workspace_id = ?");
            $stmtOwn->execute([$id, $workspace_id]);
            if (!$stmtOwn->fetchColumn()) {
                echo json_encode(['success' => false, 'error' => 'Not found or forbidden']);
                break;
            }

            $page  = max(1, (int)($_GET['page'] ?? 1));
            $limit = min(100, (int)($_GET['limit'] ?? 50));
            $offset = ($page - 1) * $limit;

            $totalStmt = $pdo->prepare("SELECT COUNT(*) FROM survey_responses WHERE survey_id = ?");
            $totalStmt->execute([$id]);
            $total = (int)$totalStmt->fetchColumn();

            // Load survey blocks map for question titles & choice resolution
            $surveyStmt = $pdo->prepare("SELECT blocks_json FROM surveys WHERE id = ?");
            $surveyStmt->execute([$id]);
            $rawBlocks = json_decode($surveyStmt->fetchColumn() ?: '[]', true) ?: [];
            $blocks = normalizeSurveyBlocks(is_array($rawBlocks) ? $rawBlocks : []);
            $blocksMap = [];
            foreach ($blocks as $b) {
                if (!empty($b['id'])) $blocksMap[$b['id']] = $b;
            }

            $stmt = $pdo->prepare("
                SELECT r.*,
                    COALESCE(r.contact_id, s.contact_id, ct.id) AS contact_id,
                    COALESCE(s.email, ct.email) AS subscriber_email,
                    TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS subscriber_name,
                    COALESCE(s.phone_number, ct.phone) AS subscriber_phone
                FROM survey_responses r
                LEFT JOIN subscribers s ON s.id = r.subscriber_id
                LEFT JOIN contacts ct ON ct.id = COALESCE(r.contact_id, s.contact_id) AND ct.deleted_at IS NULL
                WHERE r.survey_id = ?
                ORDER BY r.submitted_at DESC
                LIMIT " . (int)$limit . " OFFSET " . (int)$offset . "
            ");
            $stmt->execute([$id]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$row) {
                $rawAnswers = json_decode($row['answers_json'] ?? '[]', true) ?: [];
                $resolvedAnswers = [];

                $foundEmail = $row['subscriber_email'] ?? '';
                $foundPhone = $row['subscriber_phone'] ?? '';
                $foundName  = $row['subscriber_name'] ?? '';

                foreach ($rawAnswers as $ans) {
                    $bId = $ans['block_id'] ?? ($ans['question_id'] ?? '');
                    $b = $blocksMap[$bId] ?? null;
                    $qTitle = (!empty($b['label']) && $b['label'] !== 'Untitled Question') 
                        ? $b['label'] 
                        : ($b['content'] ?? ($b['title'] ?? ($b['question'] ?? '')));

                    $rawVal = $ans['answer_text'] ?? ($ans['answer_num'] ?? (is_array($ans['answer_json'] ?? null) ? implode(', ', $ans['answer_json']) : ''));
                    $resolvedAnswers[] = [
                        'block_id'       => $bId,
                        'question_id'    => $ans['question_id'] ?? $bId,
                        'question_title' => $qTitle,
                        'answer_text'    => resolveChoiceLabel((string)$rawVal, $b, $ans['type'] ?? ($b['type'] ?? '')),
                        'answer_json'    => $ans['answer_json'] ?? null,
                        'answer_num'     => $ans['answer_num'] ?? null,
                        'type'           => $ans['type'] ?? ($b['type'] ?? '')
                    ];

                    // Fallback email, name, phone from answers if subscriber wasn't linked
                    if (empty($foundEmail) && ($ans['type'] ?? '') === 'email' && !empty($ans['answer_text'])) {
                        $foundEmail = $ans['answer_text'];
                    }
                    if (empty($foundPhone) && in_array($ans['type'] ?? '', ['phone', 'phone_number']) && !empty($ans['answer_text'])) {
                        $foundPhone = $ans['answer_text'];
                    }
                }

                if (empty($row['subscriber_email']) && !empty($foundEmail)) {
                    $row['subscriber_email'] = $foundEmail;
                }
                if (empty($row['subscriber_phone']) && !empty($foundPhone)) {
                    $row['subscriber_phone'] = $foundPhone;
                }
                if (empty($row['subscriber_name']) && !empty($foundName)) {
                    $row['subscriber_name'] = $foundName;
                }

                $row['answers'] = $resolvedAnswers;
                unset($row['answers_json']);
            }
            echo json_encode(['success' => true, 'data' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit], JSON_UNESCAPED_UNICODE);
            break;
        }

        // ─── ANALYTICS ───────────────────────────────────────────────────────
        case 'analytics': {
            $stmtOwn = $pdo->prepare("SELECT id FROM surveys WHERE id = ? AND workspace_id = ?");
            $stmtOwn->execute([$id, $workspace_id]);
            if (!$stmtOwn->fetchColumn()) {
                echo json_encode(['success' => false, 'error' => 'Not found or forbidden']);
                break;
            }

            $surveyId = $id;

            // Auto-heal direct_link to email_embed if UTM indicates email
            try {
                $pdo->prepare("
                    UPDATE survey_responses 
                    SET source_channel = 'email_embed' 
                    WHERE survey_id = ? AND source_channel = 'direct_link' 
                    AND (utm_source = 'mailflow' OR utm_medium = 'email' OR utm_campaign IS NOT NULL)
                ")->execute([$surveyId]);
            } catch (Exception $e) { /* ignore */ }

            // Overview stats
            $overview = $pdo->prepare("
                SELECT
                    COUNT(*) AS total_responses,
                    ROUND(AVG(completion_rate), 1) AS avg_completion_rate,
                    ROUND(AVG(time_spent_sec), 0) AS avg_time_spent_sec,
                    SUM(source_channel = 'qr_code') AS qr_count,
                    SUM(source_channel = 'direct_link') AS direct_count,
                    SUM(source_channel = 'email_embed' OR source_channel = 'email') AS email_count,
                    SUM(source_channel = 'widget') AS widget_count,
                    SUM(source_channel = 'api') AS api_count,
                    SUM(device_type = 'mobile') AS mobile_count,
                    SUM(device_type = 'desktop') AS desktop_count,
                    SUM(device_type = 'tablet') AS tablet_count
                FROM survey_responses
                WHERE survey_id = ?
            ");
            $overview->execute([$surveyId]);
            $overviewData = $overview->fetch(PDO::FETCH_ASSOC);

            // Add country distribution
            $countriesStmt = $pdo->prepare("SELECT geo_country as country, COUNT(*) as count FROM survey_responses WHERE survey_id = ? AND geo_country IS NOT NULL GROUP BY geo_country ORDER BY count DESC LIMIT 10");
            $countriesStmt->execute([$surveyId]);
            $overviewData['countries'] = $countriesStmt->fetchAll(PDO::FETCH_ASSOC);

            // Responses by date (last 30 days)
            $byDate = $pdo->prepare("
                SELECT DATE(submitted_at) AS date, COUNT(*) AS count
                FROM survey_responses
                WHERE survey_id = ? AND submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(submitted_at)
                ORDER BY date ASC
            ");
            $byDate->execute([$surveyId]);
            $byDateData = $byDate->fetchAll(PDO::FETCH_ASSOC);

            // Load original blocks from surveys table for self-healing & label resolution
            $surveyStmt = $pdo->prepare("SELECT blocks_json FROM surveys WHERE id = ?");
            $surveyStmt->execute([$surveyId]);
            $rawBlocks = json_decode($surveyStmt->fetchColumn() ?: '[]', true) ?: [];
            $blocks = normalizeSurveyBlocks(is_array($rawBlocks) ? $rawBlocks : []);
            $blocksMap = [];
            foreach ($blocks as $b) {
                if (!empty($b['id'])) $blocksMap[$b['id']] = $b;
            }

            // Per-question aggregation: Optimized with SQL grouping
            $questions = $pdo->prepare("SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY order_index");
            $questions->execute([$surveyId]);
            $questionsData = $questions->fetchAll(PDO::FETCH_ASSOC);

            // If survey_questions table is empty or missing, sync from blocksMap
            if (empty($questionsData) && !empty($blocksMap)) {
                $qStmt = $pdo->prepare("INSERT INTO survey_questions (id, survey_id, block_id, type, label, options_json, required, order_index, target_attribute) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $order = 0;
                foreach ($blocks as $b) {
                    $isLayout = in_array($b['type'] ?? '', ['section_header', 'image_block', 'divider', 'page_break', 'button_block', 'link_block', 'banner_block']);
                    if (!$isLayout) {
                        $opts = isset($b['options']) ? json_encode($b['options'], JSON_UNESCAPED_UNICODE) : null;
                        $req = isset($b['required']) && $b['required'] ? 1 : 0;
                        $label = !empty($b['label']) ? $b['label'] : (!empty($b['content']) ? $b['content'] : (!empty($b['title']) ? $b['title'] : 'Câu hỏi ' . ($order + 1)));
                        $blockId = $b['id'] ?? generateUUID();
                        $targetAttr = $b['targetAttribute'] ?? ($b['target_attribute'] ?? null);
                        $qStmt->execute([generateUUID(), $surveyId, $blockId, $b['type'] ?? 'unknown', $label, $opts, $req, $order, $targetAttr]);
                        $order++;
                    }
                }
                $questions->execute([$surveyId]);
                $questionsData = $questions->fetchAll(PDO::FETCH_ASSOC);
            }

            $questionAnalytics = [];
            foreach ($questionsData as $idx => $q) {
                $blockId = $q['block_id'];
                $block = $blocksMap[$blockId] ?? null;

                // Self-heal question label if stored as 'Untitled Question'
                $resolvedLabel = $q['label'];
                if (empty($resolvedLabel) || $resolvedLabel === 'Untitled Question') {
                    $resolvedLabel = !empty($block['label']) ? $block['label'] : (!empty($block['content']) ? $block['content'] : (!empty($block['title']) ? $block['title'] : 'Câu hỏi #' . ($idx + 1)));
                    try {
                        $pdo->prepare("UPDATE survey_questions SET label = ? WHERE id = ?")->execute([$resolvedLabel, $q['id']]);
                    } catch (Exception $e) { /* non-blocking */ }
                }

                $qa = [
                    'question_id' => $blockId, 
                    'block_id'    => $blockId, 
                    'type'        => $q['type'], 
                    'label'       => $resolvedLabel, 
                    'content'     => $q['content'] ?? ($block['description'] ?? null), 
                    'options'     => $block['options'] ?? json_decode($q['options_json'] ?? '[]', true)
                ];

                // 1. Total answered for this specific question
                $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM survey_answer_details WHERE question_id = ?");
                $stmtTotal->execute([$blockId]);
                $totalAnswered = (int)$stmtTotal->fetchColumn();
                $qa['total_answered'] = $totalAnswered;

                if ($totalAnswered === 0) {
                    $questionAnalytics[] = $qa;
                    continue;
                }

                // 2. Aggregate based on type
                if (in_array($q['type'], ['star_rating', 'nps', 'slider', 'likert'])) {
                    $stmtDist = $pdo->prepare("
                        SELECT answer_num as val, COUNT(*) as cnt 
                        FROM survey_answer_details 
                        WHERE question_id = ? AND answer_num IS NOT NULL 
                        GROUP BY answer_num 
                        ORDER BY val ASC
                    ");
                    $stmtDist->execute([$blockId]);
                    $distRows = $stmtDist->fetchAll(PDO::FETCH_ASSOC);
                    
                    $distArr = array_map(fn($r) => ['value' => (float)$r['val'], 'count' => (int)$r['cnt']], $distRows);
                    $qa['rating_distribution'] = $distArr;
                    
                    $sum = array_reduce($distRows, fn($acc, $r) => $acc + ($r['val'] * $r['cnt']), 0);
                    $qa['avg_rating'] = round($sum / $totalAnswered, 2);

                    if ($q['type'] === 'nps') {
                        $promoters = 0; $detractors = 0;
                        foreach ($distRows as $r) {
                            if ($r['val'] >= 9) $promoters += $r['cnt'];
                            elseif ($r['val'] <= 6) $detractors += $r['cnt'];
                        }
                        $qa['promoters'] = $promoters;
                        $qa['detractors'] = $detractors;
                        $qa['passives'] = $totalAnswered - $promoters - $detractors;
                        $qa['nps_score'] = round(($promoters / $totalAnswered - $detractors / $totalAnswered) * 100);
                    }
                } elseif (in_array($q['type'], ['single_choice', 'dropdown', 'yes_no'])) {
                    $stmtChoice = $pdo->prepare("
                        SELECT answer_text as label, COUNT(*) as cnt 
                        FROM survey_answer_details 
                        WHERE question_id = ? AND answer_text IS NOT NULL AND answer_text != ''
                        GROUP BY answer_text 
                        ORDER BY cnt DESC
                    ");
                    $stmtChoice->execute([$blockId]);
                    $choiceRows = $stmtChoice->fetchAll(PDO::FETCH_ASSOC);
                    
                    $qa['choice_distribution'] = array_map(fn($c) => [
                        'label'      => resolveChoiceLabel($c['label'], $block, $q['type']), 
                        'count'      => (int)$c['cnt'], 
                        'percentage' => round($c['cnt'] / $totalAnswered * 100, 1)
                    ], $choiceRows);
                } elseif ($q['type'] === 'multi_choice') {
                    try {
                        $stmtMulti = $pdo->prepare("
                            SELECT j.choice as label, COUNT(*) as cnt
                            FROM survey_answer_details d,
                            JSON_TABLE(d.answer_json, '$[*]' COLUMNS (choice VARCHAR(255) PATH '$')) j
                            WHERE d.question_id = ? AND d.answer_json IS NOT NULL
                            GROUP BY j.choice
                            ORDER BY cnt DESC
                        ");
                        $stmtMulti->execute([$blockId]);
                        $choicesData = $stmtMulti->fetchAll(PDO::FETCH_ASSOC);
                        $choices = [];
                        foreach ($choicesData as $row) {
                            $choices[] = [
                                'label'      => resolveChoiceLabel((string)$row['label'], $block, 'multi_choice'),
                                'count'      => (int)$row['cnt'],
                                'percentage' => round($row['cnt'] / $totalAnswered * 100, 1)
                            ];
                        }
                        $qa['choice_distribution'] = $choices;
                    } catch (Exception $e) {
                        $stmtMulti = $pdo->prepare("SELECT answer_json FROM survey_answer_details WHERE question_id = ? AND answer_json IS NOT NULL");
                        $stmtMulti->execute([$blockId]);
                        $counts = [];
                        while ($rowJson = $stmtMulti->fetchColumn()) {
                            $arr = json_decode($rowJson, true);
                            if (is_array($arr)) {
                                foreach ($arr as $val) $counts[$val] = ($counts[$val] ?? 0) + 1;
                            }
                        }
                        $choices = [];
                        foreach ($counts as $lbl => $cnt) {
                            $choices[] = [
                                'label'      => resolveChoiceLabel((string)$lbl, $block, 'multi_choice'), 
                                'count'      => (int)$cnt, 
                                'percentage' => round($cnt / $totalAnswered * 100, 1)
                            ];
                        }
                        usort($choices, fn($a, $b) => $b['count'] <=> $a['count']);
                        $qa['choice_distribution'] = $choices;
                    }
                } else {
                    $stmtText = $pdo->prepare("
                        SELECT " . ($q['type'] === 'matrix_single' || $q['type'] === 'matrix_multi' || $q['type'] === 'ranking' ? 'answer_json' : 'answer_text') . " as val 
                        FROM survey_answer_details 
                        WHERE question_id = ? AND (answer_text IS NOT NULL OR answer_json IS NOT NULL)
                        LIMIT 50
                    ");
                    $stmtText->execute([$blockId]);
                    $qa['text_responses'] = array_map(
                        fn($v) => html_entity_decode((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'),
                        array_filter($stmtText->fetchAll(PDO::FETCH_COLUMN), fn($v) => $v !== null && $v !== '')
                    );
                }
                
                $questionAnalytics[] = $qa;
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'overview'  => $overviewData,
                    'by_date'   => $byDateData,
                    'questions' => $questionAnalytics,
                ]
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        // ─── EXPORT CSV ───────────────────────────────────────────────────────
        case 'export': {
            $stmtOwn = $pdo->prepare("SELECT id FROM surveys WHERE id = ? AND workspace_id = ?");
            $stmtOwn->execute([$id, $workspace_id]);
            if (!$stmtOwn->fetchColumn()) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => 'Not found or forbidden']);
                exit;
            }

            $format = $_GET['format'] ?? 'csv';
            
            // 1. Fetch survey questions & block options for human-friendly labels
            $surveyStmt = $pdo->prepare("SELECT blocks_json FROM surveys WHERE id = ?");
            $surveyStmt->execute([$id]);
            $rawBlocks = json_decode($surveyStmt->fetchColumn() ?: '[]', true) ?: [];
            $blocks = normalizeSurveyBlocks(is_array($rawBlocks) ? $rawBlocks : []);
            $blocksMap = [];
            foreach ($blocks as $b) {
                if (!empty($b['id'])) $blocksMap[$b['id']] = $b;
            }

            $qStmt = $pdo->prepare("SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY order_index ASC");
            $qStmt->execute([$id]);
            $surveyQuestions = $qStmt->fetchAll(PDO::FETCH_ASSOC);

            // 2. Fetch responses
            $stmt = $pdo->prepare("
                SELECT r.submitted_at, r.source_channel, r.device_type, r.time_spent_sec,
                       r.completion_rate, r.geo_country, r.geo_city,
                       s.email AS subscriber_email, 
                       TRIM(CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))) AS subscriber_name,
                       r.answers_json
                FROM survey_responses r
                LEFT JOIN subscribers s ON s.id = r.subscriber_id
                WHERE r.survey_id = ?
                ORDER BY r.submitted_at DESC
            ");
            $stmt->execute([$id]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="survey-responses-' . date('Ymd') . '.csv"');
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM
            
            $headers = ['Thời gian', 'Email', 'Tên', 'Kênh', 'Thiết bị', 'Thời gian điền (s)', 'Hoàn thành %', 'Quốc gia', 'Thành phố'];
            foreach ($surveyQuestions as $q) {
                $block = $blocksMap[$q['block_id']] ?? null;
                $qTitle = (!empty($q['label']) && $q['label'] !== 'Untitled Question') 
                    ? $q['label'] 
                    : ($block['label'] ?? ($block['content'] ?? ($block['title'] ?? $q['block_id'])));
                $headers[] = $qTitle;
            }
            fputcsv($out, $headers);

            foreach ($rows as $row) {
                $answers = json_decode($row['answers_json'], true) ?? [];
                
                // Map respondent answers by block_id
                $ansMap = [];
                foreach ($answers as $ans) {
                    $bId = $ans['block_id'] ?? ($ans['question_id'] ?? '');
                    if ($bId !== '') {
                        $ansMap[$bId] = $ans['answer_text'] ?? $ans['answer_num'] ?? (is_array($ans['answer_json'] ?? null) ? implode(', ', $ans['answer_json']) : '');
                    }
                }

                $csvRow = [
                    $row['submitted_at'],
                    $row['subscriber_email'] ?? '',
                    $row['subscriber_name'] ?? '',
                    $row['source_channel'],
                    $row['device_type'],
                    $row['time_spent_sec'],
                    $row['completion_rate'],
                    $row['geo_country'] ?? '',
                    $row['geo_city'] ?? ''
                ];

                // Append answer for each question in exact order
                foreach ($surveyQuestions as $q) {
                    $block = $blocksMap[$q['block_id']] ?? null;
                    $rawVal = $ansMap[$q['block_id']] ?? '';
                    $csvRow[] = resolveChoiceLabel($rawVal, $block, $q['type'] ?? '');
                }

                fputcsv($out, $csvRow);
            }
            fclose($out);
            exit;
        }

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Unknown action']);
    }
} catch (Exception $e) {
    error_log('Survey API Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error', 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}

function normalizeSurveyBlocks(array $blocks): array {
    $normalized = [];
    foreach ($blocks as $idx => $b) {
        if (!is_array($b)) continue;
        if (empty($b['id'])) {
            $b['id'] = generateUUID();
        }
        // Normalize label from title / question / content
        $label = $b['label'] ?? ($b['title'] ?? ($b['question'] ?? ($b['content'] ?? '')));
        if ($label === '' || $label === 'Untitled Question') {
            $label = !empty($b['question']) ? $b['question'] : (!empty($b['title']) ? $b['title'] : 'Câu hỏi ' . ($idx + 1));
        }
        $b['label'] = $label;
        if (empty($b['title'])) {
            $b['title'] = $label;
        }

        // Normalize legacy preset types ('rating', 'multiple_choice')
        $type = $b['type'] ?? 'short_text';
        if ($type === 'rating') {
            $style = $b['options']['style'] ?? ($b['style']['style'] ?? '');
            $scale = (int)($b['options']['scale'] ?? ($b['scale'] ?? 5));
            if ($style === 'nps' || $scale === 10) {
                $type = 'nps';
                $b['minValue'] = $b['minValue'] ?? 0;
                $b['maxValue'] = $b['maxValue'] ?? 10;
                $b['minLabel'] = $b['minLabel'] ?? 'Rất không hài lòng';
                $b['maxLabel'] = $b['maxLabel'] ?? 'Rất hài lòng';
            } else {
                $type = 'star_rating';
                $b['minValue'] = $b['minValue'] ?? 1;
                $b['maxValue'] = $b['maxValue'] ?? ($scale > 0 ? $scale : 5);
                $b['ratingIcon'] = $b['ratingIcon'] ?? 'star';
            }
            unset($b['options']);
        } elseif ($type === 'multiple_choice') {
            $type = 'single_choice';
        }
        $b['type'] = $type;

        // Normalize options if stored as ['choices' => [...]] or array of strings
        if (isset($b['options']) && is_array($b['options'])) {
            $rawOpts = isset($b['options']['choices']) && is_array($b['options']['choices'])
                ? $b['options']['choices']
                : $b['options'];
            $cleanOpts = [];
            foreach ($rawOpts as $optIdx => $opt) {
                if (is_array($opt)) {
                    $optLabel = (string)($opt['label'] ?? ($opt['value'] ?? ('Lựa chọn ' . ($optIdx + 1))));
                    $optValue = (string)($opt['value'] ?? $optLabel);
                    $cleanOpts[] = [
                        'id'    => !empty($opt['id']) ? (string)$opt['id'] : ('opt-' . ($idx + 1) . '-' . ($optIdx + 1)),
                        'label' => $optLabel,
                        'value' => $optValue,
                    ];
                } elseif (is_scalar($opt)) {
                    $strVal = (string)$opt;
                    $cleanOpts[] = [
                        'id'    => 'opt-' . ($idx + 1) . '-' . ($optIdx + 1),
                        'label' => $strVal,
                        'value' => $strVal,
                    ];
                }
            }
            $b['options'] = $cleanOpts;
        }

        $normalized[] = $b;
    }
    return $normalized;
}

function resolveChoiceLabel(?string $rawValue, ?array $block, string $type = ''): string {
    if ($rawValue === null || $rawValue === '') {
        return '';
    }

    // Decode HTML entities (e.g. &amp; -> &)
    $clean = html_entity_decode($rawValue, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    // Decode Unicode escape sequences if raw JSON-escaped string (e.g. \u00ed, \u1ee9...)
    if (strpos($clean, '\u') !== false) {
        $decoded = json_decode('"' . addcslashes($clean, '"') . '"');
        if (json_last_error() === JSON_ERROR_NONE && is_string($decoded)) {
            $clean = $decoded;
        }
    }

    // 1. Yes / No handling
    $lower = strtolower(trim($clean));
    if ($type === 'yes_no' || $lower === 'yes' || $lower === 'no') {
        if ($lower === 'yes' || $lower === 'true' || $lower === '1') {
            return 'Có';
        }
        if ($lower === 'no' || $lower === 'false' || $lower === '0') {
            return 'Không';
        }
    }

    // Handle comma-separated values (for multi_choice string export)
    if ($type === 'multi_choice' && strpos($clean, ',') !== false) {
        $parts = explode(',', $clean);
        $resolvedParts = [];
        foreach ($parts as $p) {
            $resolvedParts[] = resolveChoiceLabel(trim($p), $block, '');
        }
        return implode(', ', $resolvedParts);
    }

    // 2. If block is provided and has options, find matching option
    if (!empty($block['options']) && is_array($block['options'])) {
        foreach ($block['options'] as $opt) {
            $optVal = is_array($opt) ? ($opt['value'] ?? '') : (string)$opt;
            $optLbl = is_array($opt) ? ($opt['label'] ?? $optVal) : (string)$opt;

            // Direct match by value or label
            if ((string)$optVal === $clean || (string)$optLbl === $clean) {
                return (string)$optLbl;
            }

            // Case-insensitive comparison
            if (strtolower(trim((string)$optVal)) === $lower || strtolower(trim((string)$optLbl)) === $lower) {
                return (string)$optLbl;
            }

            // Normalize underscores vs spaces for comparison
            $cleanNormalized = str_replace('_', ' ', $lower);
            $optNormalized = str_replace('_', ' ', strtolower(trim((string)$optVal)));
            if ($cleanNormalized === $optNormalized) {
                return (string)$optLbl;
            }
        }
    }

    // 3. Fallback: if value looks like a slug with underscores (e.g. bứt_phá_quy_mô...), turn underscores into spaces
    if (strpos($clean, '_') !== false && !strpos($clean, ' ')) {
        $clean = str_replace('_', ' ', $clean);
        $clean = mb_strtoupper(mb_substr($clean, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($clean, 1, null, 'UTF-8');
    }

    return $clean;
}

function generateUUID(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
}

function clean_slug(string $name): string {
    $unicode = [
        'a' => 'á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ',
        'd' => 'đ',
        'e' => 'é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ',
        'i' => 'í|ì|ỉ|ĩ|ị',
        'o' => 'ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ',
        'u' => 'ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự',
        'y' => 'ý|ỳ|ỷ|ỹ|ỵ',
        'A' => 'Á|À|Ả|Ã|Ạ|Ă|Ắ|Ằ|Ẳ|Ẵ|Ặ|Â|Ấ|Ầ|Ẩ|Ẫ|Ậ',
        'D' => 'Đ',
        'E' => 'É|È|Ẻ|Ẽ|Ẹ|Ê|Ế|Ề|Ể|Ễ|Ệ',
        'I' => 'Í|Ì|Ỉ|Ĩ|Ị',
        'O' => 'Ó|Ò|Ỏ|Õ|Ọ|Ô|Ố|Ồ|Ổ|Ỗ|Ộ|Ơ|Ớ|Ờ|Ở|Ỡ|Ợ',
        'U' => 'Ú|Ù|Ủ|Ũ|Ụ|Ư|Ứ|Ừ|Ử|Ữ|Ự',
        'Y' => 'Ý|Ỳ|Ỷ|Ỹ|Ỵ'
    ];
    foreach ($unicode as $nonUnicode => $uni) {
        $name = preg_replace("/($uni)/i", $nonUnicode, $name);
    }
    $baseSlug = preg_replace('/[^a-z0-9]+/', '-', strtolower($name));
    $baseSlug = preg_replace('/-+/', '-', $baseSlug);
    $baseSlug = trim($baseSlug, '-');
    return empty($baseSlug) ? 'survey' : $baseSlug;
}
