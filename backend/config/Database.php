<?php
// f:\CRM\backend\config\Database.php

class Database {
    private static ?PDO $instance = null;

    private function __construct() {}

    private static function createConnection(bool $persistent = true): PDO {
        $dsn  = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $opts = [
            PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE       => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES         => false,
            PDO::ATTR_PERSISTENT               => $persistent,
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
            PDO::MYSQL_ATTR_INIT_COMMAND       => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+07:00', SESSION wait_timeout = 300, SESSION interactive_timeout = 300",
        ];
        return new PDO($dsn, DB_USER, DB_PASS, $opts);
    }

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            self::$instance = self::createConnection(true);
        }
        return self::$instance;
    }

    public static function reconnect(): PDO {
        self::$instance = null;
        self::$instance = self::createConnection(false);
        return self::$instance;
    }

    public static function ensureConnected(?PDO &$db = null): PDO {
        $target = $db ?? self::$instance;
        if ($target === null) {
            $fresh = self::getInstance();
            $db = $fresh;
            return $fresh;
        }
        try {
            $target->query('SELECT 1');
            return $target;
        } catch (\Throwable $e) {
            $fresh = self::reconnect();
            $db = $fresh;
            return $fresh;
        }
    }
}

