<?php
// api/health_check.php
require_once 'db_connect.php';

// 1. Initial response structure
$healthData = [
    'timestamp' => date('Y-m-d H:i:s'),
    'system_checks' => [],
    'api_files' => [],
    'php_extensions' => [],
];

// 2. Check Database Connection
try {
    if (isset($pdo)) {
        $stmt = $pdo->query("SELECT 1");
        $healthData['system_checks']['database'] = [
            'status' => 'OK',
            'message' => 'Connected successfully and responded to query.'
        ];
    } else {
        $healthData['system_checks']['database'] = [
            'status' => 'ERROR',
            'message' => 'PDO connection variable ($pdo) not set.'
        ];
    }
} catch (Exception $e) {
    $healthData['system_checks']['database'] = [
        'status' => 'ERROR',
        'message' => 'Connection failed: ' . $e->getMessage()
    ];
}

// 3. Check Critical API Files
$critical_files = [
    'subscribers.php',
    'segments.php',
    'flows.php',
    'campaigns.php',
    'lists.php',
    'tags.php',
    'forms.php',
    'settings.php',
    'worker_priority.php',
    'worker_flow.php',
    'worker_campaign.php',
    'worker_enroll.php',
    'worker_reminder.php',
    'webhook.php',
    'segment_helper.php',
    'flow_helpers.php',
    'zalo_helpers.php',
    'zalo_oa.php'
];

foreach ($critical_files as $file) {
    $exists = file_exists($file);
    $healthData['api_files'][$file] = [
        'status' => $exists ? 'OK' : 'MISSING',
        'message' => $exists ? 'File is present.' : 'File not found on server.'
    ];
}

// 4. Check PHP Extensions
$required_extensions = ['pdo_mysql', 'curl', 'json', 'mbstring', 'openssl'];
foreach ($required_extensions as $ext) {
    $loaded = extension_loaded($ext);
    $healthData['php_extensions'][$ext] = [
        'status' => $loaded ? 'OK' : 'MISSING',
        'message' => $loaded ? 'Extension is loaded.' : 'Required PHP extension is not installed.'
    ];
}

// 5. Directory Write Permissions
$directories_to_check = ['../uploads', '../logs'];
foreach ($directories_to_check as $dir) {
    $real_path = realpath(__DIR__ . '/' . $dir);
    if ($real_path && is_dir($real_path)) {
        $writable = is_writable($real_path);
        $healthData['system_checks']['dir_' . basename($dir)] = [
            'status' => $writable ? 'OK' : 'WARNING',
            'message' => $writable ? 'Directory is writable.' : 'Directory exists but is not writable.'
        ];
    }
}

// Final output using standard helper
jsonResponse(true, $healthData);
