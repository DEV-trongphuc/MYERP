<?php
class TagController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    public function index($auth) {
        $tid = $auth['tenant_id'];
        
        // Lấy tất cả tags (loại trừ các tag trạng thái cũ đã bãi bỏ)
        $stmt = $this->db->prepare("SELECT * FROM tags WHERE tenant_id = ? AND LOWER(TRIM(name)) NOT IN ('new', 'unqualified', 'needed', 'considering', 'badtiming', 'bad timing', 'bad_timing', 'qualified') ORDER BY name ASC");
        $stmt->execute([$tid]);
        $tags = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Đếm số lượng sử dụng từ contacts và companies (JSON column)
        foreach ($tags as &$tag) {
            $tagName = $tag['name'];
            $s1 = $this->db->prepare("SELECT COUNT(*) FROM contacts WHERE tenant_id = ? AND JSON_CONTAINS(tags, ?)");
            $s1->execute([$tid, json_encode($tagName)]);
            $count1 = (int)$s1->fetchColumn();

            $s2 = $this->db->prepare("SELECT COUNT(*) FROM companies WHERE tenant_id = ? AND JSON_CONTAINS(tags, ?)");
            $s2->execute([$tid, json_encode($tagName)]);
            $count2 = (int)$s2->fetchColumn();

            $tag['count'] = $count1 + $count2;
        }

        respond(200, $tags);
    }

    public function store($auth) {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true)) respond(403, null, 'Chỉ admin mới có quyền quản lý tags', false);
        $data = getBody();
        if (empty($data['name'])) respond(400, null, 'Tên tag không được để trống', false);

        $stmt = $this->db->prepare("
            INSERT INTO tags (tenant_id, name, color, entity_type)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            $auth['tenant_id'],
            $data['name'],
            $data['color'] ?? '#6366f1',
            $data['entity_type'] ?? 'all'
        ]);
        
        $id = $this->db->lastInsertId();
        respond(201, ['id' => $id], 'Đã tạo tag mới');
    }

    public function update($auth, $id) {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true)) respond(403, null, 'Chỉ admin mới có quyền quản lý tags', false);
        $data = getBody();
        $stmt = $this->db->prepare("
            UPDATE tags 
            SET name = ?, color = ?, entity_type = ?
            WHERE id = ? AND tenant_id = ?
        ");
        $stmt->execute([
            $data['name'],
            $data['color'],
            $data['entity_type'] ?? 'all',
            $id,
            $auth['tenant_id']
        ]);
        respond(200, null, 'Đã cập nhật tag');
    }

    public function destroy($auth, $id) {
        if (!in_array($auth['role'], ['admin', 'superadmin', 'super_admin', 'director'], true)) respond(403, null, 'Chỉ admin mới có quyền quản lý tags', false);
        $stmt = $this->db->prepare("DELETE FROM tags WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $auth['tenant_id']]);
        respond(200, null, 'Đã xóa tag');
    }

    /**
     * GET /tags/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&date_field=created_at
     * Returns [{tag, count, color}] aggregated from contacts.tags JSON column.
     */
    public function tagStats(array $auth): void {
        $from       = $_GET['from']       ?? null;
        $to         = $_GET['to']         ?? null;
        $dateField  = in_array($_GET['date_field'] ?? '', ['updated_at']) ? 'updated_at' : 'created_at';

        $params = [$auth['tenant_id']];
        $where  = 'tenant_id = ? AND deleted_at IS NULL';
        if ($auth['role'] === 'sales' || $auth['role'] === 'sale') {
            $where .= ' AND owner_id = ?';
            $params[] = $auth['user_id'];
        } else if ($auth['role'] === 'manager') {
            $where .= ' AND (owner_id = ? OR owner_id IN (SELECT id FROM users WHERE team_id IN (SELECT id FROM teams WHERE leader_id = ?)))';
            $params[] = $auth['user_id'];
            $params[] = $auth['user_id'];
        }
        if ($from) { $where .= " AND $dateField >= ?"; $params[] = $from . ' 00:00:00'; }
        if ($to)   { $where .= " AND $dateField <= ?"; $params[] = $to . ' 23:59:59';   }

        $stmt = $this->db->prepare("SELECT tags FROM contacts WHERE $where");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $counts = [];
        foreach ($rows as $rawTags) {
            if (empty($rawTags)) continue;
            
            $tags = json_decode($rawTags, true);
            if (!is_array($tags)) {
                $tags = explode(',', $rawTags);
            }

            foreach ($tags as $tag) {
                $tag = trim((string)$tag);
                if ($tag === '') continue;
                
                $cleanedTag = preg_replace('/^\d+\.\s*(status\s*-\s*)?/i', '', $tag);
                $cleanedTag = trim($cleanedTag);
                if ($cleanedTag === '') continue;

                $deprecatedTags = ['new', 'unqualified', 'needed', 'considering', 'badtiming', 'bad timing', 'bad_timing', 'qualified'];
                if (in_array(strtolower($cleanedTag), $deprecatedTags, true)) continue;

                $counts[$cleanedTag] = ($counts[$cleanedTag] ?? 0) + 1;
            }
        }

        $tagRows = $this->db->prepare("SELECT name, color FROM tags WHERE tenant_id = ?");
        $tagRows->execute([$auth['tenant_id']]);
        $colorMap = [];
        foreach ($tagRows->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $colorMap[strtolower(trim($r['name']))] = $r['color'];
        }

        $result = [];
        arsort($counts);
        foreach ($counts as $tag => $count) {
            $lowerTag = strtolower($tag);
            $bg = $colorMap[$lowerTag] ?? '';
            
            if (empty($bg)) {
                if (strpos($lowerTag, 'umef') !== false || strpos($lowerTag, 'msc') !== false) {
                    $bg = '#059669';
                } else {
                    $bg = '#2563eb';
                }
            }

            $result[] = [
                'tag'   => $tag,
                'count' => $count,
                'color' => $bg,
            ];
        }

        respond(200, $result);
    }
}
