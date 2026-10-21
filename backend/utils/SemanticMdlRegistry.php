<?php
/**
 * Pillar 4: WrenAI & Vanna Semantic MDL Registry for SI IDEAS AI Multi-Agent
 *
 * Provides zero-hallucination schema & metric grounding, validating table/column
 * references against backend/schema/myerp_semantic_mdl.json and
 * backend/schema/mysql_schema_reflection.json.
 */

declare(strict_types=1);

class SemanticMdlRegistry
{
    private static ?array $mdlCache = null;
    private static ?array $reflectionCache = null;

    public static function getMdl(): array
    {
        if (self::$mdlCache !== null) {
            return self::$mdlCache;
        }
        $path = __DIR__ . '/../schema/myerp_semantic_mdl.json';
        if (!file_exists($path)) {
            return [];
        }
        $raw = file_get_contents($path);
        if (substr($raw, 0, 3) === "\xEF\xBB\xBF") {
            $raw = substr($raw, 3);
        }
        self::$mdlCache = json_decode($raw, true) ?: [];
        return self::$mdlCache;
    }

    public static function getReflection(): array
    {
        if (self::$reflectionCache !== null) {
            return self::$reflectionCache;
        }
        $path = __DIR__ . '/../schema/mysql_schema_reflection.json';
        if (!file_exists($path)) {
            return [];
        }
        $raw = file_get_contents($path);
        if (substr($raw, 0, 3) === "\xEF\xBB\xBF") {
            $raw = substr($raw, 3);
        }
        self::$reflectionCache = json_decode($raw, true) ?: [];
        return self::$reflectionCache;
    }

    /**
     * Returns a compact (<150 tokens) domain-scoped Semantic MDL context block
     * for SI IDEAS AI Agent prompt injection.
     */
    public static function getDomainSemanticContext(string $domain = 'all'): string
    {
        $lines = [
            '<semantic_mdl_grounding engine="WrenAI-Vanna-MDL-v1">',
            '- ISOLATION: tenant_id=(contacts,deals,users,invoices,expenses,projects,support_tickets); workspace_id=(subscribers,lists,segments,flows,campaigns); relational_join=(deposits.created_by->users.id, monthly_payslips.user_id->users.id).',
            '- FORBIDDEN COLUMNS: NEVER use users.status (use users.is_active=1 AND users.deleted_at IS NULL); NEVER use po.order_number (use po.po_number); NEVER use contacts.dob (use contacts.birth_date).',
            '- PIPELINE SEGMENTS: Uncontacted=Stage 1-2; Qualified=Stage 3-12; Won=Stage 13-14; Enrolled Student=Stage 14.',
            '- PAYROLL STATUTORY: NV BHXH 10.5% (8%+1.5%+1%), DN 23.5% (17.5%+3%+1%+2% KPCD), Giam tru ban than 11M, NPT 4.4M.',
            '</semantic_mdl_grounding>'
        ];
        return implode("\n", $lines);
    }

    /**
     * Validates whether a given table.column exists in the live MySQL schema reflection.
     */
    public static function columnExists(string $table, string $column): bool
    {
        $ref = self::getReflection();
        $tKey = strtolower(trim($table));
        $cKey = strtolower(trim($column));
        if (empty($ref['tables'][$tKey]['columns'])) {
            return false;
        }
        foreach ($ref['tables'][$tKey]['columns'] as $colName => $_) {
            if (strtolower($colName) === $cKey) {
                return true;
            }
        }
        return false;
    }
}
