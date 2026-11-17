<?php
/**
 * AcademicAffairsController.php
 * Enterprise Controller for Academic Affairs (Học vụ & Giảng viên):
 * 1. Student Subject Grades & Inline Transcripts (Studying stage)
 * 2. Class Bulk Gradebook (Spreadsheet Matrix + Excel/CSV Import)
 * 3. Postpone (Bảo lưu) Form Upload + AI OCR Auto-Extraction + Auto Email Remind Date
 * 4. Lecturer (Giảng viên) Contract & Invitation Email with Attachments & Schedule Table
 * 5. 1-Flow 1:1 Mentoring Booking Engine (30-min slots, Atomic Lock, Auto Calendar & .ics Invite)
 */

if (file_exists(__DIR__ . '/../helpers.php')) {
    require_once __DIR__ . '/../helpers.php';
}
require_once __DIR__ . '/../mailer.php';
require_once __DIR__ . '/../utils/StudentDocOcrService.php';

use PHPMailer\PHPMailer\PHPMailer;

require_once __DIR__ . '/../config/TenantConfigService.php';

class AcademicAffairsController {
    private PDO $db;
    private static bool $schemaEnsured = false;

    public const DEFAULT_ACADEMIC_CC = '';

    private function getDefaultAcademicCc(int $tid): string {
        $org = TenantConfigService::getOrganizationProfile($this->db, $tid);
        return (string)($org['academic_cc_emails'] ?? '');
    }

    public function __construct(PDO $db) {
        $this->db = $db;
        self::ensureSchema($this->db);
    }

    public static function ensureSchema(PDO $db): void {
        if (self::$schemaEnsured) return;
        self::$schemaEnsured = true;

        try {
            // 1. Table: student_subject_grades
            $db->exec("
                CREATE TABLE IF NOT EXISTS student_subject_grades (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    contact_id INT NOT NULL,
                    campaign_id INT NOT NULL DEFAULT 0,
                    subject_code VARCHAR(100) NOT NULL DEFAULT '',
                    subject_name VARCHAR(255) NOT NULL DEFAULT '',
                    attendance_score VARCHAR(32) NULL DEFAULT NULL,
                    assignment_score VARCHAR(32) NULL DEFAULT NULL,
                    final_score VARCHAR(50) NULL DEFAULT NULL,
                    letter_grade VARCHAR(32) NULL DEFAULT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'studying',
                    note TEXT NULL,
                    updated_by INT NULL DEFAULT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_ssg_contact (tenant_id, contact_id),
                    INDEX idx_ssg_campaign (tenant_id, campaign_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // 2. Table: student_postpone_records
            $db->exec("
                CREATE TABLE IF NOT EXISTS student_postpone_records (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    contact_id INT NOT NULL,
                    form_file_id INT NULL DEFAULT NULL,
                    form_file_url VARCHAR(500) NULL DEFAULT NULL,
                    form_file_name VARCHAR(255) NULL DEFAULT NULL,
                    postpone_reason TEXT NULL,
                    postpone_from_date DATE NULL DEFAULT NULL,
                    postpone_to_date DATE NULL DEFAULT NULL,
                    duration_months INT NOT NULL DEFAULT 6,
                    remind_days_before INT NOT NULL DEFAULT 14,
                    postpone_remind_date DATE NULL DEFAULT NULL,
                    deferred_subjects TEXT NULL,
                    remind_status VARCHAR(32) NOT NULL DEFAULT 'pending',
                    reminded_at DATETIME NULL DEFAULT NULL,
                    created_by INT NULL DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_spr_contact (tenant_id, contact_id),
                    INDEX idx_spr_remind (postpone_remind_date, remind_status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // 3. Table: mentoring_1on1_configs
            $db->exec("
                CREATE TABLE IF NOT EXISTS mentoring_1on1_configs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    booking_code VARCHAR(64) NOT NULL UNIQUE,
                    title VARCHAR(255) NOT NULL,
                    campaign_id INT NULL DEFAULT NULL,
                    subject_name VARCHAR(255) NULL DEFAULT NULL,
                    lecturer_id INT NOT NULL DEFAULT 0,
                    lecturer_name VARCHAR(255) NULL DEFAULT NULL,
                    lecturer_email VARCHAR(255) NULL DEFAULT NULL,
                    week_start_date DATE NOT NULL,
                    week_end_date DATE NOT NULL,
                    slot_duration_minutes INT NOT NULL DEFAULT 30,
                    min_advance_hours INT NOT NULL DEFAULT 24,
                    zoom_link VARCHAR(500) NULL DEFAULT NULL,
                    zoom_id VARCHAR(100) NULL DEFAULT NULL,
                    zoom_pass VARCHAR(100) NULL DEFAULT NULL,
                    available_slots_json LONGTEXT NULL,
                    notes TEXT NULL,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_by INT NULL DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_m1c_lecturer (tenant_id, lecturer_id),
                    INDEX idx_m1c_campaign (tenant_id, campaign_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // 4. Table: mentoring_1on1_bookings
            $db->exec("
                CREATE TABLE IF NOT EXISTS mentoring_1on1_bookings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NOT NULL DEFAULT 1,
                    config_id INT NOT NULL,
                    contact_id INT NULL DEFAULT NULL,
                    student_name VARCHAR(255) NOT NULL,
                    student_code VARCHAR(100) NULL DEFAULT NULL,
                    student_email VARCHAR(255) NOT NULL,
                    student_phone VARCHAR(50) NULL DEFAULT NULL,
                    program_name VARCHAR(255) NULL DEFAULT NULL,
                    topic TEXT NULL,
                    questions TEXT NULL,
                    slot_date DATE NOT NULL,
                    slot_time_start VARCHAR(16) NOT NULL,
                    slot_time_end VARCHAR(16) NOT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'confirmed',
                    activity_id INT NULL DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_m1b_slot (config_id, slot_date, slot_time_start, status),
                    INDEX idx_m1b_contact (contact_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        } catch (\Throwable $e) {
            error_log("AcademicAffairsController::ensureSchema error: " . $e->getMessage());
        }
    }

    /**
     * Standard 30-minute time slots matching IDEAS BBA Capstone / MBA Thesis schedule grid:
     * Afternoon: 13:30 - 16:30 (6 slots of 30m)
     * Evening:   19:00 - 21:30 (5 slots of 30m)
     */
    public static function getDefaultTimeSlots30Min(): array {
        return [
            ['no' => 1, 'session' => 'afternoon', 'start' => '13:30', 'end' => '14:00', 'label' => '13:30 - 14:00'],
            ['no' => 2, 'session' => 'afternoon', 'start' => '14:00', 'end' => '14:30', 'label' => '14:00 - 14:30'],
            ['no' => 3, 'session' => 'afternoon', 'start' => '14:30', 'end' => '15:00', 'label' => '14:30 - 15:00'],
            ['no' => 4, 'session' => 'afternoon', 'start' => '15:00', 'end' => '15:30', 'label' => '15:00 - 15:30'],
            ['no' => 5, 'session' => 'afternoon', 'start' => '15:30', 'end' => '16:00', 'label' => '15:30 - 16:00'],
            ['no' => 6, 'session' => 'afternoon', 'start' => '16:00', 'end' => '16:30', 'label' => '16:00 - 16:30'],
            ['no' => 7, 'session' => 'evening',   'start' => '19:00', 'end' => '19:30', 'label' => '19:00 - 19:30'],
            ['no' => 8, 'session' => 'evening',   'start' => '19:30', 'end' => '20:00', 'label' => '19:30 - 20:00'],
            ['no' => 9, 'session' => 'evening',   'start' => '20:00', 'end' => '20:30', 'label' => '20:00 - 20:30'],
            ['no' => 10, 'session' => 'evening',  'start' => '20:30', 'end' => '21:00', 'label' => '20:30 - 21:00'],
            ['no' => 11, 'session' => 'evening',  'start' => '21:00', 'end' => '21:30', 'label' => '21:00 - 21:30'],
        ];
    }

    /**
     * Standard 5 Program Curriculums for Academic Affairs (Học vụ):
     * 1/ MSC - AI (13 subjects)
     * 2/ EMBA (HIGH _ STAND) (10 subjects)
     * 3/ MBA (HIGH _ STAND) (13 subjects)
     * 4/ BBA (11 subjects)
     * 5/ ISTEC (16 subjects)
     */
    public static function getStandardCurriculums(): array {
        return [
            'MSC - AI' => [
                ['code' => 'MSC-AI-01', 'name' => 'Artificial Intelligence and Machine Learning', 'credits' => 3],
                ['code' => 'MSC-AI-02', 'name' => 'Big Data Analytics', 'credits' => 3],
                ['code' => 'MSC-AI-03', 'name' => 'Digital and Computer Vision', 'credits' => 3],
                ['code' => 'MSC-AI-04', 'name' => 'Cyber-Physical Systems and IoT', 'credits' => 3],
                ['code' => 'MSC-AI-05', 'name' => 'Reinforcement Learning and AI Optimization', 'credits' => 3],
                ['code' => 'MSC-AI-06', 'name' => 'AI in Business Decision Making', 'credits' => 3],
                ['code' => 'MSC-AI-07', 'name' => 'Economic Forecasting and AI-Driven Market Dynamics', 'credits' => 3],
                ['code' => 'MSC-AI-08', 'name' => 'Research Methodology', 'credits' => 3],
                ['code' => 'MSC-AI-09', 'name' => 'AI Innovation and Entrepreneurship', 'credits' => 3],
                ['code' => 'MSC-AI-10', 'name' => 'Advanced Project Management in AI', 'credits' => 3],
                ['code' => 'MSC-AI-11', 'name' => 'Change management strategies for AI transition', 'credits' => 3],
                ['code' => 'MSC-AI-12', 'name' => 'Global AI policies and regulatory frameworks', 'credits' => 3],
                ['code' => 'MSC-AI-13', 'name' => 'CAPSTONE PROJECT', 'credits' => 6],
            ],
            'EMBA (HIGH _ STAND)' => [
                ['code' => 'EMBA-HS-01', 'name' => 'Accounting for Managers course', 'credits' => 3],
                ['code' => 'EMBA-HS-02', 'name' => 'Project management', 'credits' => 3],
                ['code' => 'EMBA-HS-03', 'name' => 'Marketing management', 'credits' => 3],
                ['code' => 'EMBA-HS-04', 'name' => 'Corporate finance', 'credits' => 3],
                ['code' => 'EMBA-HS-05', 'name' => 'Strategy Management', 'credits' => 3],
                ['code' => 'EMBA-HS-06', 'name' => 'Entrepreneurship and innovation', 'credits' => 3],
                ['code' => 'EMBA-HS-07', 'name' => 'Human capital and talent management', 'credits' => 3],
                ['code' => 'EMBA-HS-08', 'name' => 'Digital transformation', 'credits' => 3],
                ['code' => 'EMBA-HS-09', 'name' => 'Organizational Behavior', 'credits' => 3],
                ['code' => 'EMBA-HS-10', 'name' => 'Leadership Development', 'credits' => 3],
            ],
            'MBA (HIGH _ STAND)' => [
                ['code' => 'MBA-HS-01', 'name' => 'Accounting for Managers course', 'credits' => 3],
                ['code' => 'MBA-HS-02', 'name' => 'Project management', 'credits' => 3],
                ['code' => 'MBA-HS-03', 'name' => 'Marketing management', 'credits' => 3],
                ['code' => 'MBA-HS-04', 'name' => 'Corporate finance', 'credits' => 3],
                ['code' => 'MBA-HS-05', 'name' => 'Strategy Management', 'credits' => 3],
                ['code' => 'MBA-HS-06', 'name' => 'Entrepreneurship and innovation', 'credits' => 3],
                ['code' => 'MBA-HS-07', 'name' => 'Human capital and talent management', 'credits' => 3],
                ['code' => 'MBA-HS-08', 'name' => 'Digital transformation', 'credits' => 3],
                ['code' => 'MBA-HS-09', 'name' => 'Organizational Behavior', 'credits' => 3],
                ['code' => 'MBA-HS-10', 'name' => 'Leadership Development', 'credits' => 3],
                ['code' => 'MBA-HS-11', 'name' => 'AI in Business Decision Making', 'credits' => 3],
                ['code' => 'MBA-HS-12', 'name' => 'Research Methodology', 'credits' => 3],
                ['code' => 'MBA-HS-13', 'name' => 'MBA THESIS', 'credits' => 6],
            ],
            'BBA' => [
                ['code' => 'BBA-01', 'name' => 'Introduction to Management', 'credits' => 3],
                ['code' => 'BBA-02', 'name' => 'Introduction to Finance', 'credits' => 3],
                ['code' => 'BBA-03', 'name' => 'Organisational Behaviour', 'credits' => 3],
                ['code' => 'BBA-04', 'name' => 'Global Marketing', 'credits' => 3],
                ['code' => 'BBA-05', 'name' => 'AI in Business', 'credits' => 3],
                ['code' => 'BBA-06', 'name' => 'Project Management', 'credits' => 3],
                ['code' => 'BBA-07', 'name' => 'Innovation & Design Thinking', 'credits' => 3],
                ['code' => 'BBA-08', 'name' => 'Total Quality Management', 'credits' => 3],
                ['code' => 'BBA-09', 'name' => 'Change Management', 'credits' => 3],
                ['code' => 'BBA-10', 'name' => 'Management Information Systems', 'credits' => 3],
                ['code' => 'BBA-11', 'name' => 'Capstone Project', 'credits' => 6],
            ],
            'ISTEC' => [
                ['code' => 'ISTEC-01', 'name' => 'Strategic Management', 'credits' => 3],
                ['code' => 'ISTEC-02', 'name' => 'Leadership & Organizational Behavior', 'credits' => 3],
                ['code' => 'ISTEC-03', 'name' => 'Financial Management for Executives', 'credits' => 3],
                ['code' => 'ISTEC-04', 'name' => 'Marketing Strategy & Brand Management', 'credits' => 3],
                ['code' => 'ISTEC-05', 'name' => 'Business Ethics & Sustainable Development', 'credits' => 3],
                ['code' => 'ISTEC-06', 'name' => 'Business Analytics & Decision Making', 'credits' => 3],
                ['code' => 'ISTEC-07', 'name' => 'Digital Transformation & AI Strategy', 'credits' => 3],
                ['code' => 'ISTEC-08', 'name' => 'Operations & Supply Chain Management', 'credits' => 3],
                ['code' => 'ISTEC-09', 'name' => 'Entrepreneurship & Innovation Management', 'credits' => 3],
                ['code' => 'ISTEC-10', 'name' => 'Luxury & Premium Brand Management', 'credits' => 3],
                ['code' => 'ISTEC-11', 'name' => 'International Business Management', 'credits' => 3],
                ['code' => 'ISTEC-12', 'name' => 'Cross-Cultural Management', 'credits' => 3],
                ['code' => 'ISTEC-13', 'name' => 'Strategic Marketing in Emerging Markets', 'credits' => 3],
                ['code' => 'ISTEC-14', 'name' => 'International Negotiation & Business Development', 'credits' => 3],
                ['code' => 'ISTEC-15', 'name' => 'Consulting Project Management', 'credits' => 3],
                ['code' => 'ISTEC-16', 'name' => 'MBA THESIS / APPLIED BUSINESS PROJECT', 'credits' => 6],
            ],
            'MBA IN AI' => [
                ['code' => 'MBA-AI-01', 'name' => 'Marketing Management', 'credits' => 3],
                ['code' => 'MBA-AI-02', 'name' => 'Human Capital and Talent Management', 'credits' => 3],
                ['code' => 'MBA-AI-03', 'name' => 'Entrepreneurship and Innovation', 'credits' => 3],
                ['code' => 'MBA-AI-04', 'name' => 'Corporate Finance', 'credits' => 3],
                ['code' => 'MBA-AI-05', 'name' => 'Accounting for Managers', 'credits' => 3],
                ['code' => 'MBA-AI-06', 'name' => 'Digital Transformation', 'credits' => 3],
                ['code' => 'MBA-AI-07', 'name' => 'Global Strategy', 'credits' => 3],
                ['code' => 'MBA-AI-08', 'name' => 'Organizational Behaviour', 'credits' => 3],
                ['code' => 'MBA-AI-09', 'name' => 'Leadership Development', 'credits' => 3],
                ['code' => 'MBA-AI-10', 'name' => 'AI in Business Decision making', 'credits' => 3],
                ['code' => 'MBA-AI-11', 'name' => 'Big Data Analysis', 'credits' => 3],
                ['code' => 'MBA-AI-12', 'name' => 'Project Management', 'credits' => 3],
                ['code' => 'MBA-AI-13', 'name' => 'Thesis (Luận văn) - 18 ECTS', 'credits' => 18],
            ],
            'DBA ESTIAM' => [
                ['code' => 'DBA-ES-01', 'name' => 'Seminar 1: Introduction to Research', 'credits' => 6],
                ['code' => 'DBA-ES-02', 'name' => 'Seminar 2: Literature Review & Conceptual Framework', 'credits' => 6],
                ['code' => 'DBA-ES-03', 'name' => 'Seminar 3: Research Design & Qualitative Methodology', 'credits' => 6],
                ['code' => 'DBA-ES-04', 'name' => 'Seminar 4: Quantitative Analysis & Data Modeling', 'credits' => 6],
                ['code' => 'DBA-ES-05', 'name' => 'Seminar 5: Academic Writing & Publication Strategy', 'credits' => 6],
                ['code' => 'DBA-ES-06', 'name' => 'Seminar 6: Proposal Defense (Bảo vệ Đề cương Nghiên cứu)', 'credits' => 10],
                ['code' => 'DBA-ES-07', 'name' => 'DBA Thesis Supervision & Final Defense (Luận án Tiến sĩ)', 'credits' => 20],
            ],
        ];
    }

    public static function matchStandardProgramKey(string $programName): ?string {
        $raw = trim($programName);
        if ($raw === '') return null;
        $curriculums = self::getStandardCurriculums();
        foreach (array_keys($curriculums) as $exactKey) {
            if (mb_strtolower($raw, 'UTF-8') === mb_strtolower($exactKey, 'UTF-8')) {
                return $exactKey;
            }
        }
        $upper = mb_strtoupper($raw, 'UTF-8');
        if (str_contains($upper, 'ISTEC')) {
            return 'ISTEC';
        }
        if (str_contains($upper, 'DBA') || str_contains($upper, 'ESTIAM') || str_contains($upper, 'PARIS EDUCATION')) {
            return 'DBA ESTIAM';
        }
        if (str_contains($upper, 'MBA IN AI') || (str_contains($upper, 'MBA') && preg_match('/\bAI\b/u', $upper))) {
            return 'MBA IN AI';
        }
        if (str_contains($upper, 'MSC') || str_contains($upper, 'AI ST') || str_contains($upper, 'M.SC') || preg_match('/\bAI\b/u', $upper)) {
            return 'MSC - AI';
        }
        if (str_contains($upper, 'BBA') || str_contains($upper, 'BACHELOR') || str_contains($upper, 'TOP UP') || str_contains($upper, 'TOPUP') || str_contains($upper, 'CỬ NHÂN') || str_contains($upper, 'CU NHAN')) {
            return 'BBA';
        }
        if (str_contains($upper, 'EMBA') || str_contains($upper, 'EXECUTIVE MBA')) {
            return 'EMBA (HIGH _ STAND)';
        }
        if (str_contains($upper, 'MBA') || str_contains($upper, 'HIGH') || str_contains($upper, 'SWISS') || str_contains($upper, 'UMEF')) {
            return 'MBA (HIGH _ STAND)';
        }
        return null;
    }

    public static function getProgramCurriculumSubjects(string $programName): array {
        $matchedKey = self::matchStandardProgramKey($programName);
        if ($matchedKey === null) return [];
        $curriculums = self::getStandardCurriculums();
        return $curriculums[$matchedKey] ?? [];
    }

    /**
     * Official IDEAS / Swiss UMEF 6.0 ECTS Grading Scale helper:
     * - A (Excellent):    5.25 – 6.00 => passed
     * - B (Very Good):    4.75 – 5.24 => passed
     * - C (Good):         4.50 – 4.74 => passed
     * - D (Satisfactory): 4.25 – 4.49 => passed
     * - E (Pass):         4.00 – 4.24 => passed (Minimum passing grade for ECTS credits)
     * - F (Fail):         < 4.00      => failed (3.50 - <4.00: Retake; < 3.50: Redo)
     */
    public static function inferEctsGrade6(float $rawScore): array {
        $score6 = $rawScore;
        if ($rawScore > 10.0) {
            $score6 = round(($rawScore / 100.0) * 6.0, 2);
        } elseif ($rawScore > 6.0) {
            $score6 = round(($rawScore / 10.0) * 6.0, 2);
        }
        if ($score6 >= 5.25) {
            return ['score6' => $score6, 'letter' => 'A (Excellent)', 'short' => 'A', 'status' => 'passed'];
        }
        if ($score6 >= 4.75) {
            return ['score6' => $score6, 'letter' => 'B (Very Good)', 'short' => 'B', 'status' => 'passed'];
        }
        if ($score6 >= 4.50) {
            return ['score6' => $score6, 'letter' => 'C (Good)', 'short' => 'C', 'status' => 'passed'];
        }
        if ($score6 >= 4.25) {
            return ['score6' => $score6, 'letter' => 'D (Satisfactory)', 'short' => 'D', 'status' => 'passed'];
        }
        if ($score6 >= 4.00) {
            return ['score6' => $score6, 'letter' => 'E (Pass)', 'short' => 'E', 'status' => 'passed'];
        }
        $failLabel = $score6 >= 3.50 ? 'F (Fail - Retake)' : 'F (Fail - Redo)';
        return ['score6' => $score6, 'letter' => $failLabel, 'short' => 'F', 'status' => 'failed'];
    }

    /**
     * Resolve effective campaign_id and subjects for a student contact
     */
    private function resolveStudentCourseAndSubjects(array $contact, int $overrideCampaignId = 0, string $overrideProgram = ''): array {
        $campaignId = $overrideCampaignId > 0 ? $overrideCampaignId : (int)($contact['campaign_id'] ?? 0);
        $projectId = (int)($contact['project_id'] ?? 0);
        $program = $overrideProgram !== '' ? trim($overrideProgram) : trim((string)($contact['program'] ?? ''));

        $tid = (int)($contact['tenant_id'] ?? ($GLOBALS['current_tenant_id'] ?? 1));
        if ($campaignId <= 0) {
            if ($projectId <= 0 && $program !== '') {
                $stmtP = $this->db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND deleted_at IS NULL AND (LOWER(name) = LOWER(?) OR name LIKE ?) LIMIT 1");
                $stmtP->execute([$tid, $program, "%{$program}%"]);
                $projectId = (int)$stmtP->fetchColumn();
            }
            if ($projectId > 0) {
                $stmtMc = $this->db->prepare("
                    SELECT id FROM marketing_campaigns
                    WHERE tenant_id = ? AND project_id = ? AND status NOT IN ('deleted', 'archived')
                    ORDER BY (status = 'active') DESC, id DESC
                    LIMIT 1
                ");
                $stmtMc->execute([$tid, $projectId]);
                $campaignId = (int)$stmtMc->fetchColumn();
            }
        }

        $campaign = null;
        $subjects = [];
        if ($campaignId > 0) {
            $stmtC = $this->db->prepare("SELECT id, name, project_id, subjects_json, status FROM marketing_campaigns WHERE id = ? AND tenant_id = ? LIMIT 1");
            $stmtC->execute([$campaignId, $tid]);
            $campaign = $stmtC->fetch(PDO::FETCH_ASSOC) ?: null;
            if ($campaign && !empty($campaign['subjects_json'])) {
                $decoded = is_string($campaign['subjects_json']) ? json_decode($campaign['subjects_json'], true) : $campaign['subjects_json'];
                if (is_array($decoded)) {
                    $subjects = $decoded;
                }
            }
        }

        // Auto-expand curriculum subjects from the standard programs when a program is selected
        $standardSubjects = self::getProgramCurriculumSubjects($program);
        if (!empty($standardSubjects)) {
            $matchedKey = self::matchStandardProgramKey($program);
            $campMatchedKey = $campaign ? self::matchStandardProgramKey((string)($campaign['name'] ?? '')) : null;
            if ($overrideProgram !== '' || empty($subjects) || ($matchedKey !== null && $campMatchedKey !== $matchedKey)) {
                // Preserve any configured host_sessions / seminars / zoom from existing campaign subjects
                $existingByName = [];
                foreach ($subjects as $exSub) {
                    $kName = mb_strtolower(trim((string)($exSub['name'] ?? '')), 'UTF-8');
                    $kCode = mb_strtolower(trim((string)($exSub['code'] ?? '')), 'UTF-8');
                    if ($kName !== '') $existingByName[$kName] = $exSub;
                    if ($kCode !== '') $existingByName[$kCode] = $exSub;
                }
                foreach ($standardSubjects as &$stdSub) {
                    $sN = mb_strtolower(trim((string)($stdSub['name'] ?? '')), 'UTF-8');
                    $sC = mb_strtolower(trim((string)($stdSub['code'] ?? '')), 'UTF-8');
                    $matchedEx = $existingByName[$sN] ?? $existingByName[$sC] ?? null;
                    if ($matchedEx) {
                        $stdSub = array_merge($matchedEx, $stdSub);
                    }
                }
                unset($stdSub);
                $subjects = $standardSubjects;
            }
        } elseif (empty($subjects) && $campaign && !empty($campaign['name'])) {
            $fallbackSubjects = self::getProgramCurriculumSubjects((string)$campaign['name']);
            if (!empty($fallbackSubjects)) {
                $subjects = $fallbackSubjects;
            }
        }

        return [
            'campaign_id' => $campaignId,
            'campaign' => $campaign,
            'subjects' => $subjects,
            'program' => $program
        ];
    }

    /**
     * 1A. GET /academic/student-grades/{contactId}
     */
    public function getStudentGrades(array $auth, int $contactId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $stmt = $this->db->prepare("SELECT id, full_name, email, phone, student_id, program, project_id, campaign_id, study_status FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$contactId, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) {
            respond(404, null, 'Không tìm thấy học viên', false);
        }

        $reqCampaignId = isset($_GET['campaign_id']) ? (int)$_GET['campaign_id'] : 0;
        $reqProgram = isset($_GET['program']) ? trim((string)$_GET['program']) : '';
        $resolved = $this->resolveStudentCourseAndSubjects($contact, $reqCampaignId, $reqProgram);
        $campaignId = (int)$resolved['campaign_id'];
        $subjects = $resolved['subjects'];

        $stmtG = $this->db->prepare("
            SELECT * FROM student_subject_grades
            WHERE tenant_id = ? AND contact_id = ?
            ORDER BY id ASC
        ");
        $stmtG->execute([$tid, $contactId]);
        $gradeRows = $stmtG->fetchAll(PDO::FETCH_ASSOC);

        $gradesByKey = [];
        foreach ($gradeRows as $gr) {
            $codeKey = mb_strtolower(trim((string)($gr['subject_code'] ?? '')), 'UTF-8');
            $nameKey = mb_strtolower(trim((string)($gr['subject_name'] ?? '')), 'UTF-8');
            if ($codeKey !== '') $gradesByKey['code:' . $codeKey] = $gr;
            if ($nameKey !== '') $gradesByKey['name:' . $nameKey] = $gr;
        }

        // Lookup lecturer names
        $lecturerMap = [];
        try {
            $resComp = $this->db->query("SELECT id, name FROM companies WHERE deleted_at IS NULL");
            if ($resComp) {
                while ($r = $resComp->fetch(PDO::FETCH_ASSOC)) {
                    $lecturerMap[(string)$r['id']] = $r['name'];
                }
            }
        } catch (\Throwable $e) {}

        $mergedSubjects = [];
        $passedCount = 0;
        $numericScores = [];
        $matchedGradeIds = [];

        foreach ($subjects as $idx => $sub) {
            $sCode = trim((string)($sub['code'] ?? ''));
            $sName = trim((string)($sub['name'] ?? ('Môn học ' . ($idx + 1))));
            $cKey = 'code:' . mb_strtolower($sCode, 'UTF-8');
            $nKey = 'name:' . mb_strtolower($sName, 'UTF-8');

            $gr = ($sCode !== '' && isset($gradesByKey[$cKey]))
                ? $gradesByKey[$cKey]
                : (isset($gradesByKey[$nKey]) ? $gradesByKey[$nKey] : null);

            if ($gr) {
                $matchedGradeIds[(int)$gr['id']] = true;
            }

            $finalScore = $gr['final_score'] ?? '';
            $letterGrade = $gr['letter_grade'] ?? '';
            $status = $gr['status'] ?? 'studying';

            // Auto-infer letter grade on the 6.0 ECTS scale when score is numeric
            if ($finalScore !== '' && is_numeric($finalScore)) {
                $num = (float)$finalScore;
                $ects = self::inferEctsGrade6($num);
                $numericScores[] = $ects['score6'];
                if ($letterGrade === '' || preg_match('/^(A|B|C|D|E|F)\b/i', $letterGrade)) {
                    $letterGrade = $ects['letter'];
                }
            }

            if (in_array($status, ['passed', 'exempt', 'completed'], true) || ($finalScore !== '' && is_numeric($finalScore) && self::inferEctsGrade6((float)$finalScore)['status'] === 'passed')) {
                $passedCount++;
            }

            $lectId = (string)($sub['lecturer_id'] ?? '');
            $lectName = $lectId !== '' ? ($lecturerMap[$lectId] ?? $lectId) : 'Chưa phân công';

            $mergedSubjects[] = [
                'subject_index' => $idx,
                'subject_code' => $sCode !== '' ? $sCode : ('SUB-' . ($idx + 1)),
                'subject_name' => $sName,
                'lecturer_id' => $sub['lecturer_id'] ?? null,
                'lecturer_name' => $lectName,
                'sessions_count' => count($sub['host_sessions'] ?? []) + count($sub['seminars'] ?? []),
                'host_sessions' => $sub['host_sessions'] ?? [],
                'seminars' => $sub['seminars'] ?? [],
                'zoom_link' => $sub['zoom_link'] ?? ($sub['seminar_zoom_link'] ?? ($sub['school_zoom_link'] ?? '')),
                'zoom_id' => $sub['zoom_id'] ?? ($sub['seminar_zoom_id'] ?? ($sub['school_zoom_id'] ?? '')),
                'zoom_pass' => $sub['zoom_pass'] ?? ($sub['seminar_zoom_pass'] ?? ($sub['school_zoom_pass'] ?? '')),
                'ai_agent_link' => $sub['ai_agent_link'] ?? '',
                'school_lecturer' => $sub['school_lecturer'] ?? '',
                'grade_id' => $gr ? (int)$gr['id'] : null,
                'attendance_score' => $gr['attendance_score'] ?? '',
                'assignment_score' => $gr['assignment_score'] ?? '',
                'final_score' => $finalScore,
                'letter_grade' => $letterGrade,
                'status' => $status,
                'note' => $gr['note'] ?? '',
                'updated_at' => $gr['updated_at'] ?? null
            ];
        }

        // Also append any custom graded subjects not in campaign.subjects_json (unless switching to a standard program)
        foreach ($gradeRows as $gr) {
            if (isset($matchedGradeIds[(int)$gr['id']])) continue;
            if (!empty($subjects) && $reqProgram !== '' && !str_starts_with(strtoupper((string)($gr['subject_code'] ?? '')), 'CUSTOM')) {
                continue;
            }
            $finalScore = $gr['final_score'] ?? '';
            if ($finalScore !== '' && is_numeric($finalScore)) {
                $num = (float)$finalScore;
                $numericScores[] = self::inferEctsGrade6($num)['score6'];
            }
            if (in_array($gr['status'] ?? '', ['passed', 'exempt', 'completed'], true)) {
                $passedCount++;
            }
            $mergedSubjects[] = [
                'subject_index' => count($mergedSubjects),
                'subject_code' => $gr['subject_code'] ?: 'CUSTOM',
                'subject_name' => $gr['subject_name'] ?: 'Học phần bổ sung',
                'lecturer_id' => null,
                'lecturer_name' => '—',
                'sessions_count' => 0,
                'grade_id' => (int)$gr['id'],
                'attendance_score' => $gr['attendance_score'] ?? '',
                'assignment_score' => $gr['assignment_score'] ?? '',
                'final_score' => $finalScore,
                'letter_grade' => $gr['letter_grade'] ?? '',
                'status' => $gr['status'] ?? 'studying',
                'note' => $gr['note'] ?? '',
                'updated_at' => $gr['updated_at'] ?? null
            ];
        }

        $totalSubs = count($mergedSubjects);
        $studyingCount = 0;
        $postponedCount = 0;
        $failedCount = 0;
        foreach ($mergedSubjects as $ms) {
            $st = strtolower((string)($ms['status'] ?? 'studying'));
            if (in_array($st, ['passed', 'exempt', 'completed'], true)) continue;
            elseif ($st === 'postponed' || $st === 'postpone') $postponedCount++;
            elseif ($st === 'failed' || $st === 'fail') $failedCount++;
            else $studyingCount++;
        }
        $gpa10 = !empty($numericScores) ? round(array_sum($numericScores) / count($numericScores), 2) : null;
        $completionPct = $totalSubs > 0 ? round(($passedCount / $totalSubs) * 100, 1) : 0;
        $courseName = ($reqProgram !== '' ? $reqProgram : '') ?: ($resolved['program'] ?: ($resolved['campaign']['name'] ?? ($contact['program'] ?? '')));

        respond(200, [
            'contact_id' => $contactId,
            'student' => $contact,
            'campaign_id' => $campaignId,
            'course_name' => $courseName,
            'course' => [
                'id' => $campaignId,
                'name' => $courseName
            ],
            'subjects' => $mergedSubjects,
            'summary' => [
                'total_subjects' => $totalSubs,
                'passed_count' => $passedCount,
                'studying_count' => $studyingCount,
                'postponed_count' => $postponedCount,
                'failed_count' => $failedCount,
                'gpa_10' => $gpa10,
                'completion_pct' => $completionPct
            ]
        ], 'Tải bảng điểm môn học thành công');
    }

    /**
     * 1B. POST /academic/student-grades/{contactId}
     */
    public function saveStudentGrades(array $auth, int $contactId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        $stmt = $this->db->prepare("SELECT id, full_name, campaign_id FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$contactId, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) {
            respond(404, null, 'Không tìm thấy học viên', false);
        }

        $campaignId = isset($body['campaign_id']) ? (int)$body['campaign_id'] : (int)($contact['campaign_id'] ?? 0);
        $gradesList = [];
        if (!empty($body['grades']) && is_array($body['grades'])) {
            $gradesList = $body['grades'];
        } elseif (!empty($body['subject_name']) || !empty($body['subject_code'])) {
            $gradesList = [$body];
        }

        if (empty($gradesList)) {
            respond(422, null, 'Không có dữ liệu điểm môn học để lưu', false);
        }

        $this->db->beginTransaction();
        try {
            $savedCount = 0;
            $updatedSubjectNames = [];

            $stmtChk = $this->db->prepare("
                SELECT id FROM student_subject_grades
                WHERE tenant_id = ? AND contact_id = ?
                  AND ((subject_code != '' AND LOWER(subject_code) = LOWER(?)) OR LOWER(subject_name) = LOWER(?))
                LIMIT 1
            ");
            $stmtUpd = $this->db->prepare("
                UPDATE student_subject_grades
                SET campaign_id = ?, subject_code = ?, subject_name = ?,
                    attendance_score = ?, assignment_score = ?, final_score = ?,
                    letter_grade = ?, status = ?, note = ?, updated_by = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $stmtIns = $this->db->prepare("
                INSERT INTO student_subject_grades
                    (tenant_id, contact_id, campaign_id, subject_code, subject_name, attendance_score, assignment_score, final_score, letter_grade, status, note, updated_by, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");

            foreach ($gradesList as $item) {
                $sCode = trim((string)($item['subject_code'] ?? ''));
                $sName = trim((string)($item['subject_name'] ?? ''));
                if ($sCode === '' && $sName === '') continue;

                $attScore = isset($item['attendance_score']) && trim((string)$item['attendance_score']) !== '' ? trim((string)$item['attendance_score']) : null;
                $assScore = isset($item['assignment_score']) && trim((string)$item['assignment_score']) !== '' ? trim((string)$item['assignment_score']) : null;
                $finScore = isset($item['final_score']) && trim((string)$item['final_score']) !== '' ? trim((string)$item['final_score']) : null;
                $letterGrade = isset($item['letter_grade']) && trim((string)$item['letter_grade']) !== '' ? trim((string)$item['letter_grade']) : null;
                $status = strtolower(trim((string)($item['status'] ?? 'studying')));
                $note = isset($item['note']) ? trim((string)$item['note']) : null;

                // Auto-calculate final_score if Quiz (50%) and Final (50%) provided and final_score is empty
                if ($finScore === null && ($attScore !== null || $assScore !== null)) {
                    if (is_numeric($attScore) && is_numeric($assScore)) {
                        $finScore = (string)round(((float)$attScore * 0.5) + ((float)$assScore * 0.5), 2);
                    }
                }

                // Auto-infer letter grade & passed status on the 6.0 ECTS scale when numeric score is entered
                if ($finScore !== null && is_numeric($finScore)) {
                    $num = (float)$finScore;
                    $ects = self::inferEctsGrade6($num);
                    if ($letterGrade === null || preg_match('/^(A|B|C|D|E|F)\b/i', $letterGrade)) {
                        $letterGrade = $ects['letter'];
                    }
                    if ($status === 'studying' || $status === 'passed' || $status === 'failed') {
                        $status = $ects['status'];
                    }
                }

                // Check existing grade row
                $stmtChk->execute([$tid, $contactId, $sCode, $sName]);
                $existingId = (int)$stmtChk->fetchColumn();

                if ($existingId > 0) {
                    $stmtUpd->execute([
                        $campaignId, $sCode, $sName,
                        $attScore, $assScore, $finScore,
                        $letterGrade, $status, $note, $uid,
                        $existingId
                    ]);
                } else {
                    $stmtIns->execute([
                        $tid, $contactId, $campaignId, $sCode, $sName,
                        $attScore, $assScore, $finScore, $letterGrade, $status, $note, $uid
                    ]);
                }

                $savedCount++;
                $updatedSubjectNames[] = ($sCode ? "[{$sCode}] " : "") . $sName . ($finScore !== null ? " (Điểm: {$finScore})" : "");
            }

            if ($savedCount > 0) {
                $senderName = trim($auth['full_name'] ?? $auth['name'] ?? 'Học vụ');
                $actSubject = "📊 {$senderName} đã cập nhật điểm môn học ({$savedCount} môn)";
                $actBody = "Chi tiết cập nhật bảng điểm:\n• " . implode("\n• ", array_slice($updatedSubjectNames, 0, 15));
                $stmtAct = $this->db->prepare("
                    INSERT INTO activities (tenant_id, user_id, created_by, type, subject, body, status, priority, due_date, done_at, related_type, related_id, contact_id)
                    VALUES (?, ?, ?, 'note', ?, ?, 'done', 'medium', NOW(), NOW(), 'contact', ?, ?)
                ");
                $stmtAct->execute([$tid, $uid, $uid, $actSubject, $actBody, $contactId, $contactId]);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi lưu điểm môn học: ' . $e->getMessage(), false);
        }

        // Return refreshed student grades
        $this->getStudentGrades($auth, $contactId);
    }

    /**
     * 2A. GET /academic/class-gradebook/{campaignId}
     * Load full class roster + all subjects + existing grades matrix for bulk editing / Excel export
     */
    public function getClassGradebook(array $auth, int $campaignId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $projectId = isset($_GET['project_id']) ? (int)$_GET['project_id'] : 0;
        $reqProgram = isset($_GET['program']) ? trim((string)$_GET['program']) : '';

        $campaign = null;
        if ($campaignId > 0) {
            $stmtC = $this->db->prepare("
                SELECT mc.*, p.name as project_name
                FROM marketing_campaigns mc
                LEFT JOIN projects p ON p.id = mc.project_id
                WHERE mc.id = ? AND mc.tenant_id = ? LIMIT 1
            ");
            $stmtC->execute([$campaignId, $tid]);
            $campaign = $stmtC->fetch(PDO::FETCH_ASSOC);
            if ($campaign && $projectId <= 0) {
                $projectId = (int)($campaign['project_id'] ?? 0);
            }
        }

        if (!$campaign && $projectId <= 0 && $reqProgram === '') {
            respond(404, null, 'Không tìm thấy thông tin khóa học / lớp học', false);
        }

        $subjectsRaw = !empty($campaign['subjects_json'])
            ? (is_string($campaign['subjects_json']) ? json_decode($campaign['subjects_json'], true) : $campaign['subjects_json'])
            : [];
        if (!is_array($subjectsRaw)) $subjectsRaw = [];

        if ($reqProgram !== '') {
            $stdSubs = self::getProgramCurriculumSubjects($reqProgram);
            if (!empty($stdSubs)) {
                $subjectsRaw = $stdSubs;
            }
        } elseif (empty($subjectsRaw)) {
            $fallbackProg = trim((string)($campaign['project_name'] ?? $campaign['name'] ?? ''));
            if ($fallbackProg !== '') {
                $stdSubs = self::getProgramCurriculumSubjects($fallbackProg);
                if (!empty($stdSubs)) {
                    $subjectsRaw = $stdSubs;
                }
            }
        }

        $subjects = [];
        foreach ($subjectsRaw as $idx => $s) {
            $sCode = trim((string)($s['code'] ?? ''));
            $sName = trim((string)($s['name'] ?? ('Môn ' . ($idx + 1))));
            $subjects[] = [
                'index' => $idx,
                'code' => $sCode !== '' ? $sCode : ('SUB-' . ($idx + 1)),
                'name' => $sName,
                'key' => ($sCode !== '' ? $sCode : $sName)
            ];
        }

        // Fetch all students in this campaign OR in this project/program (if include_project_students=1 or campaign has 0 direct contacts)
        $includeProject = !empty($_GET['include_project']) || true;
        $progName = $reqProgram !== '' ? $reqProgram : trim((string)($campaign['project_name'] ?? ''));

        $params = [$tid];
        $conds = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
        $studentFilter = "(c.status = 'customer' OR c.customer_type = 'student' OR c.pipeline_status = 'enrolled' OR c.stage_id IN (14, 44) OR COALESCE(c.student_id, '') != '')";
        $conds[] = $studentFilter;

        if ($reqProgram !== '' && $campaignId <= 0) {
            $matchedKey = self::matchStandardProgramKey($reqProgram);
            if ($matchedKey === 'MBA IN AI') {
                $conds[] = "(LOWER(TRIM(c.program)) = LOWER(?) OR c.program LIKE '%MBA IN AI%' OR (c.program LIKE '%MBA%' AND c.program LIKE '%AI%') OR c.project_id IN (20, 21))";
                $params[] = $reqProgram;
            } elseif ($matchedKey === 'MSC - AI') {
                $conds[] = "(LOWER(TRIM(c.program)) = LOWER(?) OR (c.program LIKE '%AI%' AND c.program NOT LIKE '%MBA%') OR c.program LIKE '%MSC%' OR c.program LIKE '%ESTIAM%' OR c.project_id = 11)";
                $params[] = $reqProgram;
            } elseif ($matchedKey === 'EMBA (HIGH _ STAND)') {
                $conds[] = "(LOWER(TRIM(c.program)) = LOWER(?) OR c.program LIKE '%EMBA%' OR c.project_id IN (14, 15))";
                $params[] = $reqProgram;
            } elseif ($matchedKey === 'MBA (HIGH _ STAND)') {
                $conds[] = "(LOWER(TRIM(c.program)) = LOWER(?) OR (c.program LIKE '%MBA%' AND c.program NOT LIKE '%EMBA%' AND c.program NOT LIKE '%AI%') OR c.program LIKE '%SWISS%' OR c.program LIKE '%UMEF%' OR c.program LIKE '%UBIS%' OR c.project_id IN (12, 13))";
                $params[] = $reqProgram;
            } elseif ($matchedKey === 'BBA') {
                $conds[] = "(LOWER(TRIM(c.program)) = LOWER(?) OR c.program LIKE '%BBA%' OR c.program LIKE '%TOP UP%' OR c.project_id = 19)";
                $params[] = $reqProgram;
            } elseif ($matchedKey === 'ISTEC') {
                $conds[] = "(LOWER(TRIM(c.program)) = LOWER(?) OR c.program LIKE '%ISTEC%' OR c.project_id IN (10, 17))";
                $params[] = $reqProgram;
            } else {
                $conds[] = "(LOWER(TRIM(c.program)) = LOWER(?) OR c.program LIKE ?)";
                $params[] = $reqProgram;
                $params[] = "%{$reqProgram}%";
            }
        } elseif ($campaignId > 0 && $projectId > 0 && $includeProject) {
            if ($progName !== '') {
                $conds[] = "(c.campaign_id = ? OR c.project_id = ? OR LOWER(TRIM(c.program)) = LOWER(?) OR c.program LIKE ?)";
                $params[] = $campaignId;
                $params[] = $projectId;
                $params[] = $progName;
                $params[] = "%{$progName}%";
            } else {
                $conds[] = "(c.campaign_id = ? OR c.project_id = ?)";
                $params[] = $campaignId;
                $params[] = $projectId;
            }
        } elseif ($campaignId > 0) {
            $conds[] = "c.campaign_id = ?";
            $params[] = $campaignId;
        } elseif ($projectId > 0) {
            $conds[] = "c.project_id = ?";
            $params[] = $projectId;
        }

        $sqlStu = "
            SELECT c.id, c.full_name, c.student_id, c.email, c.phone, c.mobile, c.program, c.project_id, c.campaign_id,
                   COALESCE(c.study_status, 'studying') as study_status, c.admission_date
            FROM contacts c
            WHERE " . implode(" AND ", $conds) . "
            ORDER BY (c.campaign_id = " . (int)$campaignId . ") DESC, c.full_name ASC
            LIMIT 500
        ";
        $stmtStu = $this->db->prepare($sqlStu);
        $stmtStu->execute($params);
        $students = $stmtStu->fetchAll(PDO::FETCH_ASSOC);

        // Batch fetch grades for all these students (Anti-N+1)
        $gradesMap = [];
        if (!empty($students)) {
            $contactIds = array_values(array_unique(array_map(fn($s) => (int)$s['id'], $students)));
            $placeholders = implode(',', array_fill(0, count($contactIds), '?'));
            $stmtGr = $this->db->prepare("
                SELECT * FROM student_subject_grades
                WHERE tenant_id = ? AND contact_id IN ($placeholders)
            ");
            $stmtGr->execute(array_merge([$tid], $contactIds));
            while ($gr = $stmtGr->fetch(PDO::FETCH_ASSOC)) {
                $cid = (int)$gr['contact_id'];
                if (!isset($gradesMap[$cid])) $gradesMap[$cid] = [];
                $sCode = trim((string)($gr['subject_code'] ?? ''));
                $sName = trim((string)($gr['subject_name'] ?? ''));
                if ($sCode !== '') $gradesMap[$cid][$sCode] = $gr;
                if ($sName !== '') $gradesMap[$cid][$sName] = $gr;
            }
        }

        respond(200, [
            'campaign' => [
                'id' => (int)($campaign['id'] ?? $campaignId),
                'name' => $campaign['name'] ?? 'Danh sách lớp',
                'project_id' => $projectId,
                'project_name' => $progName
            ],
            'subjects' => $subjects,
            'students' => $students,
            'grades_map' => $gradesMap
        ], 'Tải bảng điểm lớp thành công');
    }

    /**
     * 2B. POST /academic/class-gradebook/{campaignId}
     * Bulk save grades for an entire class (from Spreadsheet Grid OR Excel/CSV Import)
     */
    public function saveClassGradebook(array $auth, int $campaignId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        $rows = $body['rows'] ?? $body['students'] ?? [];
        if (!is_array($rows) || empty($rows)) {
            respond(422, null, 'Không có dữ liệu bảng điểm lớp để lưu', false);
        }

        // Pre-fetch contacts in tenant for fast matching by ID / student_id / email / phone
        $stmtAll = $this->db->prepare("
            SELECT id, full_name, student_id, email, phone, mobile
            FROM contacts
            WHERE tenant_id = ? AND deleted_at IS NULL
        ");
        $stmtAll->execute([$tid]);
        $byId = [];
        $byStudentCode = [];
        $byEmail = [];
        $byPhone9 = [];

        while ($c = $stmtAll->fetch(PDO::FETCH_ASSOC)) {
            $cid = (int)$c['id'];
            $byId[$cid] = $cid;
            $sCode = mb_strtolower(trim((string)($c['student_id'] ?? '')), 'UTF-8');
            if ($sCode !== '') $byStudentCode[$sCode] = $cid;
            $em = mb_strtolower(trim((string)($c['email'] ?? '')), 'UTF-8');
            if ($em !== '') $byEmail[$em] = $cid;
            $ph = preg_replace('/\D/', '', (string)($c['phone'] ?: $c['mobile'] ?? ''));
            if (strlen($ph) >= 9) $byPhone9[substr($ph, -9)] = $cid;
        }

        $this->db->beginTransaction();
        try {
            $updatedStudents = 0;
            $updatedGradesCount = 0;

            $stmtChk = $this->db->prepare("
                SELECT id FROM student_subject_grades
                WHERE tenant_id = ? AND contact_id = ?
                  AND ((subject_code != '' AND LOWER(subject_code) = LOWER(?)) OR LOWER(subject_name) = LOWER(?))
                LIMIT 1
            ");
            $stmtUpd = $this->db->prepare("
                UPDATE student_subject_grades
                SET campaign_id = COALESCE(NULLIF(?, 0), campaign_id),
                    subject_code = ?, subject_name = ?,
                    attendance_score = COALESCE(?, attendance_score),
                    assignment_score = COALESCE(?, assignment_score),
                    final_score = ?, letter_grade = ?, status = ?,
                    note = COALESCE(?, note), updated_by = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $stmtIns = $this->db->prepare("
                INSERT INTO student_subject_grades
                    (tenant_id, contact_id, campaign_id, subject_code, subject_name, attendance_score, assignment_score, final_score, letter_grade, status, note, updated_by, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");

            foreach ($rows as $row) {
                $cid = (int)($row['contact_id'] ?? 0);
                if ($cid <= 0 || !isset($byId[$cid])) {
                    $sCode = mb_strtolower(trim((string)($row['student_id'] ?? $row['student_code'] ?? '')), 'UTF-8');
                    $em = mb_strtolower(trim((string)($row['email'] ?? '')), 'UTF-8');
                    $ph = preg_replace('/\D/', '', (string)($row['phone'] ?? ''));
                    if ($sCode !== '' && isset($byStudentCode[$sCode])) {
                        $cid = $byStudentCode[$sCode];
                    } elseif ($em !== '' && isset($byEmail[$em])) {
                        $cid = $byEmail[$em];
                    } elseif (strlen($ph) >= 9 && isset($byPhone9[substr($ph, -9)])) {
                        $cid = $byPhone9[substr($ph, -9)];
                    }
                }

                if ($cid <= 0) continue;

                $grades = $row['grades'] ?? [];
                if (!is_array($grades) || empty($grades)) continue;

                $studentChanged = false;
                foreach ($grades as $subKey => $gData) {
                    if (!is_array($gData)) {
                        $gData = ['final_score' => (string)$gData];
                    }
                    $sCode = trim((string)($gData['subject_code'] ?? $subKey));
                    $sName = trim((string)($gData['subject_name'] ?? $subKey));
                    $finScore = isset($gData['final_score']) ? trim((string)$gData['final_score']) : '';
                    $attScore = isset($gData['attendance_score']) ? trim((string)$gData['attendance_score']) : null;
                    $assScore = isset($gData['assignment_score']) ? trim((string)$gData['assignment_score']) : null;
                    $letterGrade = isset($gData['letter_grade']) ? trim((string)$gData['letter_grade']) : '';
                    $status = strtolower(trim((string)($gData['status'] ?? '')));
                    $note = isset($gData['note']) ? trim((string)$gData['note']) : null;

                    $stmtChk->execute([$tid, $cid, $sCode, $sName]);
                    $existingId = (int)$stmtChk->fetchColumn();

                    $isUntouchedBlank = (
                        $finScore === '' &&
                        ($attScore === null || $attScore === '') &&
                        ($assScore === null || $assScore === '') &&
                        $letterGrade === '' &&
                        ($status === '' || $status === 'studying') &&
                        ($note === null || $note === '')
                    );
                    if ($isUntouchedBlank && $existingId <= 0) {
                        continue;
                    }

                    if ($finScore === '' && $attScore !== null && $assScore !== null && is_numeric($attScore) && is_numeric($assScore)) {
                        $finScore = (string)round(((float)$attScore * 0.5) + ((float)$assScore * 0.5), 2);
                    }

                    if ($finScore !== '' && is_numeric($finScore)) {
                        $num = (float)$finScore;
                        $ects = self::inferEctsGrade6($num);
                        if ($letterGrade === '' || preg_match('/^(A|B|C|D|E|F)\b/i', $letterGrade)) {
                            $letterGrade = $ects['letter'];
                        }
                        if ($status === '' || $status === 'studying' || $status === 'passed' || $status === 'failed') {
                            $status = $ects['status'];
                        }
                    }
                    if ($status === '') $status = 'studying';

                    if ($existingId > 0) {
                        $stmtUpd->execute([
                            $campaignId, $sCode, $sName,
                            $attScore, $assScore, $finScore, $letterGrade, $status,
                            $note, $uid, $existingId
                        ]);
                    } else {
                        $stmtIns->execute([
                            $tid, $cid, $campaignId, $sCode, $sName,
                            $attScore, $assScore, $finScore, $letterGrade, $status, $note, $uid
                        ]);
                    }

                    $updatedGradesCount++;
                    $studentChanged = true;
                }

                if ($studentChanged) {
                    $updatedStudents++;
                }
            }

            $this->db->commit();

            respond(200, [
                'updated_students' => $updatedStudents,
                'updated_grades' => $updatedGradesCount
            ], "Đã cập nhật thành công {$updatedGradesCount} đầu điểm cho {$updatedStudents} học viên!");
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi cập nhật bảng điểm lớp: ' . $e->getMessage(), false);
        }
    }

    /**
     * 3A. GET /academic/postpone/{contactId}
     */
    public function getPostponeInfo(array $auth, int $contactId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $stmt = $this->db->prepare("
            SELECT * FROM student_postpone_records
            WHERE tenant_id = ? AND contact_id = ?
            ORDER BY id DESC
        ");
        $stmt->execute([$tid, $contactId]);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $latest = $records[0] ?? null;
        respond(200, [
            'latest' => $latest,
            'records' => $records,
            'history' => $records,
            'current_snapshot' => $latest ?: []
        ], 'Tải thông tin bảo lưu thành công');
    }

    /**
     * 3B. POST /academic/postpone/{contactId}/ocr
     * Upload filled postpone form -> save to cloud_files -> AI OCR extract -> auto calculate email remind date
     */
    public function ocrPostponeForm(array $auth, int $contactId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        $stmt = $this->db->prepare("SELECT id, full_name, email, phone, student_id, program FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$contactId, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) {
            respond(404, null, 'Không tìm thấy học viên', false);
        }

        $remindDaysBefore = isset($_POST['remind_days_before']) ? (int)$_POST['remind_days_before'] : 14;
        if ($remindDaysBefore <= 0) $remindDaysBefore = 14;

        $savedFilePath = '';
        $savedFileUrl = '';
        $savedFileName = '';
        $cloudFileId = null;

        if (!empty($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $origName = basename($_FILES['file']['name']);
            $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
            $allowedExts = ['pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'webp'];
            if (!in_array($ext, $allowedExts, true)) {
                respond(422, null, 'Định dạng file không hỗ trợ. Vui lòng tải file PDF, Word (.docx) hoặc Ảnh (.jpg, .png).', false);
            }

            $uploadDir = __DIR__ . "/../uploads/tenant_{$tid}";
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0775, true);
            }
            $safeName = 'postpone_' . $contactId . '_' . time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $origName);
            $destPath = $uploadDir . '/' . $safeName;

            if (!move_uploaded_file($_FILES['file']['tmp_name'], $destPath)) {
                respond(500, null, 'Không thể lưu file đơn bảo lưu lên máy chủ', false);
            }

            $relPath = "uploads/tenant_{$tid}/{$safeName}";
            $savedFilePath = $destPath;
            $savedFileUrl = "/backend/{$relPath}";
            $savedFileName = $origName;
            $fileSize = (int)@filesize($destPath);
            $mimeType = $_FILES['file']['type'] ?: 'application/octet-stream';

            // Save into cloud_files so it appears in student's Hồ sơ & Tài liệu
            try {
                $stmtCf = $this->db->prepare("
                    INSERT INTO cloud_files (tenant_id, uploaded_by, updated_by, contact_id, name, file_path, mime_type, file_size, category, visibility, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'academic', 'shared', NOW())
                ");
                $stmtCf->execute([$tid, $uid, $uid, $contactId, "[Đơn Bảo Lưu] " . $origName, $relPath, $mimeType, $fileSize]);
                $cloudFileId = (int)$this->db->lastInsertId();
            } catch (\Throwable $eCf) {
                error_log("Insert cloud_files for postpone form error: " . $eCf->getMessage());
            }
        } else {
            $body = getBody();
            $fileId = (int)($body['file_id'] ?? 0);
            if ($fileId > 0) {
                $stmtCf = $this->db->prepare("SELECT id, name, file_path FROM cloud_files WHERE id = ? AND contact_id = ? LIMIT 1");
                $stmtCf->execute([$fileId, $contactId]);
                $cf = $stmtCf->fetch(PDO::FETCH_ASSOC);
                if ($cf) {
                    $cloudFileId = (int)$cf['id'];
                    $savedFileName = $cf['name'];
                    $rel = ltrim((string)$cf['file_path'], '/');
                    $baseDir = dirname(__DIR__) . '/';
                    $p1 = $baseDir . $rel;
                    $p2 = $baseDir . 'uploads/' . $rel;
                    $savedFilePath = file_exists($p1) ? $p1 : (file_exists($p2) ? $p2 : '');
                    $savedFileUrl = '/backend/' . (strpos($rel, 'uploads/') === 0 ? $rel : 'uploads/' . $rel);
                }
            }
        }

        if ($savedFilePath === '' || !file_exists($savedFilePath)) {
            respond(422, null, 'Vui lòng chọn file đơn bảo lưu để tải lên', false);
        }

        $extracted = StudentDocOcrService::extractPostponeForm($this->db, $savedFilePath, $savedFileName, $contact, $remindDaysBefore);
        $extracted['form_file_id'] = $cloudFileId;
        $extracted['form_file_url'] = $savedFileUrl;
        $extracted['form_file_name'] = $savedFileName;

        respond(200, $extracted, 'Đã tải lên đơn bảo lưu & tự động trích xuất thông tin bảo lưu thành công!');
    }

    /**
     * 3C. POST /academic/postpone/{contactId}
     * Save postponement details, schedule email reminder, and optionally transition student to Postpone stage
     */
    public function savePostponeRecord(array $auth, int $contactId): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        $stmt = $this->db->prepare("SELECT id, full_name, email, phone, mobile, owner_id, study_status, program, student_id FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
        $stmt->execute([$contactId, $tid]);
        $contact = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$contact) {
            respond(404, null, 'Không tìm thấy học viên', false);
        }

        $reason = trim((string)($body['postpone_reason'] ?? 'Bảo lưu theo đơn đề nghị của học viên'));
        $fromDate = trim((string)($body['postpone_from_date'] ?? date('Y-m-d')));
        $durationMonths = max(1, min(36, (int)($body['duration_months'] ?? 6)));
        $toDate = trim((string)($body['postpone_to_date'] ?? ''));
        if ($toDate === '') {
            $toDate = date('Y-m-d', strtotime($fromDate . " +{$durationMonths} months"));
        }
        $remindDaysBefore = max(1, min(90, (int)($body['remind_days_before'] ?? 14)));
        $remindDate = trim((string)($body['postpone_remind_date'] ?? ''));
        if ($remindDate === '') {
            $remindDate = date('Y-m-d', strtotime($toDate . " -{$remindDaysBefore} days"));
        }
        $deferredSubjects = trim((string)($body['deferred_subjects'] ?? ''));
        $formFileId = !empty($body['form_file_id']) ? (int)$body['form_file_id'] : null;
        $formFileUrl = trim((string)($body['form_file_url'] ?? ''));
        $formFileName = trim((string)($body['form_file_name'] ?? ''));
        $autoSwitchStage = !isset($body['auto_switch_stage']) || (bool)$body['auto_switch_stage'];
        $sendConfirmationEmail = !empty($body['send_confirmation_email']) || !empty($body['send_email_now']);
        $ccEmails = !empty($body['cc_emails']) ? trim((string)$body['cc_emails']) : $this->getDefaultAcademicCc($tid);

        $this->db->beginTransaction();
        try {
            $stmtIns = $this->db->prepare("
                INSERT INTO student_postpone_records
                    (tenant_id, contact_id, form_file_id, form_file_url, form_file_name, postpone_reason, postpone_from_date, postpone_to_date, duration_months, remind_days_before, postpone_remind_date, deferred_subjects, remind_status, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())
            ");
            $stmtIns->execute([
                $tid, $contactId, $formFileId, $formFileUrl ?: null, $formFileName ?: null,
                $reason, $fromDate, $toDate, $durationMonths, $remindDaysBefore, $remindDate,
                $deferredSubjects ?: null, $uid
            ]);
            $recordId = (int)$this->db->lastInsertId();

            if ($autoSwitchStage) {
                $stmtUpd = $this->db->prepare("UPDATE contacts SET study_status = 'postpone', updated_at = NOW() WHERE id = ? AND tenant_id = ?");
                $stmtUpd->execute([$contactId, $tid]);
            }

            // Create an automatic Reminder Task in activities due on postpone_remind_date
            $studentName = $contact['full_name'] ?: 'Học viên';
            $fmtFrom = date('d/m/Y', strtotime($fromDate));
            $fmtTo = date('d/m/Y', strtotime($toDate));
            $fmtRemind = date('d/m/Y', strtotime($remindDate));

            $taskSubject = "⏰ [Remind Bảo lưu] Gửi Email nhắc học viên {$studentName} quay lại học (Hết hạn: {$fmtTo})";
            $taskBody = "Học viên: {$studentName} (" . ($contact['student_id'] ?: 'Chưa có mã HV') . ")\n"
                . "• Thời gian bảo lưu: {$fmtFrom} ➔ {$fmtTo}\n"
                . "• Lý do bảo lưu: {$reason}\n"
                . ($deferredSubjects !== '' ? "• Môn / Học kỳ bảo lưu: {$deferredSubjects}\n" : "")
                . ($formFileName !== '' ? "• Đơn bảo lưu đính kèm: {$formFileName}\n" : "")
                . "• Ngày hệ thống tự động nhắc gửi Email Remind: {$fmtRemind} (trước {$remindDaysBefore} ngày)";

            $stmtTask = $this->db->prepare("
                INSERT INTO activities (tenant_id, user_id, created_by, type, subject, body, status, priority, start_date, due_date, related_type, related_id, contact_id)
                VALUES (?, ?, ?, 'task', ?, ?, 'planned', 'high', ?, ?, 'contact', ?, ?)
            ");
            $stmtTask->execute([
                $tid, $uid, $uid, $taskSubject, $taskBody,
                $remindDate . ' 08:30:00', $remindDate . ' 17:00:00',
                $contactId, $contactId
            ]);

            // Log timeline note
            $senderName = trim($auth['full_name'] ?? $auth['name'] ?? 'Học vụ');
            $noteSubject = "📋 {$senderName} đã lưu Hồ sơ Bảo lưu (Postpone: {$fmtFrom} ➔ {$fmtTo})";
            $stmtNote = $this->db->prepare("
                INSERT INTO activities (tenant_id, user_id, created_by, type, subject, body, status, priority, due_date, done_at, related_type, related_id, contact_id)
                VALUES (?, ?, ?, 'note', ?, ?, 'done', 'medium', NOW(), NOW(), 'contact', ?, ?)
            ");
            $stmtNote->execute([$tid, $uid, $uid, $noteSubject, $taskBody, $contactId, $contactId]);

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi lưu hồ sơ bảo lưu: ' . $e->getMessage(), false);
        }

        // Optional: send confirmation email immediately if requested
        if ($sendConfirmationEmail && !empty($contact['email'])) {
            $orgInfo = TenantConfigService::getOrganizationProfile($this->db, $tid);
            $orgLabel = htmlspecialchars($orgInfo['name'] ?: 'Học viện');
            $prog = $contact['program'] ?: 'Chương trình Đào tạo Quốc tế';
            $emailSubj = TenantConfigService::getBrandPrefix($this->db, $tid) . " Thông báo Xác nhận Bảo lưu kết quả học tập - {$contact['full_name']}";
            $emailHtml = "
                <p>Kính gửi Học viên <strong>" . htmlspecialchars($contact['full_name']) . "</strong>,</p>
                <p>Ban Học vụ <strong>{$orgLabel}</strong> xác nhận đã tiếp nhận và phê duyệt Đơn xin bảo lưu kết quả học tập của Anh/Chị với thông tin chi tiết như sau:</p>
                <div style='background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #d97706;border-radius:8px;padding:16px;margin:16px 0;'>
                    <p style='margin:4px 0;'>• <strong>Họ và tên học viên:</strong> " . htmlspecialchars($contact['full_name']) . "</p>
                    <p style='margin:4px 0;'>• <strong>Mã học viên:</strong> " . htmlspecialchars($contact['student_id'] ?: 'Đang cập nhật') . "</p>
                    <p style='margin:4px 0;'>• <strong>Chương trình học:</strong> " . htmlspecialchars($prog) . "</p>
                    <p style='margin:4px 0;'>• <strong>Thời gian bảo lưu:</strong> Từ ngày <strong>{$fmtFrom}</strong> đến ngày <strong>{$fmtTo}</strong></p>
                    " . ($deferredSubjects !== '' ? "<p style='margin:4px 0;'>• <strong>Học phần bảo lưu:</strong> " . htmlspecialchars($deferredSubjects) . "</p>" : "") . "
                    <p style='margin:4px 0;'>• <strong>Lý do bảo lưu:</strong> " . htmlspecialchars($reason) . "</p>
                </div>
                <p>Hệ thống Học vụ sẽ gửi email nhắc lịch học lại cho Anh/Chị vào ngày <strong>{$fmtRemind}</strong> để hỗ trợ sắp xếp lịch học tiếp theo thuận lợi nhất.</p>
                <p>Trân trọng,<br/><strong>Ban Học vụ — {$orgLabel}</strong></p>
            ";
            sendEmailNotification($contact['email'], $emailSubj, 'XÁC NHẬN BẢO LƯU HỌC TẬP', $emailHtml, $ccEmails, false, 0, true);
        }

        $this->getPostponeInfo($auth, $contactId);
    }

    /**
     * 4. POST /academic/lecturer/{companyId}/send-invitation-email
     * Send Lecturer Invitation & Contract Email with optional Contract File Attachments & Schedule Table
     */
    public function sendLecturerInvitationEmail(array $auth, int $companyId): void {
        if (strtolower($auth['role'] ?? '') === 'viewer') {
            respond(403, null, 'Tài khoản chỉ xem không có quyền gửi email mời giảng', false);
        }
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);

        $isMultipart = !empty($_POST) || !empty($_FILES);
        $body = $isMultipart ? $_POST : getBody();

        $lecturer = null;
        if ($companyId > 0) {
            $stmt = $this->db->prepare("SELECT * FROM companies WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
            $stmt->execute([$companyId, $tid]);
            $lecturer = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        $toEmail = trim((string)($body['to_email'] ?? ($lecturer['email'] ?? '')));
        if (!$lecturer && $toEmail !== '') {
            $stmtByEmail = $this->db->prepare("SELECT * FROM companies WHERE LOWER(email) = LOWER(?) AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
            $stmtByEmail->execute([$toEmail, $tid]);
            $lecturer = $stmtByEmail->fetch(PDO::FETCH_ASSOC) ?: null;
            if ($lecturer) {
                $companyId = (int)$lecturer['id'];
            }
        }
        if (!$lecturer) {
            $lecturer = [
                'id' => $companyId,
                'name' => trim((string)($body['lecturer_name'] ?? 'Giảng viên')),
                'email' => $toEmail
            ];
        }

        $orgInfo = TenantConfigService::getOrganizationProfile($this->db, $tid);
        $orgLabelPlain = $orgInfo['name'] ?: 'Học viện';
        $ccEmail = array_key_exists('cc_emails', $body)
            ? trim((string)$body['cc_emails'])
            : (array_key_exists('cc_email', $body) ? trim((string)$body['cc_email']) : $this->getDefaultAcademicCc($tid));
        $subject = trim((string)($body['subject'] ?? ('Thư Mời Giảng Dạy & Hợp Đồng Nguyên Tắc - ' . $orgLabelPlain)));
        $contentHtml = trim((string)($body['body_html'] ?? $body['content'] ?? $body['content_html'] ?? ''));

        if ($toEmail === '') {
            respond(422, null, 'Vui lòng nhập địa chỉ Email của Giảng viên', false);
        }
        if ($subject === '' || $contentHtml === '') {
            respond(422, null, 'Vui lòng nhập đầy đủ Tiêu đề và Nội dung email mời giảng', false);
        }

        // Collect attachments: from cloud_files (attachment_file_ids) + uploaded files ($_FILES['attachments'])
        $attachments = [];
        $attachmentNames = [];

        $fileIdsRaw = $body['attachment_file_ids'] ?? [];
        if (is_string($fileIdsRaw)) {
            $decodedIds = json_decode($fileIdsRaw, true);
            $fileIds = is_array($decodedIds) ? $decodedIds : array_filter(explode(',', $fileIdsRaw));
        } elseif (is_array($fileIdsRaw)) {
            $fileIds = $fileIdsRaw;
        } else {
            $fileIds = [];
        }

        if (!empty($fileIds)) {
            $cleanIds = array_values(array_filter(array_map('intval', $fileIds), fn($v) => $v > 0));
            if (!empty($cleanIds)) {
                $ph = implode(',', array_fill(0, count($cleanIds), '?'));
                $stmtCf = $this->db->prepare("SELECT id, name, file_path FROM cloud_files WHERE tenant_id = ? AND id IN ($ph)");
                $stmtCf->execute(array_merge([$tid], $cleanIds));
                $baseDir = dirname(__DIR__) . '/';
                while ($cf = $stmtCf->fetch(PDO::FETCH_ASSOC)) {
                    $rel = ltrim((string)$cf['file_path'], '/');
                    $p1 = $baseDir . $rel;
                    $p2 = $baseDir . 'uploads/' . $rel;
                    $realPath = file_exists($p1) ? $p1 : (file_exists($p2) ? $p2 : '');
                    if ($realPath !== '') {
                        $attachments[] = ['path' => $realPath, 'name' => $cf['name']];
                        $attachmentNames[] = $cf['name'];
                    }
                }
            }
        }

        if (!empty($_FILES['attachments'])) {
            $uploadDir = __DIR__ . "/../uploads/tenant_{$tid}";
            if (!is_dir($uploadDir)) @mkdir($uploadDir, 0775, true);

            $filesArr = $_FILES['attachments'];
            $countFiles = is_array($filesArr['name']) ? count($filesArr['name']) : 1;
            for ($i = 0; $i < $countFiles; $i++) {
                $err = is_array($filesArr['error']) ? $filesArr['error'][$i] : $filesArr['error'];
                if ($err !== UPLOAD_ERR_OK) continue;
                $tmpName = is_array($filesArr['tmp_name']) ? $filesArr['tmp_name'][$i] : $filesArr['tmp_name'];
                $origName = basename(is_array($filesArr['name']) ? $filesArr['name'][$i] : $filesArr['name']);
                $mimeType = is_array($filesArr['type']) ? $filesArr['type'][$i] : $filesArr['type'];
                $safeName = 'gv_contract_' . $companyId . '_' . time() . '_' . $i . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $origName);
                $destPath = $uploadDir . '/' . $safeName;
                if (move_uploaded_file($tmpName, $destPath)) {
                    $attachments[] = ['path' => $destPath, 'name' => $origName];
                    $attachmentNames[] = $origName;
                    // Also save to cloud_files under this lecturer company
                    try {
                        $relPath = "uploads/tenant_{$tid}/{$safeName}";
                        $fSize = (int)@filesize($destPath);
                        $stmtInsCf = $this->db->prepare("
                            INSERT INTO cloud_files (tenant_id, uploaded_by, updated_by, name, file_path, mime_type, file_size, category, visibility, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'shared', NOW())
                        ");
                        $stmtInsCf->execute([$tid, $uid, $uid, "[Hợp đồng Mời giảng] " . $origName, $relPath, $mimeType ?: 'application/pdf', $fSize, 'company_' . $companyId]);
                    } catch (\Throwable $eCf) {}
                }
            }
        }

        $wrappedBody = '<div style="background: #ffffff; border-left: 0px solid transparent; color: #334155; font-size: 14.5px; line-height: 1.65;">' . $contentHtml . '</div>';
        $sent = $this->sendEmailWithAttachmentsAndIcs($toEmail, $subject, 'THƯ MỜI GIẢNG & HỢP ĐỒNG', $wrappedBody, $ccEmail, $attachments, null);

        $senderName = trim($auth['full_name'] ?? $auth['name'] ?? 'Học vụ');
        $lecturerName = trim($lecturer['name'] ?: 'Giảng viên');
        $actSubject = "📧 {$senderName} đã gửi email Mời giảng & Hợp đồng: \"{$subject}\" cho GV {$lecturerName}";
        $actBody = "Người nhận: {$toEmail}"
            . ($ccEmail !== '' ? "\nCC: {$ccEmail}" : "")
            . (!empty($attachmentNames) ? "\n📎 Đính kèm Hợp đồng / Tài liệu: " . implode(', ', $attachmentNames) : "")
            . "\n\nNội dung email:\n" . strip_tags($contentHtml);

        $activityId = null;
        try {
            $stmtAct = $this->db->prepare("
                INSERT INTO activities (tenant_id, user_id, created_by, type, subject, body, status, priority, due_date, done_at, related_type, related_id)
                VALUES (?, ?, ?, 'email', ?, ?, 'done', 'medium', NOW(), NOW(), 'company', ?)
            ");
            $stmtAct->execute([$tid, $uid, $uid, $actSubject, $actBody, $companyId]);
            $activityId = (int)$this->db->lastInsertId();
        } catch (\Throwable $eAct) {
            error_log("Insert activity for sendLecturerInvitationEmail error: " . $eAct->getMessage());
        }

        respond(200, [
            'sent' => $sent,
            'activity_id' => $activityId,
            'attachments_sent' => $attachmentNames
        ], 'Đã gửi Email Mời giảng & Hợp đồng cho Giảng viên thành công!');
    }

    public static function getDefaultAvailableSlotsMatrix(): array {
        $aft = ['13:30-14:00','14:00-14:30','14:30-15:00','15:00-15:30','15:30-16:00','16:00-16:30'];
        $eve = ['19:00-19:30','19:30-20:00','20:00-20:30','20:30-21:00','21:00-21:30'];
        $all = array_merge($aft, $eve);
        return [
            'mon' => $all,
            'tue' => $all,
            'wed' => $aft,
            'thu' => $all,
            'fri' => $all,
            'sat' => $aft,
            'sun' => [],
        ];
    }

    private static function enrichConfigRow(array $cfg, ?PDO $db = null): array {
        $code = (string)($cfg['booking_code'] ?? '');
        $cfgTid = (int)($cfg['tenant_id'] ?? 1);
        $origin = '';
        if ($db instanceof PDO) {
            $org = TenantConfigService::getOrganizationProfile($db, $cfgTid);
            $origin = rtrim((string)($org['frontend_url'] ?? ''), '/');
        }
        if ($origin === '' && !empty($_SERVER['HTTP_HOST'])) {
            $origin = ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . $_SERVER['HTTP_HOST']);
        }
        if ($origin === '') {
            $origin = rtrim((string)(getenv('APP_BASE_URL') ?: ''), '/');
        }
        $cfg['public_url'] = $origin . '/public-schedule/1on1/' . $code;
        $cfg['lecturer_company_id'] = (int)($cfg['lecturer_id'] ?? 0);
        $cfg['slot_duration'] = (int)($cfg['slot_duration_minutes'] ?? 30);
        $cfg['meeting_link'] = $cfg['zoom_link'] ?? '';
        $cfg['notes_vn'] = $cfg['notes'] ?? '';
        $wStart = $cfg['week_start_date'] ?? '';
        $wEnd = $cfg['week_end_date'] ?? '';
        if ($wStart && $wEnd) {
            $cfg['week_label'] = 'Class Schedule (' . date('d/m', strtotime($wStart)) . ' - ' . date('d/m', strtotime($wEnd)) . ')';
        }
        $decodedSlots = !empty($cfg['available_slots_json']) ? json_decode($cfg['available_slots_json'], true) : null;
        $cfg['available_slots'] = (is_array($decodedSlots) && !empty($decodedSlots))
            ? $decodedSlots
            : self::getDefaultAvailableSlotsMatrix();
        return $cfg;
    }

    /**
     * 5A. GET /academic/1on1-configs
     * List 1:1 Mentoring Configs & Bookings
     */
    public function list1on1Configs(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $lecturerId = isset($_GET['lecturer_id'])
            ? (int)$_GET['lecturer_id']
            : (isset($_GET['lecturer_company_id']) ? (int)$_GET['lecturer_company_id'] : 0);
        $campaignId = isset($_GET['campaign_id']) ? (int)$_GET['campaign_id'] : 0;

        $conds = ["c.tenant_id = ?"];
        $params = [$tid];
        if ($lecturerId > 0) {
            $conds[] = "c.lecturer_id = ?";
            $params[] = $lecturerId;
        }
        if ($campaignId > 0) {
            $conds[] = "c.campaign_id = ?";
            $params[] = $campaignId;
        }

        $stmt = $this->db->prepare("
            SELECT c.*, comp.name as company_lecturer_name, comp.email as company_lecturer_email,
                   mc.name as campaign_name
            FROM mentoring_1on1_configs c
            LEFT JOIN companies comp ON comp.id = c.lecturer_id
            LEFT JOIN marketing_campaigns mc ON mc.id = c.campaign_id
            WHERE " . implode(" AND ", $conds) . "
            ORDER BY c.id DESC
            LIMIT 100
        ");
        $stmt->execute($params);
        $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($configs)) {
            $configIds = array_values(array_unique(array_map(fn($r) => (int)$r['id'], $configs)));
            $ph = implode(',', array_fill(0, count($configIds), '?'));
            $stmtB = $this->db->prepare("
                SELECT * FROM mentoring_1on1_bookings
                WHERE config_id IN ($ph)
                ORDER BY slot_date ASC, slot_time_start ASC
            ");
            $stmtB->execute($configIds);
            $bookingsByConfig = [];
            while ($b = $stmtB->fetch(PDO::FETCH_ASSOC)) {
                $bookingsByConfig[(int)$b['config_id']][] = $b;
            }
            foreach ($configs as &$cfg) {
                $cid = (int)$cfg['id'];
                $cfg = self::enrichConfigRow($cfg, $this->db);
                $cfg['bookings'] = $bookingsByConfig[$cid] ?? [];
            }
            unset($cfg);
        }

        respond(200, $configs, 'Tải danh sách lịch đăng ký hướng dẫn 1:1 thành công');
    }

    /**
     * 5B. POST /academic/1on1-configs
     * Create or update a 1:1 Mentoring Schedule Config (with 30-minute slots matrix)
     */
    public function save1on1Config(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        $id = isset($body['id']) ? (int)$body['id'] : 0;
        $lecturerId = (int)($body['lecturer_id'] ?? $body['lecturer_company_id'] ?? 0);
        $campaignId = !empty($body['campaign_id']) ? (int)$body['campaign_id'] : null;
        $subjectName = trim((string)($body['subject_name'] ?? 'Hướng dẫn 1:1 (Capstone / Luận văn)'));
        $title = trim((string)($body['title'] ?? ''));

        // Resolve lecturer details
        $lecturerName = trim((string)($body['lecturer_name'] ?? ''));
        $lecturerEmail = trim((string)($body['lecturer_email'] ?? ''));
        if ($lecturerId > 0 && ($lecturerName === '' || $lecturerEmail === '')) {
            $stmtL = $this->db->prepare("SELECT name, email FROM companies WHERE id = ? LIMIT 1");
            $stmtL->execute([$lecturerId]);
            $lRow = $stmtL->fetch(PDO::FETCH_ASSOC);
            if ($lRow) {
                if ($lecturerName === '') $lecturerName = $lRow['name'] ?? '';
                if ($lecturerEmail === '') $lecturerEmail = $lRow['email'] ?? '';
            }
        }

        if ($title === '') {
            $title = "Lịch Đăng Ký Hướng Dẫn 1:1 — " . ($subjectName ?: 'Capstone / Thesis') . ($lecturerName ? " ({$lecturerName})" : "");
        }

        // Default week_start_date to Monday of current/next week
        $weekStart = trim((string)($body['week_start_date'] ?? ''));
        if ($weekStart === '') {
            $dow = (int)date('N');
            $weekStart = $dow === 1 ? date('Y-m-d') : date('Y-m-d', strtotime('monday this week'));
        }
        $weekEnd = trim((string)($body['week_end_date'] ?? ''));
        if ($weekEnd === '') {
            $weekEnd = date('Y-m-d', strtotime($weekStart . ' +6 days'));
        }

        $slotDuration = max(5, (int)($body['slot_duration_minutes'] ?? $body['slot_duration'] ?? 30));
        $minAdvanceHours = max(0, (int)($body['min_advance_hours'] ?? 0));
        $zoomLink = trim((string)($body['zoom_link'] ?? $body['meeting_link'] ?? ''));
        $zoomId = trim((string)($body['zoom_id'] ?? ''));
        $zoomPass = trim((string)($body['zoom_pass'] ?? ''));
        $notes = trim((string)($body['notes'] ?? $body['notes_vn'] ?? ''));
        $isActive = isset($body['is_active']) ? (int)((bool)$body['is_active']) : 1;

        $availableSlots = $body['available_slots'] ?? null;
        $availableSlotsJson = is_array($availableSlots) ? json_encode($availableSlots, JSON_UNESCAPED_UNICODE) : null;

        if ($id > 0) {
            $stmtUpd = $this->db->prepare("
                UPDATE mentoring_1on1_configs
                SET title = ?, campaign_id = ?, subject_name = ?, lecturer_id = ?, lecturer_name = ?, lecturer_email = ?,
                    week_start_date = ?, week_end_date = ?, slot_duration_minutes = ?, min_advance_hours = ?,
                    zoom_link = ?, zoom_id = ?, zoom_pass = ?, available_slots_json = COALESCE(?, available_slots_json),
                    notes = ?, is_active = ?, updated_at = NOW()
                WHERE id = ? AND tenant_id = ?
            ");
            $stmtUpd->execute([
                $title, $campaignId, $subjectName, $lecturerId, $lecturerName, $lecturerEmail,
                $weekStart, $weekEnd, $slotDuration, $minAdvanceHours,
                $zoomLink, $zoomId, $zoomPass, $availableSlotsJson,
                $notes, $isActive, $id, $tid
            ]);
            $stmtGet = $this->db->prepare("SELECT * FROM mentoring_1on1_configs WHERE id = ? LIMIT 1");
            $stmtGet->execute([$id]);
            $saved = $stmtGet->fetch(PDO::FETCH_ASSOC);
        } else {
            $bookingCode = trim((string)($body['booking_code'] ?? ''));
            if ($bookingCode === '') {
                $bookingCode = '1on1-' . ($lecturerId > 0 ? "gv{$lecturerId}-" : '') . strtolower(substr(bin2hex(random_bytes(4)), 0, 6));
            }
            $stmtIns = $this->db->prepare("
                INSERT INTO mentoring_1on1_configs
                    (tenant_id, booking_code, title, campaign_id, subject_name, lecturer_id, lecturer_name, lecturer_email,
                     week_start_date, week_end_date, slot_duration_minutes, min_advance_hours,
                     zoom_link, zoom_id, zoom_pass, available_slots_json, notes, is_active, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmtIns->execute([
                $tid, $bookingCode, $title, $campaignId, $subjectName, $lecturerId, $lecturerName, $lecturerEmail,
                $weekStart, $weekEnd, $slotDuration, $minAdvanceHours,
                $zoomLink, $zoomId, $zoomPass, $availableSlotsJson, $notes, $isActive, $uid
            ]);
            $newId = (int)$this->db->lastInsertId();
            $stmtGet = $this->db->prepare("SELECT * FROM mentoring_1on1_configs WHERE id = ? LIMIT 1");
            $stmtGet->execute([$newId]);
            $saved = $stmtGet->fetch(PDO::FETCH_ASSOC);
        }

        if ($saved) {
            $saved = self::enrichConfigRow($saved, $this->db);
        }

        respond(200, $saved, 'Đã lưu cấu hình Lịch Đăng ký Hướng dẫn 1:1 thành công!');
    }

    /**
     * 5C. PUBLIC GET /academic/public-1on1/{bookingCode}
     * Returns full weekly 30-min grid + existing bookings + lecturer teaching conflicts + optional student info
     */
    public function getPublic1on1Schedule(string $bookingCode): void {
        $bookingCode = trim($bookingCode);
        if ($bookingCode === '') {
            respond(400, null, 'Mã lịch đăng ký 1:1 không hợp lệ', false);
        }

        $stmt = $this->db->prepare("SELECT * FROM mentoring_1on1_configs WHERE booking_code = ? LIMIT 1");
        $stmt->execute([$bookingCode]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC);

        // Dynamic live link support: if bookingCode is 'lecturer-{id}' or 'course-{id}', auto-provision or fetch latest active config!
        if (!$config && preg_match('/^lecturer[\-_](\d+)$/i', $bookingCode, $mLect)) {
            $lectId = (int)$mLect[1];
            $stmtL = $this->db->prepare("SELECT * FROM mentoring_1on1_configs WHERE lecturer_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1");
            $stmtL->execute([$lectId]);
            $config = $stmtL->fetch(PDO::FETCH_ASSOC);

            if (!$config) {
                $stmtComp = $this->db->prepare("SELECT id, name, email FROM companies WHERE id = ? LIMIT 1");
                $stmtComp->execute([$lectId]);
                $comp = $stmtComp->fetch(PDO::FETCH_ASSOC);
                if ($comp) {
                    $dow = (int)date('N');
                    $wStart = $dow === 1 ? date('Y-m-d') : date('Y-m-d', strtotime('monday this week'));
                    $wEnd = date('Y-m-d', strtotime($wStart . ' +6 days'));
                    $title = "Đăng ký Lịch Hướng dẫn 1:1 — GV " . ($comp['name'] ?: '');
                    $stmtIns = $this->db->prepare("
                        INSERT INTO mentoring_1on1_configs
                            (tenant_id, booking_code, title, subject_name, lecturer_id, lecturer_name, lecturer_email, week_start_date, week_end_date, slot_duration_minutes, min_advance_hours, is_active, created_at)
                        VALUES (1, ?, ?, 'Hướng dẫn 1:1 (Capstone / Thesis)', ?, ?, ?, ?, ?, 30, 24, 1, NOW())
                    ");
                    $stmtIns->execute([$bookingCode, $title, $lectId, $comp['name'], $comp['email'], $wStart, $wEnd]);
                    $newId = (int)$this->db->lastInsertId();
                    $stmt->execute([$bookingCode]);
                    $config = $stmt->fetch(PDO::FETCH_ASSOC);
                }
            }
        }

        if (!$config) {
            respond(404, null, 'Không tìm thấy lịch đăng ký hướng dẫn 1:1 này.', false);
        }

        // Allow week navigation via ?week_start=YYYY-MM-DD for dynamic live links
        $reqWeekStart = isset($_GET['week_start']) ? trim((string)$_GET['week_start']) : '';
        $weekStart = ($reqWeekStart !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqWeekStart))
            ? $reqWeekStart
            : $config['week_start_date'];
        $weekEnd = date('Y-m-d', strtotime($weekStart . ' +6 days'));

        // Fetch confirmed bookings in this week
        $stmtB = $this->db->prepare("
            SELECT id, slot_date, slot_time_start, slot_time_end, student_name, student_code, topic, status
            FROM mentoring_1on1_bookings
            WHERE config_id = ? AND status = 'confirmed'
              AND slot_date >= ? AND slot_date <= ?
            ORDER BY slot_date ASC, slot_time_start ASC
        ");
        $stmtB->execute([(int)$config['id'], $weekStart, $weekEnd]);
        $bookings = $stmtB->fetchAll(PDO::FETCH_ASSOC);

        $bookedSlotsMap = [];
        $bookedSlotsList = [];
        foreach ($bookings as $b) {
            $k = $b['slot_date'] . '_' . $b['slot_time_start'];
            $dowKey = strtolower(date('D', strtotime($b['slot_date'])));
            $slotRange = $b['slot_time_start'] . '-' . $b['slot_time_end'];
            $item = [
                'booking_id' => (int)$b['id'],
                'booking_date' => $b['slot_date'],
                'slot_date' => $b['slot_date'],
                'day_of_week' => $dowKey,
                'slot_range' => $slotRange,
                'slot_time_start' => $b['slot_time_start'],
                'slot_time_end' => $b['slot_time_end'],
                'student_name' => $b['student_name'],
                'student_code' => $b['student_code'],
                'topic' => $b['topic'] ?? '',
                'status' => $b['status'] ?? 'confirmed'
            ];
            $bookedSlotsMap[$k] = $item;
            $bookedSlotsList[] = $item;
        }

        // Also check Lecturer's teaching sessions in marketing_campaigns so we auto-grey-out teaching hours!
        $lecturerId = (int)($config['lecturer_id'] ?? 0);
        $teachingBusyMap = [];
        if ($lecturerId > 0) {
            try {
                $resMc = $this->db->query("SELECT name, subjects_json FROM marketing_campaigns WHERE status NOT IN ('deleted', 'archived')");
                if ($resMc) {
                    while ($mc = $resMc->fetch(PDO::FETCH_ASSOC)) {
                        $subs = !empty($mc['subjects_json']) ? json_decode($mc['subjects_json'], true) : [];
                        if (!is_array($subs)) continue;
                        foreach ($subs as $sub) {
                            $subLect = (int)($sub['lecturer_id'] ?? 0);
                            foreach (($sub['host_sessions'] ?? []) as $hs) {
                                $hLect = !empty($hs['lecturer_name']) ? (int)$hs['lecturer_name'] : $subLect;
                                $hDate = $hs['date'] ?? '';
                                if ($hLect === $lecturerId && $hDate >= $weekStart && $hDate <= $weekEnd) {
                                    $tStart = $hs['time_start'] ?? '19:00';
                                    $tEnd = $hs['time_end'] ?? '21:30';
                                    $teachingBusyMap[] = ['date' => $hDate, 'start' => $tStart, 'end' => $tEnd, 'label' => 'Lịch giảng dạy'];
                                }
                            }
                        }
                    }
                }
            } catch (\Throwable $e) {}
        }

        // Optional pre-filled student info if ?student_id= or ?contact_id= is provided (scoped to config tenant_id)
        $studentPrefill = null;
        $contactIdParam = isset($_GET['contact_id']) ? (int)$_GET['contact_id'] : (isset($_GET['student_id']) && is_numeric($_GET['student_id']) ? (int)$_GET['student_id'] : 0);
        if ($contactIdParam > 0) {
            $cfgTid = (int)($config['tenant_id'] ?? 1);
            $stmtSt = $this->db->prepare("SELECT id, full_name, student_id, email, phone, mobile, program FROM contacts WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1");
            $stmtSt->execute([$contactIdParam, $cfgTid]);
            $stRow = $stmtSt->fetch(PDO::FETCH_ASSOC);
            if ($stRow) {
                $studentPrefill = [
                    'contact_id' => (int)$stRow['id'],
                    'student_name' => $stRow['full_name'] ?? '',
                    'student_code' => $stRow['student_id'] ?? '',
                    'student_email' => $stRow['email'] ?? '',
                    'student_phone' => $stRow['phone'] ?: ($stRow['mobile'] ?? ''),
                    'program_name' => $stRow['program'] ?? ''
                ];
            }
        }

        $config = self::enrichConfigRow($config, $this->db);

        respond(200, [
            'config' => $config,
            'week_start_date' => $weekStart,
            'week_end_date' => $weekEnd,
            'time_slots_30m' => self::getDefaultTimeSlots30Min(),
            'booked_slots' => $bookedSlotsList,
            'booked_slots_map' => $bookedSlotsMap,
            'teaching_busy' => $teachingBusyMap,
            'student_prefill' => $studentPrefill
        ], 'Tải lịch đăng ký 1:1 thành công');
    }

    /**
     * 5D. PUBLIC POST /academic/public-1on1/{bookingCode}/book
     * Atomic 30-minute slot booking + Auto Calendar creation + Auto Email & .ics Google Calendar Invite to Lecturer & Student
     */
    public function bookPublic1on1Slot(string $bookingCode): void {
        $bookingCode = trim($bookingCode);
        $body = getBody();

        $studentName = trim((string)($body['student_name'] ?? ''));
        $studentCode = trim((string)($body['student_code'] ?? ''));
        $studentEmail = trim((string)($body['student_email'] ?? ''));
        $studentPhone = trim((string)($body['student_phone'] ?? ''));
        $programName = trim((string)($body['program_name'] ?? ''));
        $topic = trim((string)($body['topic'] ?? 'Đăng ký hướng dẫn 1:1'));
        $questions = trim((string)($body['questions'] ?? ''));
        $slotDate = trim((string)($body['slot_date'] ?? $body['booking_date'] ?? ''));
        $slotStart = trim((string)($body['slot_time_start'] ?? ''));
        $slotEnd = trim((string)($body['slot_time_end'] ?? ''));
        $slotRangeInput = trim((string)($body['slot_range'] ?? ''));
        if (($slotStart === '' || $slotEnd === '') && strpos($slotRangeInput, '-') !== false) {
            $rParts = array_map('trim', explode('-', $slotRangeInput, 2));
            if ($slotStart === '') $slotStart = $rParts[0] ?? '';
            if ($slotEnd === '') $slotEnd = $rParts[1] ?? '';
        }
        $contactId = !empty($body['contact_id']) ? (int)$body['contact_id'] : null;

        if ($studentName === '' || $studentEmail === '' || $slotDate === '' || $slotStart === '' || $slotEnd === '') {
            respond(422, null, 'Vui lòng điền đầy đủ Họ tên, Email và chọn Khung giờ 30 phút!', false);
        }
        if (!filter_var($studentEmail, FILTER_VALIDATE_EMAIL)) {
            respond(422, null, 'Địa chỉ Email không hợp lệ', false);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $slotDate) || !preg_match('/^\d{2}:\d{2}$/', $slotStart)) {
            respond(422, null, 'Ngày hoặc khung giờ đăng ký không hợp lệ', false);
        }

        // Auto-match contact_id by student_code, email, or phone if not passed
        if (!$contactId) {
            try {
                $normPh = preg_replace('/\D/', '', $studentPhone);
                $phTail = strlen($normPh) >= 9 ? substr($normPh, -9) : '';
                $stmtMatch = $this->db->prepare("
                    SELECT id, program, student_id FROM contacts
                    WHERE deleted_at IS NULL
                      AND (
                        (student_id != '' AND LOWER(student_id) = LOWER(?))
                        OR (email != '' AND LOWER(email) = LOWER(?))
                        " . ($phTail !== '' ? "OR phone LIKE '%{$phTail}%'" : "") . "
                      )
                    ORDER BY (status = 'customer') DESC, id DESC
                    LIMIT 1
                ");
                $stmtMatch->execute([$studentCode ?: '__none__', $studentEmail]);
                $mRow = $stmtMatch->fetch(PDO::FETCH_ASSOC);
                if ($mRow) {
                    $contactId = (int)$mRow['id'];
                    if ($programName === '' && !empty($mRow['program'])) $programName = $mRow['program'];
                    if ($studentCode === '' && !empty($mRow['student_id'])) $studentCode = $mRow['student_id'];
                }
            } catch (\Throwable $e) {}
        }

        $this->db->beginTransaction();
        try {
            // Lock config row to prevent concurrent race condition on the same 30-min slot
            $stmtCfg = $this->db->prepare("SELECT * FROM mentoring_1on1_configs WHERE booking_code = ? FOR UPDATE");
            $stmtCfg->execute([$bookingCode]);
            $config = $stmtCfg->fetch(PDO::FETCH_ASSOC);
            if (!$config || !(int)$config['is_active']) {
                $this->db->rollBack();
                respond(404, null, 'Lịch đăng ký 1:1 này hiện không khả dụng hoặc đã đóng.', false);
            }

            $configId = (int)$config['id'];
            $tid = (int)($config['tenant_id'] ?? 1);

            // Check if slot is already booked
            $stmtDup = $this->db->prepare("
                SELECT id, student_name FROM mentoring_1on1_bookings
                WHERE config_id = ? AND slot_date = ? AND slot_time_start = ? AND status = 'confirmed'
                LIMIT 1
            ");
            $stmtDup->execute([$configId, $slotDate, $slotStart]);
            $existingBooking = $stmtDup->fetch(PDO::FETCH_ASSOC);
            if ($existingBooking) {
                $this->db->rollBack();
                respond(409, null, "Khung giờ {$slotStart} - {$slotEnd} ngày " . date('d/m/Y', strtotime($slotDate)) . " vừa có học viên khác đăng ký. Vui lòng chọn khung giờ 30 phút khác!", false);
            }

            // Check if this student already booked another slot in the same week for this config (optional limit or allow if needed)
            $lecturerName = $config['lecturer_name'] ?: 'Giảng viên';
            $lecturerEmail = trim((string)($config['lecturer_email'] ?? ''));
            $lecturerId = (int)($config['lecturer_id'] ?? 0);
            if ($lecturerId > 0 && $lecturerEmail === '') {
                $stmtLE = $this->db->prepare("SELECT email, name FROM companies WHERE id = ? LIMIT 1");
                $stmtLE->execute([$lecturerId]);
                $leRow = $stmtLE->fetch(PDO::FETCH_ASSOC);
                if ($leRow) {
                    $lecturerEmail = trim((string)($leRow['email'] ?? ''));
                    if ($lecturerName === 'Giảng viên' && !empty($leRow['name'])) $lecturerName = $leRow['name'];
                }
            }

            // Create Calendar Activity in `activities` so it appears on MYERP Calendar, Lecturer Timeline & Student Timeline
            $fmtDate = date('d/m/Y', strtotime($slotDate));
            $actSubject = "🎯 [Hướng dẫn 1:1] {$studentName} ({$slotStart} - {$slotEnd} {$fmtDate}) — GV: {$lecturerName}";
            $actBody = "Lịch Hướng Dẫn 1:1 (30 phút):\n"
                . "• Học viên: {$studentName}" . ($studentCode ? " (Mã HV: {$studentCode})" : "") . "\n"
                . "• Email HV: {$studentEmail} | SĐT: {$studentPhone}\n"
                . "• Giảng viên hướng dẫn: {$lecturerName}\n"
                . "• Thời gian: {$slotStart} - {$slotEnd}, ngày {$fmtDate}\n"
                . "• Đề tài / Nội dung: {$topic}\n"
                . ($questions !== '' ? "• Câu hỏi / Ghi chú: {$questions}\n" : "")
                . (!empty($config['zoom_link']) ? "• Link phòng họp Zoom: {$config['zoom_link']}\n" : "");

            $startDateTime = "{$slotDate} {$slotStart}:00";
            $endDateTime = "{$slotDate} {$slotEnd}:00";
            $ownerUid = (int)($config['created_by'] ?: 1);

            $stmtAct = $this->db->prepare("
                INSERT INTO activities
                    (tenant_id, user_id, created_by, type, subject, body, status, priority, start_date, due_date, related_type, related_id, contact_id, link)
                VALUES (?, ?, ?, 'meeting', ?, ?, 'planned', 'high', ?, ?, ?, ?, ?, ?)
            ");
            $relType = $lecturerId > 0 ? 'company' : 'contact';
            $relId = $lecturerId > 0 ? $lecturerId : ($contactId ?: 0);
            $stmtAct->execute([
                $tid, $ownerUid, $ownerUid,
                $actSubject, $actBody,
                $startDateTime, $endDateTime,
                $relType, $relId, $contactId,
                $config['zoom_link'] ?: null
            ]);
            $activityId = (int)$this->db->lastInsertId();

            // Insert Booking Record
            $stmtIns = $this->db->prepare("
                INSERT INTO mentoring_1on1_bookings
                    (tenant_id, config_id, contact_id, student_name, student_code, student_email, student_phone, program_name, topic, questions, slot_date, slot_time_start, slot_time_end, status, activity_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NOW())
            ");
            $stmtIns->execute([
                $tid, $configId, $contactId,
                $studentName, $studentCode ?: null, $studentEmail, $studentPhone ?: null, $programName ?: null,
                $topic, $questions ?: null, $slotDate, $slotStart, $slotEnd, $activityId
            ]);
            $bookingId = (int)$this->db->lastInsertId();

            try {
                $notifyUids = [];
                if ($ownerUid > 0) $notifyUids[] = $ownerUid;
                foreach (TenantConfigService::resolveNotificationRecipients($this->db, (int)$tid, 'ACADEMIC_1ON1_BOOKED', ['owner_id' => $ownerUid]) as $rec) {
                    $uInt = (int)($rec['id'] ?? 0);
                    if ($uInt > 0 && !in_array($uInt, $notifyUids, true)) {
                        $notifyUids[] = $uInt;
                    }
                }
                $notifTitle = "📅 Đăng ký Hướng dẫn 1:1 mới: {$studentName} ({$slotStart} {$fmtDate})";
                $notifBody = "Học viên {$studentName} vừa đăng ký lịch hướng dẫn 1:1 với GV {$lecturerName} vào khung giờ {$slotStart} - {$slotEnd} ngày {$fmtDate}.\nĐề tài: {$topic}";
                $notifLink = $contactId ? "/contacts?open_contact_id={$contactId}" : "/internal-schedule";

                $stmtNotif = $this->db->prepare("
                    INSERT INTO notifications (user_id, tenant_id, title, body, type, link, is_read, created_at)
                    VALUES (?, ?, ?, ?, 'academic_1on1_booking', ?, 0, NOW())
                ");
                foreach ($notifyUids as $nUid) {
                    $stmtNotif->execute([$nUid, $tid, $notifTitle, $notifBody, $notifLink]);
                }
            } catch (\Throwable $eNotif) {}

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            respond(500, null, 'Lỗi khi lưu đăng ký lịch 1:1: ' . $e->getMessage(), false);
        }

        $orgBook = TenantConfigService::getOrganizationProfile($this->db, (int)$tid);
        $orgBookPlain = $orgBook['name'] ?: 'Academy';
        $orgBookHtml = htmlspecialchars($orgBookPlain);
        $brandPrefix = TenantConfigService::getBrandPrefix($this->db, (int)$tid);
        $defaultCc = $this->getDefaultAcademicCc((int)$tid);

        // Build Google Calendar URL & iCalendar (.ics) Content
        $calLinks = self::buildCalendarLinksAndIcs([
            'booking_id' => $bookingId,
            'title' => "{$brandPrefix} Hướng dẫn 1:1: {$studentName} & GV {$lecturerName}",
            'description' => $actBody,
            'location' => $config['zoom_link'] ?: "Online (Zoom Meeting - {$orgBookPlain})",
            'slot_date' => $slotDate,
            'slot_time_start' => $slotStart,
            'slot_time_end' => $slotEnd,
            'lecturer_name' => $lecturerName,
            'lecturer_email' => $lecturerEmail,
            'student_name' => $studentName,
            'student_email' => $studentEmail
        ]);

        // Send Email + .ics Calendar Invite to Student & Lecturer (CC Academic Affairs)
        try {
            $zoomHtml = '';
            if (!empty($config['zoom_link'])) {
                $zoomHtml = "<p style='margin:6px 0;'>• <strong>Link phòng họp Zoom:</strong> <a href='" . htmlspecialchars($config['zoom_link']) . "' target='_blank' style='color:#BD1D2D;font-weight:700;'>" . htmlspecialchars($config['zoom_link']) . "</a></p>";
                if (!empty($config['zoom_id']) || !empty($config['zoom_pass'])) {
                    $zoomHtml .= "<p style='margin:4px 0;'>• <strong>Meeting ID:</strong> " . htmlspecialchars($config['zoom_id'] ?? '') . " &nbsp;|&nbsp; <strong>Passcode:</strong> " . htmlspecialchars($config['zoom_pass'] ?? '') . "</p>";
                }
            }

            $gcalBtnHtml = "
                <div style='margin: 22px 0; text-align: center;'>
                    <a href='" . htmlspecialchars($calLinks['google_calendar_url']) . "' target='_blank' style='display:inline-block;background:linear-gradient(135deg,#BD1D2D,#8C111E);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;box-shadow:0 4px 10px rgba(189,29,45,0.25);'>
                        📅 Thêm ngay vào Google Calendar (1-Click)
                    </a>
                </div>
            ";

            $commonCardHtml = "
                <div style='background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #BD1D2D;border-radius:10px;padding:18px;margin:16px 0;'>
                    <p style='margin:5px 0;'>• <strong>Môn / Chương trình:</strong> " . htmlspecialchars($config['subject_name'] ?: ($programName ?: 'Hướng dẫn 1:1')) . "</p>
                    <p style='margin:5px 0;'>• <strong>Giảng viên hướng dẫn:</strong> " . htmlspecialchars($lecturerName) . "</p>
                    <p style='margin:5px 0;'>• <strong>Học viên:</strong> " . htmlspecialchars($studentName) . ($studentCode ? " (Mã HV: " . htmlspecialchars($studentCode) . ")" : "") . "</p>
                    <p style='margin:5px 0;'>• <strong>Email Học viên:</strong> " . htmlspecialchars($studentEmail) . ($studentPhone ? " &nbsp;|&nbsp; <strong>SĐT:</strong> " . htmlspecialchars($studentPhone) : "") . "</p>
                    <p style='margin:5px 0;color:#BD1D2D;font-size:15px;'>• <strong>Thời gian hẹn (30 phút):</strong> <strong>{$slotStart} - {$slotEnd}, Ngày {$fmtDate}</strong> (Giờ Việt Nam GMT+7)</p>
                    <p style='margin:5px 0;'>• <strong>Đề tài / Nội dung trao đổi:</strong> " . htmlspecialchars($topic) . "</p>
                    " . ($questions !== '' ? "<p style='margin:5px 0;'>• <strong>Câu hỏi chi tiết:</strong> " . nl2br(htmlspecialchars($questions)) . "</p>" : "") . "
                    {$zoomHtml}
                </div>
                {$gcalBtnHtml}
            ";

            // 1. Send to Lecturer (if lecturer has email)
            if ($lecturerEmail !== '' && filter_var($lecturerEmail, FILTER_VALIDATE_EMAIL)) {
                $lectSubj = "{$brandPrefix} Lịch Hướng Dẫn 1:1 Mới: HV {$studentName} ({$slotStart} - {$slotEnd} ngày {$fmtDate})";
                $lectHtml = "
                    <p>Kính gửi Giảng viên <strong>" . htmlspecialchars($lecturerName) . "</strong>,</p>
                    <p>Ban Học vụ <strong>{$orgBookHtml}</strong> trân trọng thông báo: Học viên <strong>" . htmlspecialchars($studentName) . "</strong> vừa đăng ký lịch hướng dẫn 1:1 với Thầy/Cô theo thông tin dưới đây:</p>
                    {$commonCardHtml}
                    <p style='font-size:13px;color:#64748b;'><em>* File lịch chuẩn (.ics) đã được đính kèm trong email này để tự động hiển thị trên Google Calendar / Outlook của Thầy/Cô.</em></p>
                    <p>Trân trọng,<br/><strong>Ban Học vụ — {$orgBookHtml}</strong></p>
                ";
                $this->sendEmailWithAttachmentsAndIcs($lecturerEmail, $lectSubj, 'THÔNG BÁO LỊCH HƯỚNG DẪN 1:1', $lectHtml, $defaultCc, [], $calLinks['ics_content']);
            }

            // 2. Send Confirmation to Student
            $stuSubj = "{$brandPrefix} Xác nhận Đăng ký Lịch Hướng Dẫn 1:1 ({$slotStart} - {$slotEnd} ngày {$fmtDate})";
            $stuHtml = "
                <p>Thân gửi Học viên <strong>" . htmlspecialchars($studentName) . "</strong>,</p>
                <p>Ban Học vụ <strong>{$orgBookHtml}</strong> xác nhận bạn đã đăng ký thành công lịch hướng dẫn 1:1 cùng Giảng viên <strong>" . htmlspecialchars($lecturerName) . "</strong>:</p>
                {$commonCardHtml}
                <p style='font-size:13px;color:#64748b;'><em>* Lưu ý: Học viên vui lòng vào phòng họp đúng khung giờ 30 phút đã đăng ký ({$slotStart} - {$slotEnd}) và chuẩn bị sẵn nội dung bài làm để buổi hướng dẫn đạt hiệu quả cao nhất.</em></p>
                <p>Trân trọng,<br/><strong>Ban Học vụ — {$orgBookHtml}</strong></p>
            ";
            $ccForStudent = ($lecturerEmail === '') ? $defaultCc : '';
            $this->sendEmailWithAttachmentsAndIcs($studentEmail, $stuSubj, 'XÁC NHẬN LỊCH HƯỚNG DẪN 1:1', $stuHtml, $ccForStudent, [], $calLinks['ics_content']);
        } catch (\Throwable $eMail) {
            error_log("send 1on1 booking emails error: " . $eMail->getMessage());
        }

        respond(200, [
            'booking_id' => $bookingId,
            'booking_date' => $slotDate,
            'slot_date' => $slotDate,
            'slot_range' => "{$slotStart}-{$slotEnd}",
            'slot_time_start' => $slotStart,
            'slot_time_end' => $slotEnd,
            'student_name' => $studentName,
            'lecturer_name' => $lecturerName,
            'meeting_link' => $config['zoom_link'] ?? '',
            'google_calendar_url' => $calLinks['google_calendar_url'],
            'ics_content' => $calLinks['ics_content'],
            'ics_data_uri' => 'data:text/calendar;charset=utf-8,' . rawurlencode($calLinks['ics_content'])
        ], 'Đăng ký lịch hướng dẫn 1:1 thành công! Lịch đã được tự động tạo trên Calendar và gửi thông báo đến Giảng viên.');
    }

    /**
     * Build Google Calendar Template URL + iCalendar (.ics) RFC-5545 content (Asia/Ho_Chi_Minh)
     */
    public static function buildCalendarLinksAndIcs(array $info): array {
        $dateClean = str_replace('-', '', $info['slot_date']);
        $startClean = str_replace(':', '', substr($info['slot_time_start'], 0, 5)) . '00';
        $endClean = str_replace(':', '', substr($info['slot_time_end'], 0, 5)) . '00';

        // Convert GMT+7 to UTC for universal Google Calendar URL & ICS compatibility
        $dtStartTz = new \DateTime($info['slot_date'] . ' ' . $info['slot_time_start'] . ':00', new \DateTimeZone('Asia/Ho_Chi_Minh'));
        $dtEndTz = new \DateTime($info['slot_date'] . ' ' . $info['slot_time_end'] . ':00', new \DateTimeZone('Asia/Ho_Chi_Minh'));
        $dtStartUtc = clone $dtStartTz;
        $dtStartUtc->setTimezone(new \DateTimeZone('UTC'));
        $dtEndUtc = clone $dtEndTz;
        $dtEndUtc->setTimezone(new \DateTimeZone('UTC'));

        $utcStartStr = $dtStartUtc->format('Ymd\THis\Z');
        $utcEndStr = $dtEndUtc->format('Ymd\THis\Z');
        $nowUtcStr = gmdate('Ymd\THis\Z');

        $gcalParams = http_build_query([
            'action' => 'TEMPLATE',
            'text' => $info['title'],
            'dates' => "{$utcStartStr}/{$utcEndStr}",
            'details' => $info['description'],
            'location' => $info['location'],
            'ctz' => 'Asia/Ho_Chi_Minh'
        ]);
        $googleCalendarUrl = "https://calendar.google.com/calendar/render?" . $gcalParams;

        $orgTid = (int)($info['tenant_id'] ?? ($GLOBALS['current_tenant_id'] ?? 1));
        require_once __DIR__ . '/../config/Database.php';
        $orgCfg = TenantConfigService::getOrganizationProfile(Database::getInstance(), $orgTid);
        $orgDomain = $orgCfg['internal_email_domain'] ?: 'myerp.local';
        $orgNameClean = preg_replace('/[,;]/', '', (string)($orgCfg['name'] ?: 'Academic Affairs'));
        $organizerEmail = $orgCfg['support_email'] ?: ($orgCfg['sender_email'] ?: ('noreply@' . $orgDomain));

        $uidStr = 'mentoring-1on1-' . ($info['booking_id'] ?? time()) . '@' . $orgDomain;
        $escDesc = str_replace(["\r\n", "\n", "\r", ",", ";"], ["\\n", "\\n", "", "\\,", "\\;"], $info['description']);
        $escTitle = str_replace([",", ";"], ["\\,", "\\;"], $info['title']);
        $escLoc = str_replace([",", ";"], ["\\,", "\\;"], $info['location']);

        $icsLines = [
            "BEGIN:VCALENDAR",
            "PRODID:-//{$orgNameClean}//MYERP 1on1 Mentoring//VI",
            "VERSION:2.0",
            "CALSCALE:GREGORIAN",
            "METHOD:REQUEST",
            "BEGIN:VEVENT",
            "DTSTART:{$utcStartStr}",
            "DTEND:{$utcEndStr}",
            "DTSTAMP:{$nowUtcStr}",
            "ORGANIZER;CN=Hoc Vu {$orgNameClean}:mailto:{$organizerEmail}",
            "UID:{$uidStr}",
            "STATUS:CONFIRMED",
            "SEQUENCE:0",
            "SUMMARY:{$escTitle}",
            "DESCRIPTION:{$escDesc}",
            "LOCATION:{$escLoc}",
            "BEGIN:VALARM",
            "TRIGGER:-PT15M",
            "ACTION:DISPLAY",
            "DESCRIPTION:Nhắc lịch hướng dẫn 1:1 sau 15 phút",
            "END:VALARM",
            "END:VEVENT",
            "END:VCALENDAR"
        ];
        $icsContent = implode("\r\n", $icsLines);

        return [
            'google_calendar_url' => $googleCalendarUrl,
            'ics_content' => $icsContent,
            'local_start' => "{$dateClean}T{$startClean}",
            'local_end' => "{$dateClean}T{$endClean}"
        ];
    }

    /**
     * 6A. GET /academic/subject-announcement/recipients
     * Fetch enrolled students for a course/campaign/program to send Subject & Seminar Announcement (TBCĐ)
     */
    public function getSubjectAnnouncementRecipients(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $campaignId = (int)($_GET['campaign_id'] ?? 0);
        $projectId = (int)($_GET['project_id'] ?? 0);
        $reqProgram = trim((string)($_GET['program'] ?? ''));

        $campaign = null;
        if ($campaignId > 0) {
            $stmtC = $this->db->prepare("
                SELECT mc.id, mc.name, mc.project_id, mc.subjects_json, p.name as project_name
                FROM marketing_campaigns mc
                LEFT JOIN projects p ON p.id = mc.project_id
                WHERE mc.id = ? AND mc.tenant_id = ? LIMIT 1
            ");
            $stmtC->execute([$campaignId, $tid]);
            $campaign = $stmtC->fetch(PDO::FETCH_ASSOC);
            if ($campaign && $projectId <= 0) {
                $projectId = (int)($campaign['project_id'] ?? 0);
            }
        } elseif ($projectId > 0 || $reqProgram !== '') {
            if ($projectId <= 0 && $reqProgram !== '') {
                $stmtP = $this->db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND deleted_at IS NULL AND (LOWER(name) = LOWER(?) OR name LIKE ?) LIMIT 1");
                $stmtP->execute([$tid, $reqProgram, "%{$reqProgram}%"]);
                $projectId = (int)$stmtP->fetchColumn();
            }
            if ($projectId > 0) {
                $stmtC = $this->db->prepare("
                    SELECT mc.id, mc.name, mc.project_id, mc.subjects_json, p.name as project_name
                    FROM marketing_campaigns mc
                    LEFT JOIN projects p ON p.id = mc.project_id
                    WHERE mc.tenant_id = ? AND mc.project_id = ? AND mc.status NOT IN ('deleted', 'archived')
                    ORDER BY (mc.status = 'active') DESC, mc.id DESC
                    LIMIT 1
                ");
                $stmtC->execute([$tid, $projectId]);
                $campaign = $stmtC->fetch(PDO::FETCH_ASSOC);
                if ($campaign) {
                    $campaignId = (int)$campaign['id'];
                }
            }
        }

        $courseSubjects = [];
        if ($campaign && !empty($campaign['subjects_json'])) {
            $decoded = is_string($campaign['subjects_json']) ? json_decode($campaign['subjects_json'], true) : $campaign['subjects_json'];
            if (is_array($decoded)) {
                $courseSubjects = $decoded;
            }
        }

        $lecturersMap = [];
        try {
            $stmtComp = $this->db->prepare("SELECT id, name FROM companies WHERE tenant_id = ? AND deleted_at IS NULL");
            $stmtComp->execute([$tid]);
            while ($r = $stmtComp->fetch(PDO::FETCH_ASSOC)) {
                $lecturersMap[(string)$r['id']] = $r['name'];
            }
        } catch (\Throwable $e) {}

        $progName = $reqProgram !== '' ? $reqProgram : trim((string)($campaign['project_name'] ?? ''));
        $params = [$tid];
        $conds = ["c.tenant_id = ?", "c.deleted_at IS NULL"];
        $studentFilter = "(c.status = 'customer' OR c.customer_type = 'student' OR c.pipeline_status = 'enrolled' OR c.stage_id IN (14, 44) OR COALESCE(c.student_id, '') != '')";
        $conds[] = $studentFilter;

        if ($campaignId > 0 && $projectId > 0) {
            if ($progName !== '') {
                $conds[] = "(c.campaign_id = ? OR c.project_id = ? OR LOWER(TRIM(c.program)) = LOWER(?) OR c.program LIKE ?)";
                $params[] = $campaignId;
                $params[] = $projectId;
                $params[] = $progName;
                $params[] = "%{$progName}%";
            } else {
                $conds[] = "(c.campaign_id = ? OR c.project_id = ?)";
                $params[] = $campaignId;
                $params[] = $projectId;
            }
        } elseif ($campaignId > 0) {
            $conds[] = "c.campaign_id = ?";
            $params[] = $campaignId;
        } elseif ($projectId > 0) {
            $conds[] = "c.project_id = ?";
            $params[] = $projectId;
        } elseif ($progName !== '') {
            $conds[] = "(LOWER(TRIM(c.program)) = LOWER(?) OR c.program LIKE ?)";
            $params[] = $progName;
            $params[] = "%{$progName}%";
        }

        $reqSubjectId = trim((string)($_GET['subject_id'] ?? ''));
        $reqSubjectCode = trim((string)($_GET['subject_code'] ?? ''));
        $reqSubjectName = trim((string)($_GET['subject_name'] ?? ''));

        $sql = "
            SELECT c.id, c.full_name, c.student_id, c.email, c.phone, c.mobile, c.program,
                   c.project_id, c.campaign_id, COALESCE(c.study_status, 'studying') as study_status
            FROM contacts c
            WHERE " . implode(" AND ", $conds) . "
            ORDER BY (c.campaign_id = " . (int)$campaignId . ") DESC, c.full_name ASC
            LIMIT 500
        ";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Preload student subject grades to identify who has already completed this subject
        $completedStudentMap = [];
        if (!empty($rows) && ($reqSubjectCode !== '' || $reqSubjectName !== '' || $reqSubjectId !== '')) {
            $cids = array_map(function($r) { return (int)$r['id']; }, $rows);
            $cids = array_filter($cids, function($id) { return $id > 0; });
            if (!empty($cids)) {
                $placeholders = implode(',', array_fill(0, count($cids), '?'));
                $gradeSql = "
                    SELECT contact_id, subject_code, subject_name, status, final_score, letter_grade
                    FROM student_subject_grades
                    WHERE tenant_id = ? AND contact_id IN ($placeholders)
                ";
                $stmtG = $this->db->prepare($gradeSql);
                $stmtG->execute(array_merge([$tid], array_values($cids)));
                $allGrades = $stmtG->fetchAll(PDO::FETCH_ASSOC);
                foreach ($allGrades as $gRow) {
                    $cid = (int)$gRow['contact_id'];
                    $st = strtolower(trim((string)($gRow['status'] ?? '')));
                    $fScore = is_numeric($gRow['final_score']) ? (float)$gRow['final_score'] : null;
                    $isPassed = in_array($st, ['passed', 'completed', 'exempt'], true) || ($fScore !== null && $fScore >= 4.0);
                    if ($isPassed) {
                        $matchSub = false;
                        if ($reqSubjectCode !== '' && strcasecmp(trim((string)$gRow['subject_code']), $reqSubjectCode) === 0) $matchSub = true;
                        if (!$matchSub && $reqSubjectName !== '' && (stripos($gRow['subject_name'], $reqSubjectName) !== false || stripos($reqSubjectName, $gRow['subject_name']) !== false)) $matchSub = true;
                        if ($matchSub) {
                            $completedStudentMap[$cid] = [
                                'status' => $st ?: 'passed',
                                'final_score' => $gRow['final_score'],
                                'letter_grade' => $gRow['letter_grade']
                            ];
                        }
                    }
                }
            }
        }

        $directCount = 0;
        $completedCount = 0;
        foreach ($rows as &$r) {
            $cid = (int)$r['id'];
            $r['in_campaign'] = ($campaignId > 0 && (int)($r['campaign_id'] ?? 0) === $campaignId);
            if ($r['in_campaign']) $directCount++;
            
            $isCompleted = isset($completedStudentMap[$cid]);
            $r['is_subject_completed'] = $isCompleted;
            if ($isCompleted) {
                $completedCount++;
                $r['subject_grade_info'] = $completedStudentMap[$cid];
            }
        }
        unset($r);

        respond(200, [
            'campaign_id' => $campaignId,
            'campaign_name' => $campaign['name'] ?? '',
            'project_id' => $projectId,
            'program_name' => $progName,
            'direct_campaign_count' => $directCount,
            'course_subjects' => $courseSubjects,
            'lecturers_map' => $lecturersMap,
            'students' => $rows
        ], 'Tải danh sách học viên nhận thông báo thành công');
    }

    /**
     * 6B. POST /academic/subject-announcement/send
     * Send Subject Schedule & Seminar Announcement (TBCĐ) Email and log activity
     */
    public function sendSubjectAnnouncementEmail(array $auth): void {
        $tid = (int)($auth['tenant_id'] ?? 1);
        $uid = (int)($auth['user_id'] ?? 0);
        $body = getBody();

        $campaignId = (int)($body['campaign_id'] ?? 0);
        $subjectId = trim((string)($body['subject_id'] ?? ''));
        $subjectCode = trim((string)($body['subject_code'] ?? ''));
        $subjectName = trim((string)($body['subject_name'] ?? ''));
        $templateKey = trim((string)($body['template_key'] ?? 'mba_standard'));
        $emailSubject = trim((string)($body['email_subject'] ?? $body['subject'] ?? ''));
        $bodyHtml = trim((string)($body['body_html'] ?? $body['content'] ?? ''));
        $ccEmails = array_key_exists('cc_emails', $body)
            ? trim((string)$body['cc_emails'])
            : (array_key_exists('cc_email', $body) ? trim((string)$body['cc_email']) : $this->getDefaultAcademicCc($tid));
        $aiAgentLink = trim((string)($body['ai_agent_link'] ?? ''));
        $schoolLecturer = trim((string)($body['school_lecturer'] ?? ''));

        // Normalize recipient emails
        $rawRecipients = $body['recipient_emails'] ?? $body['to_email'] ?? $body['to_emails'] ?? [];
        if (is_string($rawRecipients)) {
            $rawRecipients = preg_split('/[,;\s]+/', $rawRecipients, -1, PREG_SPLIT_NO_EMPTY);
        }
        $validEmails = [];
        if (is_array($rawRecipients)) {
            foreach ($rawRecipients as $em) {
                $emClean = strtolower(trim((string)$em));
                if ($emClean !== '' && filter_var($emClean, FILTER_VALIDATE_EMAIL)) {
                    $validEmails[$emClean] = $emClean;
                }
            }
        }
        $validEmails = array_values($validEmails);

        if (empty($validEmails)) {
            respond(422, null, 'Vui lòng chọn hoặc nhập ít nhất 1 địa chỉ email học viên hợp lệ!', false);
        }
        if ($emailSubject === '') {
            respond(422, null, 'Tiêu đề email thông báo không được để trống!', false);
        }
        if ($bodyHtml === '') {
            respond(422, null, 'Nội dung email thông báo không được để trống!', false);
        }

        // Optional: Persist ai_agent_link or school_lecturer back to marketing_campaigns.subjects_json
        $updatedSubject = false;
        if ($campaignId > 0 && ($aiAgentLink !== '' || $schoolLecturer !== '')) {
            try {
                $stmtC = $this->db->prepare("SELECT subjects_json FROM marketing_campaigns WHERE id = ? AND tenant_id = ? LIMIT 1");
                $stmtC->execute([$campaignId, $tid]);
                $subJsonStr = $stmtC->fetchColumn();
                $subs = !empty($subJsonStr) ? json_decode((string)$subJsonStr, true) : [];
                if (is_array($subs)) {
                    $changed = false;
                    foreach ($subs as &$sItem) {
                        $matchId = ($subjectId !== '' && (string)($sItem['id'] ?? '') === $subjectId);
                        $matchCode = ($subjectCode !== '' && strtolower(trim((string)$sItem['code'] ?? '')) === strtolower($subjectCode));
                        $matchName = ($subjectName !== '' && strtolower(trim((string)$sItem['name'] ?? '')) === strtolower($subjectName));
                        if ($matchId || $matchCode || $matchName) {
                            if ($aiAgentLink !== '') {
                                $sItem['ai_agent_link'] = $aiAgentLink;
                                $changed = true;
                            }
                            if ($schoolLecturer !== '') {
                                $sItem['school_lecturer'] = $schoolLecturer;
                                $changed = true;
                            }
                        }
                    }
                    unset($sItem);
                    if ($changed) {
                        $stmtUpd = $this->db->prepare("UPDATE marketing_campaigns SET subjects_json = ? WHERE id = ? AND tenant_id = ?");
                        $stmtUpd->execute([json_encode($subs, JSON_UNESCAPED_UNICODE), $campaignId, $tid]);
                        $updatedSubject = true;
                    }
                }
            } catch (\Throwable $eSub) {
                error_log("Update subjects_json ai_agent_link error: " . $eSub->getMessage());
            }
        }

        require_once __DIR__ . '/../mailer.php';
        $wrappedHtml = '<div style="background: #ffffff; color: #1e293b; font-size: 14.5px; line-height: 1.65;">' . $bodyHtml . '</div>';

        $sentCount = 0;
        foreach ($validEmails as $idx => $toEmail) {
            // Only attach CC on the first email in batch to prevent spamming CC inbox
            $ccForThisEmail = ($idx === 0) ? $ccEmails : '';
            $ok = $this->sendEmailWithAttachmentsAndIcs(
                $toEmail,
                $emailSubject,
                $emailSubject,
                $wrappedHtml,
                $ccForThisEmail
            );
            if ($ok) {
                $sentCount++;
            }
        }

        // Batch resolve contacts matching validEmails or passed contact_ids to log activities
        $senderName = trim((string)($auth['full_name'] ?? $auth['name'] ?? 'Học vụ'));
        $loggedContactsCount = 0;
        try {
            $placeholders = implode(',', array_fill(0, count($validEmails), '?'));
            $stmtContacts = $this->db->prepare("
                SELECT id, email FROM contacts
                WHERE tenant_id = ? AND deleted_at IS NULL AND LOWER(TRIM(email)) IN ($placeholders)
            ");
            $stmtContacts->execute(array_merge([$tid], $validEmails));
            $matchedContactIds = [];
            while ($cRow = $stmtContacts->fetch(PDO::FETCH_ASSOC)) {
                $matchedContactIds[(int)$cRow['id']] = (int)$cRow['id'];
            }
            if (!empty($body['contact_ids']) && is_array($body['contact_ids'])) {
                foreach ($body['contact_ids'] as $cid) {
                    if ((int)$cid > 0) $matchedContactIds[(int)$cid] = (int)$cid;
                }
            }
            $matchedContactIds = array_values($matchedContactIds);

            if (!empty($matchedContactIds)) {
                $actSubject = "📧 {$senderName} đã gửi Thông báo Chuyên đề / Lịch học môn: \"{$emailSubject}\"";
                $actDesc = "Người gửi: {$senderName}\nMẫu TBCĐ: " . strtoupper($templateKey)
                    . "\nMôn học: " . trim("{$subjectCode} - {$subjectName}", " -")
                    . "\nCC: " . ($ccEmails ?: 'Không có')
                    . "\n----------------------------------------\n" . $bodyHtml;
                foreach (array_chunk(array_values($matchedContactIds), 200) as $cidChunk) {
                    $rowPlaceholders = [];
                    $batchParams = [];
                    foreach ($cidChunk as $cid) {
                        $rowPlaceholders[] = "(?, ?, ?, 'contact', ?, ?, 'email', ?, ?, 'done', NOW(), NOW())";
                        $batchParams[] = $tid;
                        $batchParams[] = $uid;
                        $batchParams[] = $uid;
                        $batchParams[] = $cid;
                        $batchParams[] = $cid;
                        $batchParams[] = $actSubject;
                        $batchParams[] = $actDesc;
                    }
                    $stmtAct = $this->db->prepare("
                        INSERT INTO activities (tenant_id, user_id, created_by, related_type, related_id, contact_id, type, subject, body, status, done_at, created_at)
                        VALUES " . implode(', ', $rowPlaceholders)
                    );
                    $stmtAct->execute($batchParams);
                    $loggedContactsCount += count($cidChunk);
                }
            }
        } catch (\Throwable $eAct) {
            error_log("Log subject announcement activity error: " . $eAct->getMessage());
        }

        respond(200, [
            'sent_count' => $sentCount,
            'total_recipients' => count($validEmails),
            'recipients' => $validEmails,
            'logged_contacts_count' => $loggedContactsCount,
            'updated_subject' => $updatedSubject
        ], "Đã gửi email Thông báo Chuyên đề / Lịch học môn thành công tới {$sentCount} địa chỉ email!");
    }

    /**
     * Send HTML Email with optional File Attachments and optional .ics Calendar Invite
     */
    private function sendEmailWithAttachmentsAndIcs(
        string $to,
        string $subject,
        string $title,
        string $contentHtml,
        string $ccEmailString = '',
        array $attachments = [],
        ?string $icsContent = null
    ): bool {
        if ((defined('APP_ENV') && APP_ENV === 'staging') ||
            getenv('APP_ENV') === 'staging' ||
            ($_ENV['APP_ENV'] ?? '') === 'staging' ||
            getenv('DISABLE_EMAILS') === '1' ||
            ($_ENV['DISABLE_EMAILS'] ?? '') === '1' ||
            (defined('MYERP_TEST_MODE') && MYERP_TEST_MODE)) {
            return true;
        }

        // If no binary attachments and no ICS, delegate to standard sendEmailNotification
        if (empty($attachments) && empty($icsContent)) {
            return (bool)sendEmailNotification($to, $subject, $title, $contentHtml, $ccEmailString, false, 0, true);
        }

        global $conn;
        $settings = function_exists('get_system_setting') ? get_system_setting($conn) : [];
        $provider = $settings['email_provider'] ?? 'ses';

        if ($provider === 'ses' && !empty($settings['ses_host'])) {
            $mail = new PHPMailer(true);
            try {
                $mail->isSMTP();
                $mail->Host = $settings['ses_host'] ?? '';
                $mail->SMTPAuth = true;
                $mail->Username = $settings['ses_username'] ?? '';
                $mail->Password = $settings['ses_password'] ?? '';
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port = 587;
                $mail->CharSet = 'UTF-8';
                $mail->Timeout = 20;

                $orgProfile = TenantConfigService::getOrganizationProfile($this->db, (int)($GLOBALS['current_tenant_id'] ?? 1));
                $senderEmail = $settings['ses_sender_email'] ?? ($orgProfile['sender_email'] ?: 'noreply@myerp.local');
                $senderName = $settings['ses_sender_name'] ?? ($orgProfile['name'] ?: 'Academic Portal');
                $mail->setFrom($senderEmail, $senderName);
                $mail->addAddress($to);

                if (!empty($ccEmailString)) {
                    $ccList = preg_split('/[,;\s]+/', $ccEmailString, -1, PREG_SPLIT_NO_EMPTY);
                    foreach ($ccList as $cc) {
                        $cc = trim($cc);
                        if (!empty($cc) && filter_var($cc, FILTER_VALIDATE_EMAIL)) {
                            $mail->addCC($cc);
                        }
                    }
                }

                foreach ($attachments as $att) {
                    if (!empty($att['path']) && file_exists($att['path'])) {
                        $mail->addAttachment($att['path'], $att['name'] ?? basename($att['path']));
                    }
                }

                if (!empty($icsContent)) {
                    $mail->Ical = $icsContent;
                    $mail->addStringAttachment($icsContent, 'lich-huong-dan-1on1.ics', 'base64', 'text/calendar; charset=utf-8; method=REQUEST');
                }

                $mail->isHTML(true);
                $mail->Subject = $subject;
                $mail->Body = _getBaseHtml($title, '', $contentHtml, true);
                $mail->send();
                return true;
            } catch (\Throwable $e) {
                error_log("PHPMailer attachment/ICS send fallback: " . $e->getMessage());
            }
        }

        // Fallback to standard queue mailer
        return (bool)sendEmailNotification($to, $subject, $title, $contentHtml, $ccEmailString, false, 0, true);
    }
}
