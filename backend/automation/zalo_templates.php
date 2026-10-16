<?php
/**
 * Zalo ZNS Template Management API
 * Handles CRUD operations for ZNS message templates
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php'; // [FIX] Templates require authentication

apiHeaders();
$workspace_id = get_current_workspace_id(); // For context-aware queries
$method = $_SERVER['REQUEST_METHOD'];

$route = $_GET['route'] ?? '';
$id = $_GET['id'] ?? '';              // Internal UUID
$template_id = $_GET['template_id'] ?? ''; // Zalo's numeric template_id
$oa_id = $_GET['oa_id'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if ($route === 'preview' && $id) {
                // Preview template with sample data
                previewTemplate($pdo, $id);
            } elseif ($template_id) {
                // Get by Zalo template_id (numeric) — dùng cho validate flow
                getByZaloTemplateId($pdo, $template_id);
            } elseif ($id) {
                // Get single template by internal UUID
                getSingleTemplate($pdo, $id);
            } elseif ($route === 'sync' && $oa_id) {
                // Sync templates from Zalo
                syncTemplatesFromZalo($pdo, $oa_id);
            } elseif ($route === 'detail' && $id) {
                // Get detail from Zalo API
                getTemplateDetail($pdo, $id);
            } else {
                // Get all templates (optionally filtered by OA)
                getAllTemplates($pdo, $oa_id);
            }
            break;

        case 'POST':
            if ($route === 'send_test') {
                sendTestZNS($pdo);
            } elseif ($route === 'sync' && $oa_id) {
                // Allow Sync via POST as well
                syncTemplatesFromZalo($pdo, $oa_id);
            } elseif ($route === 'detail' && $id) {
                // Get detail (POST/GET allowed)
                getTemplateDetail($pdo, $id);
            } elseif ($route === 'upload_image') {
                uploadTemplateImage($pdo);
            } elseif ($route === 'edit') {
                editTemplate($pdo);
            } else {
                // Create new template
                createTemplate($pdo);
            }
            break;

        case 'PUT':
            if ($id) {
                updateTemplate($pdo, $id);
            } else {
                jsonResponse(false, null, 'Template ID required');
            }
            break;

        case 'DELETE':
            if ($id) {
                deleteTemplate($pdo, $id);
            } else {
                jsonResponse(false, null, 'Template ID required');
            }
            break;

        default:
            jsonResponse(false, null, 'Method not allowed');
    }
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi hệ thống, vui lòng thử lại.');
}

function editTemplate($pdo)
{
    require_once 'zalo_sender.php';

    $data = json_decode(file_get_contents('php://input'), true);

    // Check required fields
    if (empty($data['template_id']) || empty($data['oa_config_id'])) {
        jsonResponse(false, null, 'Missing required fields: template_id, oa_config_id');
        return;
    }

    $templateId = $data['template_id'];
    $oaConfigId = $data['oa_config_id'];

    // 1. Get Access Token
    $tokenResult = getAccessToken($pdo, $oaConfigId);
    if (!$tokenResult['success']) {
        jsonResponse(false, null, 'Cannot get Access Token: ' . $tokenResult['message']);
        return;
    }
    $accessToken = $tokenResult['access_token'];

    // 2. Prepare Payload (Similar to create but includes template_id)
    $payload = [
        'template_id' => $templateId,
        'template_name' => $data['template_name'],
        'template_type' => (int) $data['template_type'],
        'tag' => (string) $data['tag'],
        'layout' => $data['layout'],
        'params' => $data['params'] ?? [],
        'note' => $data['note'] ?? 'Edited via API',
        'tracking_id' => $data['tracking_id'] ?? ('edit_' . time())
    ];

    // Cast types strictly as per Doc if needed, though PHP json_encode usually handles types well if variables are typed.
    // Docs say template_type is int but examples show string "1". Let's stick to user prompt example which uses string "1".
    // Actually the example curl uses string "1" for template_type and "1" for tag.

    // 3. Call Zalo Edit API
    $url = 'https://business.openapi.zalo.me/template/edit';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'access_token: ' . $accessToken
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    // 4. Handle Response
    if ($httpCode !== 200 || ($result['error'] ?? -1) !== 0) {
        jsonResponse(false, $result, 'Zalo API Edit Error: ' . ($result['message'] ?? 'Unknown error'));
        return;
    }

    // 5. Update Local DB
    // Status becomes PENDING_REVIEW after edit
    $stmt = $pdo->prepare("
        UPDATE zalo_templates 
        SET template_name = ?, template_type = ?, status = 'PENDING_REVIEW', template_data = ?, preview_data = ?, updated_at = NOW()
        WHERE template_id = ? AND oa_config_id = ?
    ");

    // We update the local data structure to match the new definition
    $layoutData = ['raw' => $result['data'] ?? [], 'layout' => $data['layout']];

    $stmt->execute([
        $data['template_name'],
        $data['template_type'],
        json_encode($layoutData),
        json_encode($data['params'] ?? []),
        $templateId,
        $oaConfigId
    ]);

    jsonResponse(true, $result['data'], 'Template edited successfully');
}

// ============ HELPER FUNCTIONS ============

function syncTemplatesFromZalo($pdo, $oa_id)
{
    require_once 'zalo_sender.php';

    // Get Access Token
    $tokenResult = getAccessToken($pdo, $oa_id);
    if (!$tokenResult['success']) {
        jsonResponse(false, null, 'Cannot get Access Token: ' . $tokenResult['message']);
        return;
    }
    $accessToken = $tokenResult['access_token'];

    // Fetch from Zalo API
    $offset = 0;
    $limit = 100;
    $totalSynced = 0;

    do {
        $url = "https://business.openapi.zalo.me/template/all?offset=$offset&limit=$limit";
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        // GET request headers (No Content-Type)
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'access_token: ' . $accessToken
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $result = json_decode($response, true);

        if ($httpCode !== 200 || ($result['error'] ?? -1) !== 0) {
            if ($offset === 0) {
                jsonResponse(false, $result, 'Zalo API Error: ' . ($result['message'] ?? 'Unknown error'));
                return;
            }
            break; // Stop if error on pagination
        }

        $data = $result['data'] ?? [];
        if (empty($data))
            break;

        // Upsert into DB
        $stmtCheck = $pdo->prepare("SELECT * FROM zalo_templates WHERE oa_config_id = ? AND template_id = ?");
        $stmtInsert = $pdo->prepare("
            INSERT INTO zalo_templates (id, oa_config_id, template_id, template_name, template_type, status, template_data, preview_data, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmtUpdate = $pdo->prepare("
            UPDATE zalo_templates 
            SET template_name = ?, status = ?, template_data = ?, preview_data = ?, updated_at = NOW() 
            WHERE id = ?
        ");

        foreach ($data as $tpl) {
            $tId = $tpl['templateId'];
            $tName = $tpl['templateName'];
            $tStatus = strtolower($tpl['status'] ?? 'pending');

            // Map status
            if ($tStatus === 'enable' || $tStatus === 'approved')
                $tStatus = 'approved';
            elseif ($tStatus === 'reject')
                $tStatus = 'rejected';
            else
                $tStatus = 'pending';

            // 1. FETCH SAMPLE DATA (Best source for examples)
            $sampleUrl = "https://business.openapi.zalo.me/template/sample-data?template_id=$tId";
            $chSample = curl_init($sampleUrl);
            curl_setopt($chSample, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chSample, CURLOPT_SSL_VERIFYPEER, true); // [SECURITY] Enforce TLS for Zalo API
            curl_setopt($chSample, CURLOPT_SSL_VERIFYHOST, 2);
            curl_setopt($chSample, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken]);
            $sampleRes = curl_exec($chSample);
            curl_close($chSample);
            $sampleData = json_decode($sampleRes, true);

            $previewData = []; // Store param structure/sample here

            if (isset($sampleData['data']) && is_array($sampleData['data'])) {
                // Transform Sample Data Key-Value into a structure our UI can understand
                foreach ($sampleData['data'] as $key => $val) {
                    $previewData[] = [
                        'name' => $key,
                        'type' => 'STRING', // Sample data doesn't give type, assume string
                        'require' => true,
                        'sample_value' => $val // Store sample value for UI placeholder
                    ];
                }
            }

            // 2. FALLBACK: If Sample Data failed or empty, try Template Info
            // 2. FETCH TEMPLATE INFO (Required for Price/UID capability check)
            // We always fetch this now to get 'price_uid'
            $detailUrl = "https://business.openapi.zalo.me/template/info?template_id=$tId";
            $chDet = curl_init($detailUrl);
            curl_setopt($chDet, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chDet, CURLOPT_SSL_VERIFYPEER, true); // [SECURITY] Enforce TLS for Zalo API
            curl_setopt($chDet, CURLOPT_SSL_VERIFYHOST, 2);
            curl_setopt($chDet, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken]);
            $detRes = curl_exec($chDet);
            curl_close($chDet);
            $detData = json_decode($detRes, true);

            // Fallback for Preview Data if Sample failed
            if (empty($previewData) && isset($detData['data']['listParams'])) {
                $previewData = $detData['data']['listParams'];
            }

            $stmtCheck->execute([$oa_id, $tId]);
            $existingRow = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            // Prepare template_data (Merge new raw with existing detail/layout)
            $existingData = [];
            if ($existingRow && !empty($existingRow['template_data'])) {
                $existingData = json_decode($existingRow['template_data'], true) ?: [];
            }
            $existingData['raw'] = $tpl;

            // [UPDATE] Check 'price_uid' from API to determine UID Support
            // If price_uid > 0, then UID sends are supported (and cost money/quota).
            $priceUid = $detData['data']['price_uid'] ?? 0;
            $price = $detData['data']['price'] ?? 0; // Standard Phone Price

            $existingData['support_uid'] = (floatval($priceUid) > 0);
            $existingData['price_uid'] = $priceUid;
            $existingData['price'] = $price;

            if ($existingRow) {
                // Update existing: Preserve existing templateData (layout, detail) and type
                $stmtUpdate = $pdo->prepare("
                    UPDATE zalo_templates 
                    SET template_name = ?, status = ?, template_data = ?, preview_data = ?, updated_at = NOW() 
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$tName, $tStatus, json_encode($existingData), json_encode($previewData), $existingRow['id']]);
            } else {
                // Insert new: Try to determine type if possible, otherwise default to transaction
                $newId = bin2hex(random_bytes(16));
                $tType = 'transaction'; // Default

                // If we called info API earlier, we might have type info there
                if (isset($detData['data']['templateType'])) {
                    $tType = strtolower($detData['data']['templateType']);
                }

                $stmtInsert->execute([$newId, $oa_id, $tId, $tName, $tType, $tStatus, json_encode($existingData), json_encode($previewData)]);
            }
            $totalSynced++;
        }

        $offset += $limit;
    } while (count($data) >= $limit);

    jsonResponse(true, ['total_synced' => $totalSynced], "Successfully synced $totalSynced templates from Zalo");
}

function sendTestZNS($pdo)
{
    require_once 'zalo_sender.php';

    $input = json_decode(file_get_contents('php://input'), true);
    $oa_id = $input['oa_config_id'] ?? '';
    $phone = $input['phone'] ?? '';
    $template_id = $input['template_id'] ?? '';
    $template_data = $input['template_data'] ?? []; // Key-Value pair

    if (!$oa_id || !$phone || !$template_id) {
        jsonResponse(false, null, 'Missing required fields: oa_config_id, phone, template_id');
        return;
    }

    $result = sendZNSMessage($pdo, $oa_id, $template_id, $phone, $template_data);

    if ($result['success']) {
        jsonResponse(true, $result, 'Test ZNS Sent Successfully');
    } else {
        jsonResponse(false, $result, 'Test ZNS Failed: ' . ($result['message'] ?? 'Unknown Error'));
    }
}

function getAllTemplates($pdo, $oa_id = '')
{
    if ($oa_id) {
        $stmt = $pdo->prepare("
            SELECT 
                t.id, t.oa_config_id, t.template_id, t.template_name,
                t.template_type, t.template_data, t.preview_data, t.status,
                t.created_at, t.updated_at,
                o.name as oa_name
            FROM zalo_templates t
            LEFT JOIN zalo_oa_configs o ON t.oa_config_id = o.id
            WHERE t.oa_config_id = ?
            ORDER BY t.created_at DESC
        ");
        $stmt->execute([$oa_id]);
    } else {
        $stmt = $pdo->query("
            SELECT 
                t.id, t.oa_config_id, t.template_id, t.template_name,
                t.template_type, t.template_data, t.preview_data, t.status,
                t.created_at, t.updated_at,
                o.name as oa_name
            FROM zalo_templates t
            LEFT JOIN zalo_oa_configs o ON t.oa_config_id = o.id
            ORDER BY t.created_at DESC
        ");
    }

    $templates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Decode JSON fields
    foreach ($templates as &$template) {
        $template['template_data'] = json_decode($template['template_data'] ?? '{}', true);
        $template['preview_data'] = json_decode($template['preview_data'] ?? '{}', true);
    }

    jsonResponse(true, $templates);
}

function getSingleTemplate($pdo, $id)
{
    $stmt = $pdo->prepare("
        SELECT 
            t.*, o.name as oa_name
        FROM zalo_templates t
        LEFT JOIN zalo_oa_configs o ON t.oa_config_id = o.id
        WHERE t.id = ?
    ");
    $stmt->execute([$id]);
    $template = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$template) {
        jsonResponse(false, null, 'Template not found');
        return;
    }

    $template['template_data'] = json_decode($template['template_data'] ?? '{}', true);
    $template['preview_data'] = json_decode($template['preview_data'] ?? '{}', true);

    jsonResponse(true, $template);
}

/**
 * Get template by Zalo's numeric template_id (not internal UUID)
 * Dùng để kiểm tra template có tồn tại trong DB local và trạng thái có active không
 */
function getByZaloTemplateId($pdo, $template_id)
{
    $stmt = $pdo->prepare("
        SELECT t.*, o.name as oa_name
        FROM zalo_templates t
        LEFT JOIN zalo_oa_configs o ON t.oa_config_id = o.id
        WHERE t.template_id = ?
        LIMIT 1
    ");
    $stmt->execute([$template_id]);
    $template = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$template) {
        jsonResponse(false, null, 'Template not found');
        return;
    }

    $template['template_data'] = json_decode($template['template_data'] ?? '{}', true);
    $template['preview_data'] = json_decode($template['preview_data'] ?? '{}', true);

    jsonResponse(true, $template);
}

function createTemplate($pdo)
{
    require_once 'zalo_sender.php';

    $data = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    $required = ['oa_config_id', 'template_name', 'template_type', 'tag', 'layout'];
    foreach ($required as $field) {
        if (empty($data[$field])) {
            jsonResponse(false, null, "Missing required field: $field");
            return;
        }
    }

    $oaConfigId = $data['oa_config_id'];

    // 1. Get Access Token
    $tokenResult = getAccessToken($pdo, $oaConfigId);
    if (!$tokenResult['success']) {
        jsonResponse(false, null, 'Cannot get Access Token: ' . $tokenResult['message']);
        return;
    }
    $accessToken = $tokenResult['access_token'];

    // 2. Prepare Payload
    $payload = [
        'template_name' => $data['template_name'],
        'template_type' => (string) $data['template_type'], // API requires string sometimes or int? Doc says int but some examples string. Let's send as is or safe cast. Doc says integer.
        'tag' => (string) $data['tag'],
        'layout' => $data['layout'], // JSON Object/Array
        'params' => $data['params'] ?? [],
        'note' => $data['note'] ?? '',
        'tracking_id' => $data['tracking_id'] ?? ('create_' . time())
    ];

    // Ensure template_type is int as per doc
    $payload['template_type'] = (int) $payload['template_type'];
    // Ensure tag is string as per doc (tag: string)
    // Actually doc: "tag string yes". value "1", "2"... 
    $payload['tag'] = (string) $payload['tag'];

    // 3. Call Zalo API
    $url = 'https://business.openapi.zalo.me/template/create';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'access_token: ' . $accessToken
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    // 4. Handle Response
    if ($httpCode !== 200 || ($result['error'] ?? -1) !== 0) {
        jsonResponse(false, $result, 'Zalo API Error: ' . ($result['message'] ?? 'Unknown error'));
        return;
    }

    $resData = $result['data'] ?? [];
    $tplId = $resData['template_id'] ?? null;

    if (!$tplId) {
        jsonResponse(false, $result, 'Zalo API returned success but no template_id');
        return;
    }

    // 5. Save to DB
    // Check if OA exists
    $stmt = $pdo->prepare("SELECT id FROM zalo_oa_configs WHERE id = ?");
    $stmt->execute([$oaConfigId]);
    if (!$stmt->fetch()) {
        jsonResponse(false, null, 'OA not found in local DB');
        return;
    }

    // Generate Local ID
    $id = bin2hex(random_bytes(16));

    $stmt = $pdo->prepare("
        INSERT INTO zalo_templates 
        (id, oa_config_id, template_id, template_name, template_type, template_data, preview_data, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ");

    $stmt->execute([
        $id,
        $oaConfigId,
        $tplId,
        $resData['template_name'] ?? $data['template_name'],
        $resData['template_type'] ?? $data['template_type'],
        json_encode(['raw' => $resData, 'layout' => $data['layout']]), // Save layout structure
        json_encode($data['params'] ?? []), // Save params as preview data
        $resData['status'] ?? 'PENDING_REVIEW'
    ]);

    jsonResponse(true, ['id' => $id, 'zalo_response' => $resData], 'Template created successfully');
}

function updateTemplate($pdo, $id)
{
    $data = json_decode(file_get_contents('php://input'), true);

    // Build update query
    $updates = [];
    $params = [];

    $allowed_fields = ['template_name', 'template_type', 'template_data', 'preview_data', 'status'];

    foreach ($allowed_fields as $field) {
        if (isset($data[$field])) {
            if (in_array($field, ['template_data', 'preview_data'])) {
                $updates[] = "$field = ?";
                $params[] = json_encode($data[$field]);
            } else {
                $updates[] = "$field = ?";
                $params[] = $data[$field];
            }
        }
    }

    if (empty($updates)) {
        jsonResponse(false, null, 'No fields to update');
        return;
    }

    $params[] = $id;
    $sql = "UPDATE zalo_templates SET " . implode(', ', $updates) . " WHERE id = ?";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    jsonResponse(true, ['message' => 'Template updated successfully']);
}

function deleteTemplate($pdo, $id)
{
    // Check if template is being used in any flows
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count
        FROM flows f
        JOIN JSON_TABLE(
            f.steps,
            '$[*]' COLUMNS(
                config JSON PATH '$.config'
            )
        ) AS jt
        WHERE JSON_EXTRACT(jt.config, '$.template_id') = (
            SELECT template_id FROM zalo_templates WHERE id = ?
        )
    ");
    $stmt->execute([$id]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($result['count'] > 0) {
        jsonResponse(false, null, 'Cannot delete template: it is being used in active flows');
        return;
    }

    $stmt = $pdo->prepare("DELETE FROM zalo_templates WHERE id = ?");
    $stmt->execute([$id]);

    jsonResponse(true, ['message' => 'Template deleted successfully']);
}

function previewTemplate($pdo, $id)
{
    $stmt = $pdo->prepare("
        SELECT template_data, preview_data
        FROM zalo_templates
        WHERE id = ?
    ");
    $stmt->execute([$id]);
    $template = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$template) {
        jsonResponse(false, null, 'Template not found');
        return;
    }

    $template_data = json_decode($template['template_data'], true);
    $preview_data = json_decode($template['preview_data'], true);

    // Merge template structure with preview data
    $preview = renderTemplate($template_data, $preview_data);

    jsonResponse(true, [
        'template_structure' => $template_data,
        'preview_data' => $preview_data,
        'rendered_preview' => $preview
    ]);
}

function renderTemplate($template_data, $preview_data)
{
    // Simple template rendering
    // Replace placeholders like {{field_name}} with actual values
    $rendered = [];

    foreach ($template_data as $key => $value) {
        if (is_string($value)) {
            // Replace placeholders
            $rendered[$key] = preg_replace_callback('/\{\{(\w+)\}\}/', function ($matches) use ($preview_data) {
                $field = $matches[1];
                return $preview_data[$field] ?? $matches[0];
            }, $value);
        } else {
            $rendered[$key] = $value;
        }
    }

    return $rendered;
}

function getTemplateDetail($pdo, $id)
{
    require_once 'zalo_sender.php';

    // 1. Get info from local DB
    $stmt = $pdo->prepare("SELECT oa_config_id, template_id FROM zalo_templates WHERE id = ?");
    $stmt->execute([$id]);
    $local = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$local) {
        jsonResponse(false, null, 'Template not found locally');
        return;
    }

    $oa_id = $local['oa_config_id'];
    $zaloTemplateId = $local['template_id'];

    // 2. Get Access Token
    $tokenResult = getAccessToken($pdo, $oa_id);
    if (!$tokenResult['success']) {
        jsonResponse(false, null, 'Cannot get Access Token: ' . $tokenResult['message']);
        return;
    }
    $accessToken = $tokenResult['access_token'];

    // 3. Call Zalo API
    $url = "https://business.openapi.zalo.me/template/info/v2?template_id=$zaloTemplateId";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['access_token: ' . $accessToken]);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($res, true);

    if ($httpCode !== 200 || ($data['error'] ?? -1) !== 0) {
        jsonResponse(false, $data, 'Zalo API Error: ' . ($data['message'] ?? 'Unknown error'));
        return;
    }

    // 4. Update local DB with new info (especially previewUrl)
    $zaloData = $data['data'] ?? [];
    if (!empty($zaloData)) {
        // Fetch current template_data
        $stmtGet = $pdo->prepare("SELECT template_data FROM zalo_templates WHERE id = ?");
        $stmtGet->execute([$id]);
        $current = $stmtGet->fetch(PDO::FETCH_ASSOC);
        $currentJson = json_decode($current['template_data'] ?? '{}', true);

        // Merge
        $currentJson['detail'] = $zaloData;

        $stmtUpdate = $pdo->prepare("UPDATE zalo_templates SET template_data = ? WHERE id = ?");
        $stmtUpdate->execute([json_encode($currentJson), $id]);
    }

    jsonResponse(true, $zaloData);
}

function uploadTemplateImage($pdo)
{
    require_once 'zalo_sender.php';

    $oa_config_id = $_POST['oa_config_id'] ?? '';

    if (!$oa_config_id) {
        jsonResponse(false, null, 'OA Config ID required');
        return;
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        jsonResponse(false, null, 'File upload error or no file sent');
        return;
    }

    $tokenResult = getAccessToken($pdo, $oa_config_id);
    if (!$tokenResult['success']) {
        jsonResponse(false, null, 'Cannot get Access Token: ' . $tokenResult['message']);
        return;
    }
    $accessToken = $tokenResult['access_token'];

    // URL based on provided documentation: https://business.openapi.zalo.me/upload/image
    $url = 'https://business.openapi.zalo.me/upload/image';
    $filePath = $_FILES['file']['tmp_name'];
    $fileName = $_FILES['file']['name'];
    $mimeType = $_FILES['file']['type'];

    $cfile = new CURLFile($filePath, $mimeType, $fileName);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'access_token: ' . $accessToken,
        'Content-Type: multipart/form-data' // Typically optional as cURL sets it automatically with POSTFIELDS array
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);

    if ($httpCode !== 200 || ($result['error'] ?? -1) !== 0) {
        jsonResponse(false, $result, 'Zalo Upload Error: ' . ($result['message'] ?? 'Unknown error'));
        return;
    }

    jsonResponse(true, $result['data'] ?? [], 'Image uploaded successfully');
}
