<?php
// api/get_global_assets.php
require_once 'db_connect.php';
require_once 'ai_org_middleware.php';

// Verify authentication for AI Space
$currentOrgUser = requireAISpaceAuth();

// session_start() removed - handled by db_connect.php

header('Content-Type: application/json');

$action = $_GET['action'] ?? 'list';
$property_id = $_GET['property_id'] ?? null;
if ($property_id) {
    $property_id = resolvePropertyId($pdo, $property_id);
}
// Use authenticated org user ID instead of global variable
$current_admin_id = $GLOBALS['current_admin_id'] ?? $currentOrgUser['id'];

// ORG ISOLATION: Determine if this is the true super-admin (admin-001) or an org-level admin.
// Only admin-001 (Autoflow platform owner) sees ALL assets across all orgs.
// All other admins, even role='admin', are scoped to their own org via admin_id.
$isSuperAdmin = is_super_admin();

try {
    if ($action === 'list') {
        $type = $_GET['type'] ?? 'all';
        $source = $_GET['source'] ?? 'all';
        $search = $_GET['search'] ?? '';
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
        $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;

        $where = ["ga.is_deleted = 0"];
        $params = [];

        // ENFORCE ORG ISOLATION:
        // - Super admin (admin-001): sees everything (no filter)
        // - Org admin (role='admin' but NOT admin-001): scoped to their own admin_id
        // - Regular users: scoped to their own admin_id
        if (!$isSuperAdmin && $current_admin_id) {
            $where[] = "(ga.admin_id = ? OR ga.admin_id IS NULL)";
            $params[] = $current_admin_id;
        }

        if (!empty($_GET['group_id'])) {
            // Group Level: Broad filter for everything in this category (All bots/conversations) + Truly Global (property_id IS NULL)
            $groupId = (int)$_GET['group_id'];
            $where[] = "(ga.property_id IN (SELECT id FROM ai_chatbots WHERE category_id = ?) OR ga.property_id IS NULL)";
            $params[] = $groupId;
        } elseif ($property_id) {
            // Specific Bot Level: Show assets for this bot OR its category OR truly global
            // [OPTIMIZATION] Flattened subquery for category-level assets
            $where[] = "(ga.property_id = ? 
                        OR ga.property_id IN (
                            SELECT b2.id 
                            FROM ai_chatbots b1 
                            JOIN ai_chatbots b2 ON b1.category_id = b2.category_id 
                            WHERE b1.id = ?
                        ) 
                        OR ga.property_id IS NULL)";
            $params[] = $property_id;
            $params[] = $property_id;
        } else {
            // GUEST/OPEN MODE: If no specific bot or admin, only show TRULY global files (NULL property and NULL admin)
            // unless they are explicitly marked as workspace global.
            $where[] = "(ga.property_id IS NULL AND (ga.admin_id IS NULL OR ga.source = 'workspace'))";
        }

        if (!empty($_GET['conversation_id'])) {
            $where[] = "ga.conversation_id = ?";
            $params[] = $_GET['conversation_id'];
        }

        if ($type === 'image') {
            $where[] = "ga.type LIKE 'image/%'";
        } elseif ($type === 'document') {
            $where[] = "ga.type NOT LIKE 'image/%'";
        }

        if ($source !== 'all') {
            if ($source === 'chat') {
                $where[] = "ga.source IN ('chat_user', 'chat_assistant', 'chat_bot')";
            } else {
                $where[] = "ga.source = ?";
                $params[] = $source;
            }
        }

        if (!empty($search)) {
            $where[] = "(ga.name LIKE ? OR ga.type LIKE ? OR ga.extension LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereSql = "WHERE " . implode(" AND ", $where);

        // Count total
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM global_assets ga $whereSql");
        $stmtCount->execute($params);
        $total = $stmtCount->fetchColumn();

        // Fetch items - JOIN with conversations and subscribers only when needed
        // For 'workspace' source, we usually don't need visitor details unless requested
        $joinVisitor = "";
        $visitorFields = "NULL as conversation_title";

        if ($source !== 'workspace' || !empty($search)) {
            $joinVisitor = "
                LEFT JOIN ai_org_conversations oc ON ga.conversation_id = oc.id
                LEFT JOIN domation_ai_conversations c ON ga.conversation_id = c.id
                LEFT JOIN web_visitors v ON (c.visitor_id = v.id OR oc.visitor_id = v.id)
                LEFT JOIN subscribers s ON v.subscriber_id = s.id";
            $visitorFields = "COALESCE(s.first_name, v.email, v.phone, oc.title, c.visitor_id) as conversation_title";
        }

        $sql = "SELECT ga.*, $visitorFields
                FROM global_assets ga
                $joinVisitor
                $whereSql 
                ORDER BY (ga.property_id IS NOT NULL) DESC, ga.created_at DESC 
                LIMIT $limit OFFSET $offset";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'data' => $items,
            'total' => (int) $total,
            'property_id' => $property_id
        ]);
    } elseif ($action === 'view') {
        // OPTIMIZED: Secure Direct Access (Redirect)
        $id = $_GET['id'] ?? null;
        if (!$id)
            die("Missing ID");

        $stmt = $pdo->prepare("SELECT * FROM global_assets WHERE id = ?");
        $stmt->execute([$id]);
        $asset = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$asset || $asset['is_deleted'])
            die("File not found");

        // Auth Check (Same as List)
        $hasAccess = false;
        if ($current_admin_id == $asset['admin_id']) {
            $hasAccess = true; // Owner
        } elseif ($asset['admin_id'] === null || $asset['source'] === 'workspace') {
            // Truly Global or Shared Workspace: 
            // Still check if it belongs to a property the user has access to
            if ($asset['property_id']) {
                $stmtProp = $pdo->prepare("SELECT 1 FROM ai_chatbots WHERE id = ? AND category_id IN (SELECT category_id FROM ai_org_user_categories WHERE user_id = ?)");
                $stmtProp->execute([$asset['property_id'], $current_admin_id]);
                if ($stmtProp->fetch() || $currentOrgUser['role'] === 'admin') {
                    $hasAccess = true;
                }
            } else {
                // No property link, Truly global
                $hasAccess = true;
            }
        }

        // Direct Redirect
        $url = $asset['url'];
        if (strpos($url, '/') === 0) {
            // It's a relative path on this server
            header("Location: " . $url);
            exit;
        } else {
            // It's a full URL (S3, external)
            header("Location: " . $url);
            exit;
        }

    } elseif ($action === 'delete') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            die(json_encode(['success' => false, 'message' => 'Method not allowed']));
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $ids = $data['ids'] ?? [];

        if (empty($ids)) {
            die(json_encode(['success' => false, 'message' => 'No IDs provided']));
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        // 1. Fetch URLs, metadata, AND OWNER info (admin_id) to perform deep cleanup & security check
        $stmtMeta = $pdo->prepare("SELECT id, url, conversation_id, name, property_id, admin_id FROM global_assets WHERE id IN ($placeholders)");
        $stmtMeta->execute($ids);
        $assets = $stmtMeta->fetchAll(PDO::FETCH_ASSOC);

        $validIdsToDelete = [];

        foreach ($assets as $asset) {
            // SECURITY CHECK: BOLA Protection
            // Allow if user is ADMIN role OR if user is the OWNER of the file
            $isOwner = (!empty($asset['admin_id']) && $asset['admin_id'] == $current_admin_id);
            $isAdmin = ($currentOrgUser['role'] === 'admin');

            if (!$isAdmin && !$isOwner) {
                // Skip files this user doesn't own
                error_log("Security: User $current_admin_id tried to delete asset {$asset['id']} owned by {$asset['admin_id']}");
                continue;
            }

            $validIdsToDelete[] = $asset['id'];
            $fileUrl = $asset['url'];
            $convId = $asset['conversation_id'];

            // A. Cleanup Disk - Robust Path Validation
            if ($fileUrl && strpos($fileUrl, '/uploadss/') !== false) {
                // Ensure the path is strictly within uploadss
                $urlPath = parse_url($fileUrl, PHP_URL_PATH);
                $parts = explode('/uploadss/', $urlPath);
                if (isset($parts[1])) {
                    $relativePath = ltrim($parts[1], '/');
                    // Prevent path traversal
                    if (strpos($relativePath, '..') === false) {
                        $localPath = realpath(__DIR__ . '/../uploadss/' . $relativePath);
                        $uploadsBase = realpath(__DIR__ . '/../uploadss/');

                        if ($localPath && strpos($localPath, $uploadsBase) === 0 && file_exists($localPath)) {
                            @unlink($localPath);
                        }
                    }
                }
            }

            // B. Cleanup Messages Metadata
            if ($convId) {
                $msgTables = ['domation_ai_messages', 'ai_org_messages'];
                foreach ($msgTables as $mTable) {
                    $stmtM = $pdo->prepare("SELECT id, metadata FROM $mTable WHERE conversation_id = ? AND metadata LIKE ?");
                    $stmtM->execute([$convId, '%' . $fileUrl . '%']);
                    while ($msg = $stmtM->fetch(PDO::FETCH_ASSOC)) {
                        $meta = json_decode($msg['metadata'], true);
                        if (!empty($meta['attachments'])) {
                            $countBefore = count($meta['attachments']);
                            $meta['attachments'] = array_filter($meta['attachments'], function ($att) use ($fileUrl) {
                                $attUrl = $att['url'] ?? $att['previewUrl'] ?? '';
                                return $attUrl !== $fileUrl;
                            });
                            $meta['attachments'] = array_values($meta['attachments']);
                            if (count($meta['attachments']) !== $countBefore) {
                                $pdo->prepare("UPDATE $mTable SET metadata = ? WHERE id = ?")
                                    ->execute([json_encode($meta), $msg['id']]);
                            }
                        }
                    }
                }
            }

            // C. Cleanup workspace files
            $pdo->prepare("DELETE FROM ai_workspace_files WHERE file_url = ?")->execute([$fileUrl]);
        }

        // 2. Hard delete from global_assets (permanent removal)
        if (empty($validIdsToDelete)) {
            echo json_encode(['success' => true, 'message' => 'No matching assets found or authorized to delete.']);
            exit;
        }

        $placeholdersDelete = implode(',', array_fill(0, count($validIdsToDelete), '?'));
        $sql = "DELETE FROM global_assets WHERE id IN ($placeholdersDelete)";
        $deleteParams = $validIdsToDelete;

        if ($property_id) {
            $sql .= " AND property_id = ?";
            $deleteParams[] = $property_id;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($deleteParams);

        echo json_encode(['success' => true, 'message' => 'Deleted ' . $stmt->rowCount() . ' assets']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi hệ thống, vui lòng thử lại.']);
}
