<?php
/**
 * tests/e2e/helpers/Assertions.php
 *
 * Anti-Tautology Assertion Library for MYERP Marketing Automation E2E
 * Strict compliance with HIẾN CHƯƠNG KIẾN TRÚC HỆ THỐNG LỚN (AGENTS.md):
 * - Axiom 1: Empirical Ground Truth (inspects live output/DB)
 * - Axiom 2: Zero Fake Data / Zero Mock
 * - Failure Sensitivity: Any defect or divergence immediately throws an Exception
 */

namespace MYERP\Tests\E2E\Helpers;

use PDO;
use Exception;
use RuntimeException;

class Assertions {
    private static int $assertionCount = 0;

    public static function getAssertionCount(): int {
        return self::$assertionCount;
    }

    public static function resetAssertionCount(): void {
        self::$assertionCount = 0;
    }

    public static function incrementAssertionCount(): void {
        self::$assertionCount++;
    }

    /**
     * Asserts that HTTP status code matches expected.
     */
    public static function assertHttpStatus(int $expected, int $actual, string $message = ''): void {
        self::$assertionCount++;
        if ($expected !== $actual) {
            $msg = $message ?: "Failed asserting HTTP status code. Expected {$expected}, got {$actual}.";
            throw new RuntimeException($msg);
        }
    }

    /**
     * Asserts that a response header exists and matches expected value or pattern.
     */
    public static function assertHeader(string $expectedHeader, string $expectedValue, array $headers, string $message = ''): void {
        self::$assertionCount++;
        $normalizedHeaders = [];
        foreach ($headers as $k => $v) {
            $normalizedHeaders[strtolower(trim($k))] = trim(is_array($v) ? implode(', ', $v) : (string)$v);
        }
        $target = strtolower(trim($expectedHeader));
        if (!isset($normalizedHeaders[$target])) {
            throw new RuntimeException($message ?: "Failed asserting that header '{$expectedHeader}' exists in response.");
        }
        if (stripos($normalizedHeaders[$target], $expectedValue) === false) {
            throw new RuntimeException($message ?: "Failed asserting header '{$expectedHeader}' contains '{$expectedValue}'. Actual: '{$normalizedHeaders[$target]}'.");
        }
    }

    /**
     * Asserts that binary payload matches exact byte length and magic header.
     */
    public static function assertBinaryPayload(string $binaryData, int $expectedBytes, string $magicHeader = '', string $message = ''): void {
        self::$assertionCount++;
        $actualBytes = strlen($binaryData);
        if ($actualBytes !== $expectedBytes) {
            throw new RuntimeException($message ?: "Failed asserting binary payload length. Expected {$expectedBytes} bytes, got {$actualBytes} bytes.");
        }
        if ($magicHeader !== '' && strpos($binaryData, $magicHeader) !== 0) {
            throw new RuntimeException($message ?: "Failed asserting binary payload starts with magic header '{$magicHeader}'.");
        }
    }

    /**
     * Asserts that a record exists in MySQL database matching criteria.
     */
    public static function assertDatabaseHas(PDO $pdo, string $table, array $criteria, string $message = ''): void {
        self::$assertionCount++;
        $where = [];
        $params = [];
        foreach ($criteria as $col => $val) {
            if ($val === null) {
                $where[] = "`{$col}` IS NULL";
            } elseif (is_array($val)) {
                $placeholders = implode(',', array_fill(0, count($val), '?'));
                $where[] = "`{$col}` IN ({$placeholders})";
                foreach ($val as $item) {
                    $params[] = $item;
                }
            } else {
                $where[] = "`{$col}` = ?";
                $params[] = $val;
            }
        }
        $whereSql = implode(' AND ', $where);
        $sql = "SELECT COUNT(*) FROM `{$table}` WHERE {$whereSql}";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $count = (int)$stmt->fetchColumn();

        if ($count === 0) {
            $criteriaStr = json_encode($criteria, JSON_UNESCAPED_UNICODE);
            $msg = $message ?: "Failed asserting that table '{$table}' contains record matching criteria: {$criteriaStr}.";
            throw new RuntimeException($msg);
        }
    }

    /**
     * Asserts that a record DOES NOT exist in MySQL database matching criteria.
     */
    public static function assertDatabaseMissing(PDO $pdo, string $table, array $criteria, string $message = ''): void {
        self::$assertionCount++;
        $where = [];
        $params = [];
        foreach ($criteria as $col => $val) {
            if ($val === null) {
                $where[] = "`{$col}` IS NULL";
            } elseif (is_array($val)) {
                $placeholders = implode(',', array_fill(0, count($val), '?'));
                $where[] = "`{$col}` IN ({$placeholders})";
                foreach ($val as $item) {
                    $params[] = $item;
                }
            } else {
                $where[] = "`{$col}` = ?";
                $params[] = $val;
            }
        }
        $whereSql = implode(' AND ', $where);
        $sql = "SELECT COUNT(*) FROM `{$table}` WHERE {$whereSql}";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $count = (int)$stmt->fetchColumn();

        if ($count > 0) {
            $criteriaStr = json_encode($criteria, JSON_UNESCAPED_UNICODE);
            $msg = $message ?: "Failed asserting that table '{$table}' is missing record matching: {$criteriaStr}. Found {$count} records.";
            throw new RuntimeException($msg);
        }
    }

    /**
     * Asserts exact row count in MySQL matching criteria.
     */
    public static function assertDatabaseCount(PDO $pdo, string $table, array $criteria, int $expectedCount, string $message = ''): void {
        self::$assertionCount++;
        $where = [];
        $params = [];
        foreach ($criteria as $col => $val) {
            if ($val === null) {
                $where[] = "`{$col}` IS NULL";
            } elseif (is_array($val)) {
                $placeholders = implode(',', array_fill(0, count($val), '?'));
                $where[] = "`{$col}` IN ({$placeholders})";
                foreach ($val as $item) {
                    $params[] = $item;
                }
            } else {
                $where[] = "`{$col}` = ?";
                $params[] = $val;
            }
        }
        $whereSql = !empty($where) ? "WHERE " . implode(' AND ', $where) : "";
        $sql = "SELECT COUNT(*) FROM `{$table}` {$whereSql}";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $actualCount = (int)$stmt->fetchColumn();

        if ($actualCount !== $expectedCount) {
            $msg = $message ?: "Failed asserting table '{$table}' row count. Expected {$expectedCount}, got {$actualCount}.";
            throw new RuntimeException($msg);
        }
    }

    /**
     * Asserts that dynamic SQL WHERE compilation matches expected regex pattern and bound parameters.
     */
    public static function assertSqlWhereMatch(array $compiledWhere, string $expectedRegex, array $expectedParams, string $message = ''): void {
        self::$assertionCount++;
        if (!isset($compiledWhere['sql']) || !isset($compiledWhere['params'])) {
            throw new RuntimeException("Compiled WHERE clause missing 'sql' or 'params' keys.");
        }
        $sql = $compiledWhere['sql'];
        $params = $compiledWhere['params'];

        if (!preg_match($expectedRegex, $sql)) {
            throw new RuntimeException($message ?: "Failed asserting SQL '{$sql}' matches pattern '{$expectedRegex}'.");
        }

        // Verify Anti-HY093 Sequential Keys
        if (!empty($params) && array_keys($params) !== range(0, count($params) - 1)) {
            throw new RuntimeException("Parameters array keys are not sequential 0..N-1 (Violates Anti-HY093 mandate).");
        }

        if ($params !== $expectedParams) {
            $expStr = json_encode($expectedParams, JSON_UNESCAPED_UNICODE);
            $actStr = json_encode($params, JSON_UNESCAPED_UNICODE);
            throw new RuntimeException($message ?: "Parameters mismatch. Expected: {$expStr}, Actual: {$actStr}.");
        }
    }

    /**
     * Asserts that a background CLI worker executed cleanly with Exit Code 0 and expected log output.
     */
    public static function assertWorkerSuccess(array $workerOutput, string $expectedLogNeedle = '', string $message = ''): void {
        self::$assertionCount++;
        $exitCode = $workerOutput['exit_code'] ?? -1;
        $stdout = $workerOutput['stdout'] ?? '';
        $stderr = $workerOutput['stderr'] ?? '';

        if ($exitCode !== 0) {
            throw new RuntimeException($message ?: "Worker process exited with code {$exitCode}. Stderr: {$stderr}. Stdout: {$stdout}.");
        }

        if ($expectedLogNeedle !== '' && strpos($stdout, $expectedLogNeedle) === false) {
            throw new RuntimeException($message ?: "Worker stdout does not contain expected needle '{$expectedLogNeedle}'. Full output: {$stdout}.");
        }
    }

    /**
     * Value equality check.
     */
    public static function assertEquals($expected, $actual, string $message = ''): void {
        self::$assertionCount++;
        if ($expected != $actual) {
            $expStr = is_scalar($expected) ? (string)$expected : json_encode($expected);
            $actStr = is_scalar($actual) ? (string)$actual : json_encode($actual);
            throw new RuntimeException($message ?: "Failed asserting that {$actStr} equals expected {$expStr}.");
        }
    }

    /**
     * Strict identity check.
     */
    public static function assertSame($expected, $actual, string $message = ''): void {
        self::$assertionCount++;
        if ($expected !== $actual) {
            $expStr = is_scalar($expected) ? (string)$expected : json_encode($expected);
            $actStr = is_scalar($actual) ? (string)$actual : json_encode($actual);
            throw new RuntimeException($message ?: "Failed asserting that {$actStr} is identical to expected {$expStr}.");
        }
    }

    /**
     * Value inequality check.
     */
    public static function assertNotEquals($expected, $actual, string $message = ''): void {
        self::$assertionCount++;
        if ($expected == $actual) {
            $expStr = is_scalar($expected) ? (string)$expected : json_encode($expected);
            throw new RuntimeException($message ?: "Failed asserting that actual value does not equal {$expStr}.");
        }
    }

    /**
     * Boolean truth check.
     */
    public static function assertTrue($condition, string $message = ''): void {
        self::$assertionCount++;
        if (!$condition) {
            throw new RuntimeException($message ?: "Failed asserting that condition is true.");
        }
    }

    /**
     * Boolean false check.
     */
    public static function assertFalse($condition, string $message = ''): void {
        self::$assertionCount++;
        if ($condition) {
            throw new RuntimeException($message ?: "Failed asserting that condition is false.");
        }
    }

    /**
     * Null check.
     */
    public static function assertNull($val, string $message = ''): void {
        self::$assertionCount++;
        if ($val !== null) {
            throw new RuntimeException($message ?: "Failed asserting that value is null.");
        }
    }

    /**
     * Not null check.
     */
    public static function assertNotNull($val, string $message = ''): void {
        self::$assertionCount++;
        if ($val === null) {
            throw new RuntimeException($message ?: "Failed asserting that value is not null.");
        }
    }

    /**
     * String contains check.
     */
    public static function assertStringContains(string $needle, string $haystack, string $message = ''): void {
        self::$assertionCount++;
        if (strpos($haystack, $needle) === false) {
            throw new RuntimeException($message ?: "Failed asserting that '{$haystack}' contains '{$needle}'.");
        }
    }

    /**
     * Regex match check.
     */
    public static function assertMatchesRegularExpression(string $pattern, string $string, string $message = ''): void {
        self::$assertionCount++;
        if (!preg_match($pattern, $string)) {
            throw new RuntimeException($message ?: "Failed asserting that '{$string}' matches pattern '{$pattern}'.");
        }
    }

    /**
     * Check array key existence.
     */
    public static function assertArrayHasKey($key, array $array, string $message = ''): void {
        self::$assertionCount++;
        if (!array_key_exists($key, $array)) {
            throw new RuntimeException($message ?: "Failed asserting that array contains key '{$key}'.");
        }
    }

    /**
     * Countable count check.
     */
    public static function assertCount(int $expectedCount, $countable, string $message = ''): void {
        self::$assertionCount++;
        $actual = is_countable($countable) ? count($countable) : 0;
        if ($actual !== $expectedCount) {
            throw new RuntimeException($message ?: "Failed asserting count. Expected {$expectedCount}, got {$actual}.");
        }
    }

    /**
     * Greater than check.
     */
    public static function assertGreaterThan($expected, $actual, string $message = ''): void {
        self::$assertionCount++;
        if (!($actual > $expected)) {
            throw new RuntimeException($message ?: "Failed asserting that {$actual} is greater than {$expected}.");
        }
    }

    /**
     * Greater than or equal check.
     */
    public static function assertGreaterThanOrEqual($expected, $actual, string $message = ''): void {
        self::$assertionCount++;
        if (!($actual >= $expected)) {
            throw new RuntimeException($message ?: "Failed asserting that {$actual} is greater than or equal to {$expected}.");
        }
    }

    /**
     * Less than check.
     */
    public static function assertLessThan($expected, $actual, string $message = ''): void {
        self::$assertionCount++;
        if (!($actual < $expected)) {
            throw new RuntimeException($message ?: "Failed asserting that {$actual} is less than {$expected}.");
        }
    }

    /**
     * Less than or equal check.
     */
    public static function assertLessThanOrEqual($expected, $actual, string $message = ''): void {
        self::$assertionCount++;
        if (!($actual <= $expected)) {
            throw new RuntimeException($message ?: "Failed asserting that {$actual} is less than or equal to {$expected}.");
        }
    }

    /**
     * JSON API success check.
     */
    public static function assertJsonSuccess(array $json, string $message = ''): void {
        self::$assertionCount++;
        if (empty($json['success'])) {
            $err = $json['message'] ?? ($json['error'] ?? 'Unknown error');
            throw new RuntimeException($message ?: "Failed asserting JSON response success: true. Error: {$err}");
        }
    }

    /**
     * JSON API error check.
     */
    public static function assertJsonError(array $json, string $message = ''): void {
        self::$assertionCount++;
        if (!empty($json['success'])) {
            throw new RuntimeException($message ?: "Failed asserting JSON response success: false. Response indicated success.");
        }
    }
}
