<?php
// api/WorkerTriggerService.php

class WorkerTriggerService
{
    private $pdo;
    private $apiBaseUrl;

    public function __construct($pdo, $apiBaseUrl)
    {
        $this->pdo = $pdo;
        $this->apiBaseUrl = $apiBaseUrl;
    }

    /**
     * Centrally trigger the worker asynchronously.
     */
    public function trigger($urlPath = '/worker_queue.php')
    {
        $hasPriority = (strpos($urlPath, '?') !== false);

        // [PERF] Queue Throttling: Prevent triggering more than once every 1 second for standard queue
        // Bypass for priority jobs (subscriber specific)
        if (!$hasPriority && $this->isThrottled()) {
            return false;
        }

        $url = rtrim($this->apiBaseUrl, '/') . $urlPath;

        // Log trigger attempt for debugging
        $this->log("Triggering worker: $url");

        return $this->executeTrigger($url, $hasPriority);
    }

    private function isThrottled()
    {
        $throttleKey = 'last_worker_trigger';
        $now = time();

        // Try APCu first (fastest)
        if (function_exists('apcu_fetch') && function_exists('apcu_store')) {
            $lastTrigger = apcu_fetch($throttleKey);
            if ($lastTrigger && ($now - $lastTrigger) < 1) {
                return true;
            }
            apcu_store($throttleKey, $now, 2);
            return false;
        }

        // Fallback to file-based lock
        // [FIX] Use __DIR__ instead of sys_get_temp_dir().
        // sys_get_temp_dir() can be isolated per PHP-FPM pool on some hosts,
        // causing the lock to vanish and allowing duplicate worker triggers.
        // __DIR__ (the api/ folder) is always consistent across all pools.
        $lockFile = __DIR__ . '/worker_trigger.lock';
        if (file_exists($lockFile)) {
            $lastTrigger = @file_get_contents($lockFile);
            if ($lastTrigger && ($now - (int) $lastTrigger) < 1) {
                return true;
            }
        }
        @file_put_contents($lockFile, $now);
        return false;

    }

    private function executeTrigger($url, $hasPriority = false)
    {
        // Check if a worker is already running (avoid stacking workers that each sleep())
        // PRIORITY JOBS (with query params) bypass this lock to prevent system-wide hangs
        $workerLock = __DIR__ . '/worker_running.lock';
        if (!$hasPriority && file_exists($workerLock)) {
            $lockAge = time() - (int) @file_get_contents($workerLock);
            if ($lockAge < 300) { // Worker considered alive for up to 5 minutes
                $this->log("Worker already running (lock age={$lockAge}s). Skipping trigger for non-priority job.");
                return false;
            }
        }

        $parts = parse_url($url);
        $host = $parts['host'] ?? 'localhost';
        $scheme = $parts['scheme'] ?? 'http';
        $port = isset($parts['port']) ? $parts['port'] : ($scheme === 'https' ? 443 : 80);
        $path = $parts['path'] ?? '/';
        $query = isset($parts['query']) ? '?' . $parts['query'] : '';
        $cronSecret = getenv('CRON_SECRET') ?: 'autoflow_cron_2026';

        // Method 1: fsockopen TRUE fire-and-forget
        // Key: set stream non-blocking + zero timeout, write request, close immediately
        $target = ($scheme === 'https' ? "ssl://$host" : $host);
        $fp = @fsockopen($target, $port, $errno, $errstr, 2);
        if ($fp) {
            stream_set_blocking($fp, false);   // ← non-blocking
            stream_set_timeout($fp, 0);        // ← zero read timeout
            $req = "GET {$path}{$query} HTTP/1.1\r\n";
            $req .= "Host: {$host}\r\n";
            $req .= "X-Cron-Secret: {$cronSecret}\r\n";
            $req .= "Connection: Close\r\n\r\n";
            @fwrite($fp, $req);
            @fclose($fp);                      // ← close WITHOUT reading response
            $this->log("Triggered via fsockopen (non-blocking): $url");
            return true;
        }

        // Method 2: cURL detached background process
        if (function_exists('exec')) {
            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                @pclose(@popen("start /B curl -s -H \"X-Cron-Secret: {$cronSecret}\" --max-time 300 \"$url\" > NUL 2>&1", "r"));
            } else {
                @exec("curl -s -H \"X-Cron-Secret: {$cronSecret}\" --max-time 300 \"$url\" > /dev/null 2>&1 &");
            }
            $this->log("Triggered via exec curl background: $url");
            return true;
        }

        // Method 3: cURL with CURLOPT_TIMEOUT_MS = 100 (send & abandon)
        // [NOTE] This is an internal self-trigger (localhost/same-domain).
        // SSL peer verify is set to false intentionally for the 100ms fire-and-forget pattern
        // where we abandon the connection before a full TLS handshake could complete.
        // The URL originates from $this->apiBaseUrl (server config, not user input) — no injection risk.
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
            curl_setopt($ch, CURLOPT_NOBODY, false);
            curl_setopt($ch, CURLOPT_TIMEOUT_MS, 100);  // 100ms — just enough to send
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Internal self-trigger: no peer cert needed
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);     // Internal self-trigger: no hostname check
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Connection: Close', "X-Cron-Secret: {$cronSecret}"]);
            @curl_exec($ch); // Will timeout but request is already sent
            curl_close($ch);
            $this->log("Triggered via curl (100ms timeout abandon): $url");
            return true;
        }

        return false;
    }

    private function log($message)
    {
        // Simple file logging for worker triggers
        $logFile = __DIR__ . '/_debug/worker_trigger.log';
        if (!is_dir(dirname($logFile))) {
            @mkdir(dirname($logFile), 0777, true);
        }
        @file_put_contents($logFile, date('[Y-m-d H:i:s] ') . $message . "\n", FILE_APPEND);
    }
}
