<?php
// backend/controllers/PostController.php

class PostController {
    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    /**
     * GET /posts
     * Fetch timeline posts with cursor pagination and optional tag/author filtering.
     */
    public function index(array $auth): void {
        $tenantId = (int)$auth['tenant_id'];
        $currentUserId = (int)$auth['user_id'];
        
        $cursor = isset($_GET['cursor']) ? base64_decode($_GET['cursor']) : null;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        if ($limit < 1 || $limit > 50) $limit = 10;

        $userIdFilter = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
        $tagFilter = isset($_GET['tag']) ? trim($_GET['tag']) : null;

        $isAdmin = in_array($auth['role'], ['superadmin', 'admin', 'super_admin'], true);

        // Fetch user's team_id
        $userTeamId = null;
        $stmtUserTeam = $this->db->prepare("SELECT team_id FROM users WHERE id = ? LIMIT 1");
        $stmtUserTeam->execute([$currentUserId]);
        $userTeamId = $stmtUserTeam->fetchColumn() ?: null;

        $query = "
            SELECT p.*, u.full_name as author_name, u.avatar_url as author_avatar, t.name as team_name
            FROM enterprise_posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN teams t ON p.team_id = t.id
            WHERE p.tenant_id = ? AND p.deleted_at IS NULL
        ";
        
        $params = [$tenantId];

        // Restrict team posts visibility for non-admins
        if (!$isAdmin) {
            if ($userTeamId) {
                $query .= " AND (p.visibility = 'global' OR p.user_id = ? OR (p.visibility = 'team' AND p.team_id = ?))";
                $params[] = $currentUserId;
                $params[] = (int)$userTeamId;
            } else {
                $query .= " AND (p.visibility = 'global' OR p.user_id = ?)";
                $params[] = $currentUserId;
            }
        }

        if ($userIdFilter) {
            $query .= " AND p.user_id = ?";
            $params[] = $userIdFilter;
        }

        if ($tagFilter) {
            $query .= " AND JSON_CONTAINS(p.tags_json, ?)";
            $params[] = json_encode($tagFilter);
        }

        if ($cursor) {
            $query .= " AND p.created_at < ?";
            $params[] = $cursor;
        }

        $query .= " ORDER BY p.created_at DESC LIMIT ?";
        $params[] = $limit + 1; // Load one extra to check if there is a next page

        $stmt = $this->db->prepare($query);
        // Bind parameters safely
        foreach ($params as $key => $val) {
            $stmt->bindValue($key + 1, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->execute();
        $posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $hasNextPage = count($posts) > $limit;
        if ($hasNextPage) {
            array_pop($posts); // Remove the extra record
            $lastPost = end($posts);
            $nextCursor = base64_encode($lastPost['created_at']);
        } else {
            $nextCursor = null;
        }

        // Hydrate posts with comments, reactions counts and user's reaction
        if (!empty($posts)) {
            $postIds = array_map(function($p) { return (int)$p['id']; }, $posts);
            $placeholders = implode(',', array_fill(0, count($postIds), '?'));

            // 1. Reactions summary batch
            $reactStmt = $this->db->prepare("
                SELECT ref_id, reaction_type, COUNT(*) as count 
                FROM enterprise_reactions 
                WHERE ref_type = 'post' AND ref_id IN ($placeholders) 
                GROUP BY ref_id, reaction_type
            ");
            $reactStmt->execute($postIds);
            $reacts = $reactStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $reactionsMap = [];
            foreach ($reacts as $r) {
                $pid = (int)$r['ref_id'];
                $reactionsMap[$pid][$r['reaction_type']] = (int)$r['count'];
            }

            // 2. User reactions batch
            $userReactStmt = $this->db->prepare("
                SELECT ref_id, reaction_type 
                FROM enterprise_reactions 
                WHERE ref_type = 'post' AND user_id = ? AND ref_id IN ($placeholders)
            ");
            $userReactStmt->execute(array_merge([$currentUserId], $postIds));
            $userReacts = $userReactStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $userReactionsMap = [];
            foreach ($userReacts as $ur) {
                $userReactionsMap[(int)$ur['ref_id']] = $ur['reaction_type'];
            }

            // 3. Comments count batch
            $cmtCountStmt = $this->db->prepare("
                SELECT post_id, COUNT(*) as count 
                FROM enterprise_comments 
                WHERE deleted_at IS NULL AND post_id IN ($placeholders)
                GROUP BY post_id
            ");
            $cmtCountStmt->execute($postIds);
            $cmtCounts = $cmtCountStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $commentsCountMap = [];
            foreach ($cmtCounts as $cc) {
                $commentsCountMap[(int)$cc['post_id']] = (int)$cc['count'];
            }

            // 4. Top 3 comments batch (using ROW_NUMBER() CTE)
            $cmtStmt = $this->db->prepare("
                WITH RankedComments AS (
                    SELECT c.*, u.full_name as author_name, u.avatar_url as author_avatar,
                           ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY c.created_at ASC) as rn
                    FROM enterprise_comments c
                    JOIN users u ON c.user_id = u.id
                    WHERE c.post_id IN ($placeholders) AND c.parent_id IS NULL AND c.deleted_at IS NULL
                )
                SELECT * FROM RankedComments WHERE rn <= 3
            ");
            $cmtStmt->execute($postIds);
            $topComments = $cmtStmt->fetchAll(PDO::FETCH_ASSOC);

            $topCommentsMap = [];
            foreach ($topComments as $tc) {
                $pid = (int)$tc['post_id'];
                $topCommentsMap[$pid][] = $tc;
            }

            // Hydrate posts
            foreach ($posts as &$post) {
                $postId = (int)$post['id'];
                
                $post['attachments'] = json_decode($post['attachments_json'] ?? '[]', true) ?: [];
                $post['tags'] = json_decode($post['tags_json'] ?? '[]', true) ?: [];
                $post['link_metadata'] = json_decode($post['link_metadata_json'] ?? 'null', true);
                unset($post['attachments_json'], $post['tags_json'], $post['link_metadata_json']);

                // Reactions
                $post['reactions_summary'] = isset($reactionsMap[$postId]) ? $reactionsMap[$postId] : [];
                $post['reactions_count'] = 0;
                foreach ($post['reactions_summary'] as $count) {
                    $post['reactions_count'] += $count;
                }

                // User reaction
                $post['user_reaction'] = isset($userReactionsMap[$postId]) ? $userReactionsMap[$postId] : null;

                // Comments count
                $post['comments_count'] = isset($commentsCountMap[$postId]) ? $commentsCountMap[$postId] : 0;

                // Top comments
                $post['top_comments'] = isset($topCommentsMap[$postId]) ? $topCommentsMap[$postId] : [];
            }
        }

        respond(200, [
            'posts' => $posts,
            'next_cursor' => $nextCursor,
            'has_more' => $hasNextPage
        ]);
    }

    /**
     * POST /posts
     * Create a post. Triggers server-side Open Graph parsing if url detected in content.
     */
    public function store(array $auth): void {
        $tenantId = (int)$auth['tenant_id'];
        $userId = (int)$auth['user_id'];
        $b = getBody();

        $content = isset($b['content']) ? trim($b['content']) : '';
        if (empty($content)) {
            respond(400, null, 'Nội dung bài viết không được để trống', false);
        }

        $attachments = isset($b['attachments']) ? $b['attachments'] : [];
        $visibility = isset($b['visibility']) ? trim($b['visibility']) : 'global';

        // Extract hashtags
        preg_match_all('/#(\w+)/u', $content, $matches);
        $tags = !empty($matches[1]) ? array_values(array_unique($matches[1])) : [];

        // Scrape Link Preview if any URL in content
        $linkMetadata = null;
        if (preg_match('@https?://[^\s<>]+@i', $content, $urlMatches)) {
            $targetUrl = $urlMatches[0];
            $linkMetadata = $this->scrapeUrlMetadata($targetUrl);
        }
        $teamId = isset($b['team_id']) ? (int)$b['team_id'] : null;
        if ($visibility !== 'team') {
            $teamId = null;
        }

        $stmt = $this->db->prepare("
            INSERT INTO enterprise_posts (tenant_id, user_id, content, attachments_json, visibility, team_id, tags_json, link_metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $tenantId,
            $userId,
            $content,
            json_encode($attachments),
            $visibility,
            $teamId,
            json_encode($tags),
            $linkMetadata ? json_encode($linkMetadata) : null
        ]);

        $postId = (int)$this->db->lastInsertId();
        $this->processMentionsAndNotify($auth, $content, $postId);

        respond(201, ['success' => true, 'id' => $postId]);
    }

    /**
     * DELETE /posts/{id}
     */
    public function destroyPost(array $auth, int $id): void {
        $tenantId = (int)$auth['tenant_id'];
        $userId = (int)$auth['user_id'];
        $role = strtolower($auth['role']);

        $stmt = $this->db->prepare("SELECT user_id FROM enterprise_posts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id, $tenantId]);
        $postAuthorId = $stmt->fetchColumn();

        if (!$postAuthorId) {
            respond(404, null, 'Bài viết không tồn tại', false);
        }

        // Only author or admin/superadmin can delete
        if ($userId !== (int)$postAuthorId && !in_array($role, ['admin', 'superadmin', 'super_admin', 'director'])) {
            respond(403, null, 'Bạn không có quyền xóa bài viết này', false);
        }

        $delStmt = $this->db->prepare("UPDATE enterprise_posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?");
        $delStmt->execute([$id]);

        respond(200, ['success' => true]);
    }

    /**
     * POST /posts/{id}/react
     * Toggle or update user reaction on a post.
     */
    public function react(array $auth, int $id): void {
        $tenantId = (int)$auth['tenant_id'];
        $userId = (int)$auth['user_id'];
        $b = getBody();
        $reactionType = isset($b['reaction_type']) ? trim($b['reaction_type']) : 'like';

        // Check if post exists
        $chk = $this->db->prepare("SELECT id FROM enterprise_posts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $chk->execute([$id, $tenantId]);
        if (!$chk->fetchColumn()) {
            respond(404, null, 'Bài viết không tồn tại', false);
        }

        // Check existing user reaction
        $chkReact = $this->db->prepare("SELECT reaction_type FROM enterprise_reactions WHERE ref_type = 'post' AND ref_id = ? AND user_id = ?");
        $chkReact->execute([$id, $userId]);
        $existing = $chkReact->fetchColumn();

        if ($existing) {
            if ($existing === $reactionType) {
                // Toggle off
                $del = $this->db->prepare("DELETE FROM enterprise_reactions WHERE ref_type = 'post' AND ref_id = ? AND user_id = ?");
                $del->execute([$id, $userId]);
                $action = 'removed';
            } else {
                // Update
                $up = $this->db->prepare("UPDATE enterprise_reactions SET reaction_type = ? WHERE ref_type = 'post' AND ref_id = ? AND user_id = ?");
                $up->execute([$reactionType, $id, $userId]);
                $action = 'updated';
            }
        } else {
            // Insert
            $ins = $this->db->prepare("INSERT INTO enterprise_reactions (tenant_id, ref_type, ref_id, user_id, reaction_type) VALUES (?, 'post', ?, ?, ?)");
            $ins->execute([$tenantId, $id, $userId, $reactionType]);
            $action = 'added';
        }

        // Get updated stats
        $reactStmt = $this->db->prepare("
            SELECT reaction_type, COUNT(*) as count 
            FROM enterprise_reactions 
            WHERE ref_type = 'post' AND ref_id = ? 
            GROUP BY reaction_type
        ");
        $reactStmt->execute([$id]);
        $reacts = $reactStmt->fetchAll(PDO::FETCH_ASSOC);

        $summary = [];
        $total = 0;
        foreach ($reacts as $r) {
            $summary[$r['reaction_type']] = (int)$r['count'];
            $total += (int)$r['count'];
        }

        respond(200, [
            'success' => true,
            'action' => $action,
            'reactions_summary' => $summary,
            'reactions_count' => $total,
            'user_reaction' => $action === 'removed' ? null : $reactionType
        ]);
    }

    /**
     * GET /posts/{id}/comments
     * Get a threaded/nested tree structure of comments.
     */
    public function getComments(array $auth, int $id): void {
        $tenantId = (int)$auth['tenant_id'];

        $stmt = $this->db->prepare("
            SELECT c.*, u.full_name as author_name, u.avatar_url as author_avatar
            FROM enterprise_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ? AND c.tenant_id = ? AND c.deleted_at IS NULL
            ORDER BY c.created_at ASC
        ");
        $stmt->execute([$id, $tenantId]);
        $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Group comments by parent_id to build parent-child links
        $byParent = [];
        $rootComments = [];

        foreach ($comments as $c) {
            $c['attachments'] = json_decode($c['attachments_json'] ?? '[]', true) ?: [];
            unset($c['attachments_json']);
            
            $pid = $c['parent_id'];
            if ($pid === null || $pid === 0 || $pid === '0' || $pid === '') {
                $rootComments[] = $c;
            } else {
                $byParent[(int)$pid][] = $c;
            }
        }

        // Map child comments recursively
        $buildTree = function($commentList) use (&$buildTree, $byParent) {
            foreach ($commentList as &$c) {
                $cid = (int)$c['id'];
                $c['replies'] = isset($byParent[$cid]) ? $buildTree($byParent[$cid]) : [];
            }
            return $commentList;
        };

        $tree = $buildTree($rootComments);
        respond(200, ['comments' => $tree]);
    }

    /**
     * POST /posts/{id}/comments
     * Create a comment/reply.
     */
    public function addComment(array $auth, int $id): void {
        $tenantId = (int)$auth['tenant_id'];
        $userId = (int)$auth['user_id'];
        $b = getBody();

        $content = isset($b['content']) ? trim($b['content']) : '';
        if (empty($content)) {
            respond(400, null, 'Nội dung bình luận không được bỏ trống', false);
        }

        $parentId = isset($b['parent_id']) && (int)$b['parent_id'] > 0 ? (int)$b['parent_id'] : null;
        $attachments = isset($b['attachments']) ? $b['attachments'] : [];

        // Verify post exists
        $chk = $this->db->prepare("SELECT user_id FROM enterprise_posts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $chk->execute([$id, $tenantId]);
        $postAuthorId = $chk->fetchColumn();
        if (!$postAuthorId) {
            respond(404, null, 'Bài viết không tồn tại', false);
        }

        $stmt = $this->db->prepare("
            INSERT INTO enterprise_comments (tenant_id, post_id, user_id, parent_id, content, attachments_json)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $tenantId,
            $id,
            $userId,
            $parentId,
            $content,
            json_encode($attachments)
        ]);

        $commentId = (int)$this->db->lastInsertId();

        // Process mentions and notify users first
        $this->processMentionsAndNotify($auth, $content, $id, $commentId);

        // Optional: Trigger system notification for post author (if comment was by another user)
        if ((int)$postAuthorId !== $userId) {
            try {
                $notifType = $parentId ? 'comment_reply' : 'post_comment';
                $title = $auth['full_name'] . ($parentId ? ' đã phản hồi bình luận của bạn' : ' đã bình luận về bài viết của bạn');
                $link = "/feed?post_id={$id}&open_comment={$commentId}";
                
                $notifStmt = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, is_read, link)
                    VALUES (?, ?, ?, ?, ?, 0, ?)
                ");
                $notifStmt->execute([
                    $postAuthorId,
                    $tenantId,
                    $title,
                    mb_strimwidth($content, 0, 100, '...'),
                    $notifType,
                    $link
                ]);
            } catch (Throwable $e) {
                // Ignore notification failure
            }
        }

        respond(201, ['success' => true, 'id' => $commentId]);
    }

    /**
     * DELETE /comments/{id}
     */
    public function deleteComment(array $auth, int $id): void {
        $tenantId = (int)$auth['tenant_id'];
        $userId = (int)$auth['user_id'];
        $role = strtolower($auth['role']);

        $stmt = $this->db->prepare("SELECT user_id FROM enterprise_comments WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
        $stmt->execute([$id, $tenantId]);
        $commentAuthorId = $stmt->fetchColumn();

        if (!$commentAuthorId) {
            respond(404, null, 'Bình luận không tồn tại', false);
        }

        if ($userId !== (int)$commentAuthorId && !in_array($role, ['admin', 'superadmin', 'super_admin', 'director'])) {
            respond(403, null, 'Bạn không có quyền xóa bình luận này', false);
        }

        $delStmt = $this->db->prepare("UPDATE enterprise_comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?");
        $delStmt->execute([$id]);

        respond(200, ['success' => true]);
    }

    /**
     * Helper: Scrape Open Graph metadata from URL.
     * Keeps response fast by setting curl timeouts.
     */
    private function scrapeUrlMetadata(string $url): ?array {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3); // 3 seconds timeout
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36');
        
        $html = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$html || $httpCode !== 200) {
            return [
                'url' => $url,
                'title' => parse_url($url, PHP_URL_HOST),
                'description' => null,
                'image' => null
            ];
        }

        $meta = [
            'url' => $url,
            'title' => '',
            'description' => '',
            'image' => ''
        ];

        // Match Title
        if (preg_match('/<title>(.*?)<\/title>/is', $html, $titleMatches)) {
            $meta['title'] = html_entity_decode(trim($titleMatches[1]), ENT_QUOTES, 'UTF-8');
        }

        // Match Open Graph Title
        if (preg_match('/<meta[^>]*property=["\']og:title["\'][^>]*content=["\'](.*?)["\']/is', $html, $ogTitleMatches)) {
            $meta['title'] = html_entity_decode(trim($ogTitleMatches[1]), ENT_QUOTES, 'UTF-8');
        }

        // Match Open Graph Description
        if (preg_match('/<meta[^>]*property=["\']og:description["\'][^>]*content=["\'](.*?)["\']/is', $html, $ogDescMatches)) {
            $meta['description'] = html_entity_decode(trim($ogDescMatches[1]), ENT_QUOTES, 'UTF-8');
        } elseif (preg_match('/<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']/is', $html, $descMatches)) {
            $meta['description'] = html_entity_decode(trim($descMatches[1]), ENT_QUOTES, 'UTF-8');
        }

        // Match Open Graph Image
        if (preg_match('/<meta[^>]*property=["\']og:image["\'][^>]*content=["\'](.*?)["\']/is', $html, $ogImgMatches)) {
            $meta['image'] = trim($ogImgMatches[1]);
        }

        // Clean values
        $meta['title'] = mb_strimwidth($meta['title'] ?: parse_url($url, PHP_URL_HOST), 0, 150, '...');
        $meta['description'] = mb_strimwidth($meta['description'], 0, 250, '...');

        return $meta;
    }

    public function seedSamples($auth) {
        $tenantId = (int)$auth['tenant_id'];
        $userId = (int)$auth['id'];

        // 1. Get other active users to simulate comments/reactions
        $stmt = $this->db->prepare("SELECT id FROM users WHERE id != ? AND tenant_id = ? LIMIT 3");
        $stmt->execute([$userId, $tenantId]);
        $otherUsers = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Fallback to current user if no other users exist
        if (empty($otherUsers)) {
            $otherUsers = [$userId];
        }

        // 2. Insert Post 1 (Welcome)
        $stmtPost = $this->db->prepare("
            INSERT INTO enterprise_posts (tenant_id, user_id, content, visibility, tags_json, attachments_json, link_metadata_json)
            VALUES (?, ?, ?, 'global', ?, '[]', NULL)
        ");
        $stmtPost->execute([
            $tenantId, 
            $userId, 
            "Chào mừng toàn thể anh chị em đến với Bảng tin nội bộ của công ty! 🌐 Đây sẽ là nơi chúng ta cập nhật các tin tức nóng hổi nhất, chia sẻ kiến thức, kỷ niệm và gắn kết tinh thần đồng đội. Mọi người hãy tích cực tương tác, thả reaction và bình luận nhé! #ideas #welcome #newfeed",
            json_encode(["ideas", "welcome", "newfeed"])
        ]);
        $postId1 = $this->db->lastInsertId();

        // Seed reaction and comment for Post 1
        if (!empty($otherUsers)) {
            $stmtReact = $this->db->prepare("INSERT IGNORE INTO enterprise_reactions (tenant_id, ref_type, ref_id, user_id, reaction_type) VALUES (?, 'post', ?, ?, ?)");
            $stmtReact->execute([$tenantId, $postId1, $otherUsers[0], 'love']);
            if (isset($otherUsers[1])) {
                $stmtReact->execute([$tenantId, $postId1, $otherUsers[1], 'like']);
            }

            $stmtComment = $this->db->prepare("INSERT INTO enterprise_comments (tenant_id, post_id, user_id, parent_id, content, attachments_json) VALUES (?, ?, ?, NULL, ?, '[]')");
            $stmtComment->execute([$tenantId, $postId1, $otherUsers[0], "Tuyệt vời quá sếp ơi! Hy vọng bảng tin sẽ là nơi kết nối anh chị em nhiều hơn nữa 🎉"]);
        }

        // 3. Insert Post 2 (Link preview)
        $linkMeta = [
            'url' => 'https://viblo.asia/p/toi-uu-hoa-nang-suat-lam-viec-cua-developer-L4elR8yJeAL',
            'title' => 'Bí quyết Tối ưu hóa Năng suất làm việc cho Lập trình viên',
            'description' => 'Chia sẻ những phương pháp, thói quen và công cụ tốt nhất giúp tối ưu hóa hiệu suất viết code của lập trình viên.',
            'image' => 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=60'
        ];
        $stmtPost->execute([
            $tenantId, 
            $userId, 
            "Mọi người đã đọc qua bài viết chia sẻ về các bí quyết tối ưu hóa năng suất làm việc của lập trình viên chưa? Cực kỳ hữu ích cho các dự án ERP hiện tại của chúng ta! Link tham khảo: https://viblo.asia/p/toi-uu-hoa-nang-suat-lam-viec-cua-developer-L4elR8yJeAL #productivity #bestpractices",
            json_encode(["productivity", "bestpractices"])
        ]);
        $postId2 = $this->db->lastInsertId();
        
        $stmtUpdateMeta = $this->db->prepare("UPDATE enterprise_posts SET link_metadata_json = ? WHERE id = ?");
        $stmtUpdateMeta->execute([json_encode($linkMeta), $postId2]);

        // Seed reaction and comment for Post 2
        if (!empty($otherUsers)) {
            $stmtReact = $this->db->prepare("INSERT IGNORE INTO enterprise_reactions (tenant_id, ref_type, ref_id, user_id, reaction_type) VALUES (?, 'post', ?, ?, ?)");
            $stmtReact->execute([$tenantId, $postId2, $otherUsers[0], 'like']);
            
            $stmtComment = $this->db->prepare("INSERT INTO enterprise_comments (tenant_id, post_id, user_id, parent_id, content, attachments_json) VALUES (?, ?, ?, NULL, ?, '[]')");
            $stmtComment->execute([$tenantId, $postId2, $otherUsers[0], "Bài viết hay và rất thiết thực. Cảm ơn sếp đã chia sẻ!"]);
        }

        // 4. Insert Post 3 (Photo grid)
        $attachments = [
            'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80',
            'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&auto=format&fit=crop&q=80'
        ];
        $stmtPostPhoto = $this->db->prepare("
            INSERT INTO enterprise_posts (tenant_id, user_id, content, visibility, tags_json, attachments_json, link_metadata_json)
            VALUES (?, ?, ?, 'global', ?, ?, NULL)
        ");
        $stmtPostPhoto->execute([
            $tenantId,
            $userId,
            "Hôm nay đại gia đình Ideas đã hoàn thành cột mốc quan trọng tiếp theo! 🚀 Chúc mừng đội ngũ dự án đã chiến đấu hết mình. Cùng nhau hướng tới những mục tiêu lớn hơn nữa nhé! #celebration #teamwork #success",
            json_encode(["celebration", "teamwork", "success"]),
            json_encode($attachments)
        ]);
        $postId3 = $this->db->lastInsertId();

        // Seed reaction and comment for Post 3
        if (!empty($otherUsers)) {
            $stmtReact = $this->db->prepare("INSERT IGNORE INTO enterprise_reactions (tenant_id, ref_type, ref_id, user_id, reaction_type) VALUES (?, 'post', ?, ?, ?)");
            $stmtReact->execute([$tenantId, $postId3, $otherUsers[0], 'haha']);
            if (isset($otherUsers[1])) {
                $stmtReact->execute([$tenantId, $postId3, $otherUsers[1], 'love']);
            }

            $stmtComment = $this->db->prepare("INSERT INTO enterprise_comments (tenant_id, post_id, user_id, parent_id, content, attachments_json) VALUES (?, ?, ?, NULL, ?, '[]')");
            $stmtComment->execute([$tenantId, $postId3, $otherUsers[0], "Tuyệt vời quá! Chúc mừng team 🍻"]);
        }

        respond(200, null, 'Seed dữ liệu mẫu thành công!');
    }

    public function getHonors($auth) {
        $tenantId = (int)$auth['tenant_id'];
        $currentUserId = (int)$auth['user_id'];

        $stmt = $this->db->prepare("
            SELECT h.*, u.full_name, u.avatar_url, u.role,
                   IFNULL(r.reaction_count, 0) as user_reactions
            FROM enterprise_honors h
            JOIN users u ON h.user_id = u.id
            LEFT JOIN enterprise_honors_reactions r ON h.id = r.honor_id AND r.user_id = ?
            WHERE h.tenant_id = ?
            ORDER BY h.hearts_count DESC, h.created_at DESC
        ");
        $stmt->execute([$currentUserId, $tenantId]);
        $honorsList = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch candidate list (active users) for configurator selection
        $stmtSales = $this->db->prepare("SELECT id, full_name, avatar_url, role FROM users WHERE is_active = 1 ORDER BY full_name ASC");
        $stmtSales->execute();
        $salesList = $stmtSales->fetchAll(PDO::FETCH_ASSOC);

        respond(200, [
            'honors' => $honorsList,
            'candidates' => $salesList
        ], 'Honors data fetched successfully');
    }

    public function saveHonors($auth) {
        if (!in_array($auth['role'], ['superadmin', 'admin', 'super_admin'], true)) {
            respond(403, null, 'Bạn không có quyền thực hiện thao tác này', false);
        }

        $body = getBody();
        $id = isset($body['id']) ? (int)$body['id'] : null;
        $action = isset($body['action']) ? trim($body['action']) : '';
        $tenantId = (int)$auth['tenant_id'];

        if ($action === 'delete') {
            if (!$id) {
                respond(400, null, 'Thiếu ID vinh danh cần xóa', false);
            }

            // Fetch the user_id of this honor before deleting it
            $stmtGet = $this->db->prepare("SELECT user_id FROM enterprise_honors WHERE id = ? AND tenant_id = ?");
            $stmtGet->execute([$id, $tenantId]);
            $honorRow = $stmtGet->fetch(PDO::FETCH_ASSOC);
            if ($honorRow) {
                $userId = (int)$honorRow['user_id'];
                // Remove from user HR records
                $this->removeHonorFromHrRecords($userId, $id);
            }

            $stmt = $this->db->prepare("DELETE FROM enterprise_honors WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$id, $tenantId]);
            respond(200, null, 'Xóa vinh danh thành công!');
        }

        $userId = isset($body['honored_user_id']) ? (int)$body['honored_user_id'] : null;
        $title = isset($body['title']) ? trim($body['title']) : '';
        $badge = isset($body['badge']) ? trim($body['badge']) : '';
        $reason = isset($body['reason']) ? trim($body['reason']) : '';

        if (!$userId || empty($title) || empty($badge) || empty($reason)) {
            respond(400, null, 'Vui lòng điền đầy đủ thông tin vinh danh', false);
        }

        if ($id) {
            $stmt = $this->db->prepare("
                UPDATE enterprise_honors 
                SET user_id = ?, title = ?, badge = ?, reason = ?
                WHERE id = ? AND tenant_id = ?
            ");
            $stmt->execute([$userId, $title, $badge, $reason, $id, $tenantId]);

            // Sync to user HR records
            $this->syncHonorToHrRecords($userId, $id, $badge, $title, $reason);

            respond(200, null, 'Cập nhật vinh danh thành công!');
        } else {
            $stmt = $this->db->prepare("
                INSERT INTO enterprise_honors (tenant_id, user_id, title, badge, reason, hearts_count)
                VALUES (?, ?, ?, ?, ?, 0)
            ");
            $stmt->execute([$tenantId, $userId, $title, $badge, $reason]);
            $honorId = (int)$this->db->lastInsertId();

            // Sync to user HR records
            $this->syncHonorToHrRecords($userId, $honorId, $badge, $title, $reason);

            respond(200, null, 'Thêm vinh danh mới thành công!');
        }
    }

    private function syncHonorToHrRecords($userId, $honorId, $badge, $title, $reason) {
        try {
            $stmtUser = $this->db->prepare("SELECT address FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if ($userRow) {
                $addressJson = $userRow['address'] ?? '';
                $addressData = [];
                if (!empty($addressJson)) {
                    $decoded = json_decode($addressJson, true);
                    if (is_array($decoded)) {
                        $addressData = $decoded;
                    }
                }
                
                if (!isset($addressData['erp_profile']) || !is_array($addressData['erp_profile'])) {
                    $addressData['erp_profile'] = [];
                }
                if (!isset($addressData['erp_profile']['hr_records']) || !is_array($addressData['erp_profile']['hr_records'])) {
                    $addressData['erp_profile']['hr_records'] = [];
                }
                
                $newRecordId = 'honor_' . $honorId;
                $existingRecords = $addressData['erp_profile']['hr_records'];
                $filteredRecords = [];
                foreach ($existingRecords as $rec) {
                    if (isset($rec['id']) && $rec['id'] === $newRecordId) {
                        continue;
                    }
                    $filteredRecords[] = $rec;
                }
                
                $filteredRecords[] = [
                    'id' => $newRecordId,
                    'type' => 'award',
                    'title' => '[Vinh danh] ' . $badge . ' - ' . $title,
                    'date' => date('Y-m-d'),
                    'amount' => '0',
                    'reason' => $reason,
                    'decisionNumber' => 'VD-' . date('Ymd') . '-' . $userId,
                    'documentLink' => ''
                ];
                
                $addressData['erp_profile']['hr_records'] = $filteredRecords;
                $updatedAddressJson = json_encode($addressData, JSON_UNESCAPED_UNICODE);
                
                $stmtUpdateUser = $this->db->prepare("UPDATE users SET address = ? WHERE id = ?");
                $stmtUpdateUser->execute([$updatedAddressJson, $userId]);
            }
        } catch (Exception $e) {
            error_log("Failed to sync honor to user HR records: " . $e->getMessage());
        }
    }

    private function removeHonorFromHrRecords($userId, $honorId) {
        try {
            $stmtUser = $this->db->prepare("SELECT address FROM users WHERE id = ?");
            $stmtUser->execute([$userId]);
            $userRow = $stmtUser->fetch(PDO::FETCH_ASSOC);
            if ($userRow) {
                $addressJson = $userRow['address'] ?? '';
                if (!empty($addressJson)) {
                    $addressData = json_decode($addressJson, true);
                    if (is_array($addressData) && isset($addressData['erp_profile']['hr_records']) && is_array($addressData['erp_profile']['hr_records'])) {
                        $targetRecordId = 'honor_' . $honorId;
                        $existingRecords = $addressData['erp_profile']['hr_records'];
                        $filteredRecords = [];
                        foreach ($existingRecords as $rec) {
                            if (isset($rec['id']) && $rec['id'] === $targetRecordId) {
                                continue;
                            }
                            $filteredRecords[] = $rec;
                        }
                        $addressData['erp_profile']['hr_records'] = $filteredRecords;
                        $updatedAddressJson = json_encode($addressData, JSON_UNESCAPED_UNICODE);
                        
                        $stmtUpdateUser = $this->db->prepare("UPDATE users SET address = ? WHERE id = ?");
                        $stmtUpdateUser->execute([$updatedAddressJson, $userId]);
                    }
                }
            }
        } catch (Exception $e) {
            error_log("Failed to remove honor from user HR records: " . $e->getMessage());
        }
    }

    public function heartHonor($auth, $id) {
        $tenantId = (int)$auth['tenant_id'];
        $currentUserId = (int)$auth['user_id'];

        // 1. Check if user already clapped 10 times for this card
        $stmtCheck = $this->db->prepare("
            SELECT reaction_count 
            FROM enterprise_honors_reactions 
            WHERE honor_id = ? AND user_id = ?
        ");
        $stmtCheck->execute([$id, $currentUserId]);
        $currentReactions = (int)($stmtCheck->fetchColumn() ?: 0);

        if ($currentReactions >= 10) {
            respond(400, null, 'Bạn đã thả tối đa 10 nhiệt cho thẻ vinh danh này rồi!', false);
        }

        // 2. Increment user reaction count
        $stmtUpsert = $this->db->prepare("
            INSERT INTO enterprise_honors_reactions (honor_id, user_id, reaction_count)
            VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE reaction_count = reaction_count + 1
        ");
        $stmtUpsert->execute([$id, $currentUserId]);

        // 3. Increment the global count on the honor card
        $stmtUpdate = $this->db->prepare("
            UPDATE enterprise_honors 
            SET hearts_count = hearts_count + 1 
            WHERE id = ? AND tenant_id = ?
        ");
        $stmtUpdate->execute([$id, $tenantId]);

        // 4. Fetch the updated count
        $stmtCount = $this->db->prepare("SELECT hearts_count FROM enterprise_honors WHERE id = ? AND tenant_id = ?");
        $stmtCount->execute([$id, $tenantId]);
        $newCount = (int)$stmtCount->fetchColumn();

        respond(200, [
            'hearts_count' => $newCount,
            'user_reactions' => $currentReactions + 1
        ], 'Đã thả tim đẩy nhiệt thành công!');
    }

    private function processMentionsAndNotify(array $auth, string $content, int $postId, ?int $commentId = null): void {
        $tenantId = (int)$auth['tenant_id'];
        $currentUserId = (int)$auth['user_id'];
        $authorName = $auth['full_name'] ?? 'Đồng nghiệp';

        $mentions = [];

        // 1. First, parse by data-user-id (HTML editor mentions)
        if (preg_match_all('/data-user-id=(?:&quot;|["\']|\\\\+["\'])?(\d+)/i', (string)$content, $matchesId)) {
            $uids = array_filter(array_map('intval', $matchesId[1]));
            foreach ($uids as $uid) {
                if ($uid && (int)$uid !== $currentUserId) {
                    $mentions[] = (int)$uid;
                }
            }
        }

        // 2. Fallback to @[Name_With_Underscores] or similar
        $matches = [];
        preg_match_all('/@([a-zA-Z0-9_\x{00C0}-\x{1EF9}()\s]+?)(?:<\/span>|<br|\n|$)/u', $content, $matches);
        $names = is_array($matches[1] ?? null) ? $matches[1] : [];
        if (!empty($names)) {
            foreach ($names as $nameWithUnderscores) {
                $nameWithUnderscores = trim(strip_tags($nameWithUnderscores));
                if (empty($nameWithUnderscores)) continue;
                $fullName = str_replace('_', ' ', $nameWithUnderscores);
                $stmt = $this->db->prepare("SELECT id FROM users WHERE (full_name=? OR REPLACE(full_name, ' ', '_')=?)");
                $stmt->execute([$fullName, $nameWithUnderscores]);
                $uid = $stmt->fetchColumn();
                if ($uid && (int)$uid !== $currentUserId) $mentions[] = (int)$uid;
            }
        }
        $mentions = array_unique($mentions);
        // Exclude self-mention
        $mentions = array_filter($mentions, function($uid) use ($currentUserId) {
            return (int)$uid !== $currentUserId;
        });

        if (!empty($mentions)) {
            require_once __DIR__ . '/../NotificationService.php';
            foreach ($mentions as $uid) {
                $uid = (int)$uid;
                $link = "/feed?post_id={$postId}" . ($commentId ? "&open_comment={$commentId}" : "");
                
                NotificationService::send($this->db, $tenantId, 'MENTION_TAGGED', [
                    'user_id' => $uid,
                    'author_name' => $authorName,
                    'comment' => $content,
                    'link' => $link
                ]);
            }
        }
    }

    public function getReactions(array $auth, int $id): void {
        $tenantId = (int)$auth['tenant_id'];

        $stmt = $this->db->prepare("
            SELECT r.reaction_type, u.full_name, u.avatar_url, u.role
            FROM enterprise_reactions r
            JOIN users u ON r.user_id = u.id
            WHERE r.ref_type = 'post' AND r.ref_id = ? AND r.tenant_id = ?
            ORDER BY r.id DESC
        ");
        $stmt->execute([$id, $tenantId]);
        $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

        respond(200, ['reactions' => $list]);
    }
}
