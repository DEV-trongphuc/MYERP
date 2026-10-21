<?php
$pdo = new PDO('mysql:host=localhost;dbname=vhvxoigh_myerp;charset=utf8mb4', 'vhvxoigh_mail_auto', 'Ideas@812', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
]);
$schema = [
    'extracted_at' => date('Y-m-d H:i:s'),
    'database' => 'vhvxoigh_myerp',
    'table_count' => 0,
    'tables' => [],
    'foreign_keys' => []
];

// Tables
$stmt = $pdo->query("SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS, ENGINE, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME");
while ($r = $stmt->fetch()) {
    $t = $r['TABLE_NAME'];
    $schema['tables'][$t] = [
        'name' => $t,
        'type' => $r['TABLE_TYPE'],
        'engine' => $r['ENGINE'],
        'approx_rows' => (int)$r['TABLE_ROWS'],
        'comment' => $r['TABLE_COMMENT'],
        'columns' => [],
        'indexes' => []
    ];
}
$schema['table_count'] = count($schema['tables']);

// Columns
$stmt = $pdo->query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY, COLUMN_COMMENT, ORDINAL_POSITION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION");
while ($r = $stmt->fetch()) {
    $t = $r['TABLE_NAME'];
    if (isset($schema['tables'][$t])) {
        $schema['tables'][$t]['columns'][$r['COLUMN_NAME']] = [
            'name' => $r['COLUMN_NAME'],
            'data_type' => $r['DATA_TYPE'],
            'column_type' => $r['COLUMN_TYPE'],
            'nullable' => ($r['IS_NULLABLE'] === 'YES'),
            'default' => $r['COLUMN_DEFAULT'],
            'key' => $r['COLUMN_KEY'],
            'extra' => $r['EXTRA'],
            'comment' => $r['COLUMN_COMMENT'],
            'ordinal' => (int)$r['ORDINAL_POSITION']
        ];
    }
}

// Indexes
$stmt = $pdo->query("SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, INDEX_TYPE, CARDINALITY, NULLABLE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX");
while ($r = $stmt->fetch()) {
    $t = $r['TABLE_NAME'];
    if (isset($schema['tables'][$t])) {
        $idxName = $r['INDEX_NAME'];
        if (!isset($schema['tables'][$t]['indexes'][$idxName])) {
            $schema['tables'][$t]['indexes'][$idxName] = [
                'name' => $idxName,
                'non_unique' => (int)$r['NON_UNIQUE'],
                'type' => $r['INDEX_TYPE'],
                'columns' => []
            ];
        }
        $schema['tables'][$t]['indexes'][$idxName]['columns'][] = [
            'seq' => (int)$r['SEQ_IN_INDEX'],
            'column' => $r['COLUMN_NAME'],
            'nullable' => $r['NULLABLE']
        ];
    }
}

// Foreign Keys
$stmt = $pdo->query("SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME, ORDINAL_POSITION");
while ($r = $stmt->fetch()) {
    $schema['foreign_keys'][] = $r;
}

echo json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
