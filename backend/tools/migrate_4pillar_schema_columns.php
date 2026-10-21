<?php
/**
 * Idempotent Non-Destructive Schema Evolution for 4-Pillar DB/SQL/API Parity
 */
declare(strict_types=1);

$columnsToAdd = array (
  'contacts' => 
  array (
    'assigned_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
    'is_error_ticket' => 
    array (
      'type' => 'tinyint',
      'nullable' => false,
      'ddl' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ),
  ),
  'users' => 
  array (
    'google_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(128) NULL DEFAULT NULL',
    ),
  ),
  'consultants' => 
  array (
    'bio' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'username' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(100) NULL DEFAULT NULL',
    ),
  ),
  'chat_conversations' => 
  array (
    'deleted_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
  ),
  'chat_messages' => 
  array (
    'is_deleted' => 
    array (
      'type' => 'tinyint',
      'nullable' => false,
      'ddl' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ),
  ),
  'marketing_campaigns' => 
  array (
    'expected_budget' => 
    array (
      'type' => 'decimal',
      'nullable' => false,
      'ddl' => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
    ),
    'budget' => 
    array (
      'type' => 'decimal',
      'nullable' => false,
      'ddl' => 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
    ),
  ),
  'sales_orders' => 
  array (
    'tax_percent' => 
    array (
      'type' => 'decimal',
      'nullable' => false,
      'ddl' => 'DECIMAL(5,2) NOT NULL DEFAULT 0.00',
    ),
  ),
  'voucher_campaigns' => 
  array (
    'total_codes' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NOT NULL DEFAULT 0',
    ),
    'claimed_count' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NOT NULL DEFAULT 0',
    ),
  ),
  'voucher_codes' => 
  array (
    'distributed_to_subscriber_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'distributed_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
  ),
  'ai_query_audit_logs' => 
  array (
    'channel_id' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NOT NULL DEFAULT 0',
    ),
    'detected_agents' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'tools_called' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'rag_articles_count' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NOT NULL DEFAULT 0',
    ),
    'gap_reason' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(255) NULL DEFAULT NULL',
    ),
    'response_preview' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'latency_ms' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NOT NULL DEFAULT 0',
    ),
  ),
  'subscribers' => 
  array (
    'temperature' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(32) NULL DEFAULT \'warm\'',
    ),
    'last_send_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
  ),
  'subscriber_activity' => 
  array (
    'action_type' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(100) NULL DEFAULT NULL',
    ),
    'target_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(100) NULL DEFAULT NULL',
    ),
    'target_name' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(255) NULL DEFAULT NULL',
    ),
    'extra_data' => 
    array (
      'type' => 'longtext',
      'nullable' => true,
      'ddl' => 'LONGTEXT NULL',
    ),
  ),
  'zalo_message_queue' => 
  array (
    'message_text' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'processed' => 
    array (
      'type' => 'tinyint',
      'nullable' => false,
      'ddl' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ),
  ),
  'zalo_broadcast_tracking' => 
  array (
    'zalo_msg_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(128) NULL DEFAULT NULL',
    ),
    'seen_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
    'reacted_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
  ),
  'zalo_automation_scenarios' => 
  array (
    'oa_config_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'type' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(50) NULL DEFAULT \'keyword\'',
    ),
    'trigger_text' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'status' => 
    array (
      'type' => 'varchar',
      'nullable' => false,
      'ddl' => 'VARCHAR(32) NOT NULL DEFAULT \'active\'',
    ),
    'buttons' => 
    array (
      'type' => 'longtext',
      'nullable' => true,
      'ddl' => 'LONGTEXT NULL',
    ),
    'ai_chatbot_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'title' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(255) NULL DEFAULT NULL',
    ),
    'content' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
  ),
  'meta_automation_scenarios' => 
  array (
    'meta_config_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'type' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(50) NULL DEFAULT \'keyword\'',
    ),
    'trigger_text' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'status' => 
    array (
      'type' => 'varchar',
      'nullable' => false,
      'ddl' => 'VARCHAR(32) NOT NULL DEFAULT \'active\'',
    ),
    'buttons' => 
    array (
      'type' => 'longtext',
      'nullable' => true,
      'ddl' => 'LONGTEXT NULL',
    ),
    'ai_chatbot_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
  ),
  'raw_event_buffer' => 
  array (
    'type' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(50) NULL DEFAULT NULL',
    ),
  ),
  'queue_throttle' => 
  array (
    'throttle_key' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(191) NULL DEFAULT NULL',
    ),
    'created_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP',
    ),
  ),
  'api_rate_limits' => 
  array (
    'action' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(100) NULL DEFAULT NULL',
    ),
    'attempts' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NOT NULL DEFAULT 1',
    ),
    'last_attempt_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP',
    ),
    'blocked_until' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
  ),
  'api_tokens' => 
  array (
    'scope' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(100) NULL DEFAULT \'all\'',
    ),
    'is_active' => 
    array (
      'type' => 'tinyint',
      'nullable' => false,
      'ddl' => 'TINYINT(1) NOT NULL DEFAULT 1',
    ),
    'expires_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
  ),
  'user_access_logs' => 
  array (
    'device' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(255) NULL DEFAULT NULL',
    ),
  ),
  'global_assets' => 
  array (
    'unique_name' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(255) NULL DEFAULT NULL',
    ),
    'extension' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(32) NULL DEFAULT NULL',
    ),
    'source' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'property_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'conversation_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'admin_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'is_deleted' => 
    array (
      'type' => 'tinyint',
      'nullable' => false,
      'ddl' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ),
  ),
  'ai_workspace_files' => 
  array (
    'conversation_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'property_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'admin_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'file_name' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(255) NULL DEFAULT NULL',
    ),
    'file_type' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(100) NULL DEFAULT NULL',
    ),
    'file_size' => 
    array (
      'type' => 'bigint',
      'nullable' => true,
      'ddl' => 'BIGINT NULL DEFAULT 0',
    ),
    'file_url' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'source' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
  ),
  'ai_org_conversations' => 
  array (
    'visitor_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(128) NULL DEFAULT NULL',
    ),
    'property_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'status' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(32) NULL DEFAULT \'active\'',
    ),
    'summary' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'is_public' => 
    array (
      'type' => 'tinyint',
      'nullable' => false,
      'ddl' => 'TINYINT(1) NOT NULL DEFAULT 0',
    ),
  ),
  'ai_org_messages' => 
  array (
    'model' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(100) NULL DEFAULT NULL',
    ),
    'processing_time' => 
    array (
      'type' => 'float',
      'nullable' => true,
      'ddl' => 'FLOAT NULL DEFAULT 0',
    ),
  ),
  'ai_org_access_tokens' => 
  array (
    'is_active' => 
    array (
      'type' => 'tinyint',
      'nullable' => false,
      'ddl' => 'TINYINT(1) NOT NULL DEFAULT 1',
    ),
    'last_used_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
  ),
  'ai_org_refresh_tokens' => 
  array (
    'is_active' => 
    array (
      'type' => 'tinyint',
      'nullable' => false,
      'ddl' => 'TINYINT(1) NOT NULL DEFAULT 1',
    ),
    'device_info' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(255) NULL DEFAULT NULL',
    ),
    'ip_address' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'last_used_at' => 
    array (
      'type' => 'datetime',
      'nullable' => true,
      'ddl' => 'DATETIME NULL DEFAULT NULL',
    ),
  ),
  'ai_org_users' => 
  array (
    'phone' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(50) NULL DEFAULT NULL',
    ),
  ),
  'ai_feedback' => 
  array (
    'org_user_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'category_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'type' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(50) NULL DEFAULT NULL',
    ),
    'title' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(255) NULL DEFAULT NULL',
    ),
    'description' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'screenshot_url' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'page_url' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
    'user_agent' => 
    array (
      'type' => 'text',
      'nullable' => true,
      'ddl' => 'TEXT NULL',
    ),
  ),
  'ai_vector_cache' => 
  array (
    'vector_binary' => 
    array (
      'type' => 'longblob',
      'nullable' => true,
      'ddl' => 'LONGBLOB NULL',
    ),
  ),
  'ai_rag_search_cache' => 
  array (
    'property_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
  ),
  'ai_pdf_chunk_results' => 
  array (
    'page_start' => 
    array (
      'type' => 'int',
      'nullable' => true,
      'ddl' => 'INT NULL DEFAULT NULL',
    ),
    'page_end' => 
    array (
      'type' => 'int',
      'nullable' => true,
      'ddl' => 'INT NULL DEFAULT NULL',
    ),
    'chapters_json' => 
    array (
      'type' => 'longtext',
      'nullable' => true,
      'ddl' => 'LONGTEXT NULL',
    ),
  ),
  'ai_term_stats' => 
  array (
    'df' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NOT NULL DEFAULT 1',
    ),
  ),
  'ai_suggested_links' => 
  array (
    'source_url' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(500) NULL DEFAULT NULL',
    ),
  ),
  'admin_logs' => 
  array (
    'admin_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'target_type' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
    'target_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
  ),
  'flow_event_queue' => 
  array (
    'flow_id' => 
    array (
      'type' => 'varchar',
      'nullable' => true,
      'ddl' => 'VARCHAR(64) NULL DEFAULT NULL',
    ),
  ),
  'segment_count_update_queue' => 
  array (
    'criteria' => 
    array (
      'type' => 'longtext',
      'nullable' => true,
      'ddl' => 'LONGTEXT NULL',
    ),
  ),
  'workspace_users' => 
  array (
    'id' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NULL DEFAULT NULL',
    ),
    'role_id' => 
    array (
      'type' => 'int',
      'nullable' => false,
      'ddl' => 'INT NOT NULL DEFAULT 2',
    ),
  ),
);

function migrateDatabase(string $envFile): array {
    $env = [];
    if (file_exists($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
            [$k, $v] = explode('=', $line, 2);
            $env[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
        }
    }
    $dbName = $env['DB_NAME'] ?? 'vhvxoigh_myerp';
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $env['DB_HOST'] ?? 'localhost', $dbName);
    $pdo = new PDO($dsn, $env['DB_USER'] ?? 'root', $env['DB_PASS'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    global $columnsToAdd;
    $applied = [];
    $skipped = 0;

    foreach ($columnsToAdd as $table => $cols) {
        // Check if table exists and is BASE TABLE (not VIEW)
        $stmtT = $pdo->prepare("SELECT TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?");
        $stmtT->execute([$dbName, $table]);
        $tType = $stmtT->fetchColumn();
        if (!$tType || $tType === 'VIEW') {
            continue;
        }

        foreach ($cols as $col => $meta) {
            $stmtC = $pdo->prepare("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?");
            $stmtC->execute([$dbName, $table, $col]);
            if ($stmtC->fetchColumn()) {
                $skipped++;
                continue;
            }
            try {
                $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$meta['ddl']}");
                $applied[] = "{$table}.{$col}";
            } catch (\Throwable $e) {
                $applied[] = "WARN {$table}.{$col}: " . $e->getMessage();
            }
        }
    }

    return [
        'db' => $dbName,
        'applied_count' => count($applied),
        'skipped_existing' => $skipped,
        'applied' => $applied,
    ];
}

$results = [];
foreach ([
    'production' => '/home/vhvxoigh/myerp.ideas.edu.vn/backend/.env',
    'staging' => '/home/vhvxoigh/myerp-stagging.ideas.edu.vn/backend/.env',
] as $envName => $path) {
    if (file_exists($path)) {
        $results[$envName] = migrateDatabase($path);
    }
}
echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;