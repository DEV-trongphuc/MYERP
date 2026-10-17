<?php
require_once "db_connect.php";
require_once 'auth_middleware.php';
apiHeaders();

function checkConnections($pdo) {
    // Default optimistic / fallback states
    $status = [
        "smtp" => true,
        "zalo" => true,
        "meta" => true,
        "api" => true,
        "tracking" => true,
        "ai" => true
    ];

    try {
        $stmt = $pdo->query("SELECT `key`, `value` FROM mkt_system_settings");
        $settings = [];
        foreach ($stmt->fetchAll() as $row) {
            $settings[$row["key"]] = $row["value"];
        }

        // Apply real validation if we can
        if (isset($settings["smtp_enabled"]) && $settings["smtp_enabled"] == "0") {
             $status["smtp"] = false;
        }
        
        if (isset($settings["zalo_access_token"]) && empty($settings["zalo_access_token"])) {
             $status["zalo"] = false;
        }

        if (isset($settings["meta_access_token"]) && empty($settings["meta_access_token"])) {
             $status["meta"] = false;
        }

        if (isset($settings["gemini_api_key"]) && empty($settings["gemini_api_key"])) {
             $status["ai"] = false;
        }

        // Forms and APIs are active if there are webhooks/events or forms defined
        try {
            $rs1 = (int)$pdo->query("SELECT count(*) FROM custom_events")->fetchColumn();
            $rs2 = (int)$pdo->query("SELECT count(*) FROM forms")->fetchColumn();
            if ($rs1 == 0 && $rs2 == 0) {
                $status["api"] = false;
            } else {
                $status["api"] = true;
            }
        } catch(Exception $e) {}

        // Analytics active if logs exist
        try {
            $rs = (int)$pdo->query("SELECT count(*) FROM mail_delivery_logs")->fetchColumn();
            if ($rs == 0) $status["tracking"] = false; else $status["tracking"] = true;
        } catch(Exception $e) {}

    } catch(Exception $e) {}

    return $status;
}

if ($_SERVER["REQUEST_METHOD"] === "GET") {
    jsonResponse(true, checkConnections($pdo));
}
