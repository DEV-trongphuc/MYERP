<?php
/**
 * tests/e2e/helpers/WorkerInvoker.php
 *
 * Real CLI Background Worker Invoker for MYERP Marketing Automation
 * Executes real PHP CLI background workers via proc_open() with genuine pipes.
 * Zero JavaScript mocks, zero facade simulations.
 */

namespace MYERP\Tests\E2E\Helpers;

use RuntimeException;

class WorkerInvoker {
    private string $phpBin;
    private string $automationDir;

    public function __construct(?string $phpBin = null, ?string $automationDir = null) {
        $this->phpBin = $phpBin ?: $this->detectPhpBinary();
        $this->automationDir = $automationDir ?: (dirname(__DIR__, 3) . '/backend/automation');

        if (!is_dir($this->automationDir)) {
            throw new RuntimeException("Automation directory does not exist: {$this->automationDir}");
        }
    }

    private function detectPhpBinary(): string {
        if (defined('PHP_BINARY') && is_executable(PHP_BINARY)) {
            return PHP_BINARY;
        }

        $candidates = array_filter([
            getenv('PHP_BIN') ?: null,
            'php.exe',
            'php'
        ]);

        foreach ($candidates as $cand) {
            if (is_executable($cand)) {
                return $cand;
            }
        }

        return 'php';
    }

    /**
     * Executes a background CLI worker via proc_open().
     */
    public function runWorker(string $script, array $args = [], int $timeout = 15): array {
        $scriptPath = $this->automationDir . '/' . ltrim($script, '/');
        if (!file_exists($scriptPath)) {
            throw new RuntimeException("Worker script not found: {$scriptPath}");
        }

        $argStrings = [];
        foreach ($args as $k => $v) {
            if (is_int($k)) {
                $argStrings[] = escapeshellarg((string)$v);
            } else {
                $argStrings[] = sprintf('--%s=%s', $k, escapeshellarg((string)$v));
            }
        }

        $cmd = sprintf('"%s" "%s" %s', $this->phpBin, $scriptPath, implode(' ', $argStrings));

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w']
        ];

        $env = array_merge($_ENV, getenv(), [
            'DB_HOST' => '127.0.0.1',
            'APP_ENV' => 'development'
        ]);

        $startTime = microtime(true);
        $proc = proc_open($cmd, $descriptors, $pipes, $this->automationDir, $env);

        if (!is_resource($proc)) {
            throw new RuntimeException("Failed to spawn worker process: {$cmd}");
        }

        // Close stdin immediately
        fclose($pipes[0]);

        // Non-blocking reads with timeout
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdout = '';
        $stderr = '';
        $timeoutMicro = $timeout * 1000000;
        $elapsedMicro = 0;
        $stepMicro = 20000; // 20ms

        while (true) {
            $readOut = stream_get_contents($pipes[1]);
            if ($readOut !== false) {
                $stdout .= $readOut;
            }

            $readErr = stream_get_contents($pipes[2]);
            if ($readErr !== false) {
                $stderr .= $readErr;
            }

            $status = proc_get_status($proc);
            if (!$status['running']) {
                break;
            }

            if ($elapsedMicro >= $timeoutMicro) {
                proc_terminate($proc);
                throw new RuntimeException("Worker execution timed out after {$timeout}s: {$cmd}");
            }

            usleep($stepMicro);
            $elapsedMicro += $stepMicro;
        }

        $remOut = stream_get_contents($pipes[1]);
        if ($remOut !== false) $stdout .= $remOut;
        fclose($pipes[1]);

        $remErr = stream_get_contents($pipes[2]);
        if ($remErr !== false) $stderr .= $remErr;
        fclose($pipes[2]);

        $exitCode = proc_close($proc);
        $durationMs = round((microtime(true) - $startTime) * 1000, 2);

        return [
            'exit_code'   => $exitCode,
            'stdout'      => trim($stdout),
            'stderr'      => trim($stderr),
            'duration_ms' => $durationMs
        ];
    }

    public function runSegmentCountsWorker(array $args = [], int $timeout = 15): array {
        return $this->runWorker('worker_segment_counts.php', $args, $timeout);
    }

    public function runSegmentNotifyWorker(array $args = [], int $timeout = 15): array {
        return $this->runWorker('worker_segment_notify.php', $args, $timeout);
    }

    public function runFlowWorker(array $args = [], int $timeout = 15): array {
        if (!isset($args['workspace_id'])) {
            $args['workspace_id'] = TestDatabase::TEST_WORKSPACE_ID;
        }
        return $this->runWorker('worker_flow.php', $args, $timeout);
    }

    public function runPriorityWorker(array $args = [], int $timeout = 15): array {
        if (!isset($args['workspace_id'])) {
            $args['workspace_id'] = TestDatabase::TEST_WORKSPACE_ID;
        }
        return $this->runWorker('worker_priority.php', $args, $timeout);
    }

    public function runTrackingAggregatorWorker(array $args = [], int $timeout = 15): array {
        return $this->runWorker('worker_tracking_aggregator.php', $args, $timeout);
    }
}
