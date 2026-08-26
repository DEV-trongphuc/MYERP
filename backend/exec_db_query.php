<?php
// backend/exec_db_query.php
// File truy vấn database toàn quyền cho agent và admin đối soát

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db_connect.php';

if (php_sapi_name() === 'cli' && isset($argv)) {
    $cliArgs = array_slice($argv, 1);
    for ($i = 0; $i < count($cliArgs); $i++) {
        $arg = $cliArgs[$i];
        if (strpos($arg, '--key=') === 0) {
            $_REQUEST['key'] = substr($arg, 6);
        } else if (strpos($arg, '--sql=') === 0) {
            $_REQUEST['sql'] = substr(implode(' ', array_slice($cliArgs, $i)), 6);
            break;
        } else {
            parse_str($arg, $parsed);
            $_REQUEST = array_merge($_REQUEST, $parsed);
        }
    }
}

$secretKey = $_REQUEST['key'] ?? '';
// Secret key bảo mật: key=Ideas2026
if ($secretKey !== 'Ideas2026') {
    http_response_code(403);
    echo json_encode(["error" => "Unauthorized. Invalid secret key."]);
    exit;
}

$sql = trim(trim($_REQUEST['sql'] ?? ''), "\"'");
if (isset($_REQUEST['read_file']) && $_REQUEST['read_file'] == '1') {
    $filePath = __DIR__ . '/controllers/HRMController.php';
    if (file_exists($filePath)) {
        $lines = file($filePath);
        $start = 980;
        $end = 1010;
        $output = [];
        for ($i = $start - 1; $i < min($end, count($lines)); $i++) {
            $output[] = ($i + 1) . ": " . $lines[$i];
        }
        echo json_encode(["status" => "success", "file" => $filePath, "lines" => $output]);
    } else {
        echo json_encode(["error" => "File not found: " . $filePath]);
    }
    exit;
}

if (empty($sql)) {
    echo json_encode(["error" => "No SQL query provided. Pass 'sql' parameter."]);
    exit;
}

try {
    $stmt = $conn->query($sql);
    if ($stmt === true) {
        echo json_encode(["status" => "success", "affected_rows" => $conn->affected_rows]);
    } else if ($stmt instanceof mysqli_result) {
        $rows = [];
        while ($row = $stmt->fetch_assoc()) {
            $rows[] = $row;
        }
        echo json_encode([
            "status" => "success",
            "count" => count($rows),
            "data" => $rows
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(["status" => "success"]);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
