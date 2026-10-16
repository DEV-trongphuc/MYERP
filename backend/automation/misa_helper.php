<?php
// api/misa_helper.php
class MisaHelper
{
    private $clientId;
    private $clientSecret;
    private $baseUrl;

    public function __construct($clientId, $clientSecret, $baseUrl = 'https://crmconnect.misa.vn/api/v2')
    {
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
        $this->baseUrl = rtrim($baseUrl, '/');
    }

    // Convert PascalCase to snake_case
    private function toSnakeCase($str)
    {
        return strtolower(preg_replace('/(?<!^)[A-Z]/', '_$0', $str));
    }

    // Normalize MISA contact object keys to snake_case
    private function normalizeContact($contact)
    {
        $normalized = [];
        foreach ($contact as $key => $value) {
            $normalized[$this->toSnakeCase($key)] = $value;
        }
        return $normalized;
    }

    public function getToken()
    {
        // Dynamic Token Endpoint based on baseUrl
        $tokenUrl = $this->baseUrl . "/Account";

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $tokenUrl);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret
        ]));

        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode($response, true);

        // User provided response: { "success": true, "data": "TOKEN_STRING", ... }
        if ($data && isset($data['success']) && $data['success'] && isset($data['data'])) {
            error_log('[MISA] Token acquired successfully.');
            return $data['data'];
        }

        // Redact response body to avoid logging credentials/tokens
        error_log("[MISA] Token acquisition FAILED. URL: $tokenUrl HTTP: $httpCode");
        return null;
    }

    public function getRecords($entity = 'Contacts', $page = 0, $pageSize = 100)
    {
        // 1. Get Token
        $token = $this->getToken();

        if (!$token) {
            return ['success' => false, 'message' => 'Lỗi xác thực MISA. Vui lòng kiểm tra AppID và Mã bảo mật.'];
        }

        // 2. Fetch Records
        // Entity can be Contacts, Accounts, Customers, etc.
        $url = $this->baseUrl . "/" . $entity . "?page=$page&pageSize=$pageSize&orderBy=modified_date&isDescending=true";

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $token,
            'Clientid: ' . $this->clientId // Required Header
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $json = json_decode($response, true);

        // Handle Response
        if ($httpCode === 200) {
            $rows = [];
            if (isset($json['results']) && is_array($json['results'])) {
                $rows = $json['results'];
            } elseif (isset($json['data']) && is_array($json['data'])) {
                $rows = $json['data'];
            } elseif (isset($json['Data']) && is_array($json['Data'])) {
                $rows = $json['Data'];
            } elseif (isset($json['customers']) && is_array($json['customers'])) {
                $rows = $json['customers'];
            } elseif (is_array($json) && count($json) > 0 && !isset($json['success'])) {
                // If it's a direct array of objects
                $first = reset($json);
                if (is_array($first)) {
                    $rows = $json;
                }
            }

            // Extract Total if available (V2 usually has total or totalCount or total_records)
            $totalFound = count($rows);
            if (isset($json['total']))
                $totalFound = $json['total'];
            elseif (isset($json['Total']))
                $totalFound = $json['Total'];
            elseif (isset($json['total_records']))
                $totalFound = $json['total_records'];
            elseif (isset($json['totalCount']))
                $totalFound = $json['totalCount'];
            elseif (isset($json['total_count']))
                $totalFound = $json['total_count'];

            $normalizedRows = [];
            foreach ($rows as $contact) {
                $normalizedRows[] = $this->normalizeContact($contact);
            }

            error_log("[MISA] Fetch $entity Page $page => " . count($normalizedRows) . " records.");

            return [
                'success' => true,
                'data' => $normalizedRows,
                'total' => $totalFound
            ];
        }

        $errorMsg = $json['error_message'] ?? ($json['message'] ?? ($json['ErrorMessage'] ?? 'Unknown Error'));
        return [
            'success' => false,
            'message' => "Lỗi lấy dữ liệu $entity. HTTP $httpCode - " . $errorMsg
        ];
    }

    public function testConnection($entity = 'Contacts')
    {
        // Try the specified entity first
        $res = $this->getRecords($entity, 0, 1);

        // If the specified entity failed, try fallbacks just to confirm connection works
        if (!$res['success']) {
            $fallbackEntities = ['Contacts', 'Accounts', 'Customers'];
            foreach ($fallbackEntities as $fb) {
                if ($fb === $entity)
                    continue;
                $fbRes = $this->getRecords($fb, 0, 1);
                if ($fbRes['success']) {
                    $res = $fbRes;
                    break;
                }
            }
        }

        if ($res['success']) {
            // Extract keys from first item to show mapping (already normalized to snake_case)
            $firstItem = isset($res['data'][0]) ? $res['data'][0] : [];
            $fields = !empty($firstItem) ? array_keys($firstItem) : [];

            // If empty, return standard fields based on User's provided payload
            if (empty($fields)) {
                $fields = [
                    'contact_code',
                    'salutation',
                    'first_name',
                    'last_name',
                    'contact_name',
                    'title',
                    'department',
                    'account_name',
                    'mobile',
                    'other_phone',
                    'office_email',
                    'email',
                    'office_tel',
                    'lead_source',
                    'account_type',
                    'mailing_address',
                    'date_of_birth',
                    'gender',
                    'zalo'
                ];
            }

            return ['success' => true, 'fields' => $fields];
        }

        return $res;
    }
}
?>
