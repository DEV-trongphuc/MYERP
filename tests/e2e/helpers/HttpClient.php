<?php
/**
 * tests/e2e/helpers/HttpClient.php
 *
 * Real cURL HTTP Client for MYERP Marketing Automation E2E Testing
 * Issues genuine HTTP requests against the built-in server.
 */

namespace MYERP\Tests\E2E\Helpers;

use RuntimeException;

class HttpResponse {
    public int $status = 0;
    public array $headers = [];
    public string $body = '';
    public ?array $json = null;
    public ?string $location = null;
    public string $contentType = '';
    public int $bodyLength = 0;

    public function __construct(int $status, array $headers, string $body, ?string $contentType = '') {
        $this->status = $status;
        $this->headers = $headers;
        $this->body = $body;
        $this->bodyLength = strlen($body);
        $this->contentType = $contentType ?: ($headers['content-type'] ?? '');
        $this->location = $headers['location'] ?? null;

        // Try JSON decode if body is not empty
        if ($body !== '') {
            $decoded = json_decode($body, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $this->json = $decoded;
            }
        }
    }
}

class HttpClient {
    private string $baseUrl;
    private ?string $defaultToken;
    private int $defaultTimeout;

    public function __construct(string $baseUrl, ?string $defaultToken = null, int $defaultTimeout = 30) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->defaultToken = $defaultToken;
        $this->defaultTimeout = $defaultTimeout;
    }

    public function setToken(?string $token): void {
        $this->defaultToken = $token;
    }

    public function getToken(): ?string {
        return $this->defaultToken;
    }

    public function setBaseUrl(string $url): void {
        $this->baseUrl = rtrim($url, '/');
    }

    public function getBaseUrl(): string {
        return $this->baseUrl;
    }

    public function get(string $path, array $query = [], array $headers = [], bool $followRedirects = false): HttpResponse {
        if (!empty($query)) {
            $sep = (strpos($path, '?') === false) ? '?' : '&';
            $path .= $sep . http_build_query($query);
        }
        return $this->request('GET', $path, null, $headers, $followRedirects);
    }

    public function post(string $path, $body = null, array $headers = [], bool $followRedirects = false): HttpResponse {
        return $this->request('POST', $path, $body, $headers, $followRedirects);
    }

    public function put(string $path, $body = null, array $headers = [], bool $followRedirects = false): HttpResponse {
        return $this->request('PUT', $path, $body, $headers, $followRedirects);
    }

    public function delete(string $path, $body = null, array $headers = [], bool $followRedirects = false): HttpResponse {
        return $this->request('DELETE', $path, $body, $headers, $followRedirects);
    }

    public function request(string $method, string $path, $body = null, array $headers = [], bool $followRedirects = false): HttpResponse {
        $url = (strpos($path, 'http://') === 0 || strpos($path, 'https://') === 0)
            ? $path
            : $this->baseUrl . '/' . ltrim($path, '/');

        $ch = curl_init();

        $reqHeaders = [];
        $hasAuth = false;
        $hasContentType = false;
        $hasWs = false;

        foreach ($headers as $k => $v) {
            $lk = strtolower(trim($k));
            if ($lk === 'authorization') $hasAuth = true;
            if ($lk === 'content-type') $hasContentType = true;
            if ($lk === 'x-workspace-id') $hasWs = true;
            $reqHeaders[] = is_numeric($k) ? $v : "{$k}: {$v}";
        }

        if (!$hasAuth && $this->defaultToken !== null) {
            $reqHeaders[] = "Authorization: Bearer {$this->defaultToken}";
        }

        if (!$hasWs) {
            $reqHeaders[] = "X-Workspace-Id: " . TestDatabase::TEST_WORKSPACE_ID;
        }

        // Suppress Expect: 100-continue which hangs PHP built-in server (php -S) on POST
        $reqHeaders[] = "Expect:";
        $reqHeaders[] = "Connection: close";

        $formattedBody = null;
        if ($body !== null) {
            if (is_array($body)) {
                $formattedBody = json_encode($body, JSON_UNESCAPED_UNICODE);
                if (!$hasContentType) {
                    $reqHeaders[] = "Content-Type: application/json; charset=UTF-8";
                }
            } else {
                $formattedBody = (string)$body;
            }
        }

        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_CUSTOMREQUEST  => strtoupper($method),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
            CURLOPT_FOLLOWLOCATION => $followRedirects,
            CURLOPT_TIMEOUT        => $this->defaultTimeout,
            CURLOPT_HTTPHEADER     => $reqHeaders
        ]);

        if ($formattedBody !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $formattedBody);
        }

        $rawResponse = curl_exec($ch);

        if ($rawResponse === false) {
            $err = curl_error($ch);
            curl_close($ch);
            throw new RuntimeException("cURL error requesting {$method} {$url}: {$err}");
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        $rawHeaderBlock = substr($rawResponse, 0, $headerSize);
        $bodyContent = substr($rawResponse, $headerSize);

        $parsedHeaders = $this->parseHeaders($rawHeaderBlock);

        return new HttpResponse($httpCode, $parsedHeaders, $bodyContent, $contentType);
    }

    private function parseHeaders(string $rawHeaders): array {
        $headers = [];
        $lines = explode("\r\n", $rawHeaders);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, 'HTTP/') === 0) {
                continue;
            }
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) {
                $name = strtolower(trim($parts[0]));
                $val = trim($parts[1]);
                $headers[$name] = $val;
            }
        }
        return $headers;
    }
}
