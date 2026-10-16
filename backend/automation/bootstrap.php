<?php
/**
 * api/bootstrap.php - Centralized API Initializer
 * Version: 1.0.0
 * 
 * This file centralizes configuration, shared helpers, and optimized 
 * system integrity checks to improve overall backend performance.
 */

require_once 'db_connect.php';
require_once 'auth_middleware.php';
require_once 'flow_helpers.php';
require_once 'segment_helper.php';

// Set common headers
apiHeaders();
date_default_timezone_set('Asia/Ho_Chi_Minh');

/**
 * Deprecated: System Initialization / Migration check.
 * Migration is now handled asynchronously via run_migrations.php.
 */
function initializeSystem($pdo)
{
    // No-op. Migration checks are deferred to run_migrations.php.
}
