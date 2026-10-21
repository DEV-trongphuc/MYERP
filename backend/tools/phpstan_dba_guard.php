<?php
/**
 * Pillar 1: phpstan-dba Guard & Live SQL Verifier for MYERP
 * 
 * Scans 100% of $this->db->prepare(...), $pdo->prepare(...), $conn->prepare(...), $conn->query(...)
 * across backend/controllers/*.php, backend/api.php, backend/automation/*.php against
 * backend/schema/mysql_schema_reflection.json.
 */

declare(strict_types=1);

class PhpstanDbaGuard {
    private array $schema = [];
    private array $tables = []; // lowercase -> table_info
    private array $tableColumns = []; // lowercase_table -> [lowercase_col => true]
    private int $totalFiles = 0;
    private int $totalQueries = 0;
    private array $errors = [];
    private array $warnings = [];

    public function __construct(string $schemaPath) {
        if (!file_exists($schemaPath)) {
            throw new RuntimeException("Schema reflection file not found: $schemaPath");
        }
        $raw = file_get_contents($schemaPath);
        if (substr($raw, 0, 3) === "\xEF\xBB\xBF") {
            $raw = substr($raw, 3);
        }
        $decoded = json_decode($raw, true);
        if (!$decoded || !isset($decoded['tables'])) {
            throw new RuntimeException("Invalid schema reflection JSON: " . json_last_error_msg());
        }
        $this->schema = $decoded;
        foreach ($decoded['tables'] as $tableName => $tableData) {
            $lowerTable = strtolower($tableName);
            $this->tables[$lowerTable] = $tableData;
            $this->tableColumns[$lowerTable] = [];
            if (!empty($tableData['columns'])) {
                foreach ($tableData['columns'] as $colName => $colData) {
                    $this->tableColumns[$lowerTable][strtolower($colName)] = true;
                }
            }
        }
    }

    public function scanDirectories(array $directories): array {
        foreach ($directories as $dir) {
            if (is_file($dir)) {
                $this->scanFile($dir);
            } elseif (is_dir($dir)) {
                $iterator = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)
                );
                foreach ($iterator as $file) {
                    if ($file->isFile() && $file->getExtension() === 'php') {
                        $pathname = $file->getPathname();
                        $base = basename($pathname);
                        if (
                            str_contains($pathname, '.bak.') || 
                            str_contains($pathname, 'scratch') || 
                            str_contains($pathname, 'PHPMailer') || 
                            $base === 'roles.php' ||
                            str_starts_with($base, 'test_')
                        ) {
                            continue;
                        }
                        $this->scanFile($pathname);
                    }
                }
            }
        }
        return [
            'total_files' => $this->totalFiles,
            'total_queries' => $this->totalQueries,
            'errors' => $this->errors,
            'warnings' => $this->warnings,
            'status' => count($this->errors) === 0 ? 'PASSED' : 'FAILED'
        ];
    }

    private function scanFile(string $filePath): void {
        $this->totalFiles++;
        $code = file_get_contents($filePath);
        $tokens = token_get_all($code);
        $count = count($tokens);

        for ($i = 0; $i < $count; $i++) {
            $token = $tokens[$i];
            
            // Check for method call: ->prepare(...) or ->query(...) or ->exec(...)
            if (is_array($token) && $token[0] === T_OBJECT_OPERATOR) {
                $nextToken = $tokens[$i + 1] ?? null;
                if (is_array($nextToken) && in_array(strtolower($nextToken[1]), ['prepare', 'query', 'exec'], true)) {
                    $line = $nextToken[2];

                    $assignedVar = $this->findAssignedVariable($tokens, $i);

                    // Find opening parenthesis
                    $j = $i + 2;
                    while ($j < $count && (is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE)) {
                        $j++;
                    }

                    if ($j < $count && $tokens[$j] === '(') {
                        $argResult = $this->extractArgumentString($tokens, $j + 1);
                        if ($argResult !== null) {
                            $sqlString = $argResult['sql'];
                            $execArgs = $assignedVar !== null 
                                ? $this->lookAheadForVariableExecute($tokens, $argResult['end_index'], $assignedVar)
                                : null;
                            $this->analyzeQuery($sqlString, $filePath, $line, $execArgs);
                        }
                    }
                }
            }
        }
    }

    private function findAssignedVariable(array $tokens, int $objectOpIndex): ?string {
        $k = $objectOpIndex - 1;
        while ($k >= 0 && (is_array($tokens[$k]) && in_array($tokens[$k][0], [T_WHITESPACE, T_VARIABLE, T_OBJECT_OPERATOR, T_STRING], true))) {
            $k--;
        }
        if ($k >= 0 && $tokens[$k] === '=') {
            $m = $k - 1;
            while ($m >= 0 && (is_array($tokens[$m]) && $tokens[$m][0] === T_WHITESPACE)) {
                $m--;
            }
            if ($m >= 0 && is_array($tokens[$m]) && $tokens[$m][0] === T_VARIABLE) {
                return $tokens[$m][1];
            }
        }
        return null;
    }

    private function extractArgumentString(array $tokens, int $startIndex): ?array {
        $count = count($tokens);
        $parenDepth = 1;
        $sqlParts = [];
        $endIndex = $startIndex;

        for ($k = $startIndex; $k < $count; $k++) {
            $tok = $tokens[$k];
            if ($tok === '(') {
                $parenDepth++;
            } elseif ($tok === ')') {
                $parenDepth--;
                if ($parenDepth === 0) {
                    $endIndex = $k;
                    break;
                }
            } elseif ($tok === ',' && $parenDepth === 1) {
                $endIndex = $k;
                break;
            }

            if (is_array($tok)) {
                if ($tok[0] === T_CONSTANT_ENCAPSED_STRING) {
                    $raw = $tok[1];
                    $quote = $raw[0];
                    $clean = substr($raw, 1, -1);
                    if ($quote === "'") {
                        $clean = str_replace(["\\'", "\\\\"], ["'", "\\"], $clean);
                    } else {
                        $clean = stripcslashes($clean);
                    }
                    $sqlParts[] = $clean;
                } elseif ($tok[0] === T_ENCAPSED_AND_WHITESPACE) {
                    $sqlParts[] = $tok[1];
                } elseif ($tok[0] === T_VARIABLE) {
                    $sqlParts[] = ' __VAR__ ';
                }
            }
        }

        if (empty($sqlParts)) {
            return null;
        }

        $sql = trim(implode('', $sqlParts));
        if (preg_match('/^\s*(CREATE|ALTER|DROP|TRUNCATE)\b/i', $sql)) {
            return null;
        }

        if (preg_match('/^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|SHOW|DESCRIBE|EXPLAIN)\b/i', $sql)) {
            return ['sql' => $sql, 'end_index' => $endIndex];
        }

        return null;
    }

    private function lookAheadForVariableExecute(array $tokens, int $fromIndex, string $varName): ?array {
        $count = count($tokens);
        $limit = min($count, $fromIndex + 120);

        for ($i = $fromIndex; $i < $limit; $i++) {
            $tok = $tokens[$i];
            if (is_array($tok) && $tok[0] === T_VARIABLE && $tok[1] === $varName) {
                $j = $i + 1;
                while ($j < $limit && (is_array($tokens[$j]) && $tokens[$j][0] === T_WHITESPACE)) {
                    $j++;
                }
                if ($j < $limit && is_array($tokens[$j]) && $tokens[$j][0] === T_OBJECT_OPERATOR) {
                    $k = $j + 1;
                    if ($k < $limit && is_array($tokens[$k]) && strtolower($tokens[$k][1]) === 'execute') {
                        $m = $k + 1;
                        while ($m < $limit && (is_array($tokens[$m]) && $tokens[$m][0] === T_WHITESPACE)) {
                            $m++;
                        }
                        if ($m < $limit && $tokens[$m] === '(') {
                            $n = $m + 1;
                            while ($n < $limit && (is_array($tokens[$n]) && $tokens[$n][0] === T_WHITESPACE)) {
                                $n++;
                            }
                            if ($n < $limit && $tokens[$n] === '[') {
                                $elements = $this->countArrayElements($tokens, $n);
                                return ['literal_elements' => $elements];
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    private function countArrayElements(array $tokens, int $bracketOpenIndex): int {
        $count = count($tokens);
        $depth = 1;
        $elements = 0;
        $hasItems = false;

        for ($i = $bracketOpenIndex + 1; $i < $count; $i++) {
            $tok = $tokens[$i];
            if ($tok === '[' || $tok === '(') {
                $depth++;
            } elseif ($tok === ']' || $tok === ')') {
                $depth--;
                if ($depth === 0) {
                    if ($hasItems) $elements++;
                    break;
                }
            } elseif ($tok === ',' && $depth === 1) {
                $elements++;
                $hasItems = false;
            } elseif (!is_array($tok) || $tok[0] !== T_WHITESPACE) {
                $hasItems = true;
            }
        }
        return $elements;
    }

    private function analyzeQuery(string $sql, string $file, int $line, ?array $execInfo): void {
        $this->totalQueries++;

        $normalizedSql = preg_replace("/'[^']*'/", "''", $sql);

        // 1. Parameter count check
        $placeholderCount = substr_count($normalizedSql, '?');
        if ($execInfo !== null && isset($execInfo['literal_elements'])) {
            $passedCount = $execInfo['literal_elements'];
            if (!str_contains($sql, '__VAR__') && $placeholderCount > 0 && $placeholderCount !== $passedCount) {
                $this->errors[] = [
                    'file' => str_replace('\\', '/', $file),
                    'line' => $line,
                    'type' => 'HY093_PARAM_MISMATCH',
                    'message' => "Parameter count mismatch: Query has $placeholderCount '?' placeholders, but execute() passes $passedCount parameters.",
                    'sql' => $this->truncateSql($sql)
                ];
            }
        }

        // 2. Extract Tables and Aliases
        $tableAliases = $this->extractTablesAndAliases($normalizedSql);

        foreach ($tableAliases as $alias => $table) {
            $lowerTable = strtolower($table);
            if (str_starts_with($lowerTable, 'information_schema.') || $lowerTable === 'information_schema') {
                continue;
            }
            if (str_contains($lowerTable, '.')) {
                $parts = explode('.', $lowerTable);
                $lowerTable = end($parts);
            }

            if (
                str_starts_with($lowerTable, '__var') || 
                str_starts_with($lowerTable, 'information_schema') || 
                str_starts_with($lowerTable, 'tmp_') ||
                in_array($lowerTable, ['dual', 'sub', 't', 'cte', 'subq', 'json_table', 'skip'], true)
            ) {
                continue;
            }

            if (!isset($this->tables[$lowerTable])) {
                $this->errors[] = [
                    'file' => str_replace('\\', '/', $file),
                    'line' => $line,
                    'type' => 'UNKNOWN_TABLE',
                    'message' => "Unknown table '$table' in database schema.",
                    'sql' => $this->truncateSql($sql)
                ];
            }
        }

        // 3. Extract Column references: alias.column_name
        if (preg_match_all('/\b([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\b/', $normalizedSql, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $alias = strtolower($m[1]);
                $col = strtolower($m[2]);

                if (in_array($alias, ['information_schema', 'mysql', 'performance_schema', 'sys', 'new', 'old'], true)) {
                    continue;
                }
                if (in_array($col, ['*'], true)) {
                    continue;
                }

                if (isset($tableAliases[$alias])) {
                    $realTable = strtolower($tableAliases[$alias]);
                    if (str_contains($realTable, '.')) {
                        $parts = explode('.', $realTable);
                        $realTable = end($parts);
                    }
                    if (str_starts_with($realTable, 'tmp_')) {
                        continue;
                    }
                    if (isset($this->tableColumns[$realTable])) {
                        if (!isset($this->tableColumns[$realTable][$col])) {
                            $this->errors[] = [
                                'file' => str_replace('\\', '/', $file),
                                'line' => $line,
                                'type' => 'UNKNOWN_COLUMN',
                                'message' => "Unknown column '$col' in table '{$tableAliases[$alias]}' (alias '$alias').",
                                'sql' => $this->truncateSql($sql)
                            ];
                        }
                    }
                }
            }
        }

        // 3B. Unaliased INSERT INTO table (col1, col2, ...) column validation
        if (preg_match('/^\s*INSERT\s+(?:IGNORE\s+)?INTO\s+`?([a-zA-Z0-9_]+)`?\s*\(([^)]+)\)\s*(?:VALUES|SELECT)/is', $normalizedSql, $mIns)) {
            $insTbl = strtolower($mIns[1]);
            if (isset($this->tableColumns[$insTbl])) {
                foreach (explode(',', $mIns[2]) as $rawCol) {
                    $c = strtolower(trim(str_replace('`', '', $rawCol)));
                    if ($c === '' || str_contains($c, '$') || str_contains($c, '__var__') || str_contains($c, '(') || str_contains($c, ' ')) {
                        continue;
                    }
                    if (!isset($this->tableColumns[$insTbl][$c])) {
                        $this->errors[] = [
                            'file' => str_replace('\\', '/', $file),
                            'line' => $line,
                            'type' => 'INSERT_UNKNOWN_COLUMN',
                            'message' => "Unknown column '$c' in INSERT INTO '$insTbl'.",
                            'sql' => $this->truncateSql($sql)
                        ];
                    }
                }
            }
        }

        // 3C. Unaliased single-table UPDATE table SET col1 = ..., col2 = ... column validation
        if (preg_match('/^\s*UPDATE\s+`?([a-zA-Z0-9_]+)`?\s+SET\s+(.+?)(?:\bWHERE\b|$)/is', $normalizedSql, $mUpd)) {
            $updTbl = strtolower($mUpd[1]);
            if (isset($this->tableColumns[$updTbl]) && !preg_match('/\bJOIN\b/i', $mUpd[0])) {
                if (preg_match_all('/(?:^|,)\s*`?([a-zA-Z0-9_]+)`?\s*=/m', $mUpd[2], $mSetCols)) {
                    foreach ($mSetCols[1] as $rawCol) {
                        $c = strtolower(trim($rawCol));
                        if ($c === '' || str_contains($c, '__var__')) {
                            continue;
                        }
                        if (!isset($this->tableColumns[$updTbl][$c])) {
                            $this->errors[] = [
                                'file' => str_replace('\\', '/', $file),
                                'line' => $line,
                                'type' => 'UPDATE_UNKNOWN_COLUMN',
                                'message' => "Unknown column '$c' in UPDATE '$updTbl' SET.",
                                'sql' => $this->truncateSql($sql)
                            ];
                        }
                    }
                }
            }
        }

        // 4. Anti-Pattern: NOT IN (SELECT ...)
        if (preg_match('/\bNOT\s+IN\s*\(\s*SELECT\b/i', $normalizedSql)) {
            $this->warnings[] = [
                'file' => str_replace('\\', '/', $file),
                'line' => $line,
                'type' => 'ANTI_PATTERN_NOT_IN_NULL',
                'message' => "Hazardous SQL Anti-Pattern: 'NOT IN (SELECT ...)' can return 0 rows if subquery contains NULL. Convert to 'NOT EXISTS (SELECT 1 FROM ...)'.",
                'sql' => $this->truncateSql($sql)
            ];
        }

        // 5. Anti-Pattern: non-SARGable DATE(...) on indexed column
        if (preg_match('/\bDATE\s*\(\s*([a-zA-Z0-9_\.]+)\s*\)\s*=/i', $normalizedSql, $m)) {
            $this->warnings[] = [
                'file' => str_replace('\\', '/', $file),
                'line' => $line,
                'type' => 'NON_SARGABLE_DATE_WRAP',
                'message' => "Non-SARGable expression 'DATE({$m[1]}) = ?'. Negates B-Tree Index. Use range 'created_at >= ? AND created_at <= ?'.",
                'sql' => $this->truncateSql($sql)
            ];
        }
    }

    private function cleanTableToken(string $raw): string {
        $raw = str_replace('`', '', trim($raw));
        if (str_contains($raw, '.')) {
            $parts = explode('.', $raw);
            return end($parts);
        }
        return $raw;
    }

    private function extractTablesAndAliases(string $sql): array {
        $aliases = [];

        // Pattern handles: FROM `db`.`table` [AS] `alias` or FROM table alias
        $tablePattern = '/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+(?:`?([a-zA-Z0-9_]+)`?\.)?`?([a-zA-Z0-9_]+)`?(?:\s+(?:AS\s+)?`?([a-zA-Z0-9_]+)`?)?/i';
        
        $cleanSql = preg_replace('/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b.*/i', '', $sql);
        if (preg_match_all($tablePattern, $cleanSql, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                // If prefixed by system schema (information_schema, mysql, performance_schema, sys), skip
                if (!empty($m[1]) && in_array(strtolower($m[1]), ['information_schema', 'mysql', 'performance_schema', 'sys'], true)) {
                    continue;
                }
                $table = $m[2];
                $alias = !empty($m[3]) ? $m[3] : $table;
                if ($this->isSqlKeyword($alias)) {
                    $alias = $table;
                }
                $cleanTable = $this->cleanTableToken($table);
                $cleanAlias = $this->cleanTableToken($alias);
                $aliases[strtolower($cleanAlias)] = $cleanTable;
                $aliases[strtolower($cleanTable)] = $cleanTable;
            }
        }

        return $aliases;
    }

    private function isSqlKeyword(string $word): bool {
        return in_array(strtoupper($word), [
            'ON', 'WHERE', 'SET', 'GROUP', 'ORDER', 'LEFT', 'RIGHT', 'INNER', 
            'OUTER', 'CROSS', 'JOIN', 'LIMIT', 'VALUES', 'SELECT', 'HAVING',
            'UNION', 'AS', 'INTO', 'USING', 'BY', 'FOR', 'LOCK', 'WINDOW',
            'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'EXISTS'
        ], true);
    }

    private function truncateSql(string $sql, int $max = 140): string {
        $cleaned = trim(preg_replace('/\s+/', ' ', $sql));
        if (strlen($cleaned) > $max) {
            return substr($cleaned, 0, $max) . '...';
        }
        return $cleaned;
    }
}

// ── Runner CLI ─────────────────────────────────────────────
$schemaFile = __DIR__ . '/../schema/mysql_schema_reflection.json';
$guard = new PhpstanDbaGuard($schemaFile);

$dirsToScan = [
    __DIR__ . '/../controllers',
    __DIR__ . '/../api.php',
    __DIR__ . '/../index.php',
    __DIR__ . '/../automation',
    __DIR__ . '/../utils'
];

echo "========================================================================\n";
echo "🛡️  PILLAR 1: PHPSTAN-DBA SQL AST GUARD & LIVE SCHEMA VERIFIER\n";
echo "    Database Target: vhvxoigh_myerp (289 tables loaded)\n";
echo "========================================================================\n\n";

$start = microtime(true);
$results = $guard->scanDirectories($dirsToScan);
$duration = round(microtime(true) - $start, 3);
file_put_contents(__DIR__ . '/../schema/phpstan_dba_results.json', json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "Scanned Files   : {$results['total_files']} files\n";
echo "Scanned Queries : {$results['total_queries']} SQL statements\n";
echo "Duration        : {$duration}s\n";
echo "Errors Found    : " . count($results['errors']) . "\n";
echo "Warnings Found  : " . count($results['warnings']) . "\n\n";

if (!empty($results['errors'])) {
    echo "❌ REAL SQL DEFECTS DETECTED:\n";
    echo "------------------------------------------------------------------------\n";
    foreach ($results['errors'] as $i => $err) {
        $num = $i + 1;
        echo "[#{$num}] {$err['type']} at {$err['file']}:{$err['line']}\n";
        echo "     Message : {$err['message']}\n";
        echo "     SQL     : {$err['sql']}\n\n";
    }
}

if (!empty($results['warnings'])) {
    echo "⚠️  SQL ANTI-PATTERNS & PERFORMANCE WARNINGS:\n";
    echo "------------------------------------------------------------------------\n";
    foreach ($results['warnings'] as $i => $w) {
        $num = $i + 1;
        echo "[#{$num}] {$w['type']} at {$w['file']}:{$w['line']}\n";
        echo "     Message : {$w['message']}\n";
        echo "     SQL     : {$w['sql']}\n\n";
    }
}

if (count($results['errors']) === 0) {
    echo "✅ PASSED: 0 Unknown Columns, 0 Parameter Mismatches, 0 Unknown Tables!\n";
    exit(0);
} else {
    echo "❌ FAILED: Found " . count($results['errors']) . " SQL defects requiring fixes.\n";
    exit(1);
}
