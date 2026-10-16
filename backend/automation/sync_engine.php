<?php
// api/sync_engine.php

class SyncEngine
{
    private $pdo;
    private $workspaceId; // [FIX BUG-SE-1] Scope identity maps to one workspace
    private $mapEmail = [];
    private $mapPhone = [];
    private $mapMeta = [];
    private $mapZalo = [];

    public function __construct($pdo, $workspaceId = null)
    {
        $this->pdo = $pdo;
        // [FIX BUG-SE-1] Store workspace_id to filter identity maps at load time.
        // Without this, two workspaces sharing the same email/phone would cross-resolve
        // subscriber IDs \u2014 leading to MISA sync writing data to the wrong subscriber.
        $this->workspaceId = $workspaceId;
    }

    /**
     * Load existing identity maps from database to memory
     * Optimized for bulk processing
     */
    public function loadMaps()
    {
        // [FIX BUG-SE-1] Build workspace filter clause when workspace_id is provided.
        // This prevents cross-workspace identity resolution when 2 workspaces share
        // the same email or phone number (e.g. demo data, test accounts).
        $wsFilter = '';
        $wsParam  = [];
        if ($this->workspaceId !== null) {
            $wsFilter = ' AND workspace_id = ?';
            $wsParam  = [$this->workspaceId];
        }

        // Load Email Map
        $stmt = $this->pdo->prepare("SELECT email, id FROM subscribers WHERE email IS NOT NULL AND email != ''{$wsFilter}");
        $stmt->execute($wsParam);
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $this->mapEmail[strtolower(trim($row[0]))] = $row[1];
        }

        // Load Phone Map (Normalized)
        $stmt = $this->pdo->prepare("SELECT phone_number, id FROM subscribers WHERE phone_number IS NOT NULL AND phone_number != ''{$wsFilter}");
        $stmt->execute($wsParam);
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $norm = self::normalizePhone($row[0]);
            if ($norm) {
                $this->mapPhone[$norm] = $row[1];
            }
        }

        // Load Meta PSID Map
        $stmt = $this->pdo->prepare("SELECT meta_psid, id FROM subscribers WHERE meta_psid IS NOT NULL AND meta_psid != ''{$wsFilter}");
        $stmt->execute($wsParam);
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $this->mapMeta[$row[0]] = $row[1];
        }

        // Load Zalo User ID Map
        $stmt = $this->pdo->prepare("SELECT zalo_user_id, id FROM subscribers WHERE zalo_user_id IS NOT NULL AND zalo_user_id != ''{$wsFilter}");
        $stmt->execute($wsParam);
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
            $this->mapZalo[$row[0]] = $row[1];
        }
    }

    /**
     * Resolve Subscriber ID based on any available identifier.
     * Order of Precedence: Meta PSID > Zalo ID > Email > Phone
     */
    public function resolveId($email, $phone, $psid = null, $zaloId = null)
    {
        // 1. Check Social IDs (Strongest Link)
        if ($psid && isset($this->mapMeta[$psid])) {
            return $this->mapMeta[$psid];
        }
        if ($zaloId && isset($this->mapZalo[$zaloId])) {
            return $this->mapZalo[$zaloId];
        }

        // 2. Check Email
        $cleanEmail = strtolower(trim($email));
        if ($cleanEmail && isset($this->mapEmail[$cleanEmail])) {
            return $this->mapEmail[$cleanEmail];
        }

        // 3. Check Phone
        $normPhone = self::normalizePhone($phone);
        if ($normPhone && isset($this->mapPhone[$normPhone])) {
            return $this->mapPhone[$normPhone];
        }

        return null; // New Subscriber
    }

    /**
     * Helper to normalize phone numbers for consistent comparison
     * Handles +84, 84, 0... format -> 0... format (Standard VN)
     */
    public static function normalizePhone($phone)
    {
        if (!$phone)
            return '';

        // Remove non-digits
        $digits = preg_replace('/[^0-9]/', '', $phone);

        // Remove leading 84 if present and long enough (e.g. 8490... -> 090...)
        if (substr($digits, 0, 2) === '84' && strlen($digits) > 9) {
            $digits = '0' . substr($digits, 2);
        }

        // Fix dropped leading zero from Excel (Vietnamese phones are 10 digits starting with 0)
        // If it is 9 digits and starts with a valid carrier prefix (3, 5, 7, 8, 9)
        if (strlen($digits) === 9 && in_array($digits[0], ['3', '5', '7', '8', '9'])) {
            $digits = '0' . $digits;
        }

        return $digits;
    }

    /**
     * Add a newly resolved ID to the memory maps dynamically.
     * Prevents duplicate insertions within the same batch.
     */
    public function addResolvedId($email, $phone, $subId)
    {
        if ($email) {
            $this->mapEmail[strtolower(trim($email))] = $subId;
        }
        if ($phone) {
            $normPhone = self::normalizePhone($phone);
            if ($normPhone) {
                $this->mapPhone[$normPhone] = $subId;
            }
        }
    }

    /**
     * Get Identity Maps (Debugging/Stats)
     */
    public function getStats()
    {
        return [
            'emails' => count($this->mapEmail),
            'phones' => count($this->mapPhone),
            'meta_ids' => count($this->mapMeta),
            'zalo_ids' => count($this->mapZalo)
        ];
    }
}
?>
