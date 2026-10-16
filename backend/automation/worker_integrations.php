<?php
require_once 'db_connect.php';

// Prevent re-declaration if included multiple times
if (!function_exists('runIntegrationSync')) {

    function logIntegrationSync($message)
    {
        $msg = "[" . date('Y-m-d H:i:s') . "] " . $message . "\n";
        // If running in CLI, echo. If running via Web (Sync Now), maybe capture or echo (captured by buffer)
        echo $msg;
        // Log to file always (Save in api/ directory for easier access)
        @file_put_contents(__DIR__ . '/worker_sync.log', $msg, FILE_APPEND);
    }

    // Helper to execute batch query using Raw SQL (Much faster than 1000s of bindings)
    function processBatch($pdo, $subRows, $listRows, $count)
    {
        if ($count === 0)
            return;

        // 1. Bulk Upsert Subscribers
        // Added: notes, anniversary_date, workspace_id
        $sql = "INSERT INTO subscribers (id, email, first_name, last_name, phone_number, source, job_title, company_name, country, city, gender, date_of_birth, anniversary_date, salesperson, notes, custom_attributes, status, workspace_id, joined_at) VALUES ";
        $sql .= implode(', ', $subRows);
        $sql .= " ON DUPLICATE KEY UPDATE 
                first_name = CASE WHEN VALUES(first_name) != '' AND VALUES(first_name) IS NOT NULL THEN VALUES(first_name) ELSE first_name END,
                last_name = CASE WHEN VALUES(last_name) != '' AND VALUES(last_name) IS NOT NULL THEN VALUES(last_name) ELSE last_name END,
                phone_number = CASE WHEN VALUES(phone_number) != '' AND VALUES(phone_number) IS NOT NULL THEN VALUES(phone_number) ELSE phone_number END,
                job_title = CASE WHEN VALUES(job_title) != '' AND VALUES(job_title) IS NOT NULL THEN VALUES(job_title) ELSE job_title END,
                company_name = CASE WHEN VALUES(company_name) != '' AND VALUES(company_name) IS NOT NULL THEN VALUES(company_name) ELSE company_name END,
                country = CASE WHEN VALUES(country) != '' AND VALUES(country) IS NOT NULL THEN VALUES(country) ELSE country END,
                city = CASE WHEN VALUES(city) != '' AND VALUES(city) IS NOT NULL THEN VALUES(city) ELSE city END,
                gender = CASE WHEN VALUES(gender) != '' AND VALUES(gender) IS NOT NULL THEN VALUES(gender) ELSE gender END,
                date_of_birth = CASE WHEN VALUES(date_of_birth) != '' AND VALUES(date_of_birth) IS NOT NULL THEN VALUES(date_of_birth) ELSE date_of_birth END,
                anniversary_date = CASE WHEN VALUES(anniversary_date) != '' AND VALUES(anniversary_date) IS NOT NULL THEN VALUES(anniversary_date) ELSE anniversary_date END,
                salesperson = CASE WHEN VALUES(salesperson) != '' AND VALUES(salesperson) IS NOT NULL THEN VALUES(salesperson) ELSE salesperson END,
                notes = CASE WHEN VALUES(notes) != '' AND VALUES(notes) != '[]' AND VALUES(notes) IS NOT NULL THEN VALUES(notes) ELSE notes END,
                custom_attributes = CASE 
                    WHEN VALUES(custom_attributes) != '' AND VALUES(custom_attributes) != '{}' AND VALUES(custom_attributes) IS NOT NULL 
                    THEN JSON_MERGE_PATCH(COALESCE(custom_attributes, '{}'), VALUES(custom_attributes)) 
                    ELSE custom_attributes 
                END,
                source = CASE WHEN VALUES(source) != '' AND VALUES(source) IS NOT NULL THEN VALUES(source) ELSE source END,
                workspace_id = VALUES(workspace_id)";

        $pdo->query($sql);

        // 2. Bulk Insert List Map
        $sqlList = "INSERT IGNORE INTO subscriber_lists (list_id, subscriber_id) VALUES ";
        $sqlList .= implode(', ', $listRows);

        $pdo->query($sqlList);
    }

    function runIntegrationSync($forceId = null)
    {
        global $pdo;

        // Optimized settings for large datasets
        if (function_exists('set_time_limit')) {
            set_time_limit(0); // Unlimited time
        }
        ini_set('memory_limit', '1024M'); // 1GB Memory

        // [PERF-GUARD] Stop if server is saturated
        if (!isSystemHealthy()) {
            logIntegrationSync("Server load too high, pausing integration worker.");
            return;
        }

        // Ensure schema exists (Self-healing)
        try {
            $pdo->query("SELECT sync_status FROM integrations LIMIT 1");
        } catch (Exception $e) {
            try {
                $pdo->exec("ALTER TABLE integrations ADD COLUMN sync_status VARCHAR(20) DEFAULT 'idle'");
            } catch (Exception $ex) {
                // Ignore if race condition
            }
        }

        try {
            // 1. Fetch active integrations (Google Sheets OR MISA)
            $stmt = $pdo->prepare("SELECT * FROM integrations WHERE type IN ('google_sheets', 'misa') AND status = 'active'");
            $stmt->execute();
            $integrations = $stmt->fetchAll();

            logIntegrationSync("Found " . count($integrations) . " active integrations.");

            foreach ($integrations as $integration) {
                $config = json_decode($integration['config'], true);

                // Validate config generic
                if (!isset($config['targetListId'])) {
                    logIntegrationSync("Skipping Integration ID {$integration['id']}: Invalid config (Missing targetListId).");
                    continue;
                }

                $intervalMinutes = isset($config['syncInterval']) ? (int) $config['syncInterval'] : 15;
                $lastSync = isset($integration['last_sync_at']) ? strtotime($integration['last_sync_at']) : 0;
                $nextSync = $lastSync + ($intervalMinutes * 60);

                // Handle Specific Time of Day (e.g. 23:00) if interval is >= 1 day
                if (isset($config['syncTimeOfDay']) && $config['syncTimeOfDay'] !== '' && $intervalMinutes >= 1440) {
                    $timeOfDay = $config['syncTimeOfDay']; // format "H:i"
                    $todayTimeStr = date('Y-m-d') . ' ' . $timeOfDay . ':00';
                    $todayTime = strtotime($todayTimeStr);
                    
                    if ($lastSync < $todayTime) {
                        $nextSync = $todayTime;
                    } else {
                        $nextSync = $todayTime + 86400; // Next day
                    }
                }

                // Check if allow to run (Force trigger OR Time passed)
                $isForced = ($forceId && $forceId == $integration['id']);

                if (time() >= $nextSync || $isForced) {
                    // [FIX] CONCURRENCY GUARD: Prevent multiple threads from syncing the SAME integration
                    // This eliminates the 3k -> 10k data duplication issue (Race Condition)
                    $lockName = "sync_lock_" . $integration['id'];
                    $stmtLock = $pdo->prepare("SELECT GET_LOCK(?, 0)");
                    $stmtLock->execute([$lockName]);
                    if (!$stmtLock->fetchColumn()) {
                        logIntegrationSync("Sync for ID {$integration['id']} is already running in another thread. Skipping to prevent duplicates.");
                        continue;
                    }

                    logIntegrationSync("Syncing Integration ID {$integration['id']} (" . ($isForced ? "Forced" : "Scheduled") . ")...");

                    // Set Status to Syncing
                    $pdo->prepare("UPDATE integrations SET sync_status = 'syncing' WHERE id = ?")->execute([$integration['id']]);

                    try {
                        // --- SYNC LOGIC ---
                        $targetListId = $config['targetListId'];
                        $syncedCount = 0;
                        $newCount = 0;
                        $updatedCount = 0;

                        // Start timing
                        $startTime = microtime(true);

                        // INITIALIZE SYNC ENGINE
                        // [FIX BUG-SE-1] Pass workspace_id so SyncEngine only loads identity maps
                        // for this integration's workspace, preventing cross-workspace email/phone match.
                        require_once 'sync_engine.php';
                        $engine = new SyncEngine($pdo, $integration['workspace_id'] ?? null);
                        logIntegrationSync("Loading identity maps...");
                        $engine->loadMaps();
                        logIntegrationSync("Maps loaded. Emails: " . $engine->getStats()['emails'] . ", Phones: " . $engine->getStats()['phones']);

                        // MISA HANDLER
                        if ($integration['type'] === 'misa') {
                            require_once 'misa_helper.php';
                            $misa = new MisaHelper($config['clientId'], $config['clientSecret'], $config['endpoint'] ?? '');

                            // Pagination Loop
                            $page = 0;
                            $pageSize = 100; // Optimized for MISA max limits (100) per documentation
                            $hasMore = true;

                            $pdo->exec("SET sql_mode=''");
                            if (!$pdo->inTransaction())
                                $pdo->beginTransaction();

                            $escTargetList = "'" . addslashes($targetListId) . "'";

                            while ($hasMore) {
                                $entity = $config['entity'] ?? 'Contacts';
                                $res = $misa->getRecords($entity, $page, $pageSize);

                                if (!$res['success']) {
                                    throw new Exception("MISA API Page $page Failed: " . ($res['message'] ?? 'Unknown error'));
                                }

                                $rows = $res['data'];
                                $totalFound = $res['total'] ?? count($rows);

                                if ($page === 0) {
                                    logIntegrationSync("ID {$integration['id']} (MISA): Starting sync for entity '{$entity}'. Total records reported by MISA: $totalFound.");
                                }

                                if (empty($rows)) {
                                    logIntegrationSync("ID {$integration['id']} (MISA): Finished at page $page (No more rows).");
                                    $hasMore = false;
                                    break;
                                }

                                $mapping = $config['mapping'];
                                $batchSubscribers = [];
                                $batchListPairs = [];

                                foreach ($rows as $contact) {
                                    // Build subscriber data
                                    $subData = [];
                                    foreach ($mapping as $sysField => $misaField) {
                                        // Handle nested lookup if dot notation (optional, MISA usually flat)
                                        $subData[$sysField] = $contact[$misaField] ?? '';
                                    }

                                    $email = trim($subData['email'] ?? '');
                                    $phone = trim($subData['phoneNumber'] ?? '');

                                    // ROBUST EMAIL DETECTION
                                    $hasValidEmail = ($email !== '' && strpos($email, '@') !== false);
                                    if (!$hasValidEmail) {
                                        // Try common candidate keys from normalized contact
                                        $candidates = ['email', 'office_email', 'email_address', 'mail', 'contact_email', 'official_email'];
                                        foreach ($candidates as $c) {
                                            if (isset($contact[$c]) && strpos($contact[$c], '@') !== false) {
                                                $email = trim($contact[$c]);
                                                $hasValidEmail = true;
                                                break;
                                            }
                                        }
                                    }

                                    $hasPhone = ($phone !== '');

                                    if (!$hasValidEmail && !$hasPhone) {
                                        logIntegrationSync("[SKIP] Contact missing valid email AND phone. Mapped: '" . ($subData['email'] ?? 'N/A') . "'. Available keys: " . implode(', ', array_keys($contact)));
                                        continue;
                                    }
                                    
                                    // Clear invalid email so it doesn't pollute DB
                                    if (!$hasValidEmail) {
                                        $email = '';
                                        // VIRTUAL EMAIL LOGIC: If enabled and phone exists, generate virtual
                                        if (!empty($phone) && ($config['createVirtualEmail'] ?? false)) {
                                            $email = $phone . '@no-email.domation';
                                        }
                                    }

                                    // Extract fields
                                    $rawFName = $subData['firstName'] ?? '';
                                    $rawLName = $subData['lastName'] ?? '';
                                    $rawFullName = $subData['fullName'] ?? '';

                                    // Logic: Use 'first_name' column as FULL NAME.
                                    // If MISA provides fullName, use it.
                                    // If MISA provides parsed fName/lName, join them.
                                    if (!empty($rawFullName)) {
                                        $fName = $rawFullName;
                                    } else {
                                        $parts = [];
                                        if ($rawFName)
                                            $parts[] = $rawFName;
                                        if ($rawLName)
                                            $parts[] = $rawLName;
                                        $fName = implode(' ', $parts);
                                    }

                                    // Force lastName to empty
                                    $lName = '';

                                    // $phone already extracted above
                                    $company = $subData['companyName'] ?? '';
                                    $company = $subData['companyName'] ?? '';
                                    $address = $subData['address'] ?? ($subData['info.address'] ?? ($subData['city'] ?? ($subData['country'] ?? '')));
                                    $country = $address;
                                    $city = $address;
                                    $source = 'MISA CRM';

                                    // New Mapped Fields
                                    $salesperson = $subData['salesperson'] ?? '';
                                    $jobTitle = $subData['jobTitle'] ?? '';
                                    $gender = $subData['gender'] ?? '';
                                    $dob = $subData['dateOfBirth'] ?? null;
                                    $anniversary = $subData['anniversaryDate'] ?? null;
                                    $website = $subData['info.website'] ?? '';

                                    // Notes Logic: Map 'notes' field and json_encode it (array of strings) if expected by schema, or simpler string.
                                    // Schema expects generic notes JSON. But MISA might send description string.
                                    // Let's store as a simple JSON array with one entry if it's a string.
                                    $rawNotes = $subData['notes'] ?? '';
                                    $notesJson = '[]';
                                    if ($rawNotes) {
                                        // If it's already an array, use it. If string, wrap it.
                                        // Or better, just store the raw string content in a "description" field? 
                                        // Subscriber schema 'notes' is TEXT (JSON). 
                                        // Let's force it to be a simple string inside JSON for compatibility or just raw string if schema changed (it hasn't).
                                        // Wait, the subscriber schema uses `json_decode` in `subscribers.php`.
                                        // But the user upgraded `CustomerProfileModal` to handle string notes or array notes.
                                        // Ideally, we store "raw content" but since the column is meant for structured notes often...
                                        // Let's just json_encode it if it's not valid json.
                                        // Actually `subscribers.php` line 97: `$row['notes'] = json_decode($row['notes'] ?? '[]', true);`
                                        // If I store "some string", json_decode returns null -> empty.
                                        // So I MUST store `json_encode("some string")` OR `json_encode(["some string"])`?
                                        // The Modal expects string directly OR array. 
                                        // Let's safely encode it as a simple string value (JSON string).
                                        $notesJson = json_encode($rawNotes, JSON_UNESCAPED_UNICODE);
                                    }

                                    // Resolve ID (Unified)
                                    $subId = $engine->resolveId($email, $phone);

                                    if ($subId) {
                                        $updatedCount++;
                                    } else {
                                        $subId = uniqid(); 
                                        if ($email || $phone) {
                                            $engine->addResolvedId($email, $phone, $subId);
                                        }
                                        $newCount++;
                                    }

                                    // Escape and Build SQL
                                    $escId = "'" . $subId . "'";
                                    $escEmail = $email ? "'" . addslashes($email) . "'" : "NULL";
                                    $escFName = "'" . addslashes($fName) . "'";
                                    $escLName = "'" . addslashes($lName) . "'";
                                    $escPhone = "'" . addslashes($phone) . "'";
                                    $escSource = "'" . addslashes($source) . "'";
                                    $escJobTitle = "'" . addslashes($jobTitle) . "'";
                                    $escCompanyName = "'" . addslashes($company) . "'";
                                    $escCountry = "'" . addslashes($country) . "'";
                                    $escCity = "'" . addslashes($city) . "'";
                                    $escGender = "'" . addslashes($gender) . "'";

                                    // Dates
                                    $escDateOfBirth = ($dob && strtotime($dob)) ? "'" . date('Y-m-d', strtotime($dob)) . "'" : "NULL";
                                    $escAnniversary = ($anniversary && strtotime($anniversary)) ? "'" . date('Y-m-d', strtotime($anniversary)) . "'" : "NULL";

                                    $escSalesperson = "'" . addslashes($salesperson) . "'";
                                    $escNotes = "'" . addslashes($notesJson) . "'";

                                    // Custom Attributes (exclude known fields)
                                    // Collect any mapped fields that are NOT in standard set
                                    $stdKeys = [
                                        'email',
                                        'firstName',
                                        'lastName',
                                        'fullName',
                                        'phoneNumber',
                                        'companyName',
                                        'address',
                                        'info.address',
                                        'salesperson',
                                        'jobTitle',
                                        'country',
                                        'city',
                                        'gender',
                                        'date_of_birth',
                                        'anniversary_date',
                                        'notes',
                                        'info.website',
                                        'email_address',
                                        'contact_name',
                                        'account_name',
                                        'company_name'
                                    ];
                                    $customAttrs = [];
                                    foreach ($subData as $k => $v) {
                                        if (!in_array($k, $stdKeys) && !empty($v)) {
                                            $customAttrs[$k] = $v;
                                        }
                                    }
                                    if ($website)
                                        $customAttrs['website'] = $website;
                                    if ($address)
                                        $customAttrs['address'] = $address;

                                    $escCustomAttrs = "'" . addslashes(json_encode($customAttrs, JSON_UNESCAPED_UNICODE)) . "'";
                                    $escWorkspaceId = (int)($integration['workspace_id'] ?? 1);

                                    $batchSubscribers[] = "($escId, $escEmail, $escFName, $escLName, $escPhone, $escSource, $escJobTitle, $escCompanyName, $escCountry, $escCity, $escGender, $escDateOfBirth, $escAnniversary, $escSalesperson, $escNotes, $escCustomAttrs, 'customer', $escWorkspaceId, NOW())";
                                    $batchListPairs[] = "($escTargetList, $escId)";

                                    $syncedCount++;
                                }

                                if (!empty($batchSubscribers)) {
                                    processBatch($pdo, $batchSubscribers, $batchListPairs, count($batchSubscribers));
                                    logIntegrationSync("ID {$integration['id']} (MISA): Synced Page $page (" . count($batchSubscribers) . " rows)...");
                                }

                                // Check Pagination
                                // MISA V2 usually has 'total' or check if count < pageSize
                                // [FIX] Improved pagination: continue if we got records, stop only if empty
                                // This handles cases where MISA returns fewer records than requested pageSize
                                if (empty($rows)) {
                                    $hasMore = false;
                                } else {
                                    $page++;
                                    // Safety brake
                                    if ($page > 2000)
                                        $hasMore = false;
                                }
                            }

                            $pdo->commit();

                            // Update stats
                            // [FIX P36-I1] Replace exec() with string interpolation → prepared statement
                            $pdo->prepare("UPDATE integrations SET last_sync_at = NOW(), sync_status = 'idle' WHERE id = ?")->execute([$integration['id']]);
                            $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM subscriber_lists WHERE list_id = ?");
                            $stmtCount->execute([$targetListId]);
                            $totalCount = $stmtCount->fetchColumn();
                            $pdo->prepare("UPDATE lists SET subscriber_count = ? WHERE id = ?")->execute([$totalCount, $targetListId]);

                            $executionTime = round(microtime(true) - $startTime, 2);
                            logIntegrationSync("ID {$integration['id']} (MISA): Finished. Total Synced $syncedCount rows in {$executionTime}s");

                            // Release Lock
                            $pdo->exec("DO RELEASE_LOCK('sync_lock_{$integration['id']}')");

                            continue; // Skip Google Sheets Logic
                        }

                        // GOOGLE SHEETS HANDLER (Original Logic)
                        $spreadsheetId = $config['spreadsheetId'];
                        $sheetName = $config['sheetName'] ?? 'Sheet1';

                        // 1. Stream Download to Temp File (Low Memory)
                        // 1. Stream Download to Temp File (Low Memory)
                        // 1. Stream Download to Temp File (Low Memory)
                        // [FIX] Using gviz/tq with range=A1:Z to fetch all rows until the very end of the sheet,
                        // bypassing any blank rows in between.
                        $csvUrl = "https://docs.google.com/spreadsheets/d/{$spreadsheetId}/gviz/tq?tqx=out:csv&sheet=" . urlencode($sheetName) . "&range=A1:Z";
                        $tempFile = tempnam(sys_get_temp_dir(), 'sheet_' . $integration['id']);

                        $fp = fopen($tempFile, 'w+');
                        $ch = curl_init($csvUrl);
                        curl_setopt($ch, CURLOPT_FILE, $fp);
                        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
                        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2); // [FIX P36-I1] Added hostname verification
                        curl_setopt($ch, CURLOPT_TIMEOUT, 300); // 5 min download timeout
                        curl_exec($ch);
                        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                        curl_close($ch);
                        fclose($fp);

                        if ($httpCode != 200) {
                            logIntegrationSync("Error: Could not fetch CSV from Google Sheets for ID {$integration['id']}. HTTP Code: $httpCode.");
                            unlink($tempFile);
                            continue;
                        }

                        // 2. Stream Process CSV
                        $handle = fopen($tempFile, "r");
                        if ($handle === FALSE) {
                            logIntegrationSync("Error: Could not open temp file.");
                            continue;
                        }

                        // Read Header
                        $headers = fgetcsv($handle);
                        if (!$headers || count($headers) < 1) {
                            logIntegrationSync("Warning: Sheet is empty or header only.");
                            fclose($handle);
                            unlink($tempFile);
                            continue;
                        }

                        // Remove BOM if present
                        $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', $headers[0]);

                        // Mapping Logic
                        $mapping = $config['mapping'] ?? [];
                        $normalizedHeaders = array_map('strtolower', $headers);
                        $colIndices = []; // System Field => Index

                        foreach ($mapping as $sysField => $sheetHeader) {
                            $index = array_search($sheetHeader, $headers);
                            if ($index === false) {
                                $index = array_search(strtolower($sheetHeader), $normalizedHeaders);
                            }
                            if ($index !== false) {
                                $colIndices[$sysField] = $index;
                            }
                        }

                        if (!isset($colIndices['email'])) {
                            logIntegrationSync("Error: Email column not found in sheet.");
                            fclose($handle);
                            unlink($tempFile);
                            continue;
                        }

                        $syncedCount = 0;
                        $newCount = 0;
                        $updatedCount = 0;

                        // [FIX] Moved EXTREME SPEED MODE flags to HERE — AFTER all validation checks.
                        // Previously these were set before the 'email column not found' check.
                        // If that check triggered a continue, autocommit=0 and disabled constraints
                        // would bleed into the next integration's processing, risking DB locks and
                        // floating transactions on otherwise unrelated data.
                        $pdo->exec("SET sql_mode=''");
                        $pdo->exec("SET autocommit=0");
                        $pdo->exec("SET unique_checks=0");
                        $pdo->exec("SET foreign_key_checks=0");

                        // Only begin if not already in one
                        if (!$pdo->inTransaction()) {
                            $pdo->beginTransaction();
                        }

                        // Initialize Sync Engine Maps for Sheet processing (Reload just to be safe or reuse?)
                        // We can reuse, but if MISA ran before, map is stale? No, SyncEngine loads from DB.
                        // Ideally we reload if we want fresh DB state. But for performance, let's reuse loaded maps from start of function.

                        // Load existing emails into memory -> REMOVED (Handled by SyncEngine)
                        $existingMap = [];
                        // $stmtAll... removed

                        // SWEET SPOT: 5000 is faster than 25000 on shared hosting due to MySQL parser overhead & packet limits
                        $batchSize = 5000;
                        $batchSubscribers = [];
                        $batchListPairs = [];
                        $countInBatch = 0;
                        $syncedCount = 0;
                        $newCount = 0;
                        $updatedCount = 0;

                        // Cache indices to avoid array lookup in loop
                        $emailIdx = $colIndices['email'];
                        $fNameIdx = $colIndices['firstName'] ?? -1;
                        $lNameIdx = $colIndices['lastName'] ?? -1;
                        $phoneIdx = $colIndices['phoneNumber'] ?? -1;
                        $srcIdx = $colIndices['source'] ?? -1;
                        $jobTitleIdx = $colIndices['jobTitle'] ?? -1;
                        $companyNameIdx = $colIndices['companyName'] ?? -1;
                        $countryIdx = $colIndices['country'] ?? -1;
                        $cityIdx = $colIndices['city'] ?? -1;
                        $genderIdx = $colIndices['gender'] ?? -1;
                        $dobIdx = $colIndices['dateOfBirth'] ?? -1;
                        $annivIdx = $colIndices['anniversaryDate'] ?? -1;
                        $salesIdx = $colIndices['salesperson'] ?? -1;
                        $notesIdx = $colIndices['notes'] ?? -1;

                        $standardFields = [
                            'email',
                            'firstName',
                            'lastName',
                            'phoneNumber',
                            'jobTitle',
                            'companyName',
                            'country',
                            'city',
                            'gender',
                            'dateOfBirth',
                            'anniversaryDate',
                            'salesperson',
                            'notes',
                            'source',
                            'info.salesperson',
                            'info.address',
                            'info.website'
                        ];

                        // Prepare custom field keys to avoid repeated array_keys calls
                        $customFieldMap = [];
                        foreach ($colIndices as $sysField => $colIdx) {
                            if (!in_array($sysField, $standardFields)) {
                                $customFieldMap[$sysField] = $colIdx;
                            }
                        }

                        // Pre-quote target list ID since it never changes
                        $escTargetList = "'" . addslashes($targetListId) . "'";

                        while (($row = fgetcsv($handle)) !== FALSE) {
                            $email = trim($row[$emailIdx]);
                            $phone = ($phoneIdx !== -1 && isset($row[$phoneIdx])) ? trim($row[$phoneIdx]) : '';
                            
                            // [FIX] Accept rows that have EITHER a valid email OR a phone number.
                            $hasValidEmail = ($email !== '' && strpos($email, '@') !== false);
                            $hasPhone = ($phone !== '');
                            
                            if (!$hasValidEmail && !$hasPhone) {
                                continue; // Skip only if BOTH are missing or invalid
                            }
                            
                            // If email is invalid but phone exists, we clear the invalid email so it doesn't pollute the DB
                            if (!$hasValidEmail) {
                                $email = '';
                                // VIRTUAL EMAIL LOGIC: If enabled and phone exists, generate virtual
                                if (!empty($phone) && ($config['createVirtualEmail'] ?? false)) {
                                    $email = $phone . '@no-email.domation';
                                }
                            }

                            // Fast scalar retrieval
                            $fName = ($fNameIdx !== -1 && isset($row[$fNameIdx])) ? $row[$fNameIdx] : '';
                            $lName = ($lNameIdx !== -1 && isset($row[$lNameIdx])) ? $row[$lNameIdx] : '';
                            $jobTitle = ($jobTitleIdx !== -1 && isset($row[$jobTitleIdx])) ? $row[$jobTitleIdx] : '';
                            $companyName = ($companyNameIdx !== -1 && isset($row[$companyNameIdx])) ? $row[$companyNameIdx] : '';
                            $country = ($countryIdx !== -1 && isset($row[$countryIdx])) ? $row[$countryIdx] : '';
                            $city = ($cityIdx !== -1 && isset($row[$cityIdx])) ? $row[$cityIdx] : '';
                            $gender = ($genderIdx !== -1 && isset($row[$genderIdx])) ? $row[$genderIdx] : '';
                            $dateOfBirth = ($dobIdx !== -1 && isset($row[$dobIdx])) ? $row[$dobIdx] : null;
                            $anniversary = ($annivIdx !== -1 && isset($row[$annivIdx])) ? $row[$annivIdx] : null;
                            $salesperson = ($salesIdx !== -1 && isset($row[$salesIdx])) ? $row[$salesIdx] : '';
                            $notesRaw = ($notesIdx !== -1 && isset($row[$notesIdx])) ? $row[$notesIdx] : '';
                            $source = ($srcIdx !== -1 && isset($row[$srcIdx])) ? $row[$srcIdx] : 'Google Sheets';

                            // Valid Date check
                            if ($dateOfBirth && !strtotime($dateOfBirth))
                                $dateOfBirth = null;
                            if ($anniversary && !strtotime($anniversary))
                                $anniversary = null;

                            $notesJson = '[]';
                            if ($notesRaw) {
                                $notesJson = json_encode($notesRaw, JSON_UNESCAPED_UNICODE);
                            }

                            // Custom fields optimization - FAST PATH
                            $customAttrsJson = '{}';
                            if (!empty($customFieldMap)) {
                                $customAttrs = [];
                                foreach ($customFieldMap as $sysKey => $cIdx) {
                                    if (!empty($row[$cIdx])) {
                                        // Strip 'custom_field.' prefix if present
                                        $cleanKey = str_replace('custom_field.', '', $sysKey);
                                        $customAttrs[$cleanKey] = $row[$cIdx];
                                    }
                                }
                                if (!empty($customAttrs)) {
                                    $customAttrsJson = json_encode($customAttrs, JSON_UNESCAPED_UNICODE);
                                }
                            }

                            // Determine ID (Unified)
                            $subId = $engine->resolveId($email, $phone);

                            if ($subId) {
                                $updatedCount++;
                            } else {
                                $subId = uniqid();
                                // Note: Update $engine map on the fly to prevent duplicates within the same sheet
                                if ($email || $phone) {
                                    $engine->addResolvedId($email, $phone, $subId);
                                }
                                $newCount++;
                            }

                            // Use addslashes instead of PDO::quote for speed (approx 3x faster)
                            // We trust CSV input enough here, and allow UTF-8
                            $escId = "'" . $subId . "'";
                            $escEmail = $email ? "'" . addslashes($email) . "'" : "NULL";
                            $escFName = "'" . addslashes($fName) . "'";
                            $escLName = "'" . addslashes($lName) . "'";
                            $escPhone = "'" . addslashes($phone) . "'";
                            $escSource = "'" . addslashes($source) . "'";
                            $escJobTitle = "'" . addslashes($jobTitle) . "'";
                            $escCompanyName = "'" . addslashes($companyName) . "'";
                            $escCountry = "'" . addslashes($country) . "'";
                            $escCity = "'" . addslashes($city) . "'";
                            $escGender = "'" . addslashes($gender) . "'";
                            $escDateOfBirth = $dateOfBirth ? "'" . addslashes($dateOfBirth) . "'" : 'NULL';
                            $escAnniversary = $anniversary ? "'" . addslashes($anniversary) . "'" : 'NULL';
                            $escSalesperson = "'" . addslashes($salesperson) . "'";
                            $escNotes = "'" . addslashes($notesJson) . "'";
                            $escCustomAttrs = "'" . addslashes($customAttrsJson) . "'";
                            $escWorkspaceId = (int)($integration['workspace_id'] ?? 1);

                            $batchSubscribers[] = "($escId, $escEmail, $escFName, $escLName, $escPhone, $escSource, $escJobTitle, $escCompanyName, $escCountry, $escCity, $escGender, $escDateOfBirth, $escAnniversary, $escSalesperson, $escNotes, $escCustomAttrs, 'active', $escWorkspaceId, NOW())";
                            $batchListPairs[] = "($escTargetList, $escId)";

                            $countInBatch++;
                            $syncedCount++;

                            // Process Batch if full
                            if ($countInBatch >= $batchSize) {
                                processBatch($pdo, $batchSubscribers, $batchListPairs, $countInBatch);
                                $batchSubscribers = [];
                                $batchListPairs = [];
                                $countInBatch = 0;

                                // Memory Cleanup
                                gc_collect_cycles();
                            }
                        }

                        // Process remaining
                        if ($countInBatch > 0) {
                            processBatch($pdo, $batchSubscribers, $batchListPairs, $countInBatch);
                        }

                        // CRITICAL: Update status BEFORE commit to ensure it's saved even if script dies
                        // Use separate statement outside transaction
                        // [FIX P36-I1] Replace exec() with string interpolation → prepared statement.
                        // This runs BEFORE commit() so it is INSIDE the transaction — ensures status is saved.
                        $pdo->prepare("UPDATE integrations SET last_sync_at = NOW(), sync_status = 'idle' WHERE id = ?")->execute([$integration['id']]);

                        $pdo->commit();

                        // Re-enable MySQL checks
                        $pdo->exec("SET unique_checks=1");
                        $pdo->exec("SET foreign_key_checks=1");
                        $pdo->exec("SET autocommit=1"); // [CRITICAL FIX] Ensure autocommit is restored on success too!

                        fclose($handle);
                        unlink($tempFile);

                        // Update List Count (Workspace Aware)
                        $stmtCount = $pdo->prepare("
                            SELECT COUNT(*) 
                            FROM subscriber_lists sl
                            JOIN subscribers s ON sl.subscriber_id = s.id
                            WHERE sl.list_id = ? AND s.workspace_id = ?
                        ");
                        $safeWorkspaceId = (int)($integration['workspace_id'] ?? 1);
                        $stmtCount->execute([$targetListId, $safeWorkspaceId]);
                        $totalCount = $stmtCount->fetchColumn();
                        $pdo->prepare("UPDATE lists SET subscriber_count = ? WHERE id = ?")->execute([$totalCount, $targetListId]);

                        // Calculate performance metrics
                        $endTime = microtime(true);
                        $executionTime = round($endTime - $startTime, 2);
                        $rowsPerSecond = $syncedCount > 0 ? round($syncedCount / $executionTime, 0) : 0;

                        logIntegrationSync("ID {$integration['id']}: Synced $syncedCount rows (New: $newCount, Upsert: $updatedCount) in {$executionTime}s. Speed: {$rowsPerSecond} rows/s");

                        // Release Lock
                        $pdo->exec("DO RELEASE_LOCK('sync_lock_{$integration['id']}')");

                    } catch (Exception $e) {
                        // Error handling for sync block
                        if ($pdo->inTransaction()) {
                            $pdo->rollBack();
                        }
                        
                        // [CRITICAL FIX] Restore MySQL connection state!
                        // If an error happens while in Extreme Speed Mode, the worker MUST restore 
                        // the connection's original state. Otherwise, subsequent integrations or 
                        // the Global Zalo Sync at the end of this script will execute with autocommit=0 
                        // and silently fail to persist data to the database.
                        try {
                            $pdo->exec("SET unique_checks=1");
                            $pdo->exec("SET foreign_key_checks=1");
                            $pdo->exec("SET autocommit=1");
                        } catch (Exception $connEx) {
                            // Ignored if connection is dead
                        }

                        // [FIX] Guard against TypeError if exception occurred before $handle was initialized
                        // (e.g. during the SET sql_mode statement). Calling fclose() on an unset/non-resource
                        // variable would throw a new exception, interrupting error logging and status reset.
                        if (isset($handle) && is_resource($handle)) {
                            fclose($handle);
                        }
                        if (isset($tempFile) && file_exists($tempFile)) {
                            unlink($tempFile);
                        }
                        logIntegrationSync("Error processing ID {$integration['id']}: " . $e->getMessage());
                        // Reset status on error
                        $pdo->prepare("UPDATE integrations SET sync_status = 'error' WHERE id = ?")->execute([$integration['id']]);
                        
                        // Release Lock
                        $pdo->exec("DO RELEASE_LOCK('sync_lock_{$integration['id']}')");
                    }

                }
            }

            try {
                // [NEW] Global Zalo Sync: Link any external subscribers with Zalo users by Email/Phone
                // [FIX P43-E2] Scoped to workspace_id to prevent cross-workspace data leakage.
                $pdo->exec("
                UPDATE subscribers s
                JOIN zalo_subscribers zs ON (s.email = zs.manual_email AND zs.manual_email != '') 
                                         OR (s.phone_number = zs.phone_number AND zs.phone_number != '')
                JOIN zalo_oa_configs zo ON zs.oa_id = zo.oa_id
                SET s.zalo_user_id = zs.zalo_user_id,
                    s.verified = 1,
                    s.avatar = CASE WHEN s.avatar IS NULL OR s.avatar = '' THEN zs.avatar ELSE s.avatar END,
                    s.gender = CASE WHEN s.gender IS NULL OR s.gender = '' THEN zs.gender ELSE s.gender END,
                    s.first_name = CASE WHEN (s.first_name IS NULL OR s.first_name = '') AND zs.display_name != 'Zalo User' THEN zs.display_name ELSE s.first_name END
                WHERE (s.zalo_user_id IS NULL OR s.verified = 0) AND s.workspace_id = zo.workspace_id
            ");
            } catch (Exception $e) {
                logIntegrationSync("Bulk Zalo Sync Error: " . $e->getMessage());
            }
            try {
                // Trigger flow enrollment and execution workers so new/updated subscribers 
                // from the sync enter flows immediately without waiting for the next cron cycle.
                if (function_exists('triggerAsyncWorker')) {
                    triggerAsyncWorker('/worker_enroll.php');
                    triggerAsyncWorker('/worker_flow.php');
                }
            } catch (Exception $e) {
                logIntegrationSync("Worker Trigger Error: " . $e->getMessage());
            }
        } catch (Exception $e) {
            logIntegrationSync("Critical Error: " . $e->getMessage());
        }
    }
}

// Check if running from CLI
if (php_sapi_name() === 'cli' && isset($argv)) {
    $forceId = null;
    foreach ($argv as $arg) {
        if (strpos($arg, 'force_id=') === 0) {
            $forceId = substr($arg, 9);
        }
    }
    runIntegrationSync($forceId);
}
