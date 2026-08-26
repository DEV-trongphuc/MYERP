<?php
// f:\CRM\backend\config\Database.php

class Database {
    private static ?PDO $instance = null;

    private function __construct() {}

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            $dsn  = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
            $opts = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_PERSISTENT         => true,
            ];
            self::$instance = new PDO($dsn, DB_USER, DB_PASS, $opts);
            self::$instance->exec("SET time_zone = '+07:00'");
        }
        return self::$instance;
    }
}
