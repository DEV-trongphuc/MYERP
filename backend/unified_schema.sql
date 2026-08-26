/*!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.6.18-MariaDB, for Linux (x86_64)
--
-- Host: localhost    Database: vhvxoigh_db_Ideas
-- ------------------------------------------------------
-- Server version	10.6.18-MariaDB-cll-lve-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Temporary table structure for view `accounts`
--

DROP TABLE IF EXISTS `accounts`;
/*!50001 DROP VIEW IF EXISTS `accounts`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `accounts` AS SELECT
 1 AS `id`,
  1 AS `tenant_id`,
  1 AS `username`,
  1 AS `password_hash`,
  1 AS `password`,
  1 AS `name`,
  1 AS `job_title`,
  1 AS `email`,
  1 AS `role`,
  1 AS `status`,
  1 AS `is_confirmed`,
  1 AS `confirm_token`,
  1 AS `last_login`,
  1 AS `avatar`,
  1 AS `signature_url`,
  1 AS `zalo_chat_id`,
  1 AS `telegram_chat_id`,
  1 AS `created_at`,
  1 AS `dob`,
  1 AS `gender`,
  1 AS `citizen_id`,
  1 AS `address`,
  1 AS `bank_name`,
  1 AS `bank_account`,
  1 AS `phone`,
  1 AS `is_active`,
  1 AS `team_id` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `active_compensation_logs`
--

DROP TABLE IF EXISTS `active_compensation_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `active_compensation_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `round_id` int(11) NOT NULL,
  `consultant_id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `amount` int(11) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `round_id` (`round_id`),
  KEY `consultant_id` (`consultant_id`),
  KEY `admin_id` (`admin_id`),
  KEY `idx_active_compensation_tenant` (`tenant_id`),
  CONSTRAINT `active_compensation_logs_ibfk_1` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE,
  CONSTRAINT `active_compensation_logs_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `active_compensation_logs_ibfk_3` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_compensation_logs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `activities`
--

DROP TABLE IF EXISTS `activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `activities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'task',
  `subject` varchar(255) NOT NULL,
  `body` text DEFAULT NULL,
  `status` enum('planned','done','cancelled') NOT NULL DEFAULT 'planned',
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `due_date` datetime DEFAULT NULL,
  `done_at` datetime DEFAULT NULL,
  `related_type` varchar(50) DEFAULT NULL,
  `related_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `participant_ids` varchar(255) DEFAULT NULL,
  `progress` int(11) NOT NULL DEFAULT 0,
  `require_approval` tinyint(1) NOT NULL DEFAULT 0,
  `approver_id` int(11) DEFAULT NULL,
  `approval_status` varchar(50) DEFAULT NULL,
  `link` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `edit_history` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_activity_tenant` (`tenant_id`),
  KEY `idx_activity_user` (`user_id`),
  KEY `idx_activity_related` (`related_type`,`related_id`),
  KEY `idx_activity_due` (`due_date`),
  KEY `idx_activity_status` (`status`),
  KEY `idx_act_type` (`tenant_id`,`type`),
  KEY `idx_activity_created` (`tenant_id`,`created_at`),
  KEY `idx_activities_tenant_user_status` (`tenant_id`,`user_id`,`status`,`due_date`),
  KEY `idx_activities_tenant_user` (`tenant_id`,`user_id`),
  KEY `idx_activities_related` (`related_type`,`related_id`),
  KEY `idx_activities_due_date` (`due_date`),
  KEY `idx_activities_composite` (`related_type`,`related_id`,`status`),
  CONSTRAINT `activities_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=171 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `activity_comments`
--

DROP TABLE IF EXISTS `activity_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `activity_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `activity_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `content` text DEFAULT NULL,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `parent_id` int(11) DEFAULT NULL,
  `subtask_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `activity_id` (`activity_id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `activity_comments_ibfk_3` (`user_id`),
  KEY `idx_comments_activity_id` (`activity_id`),
  CONSTRAINT `activity_comments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_comments_ibfk_2` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_comments_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `admin_logs`
--

DROP TABLE IF EXISTS `admin_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `admin_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `details` longtext DEFAULT NULL COMMENT 'JSON details',
  `log_type` varchar(50) GENERATED ALWAYS AS (json_value(`details`,'$.type')) VIRTUAL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `is_rolled_back` tinyint(1) DEFAULT 0 COMMENT 'Đánh dấu log đã được hoàn tác',
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_action_created` (`action`,`created_at`),
  KEY `idx_action_log_type_created` (`action`,`log_type`,`created_at`),
  CONSTRAINT `admin_logs_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=111 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_rag_search_cache`
--

DROP TABLE IF EXISTS `ai_rag_search_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_rag_search_cache` (
  `query_hash` varchar(32) NOT NULL,
  `results` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`query_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_training_chunks`
--

DROP TABLE IF EXISTS `ai_training_chunks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_training_chunks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT 1,
  `doc_id` int(11) NOT NULL,
  `chunk_index` int(11) NOT NULL,
  `content` text NOT NULL,
  `vector` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `vector_norm` float DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `doc_id` (`doc_id`),
  FULLTEXT KEY `ft_content` (`content`),
  CONSTRAINT `ai_training_chunks_ibfk_1` FOREIGN KEY (`doc_id`) REFERENCES `ai_training_docs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=100007 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_training_docs`
--

DROP TABLE IF EXISTS `ai_training_docs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_training_docs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(255) NOT NULL,
  `content` longtext DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `source_type` enum('manual','web','file','folder') NOT NULL,
  `parent_id` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `status` varchar(50) DEFAULT 'pending',
  `file_path` varchar(500) DEFAULT NULL,
  `file_size` bigint(20) unsigned DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10006 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ai_vector_cache`
--

DROP TABLE IF EXISTS `ai_vector_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_vector_cache` (
  `hash` varchar(32) NOT NULL,
  `vector` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `vector_norm` double DEFAULT 0,
  PRIMARY KEY (`hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT 1,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `resource` varchar(100) NOT NULL,
  `resource_id` int(11) DEFAULT NULL,
  `old_data` longtext DEFAULT NULL,
  `new_data` longtext DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_audit_logs_action_created` (`action`,`created_at`),
  KEY `idx_audit_logs_resource_id` (`resource`,`resource_id`),
  KEY `idx_audit_resource_date` (`resource`,`resource_id`,`created_at`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=881 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `batches`
--

DROP TABLE IF EXISTS `batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `po_id` int(11) DEFAULT NULL,
  `batch_code` varchar(50) NOT NULL,
  `import_date` date NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `import_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `initial_qty` int(11) NOT NULL DEFAULT 0,
  `current_qty` int(11) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `status` enum('active','archived') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `product_id` (`product_id`),
  KEY `batch_code` (`batch_code`),
  KEY `idx_batches_fifo` (`product_id`,`tenant_id`,`current_qty`,`import_date`),
  CONSTRAINT `fk_batch_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocked_leads`
--

DROP TABLE IF EXISTS `blocked_leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `blocked_leads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) DEFAULT 1,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_blocked_phone` (`phone`),
  KEY `idx_blocked_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `capi_logs`
--

DROP TABLE IF EXISTS `capi_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `capi_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `event_name` enum('CompleteRegistration','Schedule','Purchase','BAD') NOT NULL,
  `payload_hash` varchar(64) NOT NULL,
  `sent_payload` text NOT NULL,
  `response_status` int(11) NOT NULL,
  `response_body` text DEFAULT NULL,
  `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_ins`
--

DROP TABLE IF EXISTS `check_ins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `check_ins` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `check_in_date` date NOT NULL,
  `check_in_time` time NOT NULL,
  `late_minutes` int(11) DEFAULT 0 COMMENT 'Số phút đi trễ',
  `selfie_url` varchar(255) DEFAULT NULL,
  `status` enum('approved','pending_approval','rejected') NOT NULL DEFAULT 'approved',
  `reason` varchar(255) DEFAULT NULL,
  `sla_notified_at` datetime DEFAULT NULL,
  `admin_note` varchar(255) DEFAULT NULL COMMENT 'Ghi chú phê duyệt từ Admin/Manager',
  `check_out_time` datetime DEFAULT NULL,
  `early_minutes` int(11) DEFAULT 0,
  `check_out_status` varchar(50) DEFAULT NULL,
  `latitude` varchar(50) DEFAULT NULL COMMENT 'Vĩ độ check-in',
  `longitude` varchar(50) DEFAULT NULL COMMENT 'Kinh độ check-in',
  `location_address` varchar(500) DEFAULT NULL COMMENT 'Địa chỉ check-in',
  `checkout_latitude` varchar(50) DEFAULT NULL COMMENT 'Vĩ độ check-out',
  `checkout_longitude` varchar(50) DEFAULT NULL COMMENT 'Kinh độ check-out',
  `checkout_location_address` varchar(500) DEFAULT NULL COMMENT 'Địa chỉ check-out',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_date` (`user_id`,`check_in_date`),
  CONSTRAINT `check_ins_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cloud_files`
--

DROP TABLE IF EXISTS `cloud_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cloud_files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `uploaded_by` int(11) NOT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `file_size` bigint(20) unsigned DEFAULT 0,
  `category` varchar(100) DEFAULT 'general',
  `visibility` enum('shared','personal') NOT NULL DEFAULT 'shared',
  `is_public` tinyint(1) DEFAULT 0,
  `project_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `campaign_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `visibility` (`visibility`),
  KEY `fk_cf_editor` (`updated_by`),
  KEY `idx_tenant_contact` (`tenant_id`,`contact_id`),
  CONSTRAINT `fk_cf_editor` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cf_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cf_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `parent_id` int(11) DEFAULT NULL,
  `attachments` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attachments`)),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `communication_logs`
--

DROP TABLE IF EXISTS `communication_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `communication_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) DEFAULT NULL,
  `type` enum('zalo','email') NOT NULL,
  `recipient` varchar(255) NOT NULL,
  `status` enum('sent','failed') NOT NULL,
  `error_message` text DEFAULT NULL,
  `sent_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `idx_comm_sent` (`sent_at`),
  CONSTRAINT `communication_logs_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=910 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `companies`
--

DROP TABLE IF EXISTS `companies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `companies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `owner_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `tax_id` varchar(50) DEFAULT NULL,
  `industry` varchar(150) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `social_link` varchar(255) DEFAULT NULL,
  `stage_id` int(11) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `ward` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `expected_revenue` decimal(15,2) DEFAULT 0.00,
  `country` varchar(100) DEFAULT 'Việt Nam',
  `size` enum('1-10','11-50','51-200','201-500','500+') DEFAULT NULL,
  `status` enum('active','inactive','prospect') NOT NULL DEFAULT 'prospect',
  `legal_representative` varchar(255) DEFAULT NULL,
  `erp_code` varchar(100) DEFAULT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `sla_level` varchar(50) NOT NULL DEFAULT 'standard',
  `wholesale_price` tinyint(1) NOT NULL DEFAULT 0,
  `vat_exempt` tinyint(1) NOT NULL DEFAULT 0,
  `dedicated_rep_id` int(11) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `tier` varchar(50) DEFAULT 'f1' COMMENT 'Cấp đại lý: f1, f2, f3, ctv',
  `parent_id` int(11) DEFAULT NULL COMMENT 'Đại lý cấp trên trực tiếp',
  `commission_rate` decimal(5,2) DEFAULT 0.00 COMMENT 'Tỷ lệ hoa hồng liên kết %',
  `focus_markets` text DEFAULT NULL COMMENT 'Phân khúc/Thị trường thế mạnh',
  `agent_count` int(11) DEFAULT 0 COMMENT 'Số lượng sales',
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_company_tenant` (`tenant_id`),
  KEY `idx_company_owner` (`owner_id`),
  KEY `idx_company_status` (`status`),
  KEY `idx_company_stage` (`stage_id`),
  FULLTEXT KEY `idx_company_search` (`name`,`email`),
  CONSTRAINT `companies_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `companies_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `companies_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `consultant_leaves`
--

DROP TABLE IF EXISTS `consultant_leaves`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `consultant_leaves` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `consultant_id` int(11) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `consultant_leave_dates` (`consultant_id`,`start_date`,`end_date`),
  CONSTRAINT `consultant_leaves_ibfk_1` FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary table structure for view `consultants`
--

DROP TABLE IF EXISTS `consultants`;
/*!50001 DROP VIEW IF EXISTS `consultants`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `consultants` AS SELECT
 1 AS `id`,
  1 AS `tenant_id`,
  1 AS `name`,
  1 AS `job_title`,
  1 AS `email`,
  1 AS `role`,
  1 AS `status`,
  1 AS `leave_start`,
  1 AS `leave_end`,
  1 AS `work_start_time`,
  1 AS `work_end_time`,
  1 AS `work_schedule`,
  1 AS `avatar`,
  1 AS `signature_url`,
  1 AS `zalo_chat_id`,
  1 AS `telegram_chat_id`,
  1 AS `vacation_mode`,
  1 AS `overtime_mode`,
  1 AS `team_id`,
  1 AS `dob`,
  1 AS `gender`,
  1 AS `citizen_id`,
  1 AS `address`,
  1 AS `bank_name`,
  1 AS `bank_account`,
  1 AS `extra_fields_json`,
  1 AS `use_custom_work_hours`,
  1 AS `created_at`,
  1 AS `phone`,
  1 AS `is_active` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `contact_emails`
--

DROP TABLE IF EXISTS `contact_emails`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contact_emails` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contact_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `type` enum('work','personal','other') DEFAULT 'work',
  `is_primary` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_ce_contact` (`contact_id`),
  CONSTRAINT `contact_emails_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contact_phones`
--

DROP TABLE IF EXISTS `contact_phones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contact_phones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contact_id` int(11) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `type` enum('mobile','work','home','fax','other') DEFAULT 'mobile',
  `is_primary` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_cp_contact` (`contact_id`),
  CONSTRAINT `contact_phones_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `contacts`
--

DROP TABLE IF EXISTS `contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `person_id` int(11) DEFAULT NULL,
  `duplicate_flag` tinyint(1) NOT NULL DEFAULT 0,
  `duplicate_with_id` int(11) DEFAULT NULL,
  `project_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `owner_id` int(11) DEFAULT NULL,
  `collaborator_ids` text DEFAULT NULL COMMENT 'JSON array or comma-separated list of co-caring sale IDs',
  `created_by` int(11) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL DEFAULT '',
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `avatar_url` text DEFAULT NULL,
  `mobile` varchar(50) DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `job_title` varchar(150) DEFAULT NULL,
  `department` varchar(150) DEFAULT NULL,
  `source` varchar(100) DEFAULT 'other',
  `status` enum('lead','qualified','customer','churned') NOT NULL DEFAULT 'lead',
  `pipeline_status` varchar(50) NOT NULL DEFAULT 'chua_xac_dinh',
  `temperature` enum('hot','warm','neutral','cool','cold') NOT NULL DEFAULT 'neutral',
  `suggested_temperature` enum('hot','warm','neutral','cool','cold') NOT NULL DEFAULT 'neutral',
  `temperature_updated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `tags` longtext DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `total_spent` decimal(15,2) NOT NULL DEFAULT 0.00,
  `order_count` int(11) NOT NULL DEFAULT 0,
  `last_order_at` datetime DEFAULT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `ward` varchar(100) DEFAULT NULL,
  `expected_revenue` decimal(15,2) DEFAULT 0.00,
  `win_probability` tinyint(3) DEFAULT 50,
  `last_contact` datetime DEFAULT NULL,
  `lead_score` tinyint(3) DEFAULT 0,
  `stage_id` int(11) DEFAULT NULL,
  `ttl1_completed` tinyint(1) DEFAULT 0,
  `ttl1_data` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `security_expires_at` datetime DEFAULT NULL,
  `parallel_assigned` tinyint(1) DEFAULT 0,
  `gender` varchar(20) DEFAULT NULL,
  `zalo_link` varchar(255) DEFAULT NULL,
  `fb_link` varchar(255) DEFAULT NULL,
  `customer_type` varchar(50) DEFAULT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `budget_range` varchar(100) DEFAULT NULL,
  `campaign_id` int(11) DEFAULT NULL,
  `not_lead_proposed` tinyint(1) DEFAULT 0,
  `not_lead_proposed_by` int(11) DEFAULT NULL,
  `not_lead_proposed_at` timestamp NULL DEFAULT NULL,
  `phone2` varchar(50) DEFAULT NULL COMMENT 'Số điện thoại 2 / phụ',
  `dob` date DEFAULT NULL COMMENT 'Ngày sinh',
  `citizen_id` varchar(50) DEFAULT NULL COMMENT 'Số CCCD / CMND',
  `district` varchar(100) DEFAULT NULL COMMENT 'Quận / Huyện',
  `company` varchar(200) DEFAULT NULL COMMENT 'Công ty làm việc',
  `tax_code` varchar(50) DEFAULT NULL COMMENT 'Mã số thuế',
  `budget` decimal(15,2) DEFAULT 0.00 COMMENT 'Ngân sách tài chính',
  `demand_type` varchar(100) DEFAULT NULL COMMENT 'Mục đích nhu cầu (Ở/Đầu tư/Cho thuê)',
  `property_type` varchar(100) DEFAULT NULL COMMENT 'Loại BĐS quan tâm',
  `bedroom_count` varchar(50) DEFAULT NULL COMMENT 'Số phòng ngủ mong muốn',
  `preferred_location` varchar(255) DEFAULT NULL COMMENT 'Khu vực / Dự án quan tâm',
  `utm_campaign` varchar(255) DEFAULT NULL COMMENT 'Tên chiến dịch Ads (UTM Campaign)',
  `utm_medium` varchar(255) DEFAULT NULL COMMENT 'Hình thức Ads (UTM Medium)',
  `utm_content` varchar(255) DEFAULT NULL COMMENT 'Mẫu QC / Adset (UTM Content)',
  `utm_term` varchar(255) DEFAULT NULL COMMENT 'Từ khóa Ads (UTM Term)',
  `platform` varchar(100) DEFAULT NULL COMMENT 'Nền tảng Data (Meta/Google/TikTok/Zalo)',
  `form_name` varchar(255) DEFAULT NULL COMMENT 'Tên Form / Landing Page',
  `zalo_phone` varchar(50) DEFAULT NULL COMMENT 'Số Zalo / Link Zalo',
  `facebook_link` varchar(255) DEFAULT NULL COMMENT 'Link Facebook cá nhân',
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `project_id` (`project_id`),
  KEY `idx_contacts_phone` (`phone`),
  KEY `idx_contacts_email` (`email`),
  KEY `idx_contacts_owner_id` (`owner_id`),
  KEY `idx_contacts_stage_id` (`stage_id`),
  KEY `idx_contacts_status` (`status`),
  KEY `idx_contacts_pipeline_status` (`pipeline_status`),
  KEY `idx_contacts_created_at` (`created_at`),
  KEY `idx_contacts_deleted_at` (`deleted_at`),
  KEY `idx_contacts_mobile` (`mobile`),
  KEY `idx_contacts_composite` (`person_id`,`owner_id`,`deleted_at`),
  KEY `idx_contacts_owner_status` (`owner_id`,`status`),
  KEY `idx_contacts_owner_pipeline` (`owner_id`,`pipeline_status`,`deleted_at`),
  KEY `idx_contacts_temp_created` (`temperature`,`created_at`),
  KEY `idx_contacts_person_id` (`person_id`),
  KEY `idx_tenant_status_owner` (`tenant_id`,`status`,`owner_id`,`created_at`),
  CONSTRAINT `contacts_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `contacts_ibfk_2` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contacts_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contacts_ibfk_4` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cooperation_slips`
--

DROP TABLE IF EXISTS `cooperation_slips`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cooperation_slips` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contact_id` int(11) NOT NULL,
  `deposit_slip_id` int(11) DEFAULT NULL,
  `version` int(11) NOT NULL DEFAULT 1,
  `total_percentage` int(11) NOT NULL DEFAULT 100,
  `shares_json` longtext NOT NULL,
  `signatures_json` longtext DEFAULT NULL,
  `status` enum('pending_signatures','pending_manager_approval','approved','rejected','disputed','approved_pending_signatures') NOT NULL DEFAULT 'pending_signatures',
  `dispute_details` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `attachment_url` varchar(500) DEFAULT NULL,
  `dieu_chinh_tu_id` int(11) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `adjustment_request_user_id` int(11) DEFAULT NULL,
  `adjustment_request_reason` text DEFAULT NULL,
  `adjustment_request_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `adjustment_request_shares_json` text DEFAULT NULL,
  `adjustment_request_commission` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `contact_id` (`contact_id`),
  KEY `idx_coop_slips_status_created` (`status`,`created_at`),
  CONSTRAINT `cooperation_slips_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_field_values`
--

DROP TABLE IF EXISTS `custom_field_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `custom_field_values` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `custom_field_id` int(11) NOT NULL,
  `entity_id` int(11) NOT NULL,
  `value_text` text DEFAULT NULL,
  `value_number` decimal(15,4) DEFAULT NULL,
  `value_date` date DEFAULT NULL,
  `value_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`value_json`)),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_field_value` (`custom_field_id`,`entity_id`),
  KEY `idx_cfv_entity` (`custom_field_id`,`entity_id`),
  CONSTRAINT `custom_field_values_ibfk_1` FOREIGN KEY (`custom_field_id`) REFERENCES `custom_fields` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `custom_fields`
--

DROP TABLE IF EXISTS `custom_fields`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `custom_fields` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `field_key` varchar(100) NOT NULL,
  `label` varchar(200) NOT NULL,
  `field_type` enum('text','number','date','dropdown','multiselect','checkbox','url','email','phone') NOT NULL DEFAULT 'text',
  `options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`options`)),
  `is_required` tinyint(1) DEFAULT 0,
  `is_filterable` tinyint(1) DEFAULT 1,
  `order_index` smallint(6) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_field_key` (`tenant_id`,`entity_type`,`field_key`),
  KEY `idx_cf_tenant_entity` (`tenant_id`,`entity_type`),
  CONSTRAINT `custom_fields_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `data_reports`
--

DROP TABLE IF EXISTS `data_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `data_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) DEFAULT NULL,
  `consultant_id` int(11) DEFAULT NULL,
  `round_id` int(11) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL,
  `resolved_by` varchar(100) DEFAULT NULL COMMENT 'Tên admin duyệt ticket',
  `reject_reason` varchar(255) DEFAULT NULL COMMENT 'Lý do từ chối ticket',
  `approval_reason` varchar(255) DEFAULT NULL COMMENT 'Lý do duyệt ticket',
  PRIMARY KEY (`id`),
  KEY `consultant_id` (`consultant_id`),
  KEY `idx_round_id` (`round_id`),
  KEY `idx_report_lookup` (`lead_id`,`consultant_id`,`round_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`),
  KEY `idx_data_reports_lead_id` (`lead_id`),
  KEY `idx_data_reports_status` (`status`),
  CONSTRAINT `data_reports_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `data_reports_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `data_reports_ibfk_3` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deal_stage_history`
--

DROP TABLE IF EXISTS `deal_stage_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `deal_stage_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `deal_id` int(11) NOT NULL,
  `from_stage` int(11) DEFAULT NULL,
  `to_stage` int(11) NOT NULL,
  `moved_by` int(11) NOT NULL,
  `moved_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `moved_by` (`moved_by`),
  KEY `idx_dsh_deal` (`deal_id`),
  CONSTRAINT `deal_stage_history_ibfk_1` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `deal_stage_history_ibfk_2` FOREIGN KEY (`moved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deals`
--

DROP TABLE IF EXISTS `deals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `deals` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `stage_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `owner_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `value` decimal(15,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'VND',
  `probability` tinyint(3) unsigned NOT NULL DEFAULT 50,
  `expected_close_date` date DEFAULT NULL,
  `actual_close_date` date DEFAULT NULL,
  `source` varchar(100) DEFAULT NULL,
  `lost_reason` text DEFAULT NULL,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `expected_close` date DEFAULT NULL,
  `switched_from_deal_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `contact_id` (`contact_id`),
  KEY `company_id` (`company_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_deal_tenant` (`tenant_id`),
  KEY `idx_deal_stage` (`stage_id`),
  KEY `idx_deal_owner` (`owner_id`),
  KEY `idx_deal_close` (`expected_close_date`),
  KEY `idx_deal_value` (`tenant_id`,`value`),
  KEY `idx_deal_tenant_created` (`tenant_id`,`created_at`),
  KEY `idx_deals_tenant_deleted` (`tenant_id`,`deleted_at`),
  KEY `idx_deals_deep_filter` (`tenant_id`,`stage_id`,`deleted_at`),
  KEY `idx_deals_tenant_owner_deleted` (`tenant_id`,`owner_id`,`deleted_at`,`stage_id`),
  CONSTRAINT `deals_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `deals_ibfk_2` FOREIGN KEY (`stage_id`) REFERENCES `pipeline_stages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `deals_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `deals_ibfk_4` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `deals_ibfk_5` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `deals_ibfk_6` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deposit_milestones`
--

DROP TABLE IF EXISTS `deposit_milestones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `deposit_milestones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `deposit_id` int(11) NOT NULL,
  `milestone_name` varchar(255) NOT NULL,
  `expected_amount` decimal(15,2) NOT NULL,
  `unc_file_path` varchar(500) DEFAULT NULL,
  `status` enum('pending','paid','approved','failed') NOT NULL DEFAULT 'pending',
  `approval_date` timestamp NULL DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `deposit_id` (`deposit_id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_deposit` (`deposit_id`),
  CONSTRAINT `deposit_milestones_ibfk_1` FOREIGN KEY (`deposit_id`) REFERENCES `deposits` (`id`) ON DELETE CASCADE,
  CONSTRAINT `deposit_milestones_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deposits`
--

DROP TABLE IF EXISTS `deposits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `deposits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contact_id` int(11) NOT NULL,
  `project_id` int(11) NOT NULL,
  `unit_code` varchar(100) NOT NULL,
  `price` decimal(15,2) NOT NULL,
  `expected_commission` decimal(15,2) NOT NULL DEFAULT 0.00,
  `status` enum('pending_admin','approved','cancelled') NOT NULL DEFAULT 'pending_admin',
  `cancelled_reason` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_deposits_contact_id` (`contact_id`),
  KEY `idx_deposits_project_id` (`project_id`),
  KEY `idx_deposits_status_created` (`status`,`created_at`),
  KEY `idx_contact` (`contact_id`),
  CONSTRAINT `deposits_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `deposits_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `deposits_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `distribution_logs`
--

DROP TABLE IF EXISTS `distribution_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `distribution_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `round_id` int(11) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `message` mediumtext DEFAULT NULL,
  `received_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `round_id` (`round_id`),
  KEY `idx_dist_logs_lead_id` (`lead_id`),
  KEY `idx_dist_logs_assigned_to` (`assigned_to`),
  KEY `idx_dist_logs_status` (`status`),
  CONSTRAINT `distribution_logs_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `distribution_logs_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `distribution_logs_ibfk_3` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1394 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `distribution_rounds`
--

DROP TABLE IF EXISTS `distribution_rounds`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `distribution_rounds` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `round_name` varchar(255) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `cc_emails` mediumtext DEFAULT NULL,
  `last_assigned_consultant_id` int(11) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `project_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `last_assigned_consultant_id` (`last_assigned_consultant_id`),
  KEY `idx_dist_rounds_tenant` (`tenant_id`),
  CONSTRAINT `distribution_rounds_ibfk_1` FOREIGN KEY (`last_assigned_consultant_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_dist_rounds_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10000 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `duplicate_log`
--

DROP TABLE IF EXISTS `duplicate_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `duplicate_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `entity_type` enum('contact','company') NOT NULL,
  `original_id` int(11) NOT NULL,
  `duplicate_id` int(11) NOT NULL,
  `match_field` varchar(50) NOT NULL,
  `resolved` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_dup_tenant` (`tenant_id`,`resolved`),
  CONSTRAINT `duplicate_log_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `email_otps`
--

DROP TABLE IF EXISTS `email_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `email_otps` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `otp_code` varchar(10) NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT '2fa',
  `expires_at` datetime NOT NULL,
  `is_used` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_email_otp_lookup` (`email`,`otp_code`,`type`,`is_used`),
  KEY `idx_user_otp` (`user_id`,`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `entity_tags`
--

DROP TABLE IF EXISTS `entity_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `entity_tags` (
  `tag_id` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `entity_id` int(11) NOT NULL,
  PRIMARY KEY (`tag_id`,`entity_type`,`entity_id`),
  KEY `idx_et_entity` (`entity_type`,`entity_id`),
  CONSTRAINT `entity_tags_ibfk_1` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `expense_entities`
--

DROP TABLE IF EXISTS `expense_entities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `expense_entities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `expense_id` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `entity_id` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ee_expense` (`expense_id`),
  KEY `idx_ee_entity` (`entity_type`,`entity_id`),
  KEY `idx_ee_tenant` (`tenant_id`),
  CONSTRAINT `expense_entities_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `expense_entities_ibfk_2` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `expenses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `approver_id` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `category` varchar(100) NOT NULL,
  `vendor_name` varchar(255) DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `vat_amount` decimal(15,2) DEFAULT 0.00,
  `date` date NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `has_vat_invoice` tinyint(1) NOT NULL DEFAULT 0,
  `is_vat_inclusive` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `reject_reason` varchar(255) DEFAULT NULL,
  `is_refunded` tinyint(1) DEFAULT 0,
  `refund_image_url` varchar(555) DEFAULT NULL,
  `refunded_at` datetime DEFAULT NULL,
  `refunder_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_exp_tenant` (`tenant_id`),
  KEY `idx_exp_status` (`status`),
  KEY `fk_exp_approver` (`approver_id`),
  KEY `idx_exp_date` (`tenant_id`,`date`),
  KEY `idx_expenses_tenant_title` (`tenant_id`,`title`),
  CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_exp_approver` FOREIGN KEY (`approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `field_mappings`
--

DROP TABLE IF EXISTS `field_mappings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `field_mappings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `connection_id` int(11) NOT NULL,
  `sheet_column` varchar(255) NOT NULL,
  `system_field` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `custom_label` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `connection_id` (`connection_id`),
  CONSTRAINT `field_mappings_ibfk_1` FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `file_categories`
--

DROP TABLE IF EXISTS `file_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `file_categories` (
  `id` varchar(50) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `label` varchar(100) NOT NULL,
  `icon_type` varchar(50) DEFAULT 'folder',
  `is_default` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `visibility` varchar(50) DEFAULT 'shared',
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `file_categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `files`
--

DROP TABLE IF EXISTS `files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `files` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `uploaded_by` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal','note') NOT NULL,
  `entity_id` int(11) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `file_size` bigint(20) unsigned DEFAULT 0,
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `version` smallint(6) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `idx_file_entity` (`entity_type`,`entity_id`),
  KEY `idx_file_tenant` (`tenant_id`),
  CONSTRAINT `files_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `files_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `form_submissions`
--

DROP TABLE IF EXISTS `form_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `form_submissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `form_id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`data`)),
  `source_url` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_contact_id` int(11) DEFAULT NULL,
  `status` enum('new','processed','spam') DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `idx_fs_form` (`form_id`),
  KEY `idx_fs_status` (`status`),
  CONSTRAINT `form_submissions_ibfk_1` FOREIGN KEY (`form_id`) REFERENCES `forms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `form_submissions_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `forms`
--

DROP TABLE IF EXISTS `forms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `forms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `schema` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`schema`)),
  `mapping` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`mapping`)),
  `embed_token` varchar(64) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `submit_count` int(11) DEFAULT 0,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `embed_token` (`embed_token`),
  KEY `tenant_id` (`tenant_id`),
  CONSTRAINT `forms_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `holiday_shift_registrations`
--

DROP TABLE IF EXISTS `holiday_shift_registrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `holiday_shift_registrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shift_date` date NOT NULL,
  `holiday_name` varchar(255) NOT NULL,
  `approved` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_shift_date` (`user_id`,`shift_date`),
  CONSTRAINT `holiday_shift_registrations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `import_jobs`
--

DROP TABLE IF EXISTS `import_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `import_jobs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `mapping` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`mapping`)),
  `status` enum('pending','processing','done','failed') DEFAULT 'pending',
  `total_rows` int(11) DEFAULT 0,
  `imported` int(11) DEFAULT 0,
  `duplicates` int(11) DEFAULT 0,
  `errors` int(11) DEFAULT 0,
  `error_log` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`error_log`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `import_jobs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `import_jobs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `inventory_logs`
--

DROP TABLE IF EXISTS `inventory_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `action_type` enum('IMPORT','SALE','EXPORT_INTERNAL','ADJUST','RETURN') NOT NULL,
  `qty_change` int(11) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `receiver_id` int(11) DEFAULT NULL,
  `receiver_type` enum('contact','company','user') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `batch_id` (`batch_id`),
  KEY `idx_inv_logs_receiver` (`receiver_type`,`receiver_id`),
  KEY `idx_inventory_logs_filter` (`tenant_id`,`action_type`,`created_at`),
  KEY `idx_inv_logs_reason` (`tenant_id`,`reason`(100)),
  CONSTRAINT `fk_log_batch` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoice_items`
--

DROP TABLE IF EXISTS `invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoice_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `invoice_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `invoice_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoice_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `deal_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `status` enum('draft','pending','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
  `issue_date` date NOT NULL,
  `due_date` date NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `shipping_customer_pay` tinyint(1) DEFAULT 1 COMMENT '1: Khách trả, 0: Shop trả',
  `shipping_fee` decimal(15,2) DEFAULT 0.00,
  `is_inventory_deducted` tinyint(1) DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `deal_id` (`deal_id`),
  KEY `company_id` (`company_id`),
  KEY `contact_id` (`contact_id`),
  KEY `idx_inv_tenant` (`tenant_id`),
  KEY `idx_inv_status` (`status`),
  KEY `idx_invoices_deep_filter` (`tenant_id`,`status`,`paid_at`),
  CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_ibfk_3` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `invoices_ibfk_4` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lead_offers`
--

DROP TABLE IF EXISTS `lead_offers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lead_offers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `round_id` int(11) NOT NULL,
  `offered_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('pending','accepted','expired','rejected') NOT NULL DEFAULT 'pending',
  `action_reason` varchar(255) DEFAULT NULL,
  `responded_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `idx_lead_offers_status_expires` (`status`,`expires_at`),
  KEY `idx_lead_offers_user_status` (`user_id`,`status`),
  CONSTRAINT `lead_offers_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lead_offers_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `leads`
--

DROP TABLE IF EXISTS `leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `leads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `person_id` int(11) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `note` mediumtext DEFAULT NULL,
  `campaign_id` varchar(255) DEFAULT NULL,
  `campaign_name` varchar(255) DEFAULT NULL,
  `ad_id` varchar(255) DEFAULT NULL,
  `raw_payload` longtext DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `last_assigned_at` datetime DEFAULT NULL,
  `target_round_id` int(11) DEFAULT NULL,
  `is_accepted` tinyint(1) DEFAULT 0,
  `accepted_at` datetime DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  `ai_screener_status` varchar(50) DEFAULT 'not_screened',
  `ai_evaluation` text DEFAULT NULL,
  `ai_attempts` int(11) DEFAULT 0,
  `connection_id` int(11) DEFAULT NULL,
  `last_interaction_date` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `zalo_notify_status` varchar(50) DEFAULT 'none',
  `email_notify_status` varchar(50) DEFAULT 'none',
  `zalo_notify_sent_at` datetime DEFAULT NULL,
  `email_notify_sent_at` datetime DEFAULT NULL,
  `ai_screening_started_at` datetime DEFAULT NULL COMMENT 'Thời điểm bắt đầu gọi AI',
  `ai_prompt_tokens` int(11) DEFAULT 0 COMMENT 'Số token prompt AI sử dụng',
  `ai_completion_tokens` int(11) DEFAULT 0 COMMENT 'Số token completion AI sử dụng',
  `ai_total_tokens` int(11) DEFAULT 0 COMMENT 'Tổng số token AI sử dụng',
  `telegram_notify_status` varchar(50) DEFAULT 'none',
  `telegram_notify_sent_at` datetime DEFAULT NULL COMMENT 'Thời gian gửi thông báo Telegram thành công',
  `phone2` varchar(50) DEFAULT NULL COMMENT 'Số điện thoại 2 / phụ',
  `gender` varchar(20) DEFAULT NULL COMMENT 'Giới tính',
  `dob` date DEFAULT NULL COMMENT 'Ngày sinh',
  `citizen_id` varchar(50) DEFAULT NULL COMMENT 'Số CCCD / CMND',
  `district` varchar(100) DEFAULT NULL COMMENT 'Quận / Huyện',
  `company` varchar(200) DEFAULT NULL COMMENT 'Công ty làm việc',
  `tax_code` varchar(50) DEFAULT NULL COMMENT 'Mã số thuế',
  `budget` decimal(15,2) DEFAULT 0.00 COMMENT 'Ngân sách tài chính',
  `demand_type` varchar(100) DEFAULT NULL COMMENT 'Mục đích nhu cầu (Ở/Đầu tư/Cho thuê)',
  `property_type` varchar(100) DEFAULT NULL COMMENT 'Loại BĐS quan tâm',
  `bedroom_count` varchar(50) DEFAULT NULL COMMENT 'Số phòng ngủ mong muốn',
  `preferred_location` varchar(255) DEFAULT NULL COMMENT 'Khu vực / Dự án quan tâm',
  `utm_campaign` varchar(255) DEFAULT NULL COMMENT 'Tên chiến dịch Ads (UTM Campaign)',
  `utm_medium` varchar(255) DEFAULT NULL COMMENT 'Hình thức Ads (UTM Medium)',
  `utm_content` varchar(255) DEFAULT NULL COMMENT 'Mẫu QC / Adset (UTM Content)',
  `utm_term` varchar(255) DEFAULT NULL COMMENT 'Từ khóa Ads (UTM Term)',
  `platform` varchar(100) DEFAULT NULL COMMENT 'Nền tảng Data (Meta/Google/TikTok/Zalo)',
  `form_name` varchar(255) DEFAULT NULL COMMENT 'Tên Form / Landing Page',
  `zalo_phone` varchar(50) DEFAULT NULL COMMENT 'Số Zalo / Link Zalo',
  `facebook_link` varchar(255) DEFAULT NULL COMMENT 'Link Facebook cá nhân',
  `next_attempt_date` datetime DEFAULT NULL COMMENT 'Thời gian thử phân bổ lại tiếp theo',
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `person_id` (`person_id`),
  KEY `idx_connection_id` (`connection_id`),
  KEY `idx_last_interaction_date` (`last_interaction_date`),
  KEY `idx_leads_status_created_at` (`status`,`created_at`),
  KEY `idx_leads_assigned_status` (`assigned_to`,`status`),
  KEY `idx_leads_assigned_accepted` (`assigned_to`,`is_accepted`),
  KEY `idx_leads_email` (`email`),
  KEY `idx_leads_created_at` (`created_at`),
  KEY `idx_leads_assign_status` (`assigned_to`,`status`),
  CONSTRAINT `leads_ibfk_1` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`) ON DELETE SET NULL,
  CONSTRAINT `leads_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `login_attempts`
--

DROP TABLE IF EXISTS `login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `login_attempts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `attempt_time` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_successful` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_ip_attempts` (`ip_address`,`attempt_time`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `mail_queue`
--

DROP TABLE IF EXISTS `mail_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mail_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `to_email` varchar(255) NOT NULL,
  `cc_email` varchar(255) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `body_html` longtext NOT NULL,
  `status` enum('pending','processing','sent','failed') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `attempts` int(11) DEFAULT 0,
  `last_error` text DEFAULT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `idx_mail_queue_status_created` (`status`,`created_at`),
  CONSTRAINT `mail_queue_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=386 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `marketing_campaigns`
--

DROP TABLE IF EXISTS `marketing_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `marketing_campaigns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `project_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `reference_url` varchar(500) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `project_ids` text DEFAULT NULL,
  `user_ids` text DEFAULT NULL,
  `manager_ids` text DEFAULT NULL,
  `document_ids` text DEFAULT NULL,
  `folder_path` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_mc_project_id` (`project_id`),
  CONSTRAINT `fk_mc_project_id` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `night_shift_registrations`
--

DROP TABLE IF EXISTS `night_shift_registrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `night_shift_registrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shift_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `approved` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_shift_date` (`user_id`,`shift_date`),
  CONSTRAINT `night_shift_registrations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `note_mentions`
--

DROP TABLE IF EXISTS `note_mentions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `note_mentions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `note_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_mention` (`note_id`,`user_id`),
  KEY `fk_note_mentions_user` (`user_id`),
  CONSTRAINT `fk_note_mentions_note` FOREIGN KEY (`note_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_note_mentions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notes`
--

DROP TABLE IF EXISTS `notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `entity_id` int(11) NOT NULL,
  `body` text NOT NULL,
  `type` enum('internal','public') NOT NULL DEFAULT 'internal',
  `is_pinned` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `attachment_url` varchar(500) DEFAULT NULL,
  `channel` varchar(50) DEFAULT NULL,
  `note_type` varchar(50) DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT 0,
  `client_feedback` text DEFAULT NULL,
  `stuck_tag` varchar(100) DEFAULT NULL,
  `suggested_temperature` varchar(20) DEFAULT NULL,
  `sale_temperature` varchar(20) DEFAULT NULL,
  `documents_sent` text DEFAULT NULL,
  `is_heritage` tinyint(1) DEFAULT 0,
  `edit_history` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_note_entity` (`entity_type`,`entity_id`),
  KEY `idx_note_parent` (`parent_id`),
  KEY `idx_note_tenant` (`tenant_id`),
  KEY `idx_note_time` (`created_at`),
  CONSTRAINT `notes_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `notes_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `notes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `body` text DEFAULT NULL,
  `type` varchar(50) DEFAULT 'info',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `link` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `idx_notif_user` (`user_id`,`is_read`),
  KEY `idx_notif_created` (`created_at`),
  KEY `idx_notifications_user_unread` (`user_id`,`is_read`),
  KEY `idx_notifications_user_created_at` (`user_id`,`created_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=336 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `persons`
--

DROP TABLE IF EXISTS `persons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `persons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `phone` varchar(20) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_public` tinyint(1) DEFAULT 0,
  `released_to_kho_at` datetime DEFAULT NULL,
  `public_count` int(11) DEFAULT 0,
  `deleted_from_databank` tinyint(1) DEFAULT 0,
  `is_blocked` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `phone_2` (`phone`),
  KEY `idx_persons_is_public` (`is_public`),
  KEY `idx_persons_released_to_kho` (`released_to_kho_at`),
  KEY `idx_persons_deleted_from_db` (`deleted_from_databank`),
  KEY `idx_persons_is_blocked` (`is_blocked`)
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pipeline_stages`
--

DROP TABLE IF EXISTS `pipeline_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pipeline_stages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `color` varchar(20) DEFAULT '#6366f1',
  `order_index` smallint(6) NOT NULL DEFAULT 0,
  `is_won` tinyint(1) NOT NULL DEFAULT 0,
  `is_lost` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `system_slug` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_stage_tenant` (`tenant_id`),
  KEY `idx_stage_order` (`tenant_id`,`order_index`),
  CONSTRAINT `pipeline_stages_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `product_categories`
--

DROP TABLE IF EXISTS `product_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `track_inventory` tinyint(1) DEFAULT 1,
  `has_cost` tinyint(1) DEFAULT 1,
  `track_batches` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_category` (`tenant_id`,`name`),
  CONSTRAINT `product_categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `sku` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `currency` char(3) NOT NULL DEFAULT 'VND',
  `unit` varchar(50) DEFAULT 'cái',
  `stock_quantity` int(11) NOT NULL DEFAULT 0,
  `min_stock_level` int(11) NOT NULL DEFAULT 5,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `track_inventory` tinyint(1) DEFAULT 1,
  `track_cost` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_product_tenant` (`tenant_id`),
  KEY `idx_product_sku` (`tenant_id`,`sku`),
  KEY `fk_prod_cat` (`category_id`),
  KEY `fk_products_creator` (`created_by`),
  CONSTRAINT `fk_prod_cat` FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_products_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_documents`
--

DROP TABLE IF EXISTS `project_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `project_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `project_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` bigint(20) DEFAULT 0,
  `mime_type` varchar(100) DEFAULT NULL,
  `uploaded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `project_documents_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_documents_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `project_roster`
--

DROP TABLE IF EXISTS `project_roster`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `project_roster` (
  `project_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`project_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `project_roster_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_roster_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `projects` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(255) NOT NULL,
  `code` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('active','completed','draft') DEFAULT 'active',
  `location` varchar(255) DEFAULT NULL,
  `developer` varchar(255) DEFAULT NULL,
  `document_ids` text DEFAULT NULL,
  `campaign_ids` text DEFAULT NULL,
  `progress_percent` int(11) DEFAULT 0,
  `construction_status` varchar(100) DEFAULT 'Chưa khởi công',
  `legal_status` varchar(255) DEFAULT 'Đang hoàn thiện pháp lý',
  `scale_block_count` int(11) DEFAULT 1,
  `scale_unit_count` int(11) DEFAULT 100,
  `handover_year` int(11) DEFAULT 2026,
  `manager_ids` text DEFAULT NULL,
  `folder_path` varchar(500) DEFAULT NULL,
  `reference_url` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `campaign_sharing_mode` varchar(50) DEFAULT 'independent',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `purchase_order_items`
--

DROP TABLE IF EXISTS `purchase_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `purchase_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `po_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_cost` decimal(15,2) NOT NULL,
  `subtotal` decimal(15,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_po_item_po` (`po_id`),
  KEY `idx_po_item_product` (`product_id`),
  CONSTRAINT `fk_po_item_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_po_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `purchase_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `supplier_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `po_number` varchar(50) NOT NULL,
  `order_date` date NOT NULL,
  `status` enum('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `payment_status` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_po_number_tenant` (`tenant_id`,`po_number`),
  KEY `idx_po_supplier` (`supplier_id`),
  KEY `idx_po_created` (`created_by`),
  CONSTRAINT `fk_po_created` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `fk_po_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quote_items`
--

DROP TABLE IF EXISTS `quote_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `quote_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quote_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(5,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `sort_order` smallint(6) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `idx_qi_quote` (`quote_id`),
  CONSTRAINT `quote_items_ibfk_1` FOREIGN KEY (`quote_id`) REFERENCES `quotes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quote_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quotes`
--

DROP TABLE IF EXISTS `quotes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `quotes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `deal_id` int(11) DEFAULT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `quote_number` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `status` enum('draft','sent','accepted','rejected','expired') NOT NULL DEFAULT 'draft',
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(15,2) NOT NULL DEFAULT 0.00,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `valid_until` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `terms` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `contact_id` (`contact_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_quote_tenant` (`tenant_id`),
  KEY `idx_quote_deal` (`deal_id`),
  KEY `idx_quote_status` (`status`),
  CONSTRAINT `quotes_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quotes_ibfk_2` FOREIGN KEY (`deal_id`) REFERENCES `deals` (`id`) ON DELETE SET NULL,
  CONSTRAINT `quotes_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `quotes_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `quyen_truy_cap`
--

DROP TABLE IF EXISTS `quyen_truy_cap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `quyen_truy_cap` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `contact_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `invited_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `contact_user_unique` (`contact_id`,`user_id`),
  KEY `user_id_idx` (`user_id`),
  KEY `contact_id_idx` (`contact_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `refresh_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_rt_user` (`user_id`),
  KEY `idx_rt_expires` (`expires_at`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `round_consultants`
--

DROP TABLE IF EXISTS `round_consultants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `round_consultants` (
  `round_id` int(11) NOT NULL,
  `consultant_id` int(11) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `receive_ratio` int(11) DEFAULT 1,
  `skip_count` int(11) DEFAULT 0,
  `compensation_count` int(11) DEFAULT 0,
  `data_per_turn` int(11) DEFAULT 1,
  `current_turn_remaining` int(11) DEFAULT 0,
  `skipped_credit` int(11) DEFAULT 0,
  PRIMARY KEY (`round_id`,`consultant_id`),
  KEY `consultant_id` (`consultant_id`),
  CONSTRAINT `round_consultants_ibfk_1` FOREIGN KEY (`round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE,
  CONSTRAINT `round_consultants_ibfk_2` FOREIGN KEY (`consultant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `routing_rules`
--

DROP TABLE IF EXISTS `routing_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `routing_rules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `connection_id` varchar(255) DEFAULT NULL,
  `target_round_id` int(11) DEFAULT NULL,
  `condition_column` varchar(100) NOT NULL,
  `condition_operator` varchar(50) DEFAULT 'contains',
  `condition_value` varchar(255) NOT NULL,
  `priority` int(11) DEFAULT 0,
  `conditions_json` longtext DEFAULT NULL,
  `logical_operator` varchar(10) DEFAULT 'AND',
  PRIMARY KEY (`id`),
  KEY `target_round_id` (`target_round_id`),
  CONSTRAINT `routing_rules_ibfk_1` FOREIGN KEY (`target_round_id`) REFERENCES `distribution_rounds` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `schema_migrations` (
  `migration` varchar(255) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`migration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `segments`
--

DROP TABLE IF EXISTS `segments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `segments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `name` varchar(200) NOT NULL,
  `entity_type` enum('contact','company','deal') NOT NULL,
  `filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`filters`)),
  `is_shared` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_seg_tenant` (`tenant_id`,`entity_type`),
  CONSTRAINT `segments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `segments_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sent_notifications`
--

DROP TABLE IF EXISTS `sent_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sent_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `notify_type` varchar(50) NOT NULL,
  `notify_date` date NOT NULL,
  `sent_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_type_date` (`user_id`,`notify_type`,`notify_date`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sheet_connections`
--

DROP TABLE IF EXISTS `sheet_connections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sheet_connections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sheet_name` varchar(255) NOT NULL,
  `spreadsheet_id` varchar(255) DEFAULT NULL,
  `connection_type` varchar(20) DEFAULT 'sheets',
  `webhook_token` varchar(64) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sync_interval` int(11) DEFAULT 5,
  `last_sync_at` datetime DEFAULT NULL,
  `sync_status` varchar(50) DEFAULT 'idle',
  `email_template` mediumtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `require_both_contact` tinyint(1) DEFAULT 0,
  `sync_mode` enum('all','new_only') DEFAULT 'all',
  `is_initialized` tinyint(1) DEFAULT 0,
  `is_silent` tinyint(1) DEFAULT 0,
  `sync_saleperson` tinyint(1) DEFAULT 0,
  `last_error` varchar(255) DEFAULT NULL,
  `two_way_sync` tinyint(1) DEFAULT 0,
  `google_script_url` varchar(512) DEFAULT NULL,
  `lead_recall_minutes` int(11) DEFAULT 0,
  `sync_error_count` int(11) DEFAULT 0,
  `notify_admin` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sheet_sync_records`
--

DROP TABLE IF EXISTS `sheet_sync_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sheet_sync_records` (
  `connection_id` int(11) NOT NULL,
  `row_hash` varchar(64) NOT NULL,
  `synced_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`connection_id`,`row_hash`),
  CONSTRAINT `sheet_sync_records_ibfk_1` FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suppliers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `contact_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `tax_code` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `total_ordered` decimal(15,2) DEFAULT 0.00,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `contact_position` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `scale_capital` varchar(255) DEFAULT NULL,
  `typical_projects` text DEFAULT NULL,
  `focused_type` varchar(255) DEFAULT NULL,
  `prestige_tier` varchar(50) DEFAULT NULL,
  `cooperation_status` varchar(50) DEFAULT 'active',
  `bank_account` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_supplier_tenant` (`tenant_id`),
  KEY `idx_supplier_created` (`created_by`),
  CONSTRAINT `fk_supp_created` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_supp_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sync_queue`
--

DROP TABLE IF EXISTS `sync_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sync_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lead_id` int(11) DEFAULT NULL,
  `connection_id` int(11) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `attempts` int(11) DEFAULT 0,
  `next_retry_at` datetime DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `lead_id` (`lead_id`),
  KEY `connection_id` (`connection_id`),
  KEY `idx_status_retry` (`status`,`next_retry_at`),
  CONSTRAINT `sync_queue_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sync_queue_ibfk_2` FOREIGN KEY (`connection_id`) REFERENCES `sheet_connections` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `system_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` mediumtext DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `color` varchar(20) DEFAULT '#6366f1',
  `entity_type` enum('contact','company','deal','all') DEFAULT 'all',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_tag` (`tenant_id`,`name`,`entity_type`),
  CONSTRAINT `tags_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `task_muted_notifications`
--

DROP TABLE IF EXISTS `task_muted_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `task_muted_notifications` (
  `task_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `muted_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`task_id`,`user_id`),
  KEY `idx_task_muted_user` (`user_id`,`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `teams` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `name` varchar(255) NOT NULL,
  `avatar_url` text DEFAULT NULL,
  `leader_id` int(11) NOT NULL,
  `branch` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `description` text DEFAULT NULL,
  `kpi_target` decimal(15,2) DEFAULT NULL,
  `max_members` int(11) DEFAULT NULL,
  `priority_weight` int(11) DEFAULT 1,
  `focus_project` varchar(255) DEFAULT NULL,
  `co_leader_ids` text DEFAULT NULL COMMENT 'JSON array or comma-separated list of co-manager user IDs',
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `leader_id` (`leader_id`),
  CONSTRAINT `teams_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teams_ibfk_2` FOREIGN KEY (`leader_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `telegram_queue`
--

DROP TABLE IF EXISTS `telegram_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `telegram_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bot_token` varchar(255) NOT NULL,
  `chat_id` varchar(255) NOT NULL,
  `body_text` text NOT NULL,
  `status` enum('pending','processing','sent','failed') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `attempts` int(11) DEFAULT 0,
  `last_error` text DEFAULT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `idx_telegram_queue_status_created` (`status`,`created_at`),
  CONSTRAINT `telegram_queue_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tenants`
--

DROP TABLE IF EXISTS `tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tenants` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(100) NOT NULL,
  `plan` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
  `logo_url` text DEFAULT NULL,
  `primary_color` varchar(20) DEFAULT '#BD1D2D',
  `currency` char(3) DEFAULT 'VND',
  `timezone` varchar(50) DEFAULT 'Asia/Ho_Chi_Minh',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket_comments`
--

DROP TABLE IF EXISTS `ticket_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ticket_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ticket_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `body` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `parent_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_tc_ticket` (`ticket_id`),
  CONSTRAINT `ticket_comments_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ticket_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ticket_notify_settings`
--

DROP TABLE IF EXISTS `ticket_notify_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ticket_notify_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `ticket_notify_settings_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tickets`
--

DROP TABLE IF EXISTS `tickets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tickets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `contact_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `assignee_id` int(11) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `due_date` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `related_contacts` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`related_contacts`)),
  `related_users` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`related_users`)),
  PRIMARY KEY (`id`),
  KEY `contact_id` (`contact_id`),
  KEY `created_by` (`created_by`),
  KEY `assignee_id` (`assignee_id`),
  KEY `idx_ticket_tenant` (`tenant_id`),
  KEY `idx_ticket_status` (`status`),
  CONSTRAINT `tickets_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tickets_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tickets_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `tickets_ibfk_4` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_notification_settings`
--

DROP TABLE IF EXISTS `user_notification_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_notification_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `tenant_id` int(11) NOT NULL,
  `email_warning` tinyint(1) DEFAULT 1,
  `email_mention` tinyint(1) DEFAULT 1,
  `email_approval_request` tinyint(1) DEFAULT 1,
  `email_project_document` tinyint(1) DEFAULT 0,
  `email_project_comment` tinyint(1) DEFAULT 0,
  `email_project_roster` tinyint(1) DEFAULT 0,
  `email_info` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `matrix_config` longtext DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_tenant` (`user_id`,`tenant_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL DEFAULT 1,
  `username` varchar(100) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `full_name` varchar(200) NOT NULL,
  `job_title` varchar(150) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `signature_url` longtext DEFAULT NULL COMMENT 'Chữ ký mẫu cá nhân',
  `role` enum('super_admin','admin','manager','assistant','sales','viewer','superadmin','director','hr','accountant','marketing','sale_admin','saleadmin') NOT NULL DEFAULT 'sales',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `two_factor_enabled` tinyint(1) DEFAULT 0,
  `two_factor_type` varchar(20) DEFAULT 'email',
  `two_factor_secret` varchar(255) DEFAULT NULL,
  `two_factor_backup_codes` text DEFAULT NULL,
  `status` enum('active','inactive','leave') DEFAULT 'active',
  `vacation_mode` tinyint(1) DEFAULT 0,
  `leave_start` date DEFAULT NULL,
  `leave_end` date DEFAULT NULL,
  `work_start_time` varchar(5) DEFAULT '08:00',
  `work_end_time` varchar(5) DEFAULT '17:30',
  `work_schedule` longtext DEFAULT NULL,
  `zalo_chat_id` varchar(255) DEFAULT NULL,
  `telegram_chat_id` varchar(255) DEFAULT NULL,
  `is_confirmed` tinyint(1) DEFAULT 0,
  `confirm_token` varchar(64) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `team_id` int(11) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `citizen_id` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `bank_name` varchar(150) DEFAULT NULL,
  `bank_account` varchar(100) DEFAULT NULL,
  `overtime_mode` tinyint(1) DEFAULT 0,
  `permissions_json` longtext DEFAULT NULL,
  `extra_fields_json` longtext DEFAULT NULL,
  `manager_behavior_mode` varchar(50) NOT NULL DEFAULT 'combined',
  `use_custom_work_hours` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username` (`username`),
  KEY `tenant_id` (`tenant_id`),
  KEY `fk_user_team` (`team_id`),
  CONSTRAINT `fk_user_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=100005 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `weekend_shift_registrations`
--

DROP TABLE IF EXISTS `weekend_shift_registrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `weekend_shift_registrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shift_date` date NOT NULL,
  `approved` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_shift_date` (`user_id`,`shift_date`),
  CONSTRAINT `weekend_shift_registrations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflow_task_templates`
--

DROP TABLE IF EXISTS `workflow_task_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `workflow_task_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `stage_id` int(11) NOT NULL,
  `team_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `due_days_offset` int(11) NOT NULL DEFAULT 1,
  `require_approval` tinyint(4) NOT NULL DEFAULT 0,
  `is_active` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tenant_id` (`tenant_id`),
  KEY `stage_id` (`stage_id`),
  KEY `team_id` (`team_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `workflows`
--

DROP TABLE IF EXISTS `workflows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `workflows` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenant_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `trigger_type` varchar(100) NOT NULL,
  `trigger_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`trigger_data`)),
  `conditions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`conditions`)),
  `actions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`actions`)),
  `is_active` tinyint(1) DEFAULT 1,
  `run_count` int(11) DEFAULT 0,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_wf_tenant_active` (`tenant_id`,`is_active`),
  CONSTRAINT `workflows_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `workflows_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `zalo_queue`
--

DROP TABLE IF EXISTS `zalo_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `zalo_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bot_token` varchar(255) NOT NULL,
  `chat_id` varchar(255) NOT NULL,
  `body_text` text NOT NULL,
  `status` enum('pending','processing','sent','failed') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `sent_at` datetime DEFAULT NULL,
  `attempts` int(11) DEFAULT 0,
  `last_error` text DEFAULT NULL,
  `lead_id` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `idx_zalo_queue_status_created` (`status`,`created_at`),
  CONSTRAINT `zalo_queue_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=118 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Final view structure for view `accounts`
--

/*!50001 DROP VIEW IF EXISTS `accounts`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`vhvxoigh_mail_auto`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `accounts` AS select `users`.`id` AS `id`,`users`.`tenant_id` AS `tenant_id`,`users`.`username` AS `username`,`users`.`password_hash` AS `password_hash`,`users`.`password_hash` AS `password`,`users`.`full_name` AS `name`,`users`.`job_title` AS `job_title`,`users`.`email` AS `email`,`users`.`role` AS `role`,`users`.`status` AS `status`,`users`.`is_confirmed` AS `is_confirmed`,`users`.`confirm_token` AS `confirm_token`,`users`.`last_login_at` AS `last_login`,`users`.`avatar_url` AS `avatar`,`users`.`signature_url` AS `signature_url`,`users`.`zalo_chat_id` AS `zalo_chat_id`,`users`.`telegram_chat_id` AS `telegram_chat_id`,`users`.`created_at` AS `created_at`,`users`.`dob` AS `dob`,`users`.`gender` AS `gender`,`users`.`citizen_id` AS `citizen_id`,`users`.`address` AS `address`,`users`.`bank_name` AS `bank_name`,`users`.`bank_account` AS `bank_account`,`users`.`phone` AS `phone`,`users`.`is_active` AS `is_active`,`users`.`team_id` AS `team_id` from `users` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `consultants`
--

/*!50001 DROP VIEW IF EXISTS `consultants`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`vhvxoigh_mail_auto`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `consultants` AS select `users`.`id` AS `id`,`users`.`tenant_id` AS `tenant_id`,`users`.`full_name` AS `name`,`users`.`job_title` AS `job_title`,`users`.`email` AS `email`,`users`.`role` AS `role`,`users`.`status` AS `status`,`users`.`leave_start` AS `leave_start`,`users`.`leave_end` AS `leave_end`,`users`.`work_start_time` AS `work_start_time`,`users`.`work_end_time` AS `work_end_time`,`users`.`work_schedule` AS `work_schedule`,`users`.`avatar_url` AS `avatar`,`users`.`signature_url` AS `signature_url`,`users`.`zalo_chat_id` AS `zalo_chat_id`,`users`.`telegram_chat_id` AS `telegram_chat_id`,`users`.`vacation_mode` AS `vacation_mode`,`users`.`overtime_mode` AS `overtime_mode`,`users`.`team_id` AS `team_id`,`users`.`dob` AS `dob`,`users`.`gender` AS `gender`,`users`.`citizen_id` AS `citizen_id`,`users`.`address` AS `address`,`users`.`bank_name` AS `bank_name`,`users`.`bank_account` AS `bank_account`,`users`.`extra_fields_json` AS `extra_fields_json`,`users`.`use_custom_work_hours` AS `use_custom_work_hours`,`users`.`created_at` AS `created_at`,`users`.`phone` AS `phone`,`users`.`is_active` AS `is_active` from `users` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-27 13:20:45

-- ------------------------------------------------------
-- Database Performance Indexes Optimization (v218)
-- ------------------------------------------------------

ALTER TABLE `absent_reasons` ADD INDEX `idx_absent_reasons_tenant` (`tenant_id`);
ALTER TABLE `academic_lecturers` ADD INDEX `idx_academic_lecturers_tenant` (`tenant_id`);
ALTER TABLE `checks` ADD INDEX `idx_checks_tenant` (`tenant_id`);
ALTER TABLE `contact_tags` ADD INDEX `idx_contact_tags_tenant` (`tenant_id`);
ALTER TABLE `defaults` ADD INDEX `idx_defaults_tenant` (`tenant_id`);
ALTER TABLE `departments` ADD INDEX `idx_departments_tenant` (`tenant_id`);
ALTER TABLE `deposit_milestones` ADD INDEX `idx_deposit_milestones_tenant` (`tenant_id`);
ALTER TABLE `honors` ADD INDEX `idx_honors_tenant` (`tenant_id`);
ALTER TABLE `inventory` ADD INDEX `idx_inventory_tenant` (`tenant_id`);
ALTER TABLE `list_views` ADD INDEX `idx_list_views_tenant` (`tenant_id`);
ALTER TABLE `lms_campaign_lecturer_allocations` ADD INDEX `idx_lms_camp_lect_alloc_tenant` (`tenant_id`);
ALTER TABLE `lms_lecturer_schedule_details` ADD INDEX `idx_lms_lect_sched_det_tenant` (`tenant_id`);
ALTER TABLE `lms_student_campaign_allocations` ADD INDEX `idx_lms_stud_camp_alloc_tenant` (`tenant_id`);
ALTER TABLE `monthly_payslips` ADD INDEX `idx_monthly_payslips_tenant` (`tenant_id`);
ALTER TABLE `quyen_truy_cap` ADD INDEX `idx_quyen_truy_cap_tenant` (`tenant_id`);

ALTER TABLE `check_ins` ADD INDEX `idx_check_ins_created_by` (`created_by`);
ALTER TABLE `contact_tags` ADD INDEX `idx_contact_tags_contact` (`contact_id`);
ALTER TABLE `contact_tags` ADD INDEX `idx_contact_tags_tag` (`tag_id`);
ALTER TABLE `deposit_milestones` ADD INDEX `idx_deposit_milestones_deposit` (`deposit_id`);
ALTER TABLE `deposit_milestones` ADD INDEX `idx_deposit_milestones_approved_by` (`approved_by`);
ALTER TABLE `lms_campaign_lecturer_allocations` ADD INDEX `idx_lms_camp_lect_alloc_campaign` (`campaign_id`);
ALTER TABLE `lms_campaign_lecturer_allocations` ADD INDEX `idx_lms_camp_lect_alloc_lecturer` (`lecturer_id`);
ALTER TABLE `lms_lecturer_schedule_details` ADD INDEX `idx_lms_lect_sched_det_lecturer` (`lecturer_id`);
ALTER TABLE `lms_lecturer_schedule_details` ADD INDEX `idx_lms_lect_sched_det_campaign` (`campaign_id`);
ALTER TABLE `lms_student_campaign_allocations` ADD INDEX `idx_lms_stud_camp_alloc_student` (`student_id`);
ALTER TABLE `lms_student_campaign_allocations` ADD INDEX `idx_lms_stud_camp_alloc_campaign` (`campaign_id`);
ALTER TABLE `quyen_truy_cap` ADD INDEX `idx_quyen_truy_cap_invited_by` (`invited_by`);

