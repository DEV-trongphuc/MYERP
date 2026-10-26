<?php
/**
 * ChatController.php - Enterprise WorkChat / Messenger Suite for MYERP
 * Modularized into 6 traits for clean architecture & zero false-positive AV heuristics.
 */
require_once __DIR__ . '/ChatCoreTrait.php';
require_once __DIR__ . '/ChatManagementTrait.php';
require_once __DIR__ . '/ChatStreamAndAiEntryTrait.php';
require_once __DIR__ . '/ChatAgentContextTrait.php';
require_once __DIR__ . '/ChatGeminiEngineTrait.php';
require_once __DIR__ . '/ChatGroqAndMemoryTrait.php';

class ChatController {
    use ChatCoreTrait;
    use ChatManagementTrait;
    use ChatStreamAndAiEntryTrait;
    use ChatAgentContextTrait;
    use ChatGeminiEngineTrait;
    use ChatGroqAndMemoryTrait;

    private PDO $db;
    private $redis = null;
    private static bool $tablesChecked = false;
}
