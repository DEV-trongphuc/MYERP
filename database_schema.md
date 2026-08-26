# Database Schema - IDEAS ERP (Staging)

*Generated automatically on: 2026-08-15T17:05:04+07:00*
*Total Tables: 112*

## Table of Contents

- [accounts](#accounts)
- [active_compensation_logs](#active_compensation_logs)
- [activities](#activities)
- [activity_comments](#activity_comments)
- [activity_dependencies](#activity_dependencies)
- [admin_logs](#admin_logs)
- [ai_rag_search_cache](#ai_rag_search_cache)
- [ai_training_chunks](#ai_training_chunks)
- [ai_training_docs](#ai_training_docs)
- [ai_vector_cache](#ai_vector_cache)
- [attendance_bulk_request_details](#attendance_bulk_request_details)
- [attendance_bulk_requests](#attendance_bulk_requests)
- [audit_logs](#audit_logs)
- [batches](#batches)
- [blocked_leads](#blocked_leads)
- [capi_logs](#capi_logs)
- [check_ins](#check_ins)
- [cloud_files](#cloud_files)
- [comments](#comments)
- [communication_logs](#communication_logs)
- [companies](#companies)
- [consultant_leaves](#consultant_leaves)
- [consultants](#consultants)
- [contact_emails](#contact_emails)
- [contact_phones](#contact_phones)
- [contacts](#contacts)
- [cooperation_slips](#cooperation_slips)
- [custom_field_values](#custom_field_values)
- [custom_fields](#custom_fields)
- [data_reports](#data_reports)
- [deal_stage_history](#deal_stage_history)
- [deals](#deals)
- [deposit_milestones](#deposit_milestones)
- [deposits](#deposits)
- [distribution_logs](#distribution_logs)
- [distribution_rounds](#distribution_rounds)
- [duplicate_log](#duplicate_log)
- [email_otps](#email_otps)
- [enterprise_comments](#enterprise_comments)
- [enterprise_honors](#enterprise_honors)
- [enterprise_honors_reactions](#enterprise_honors_reactions)
- [enterprise_posts](#enterprise_posts)
- [enterprise_reactions](#enterprise_reactions)
- [entity_tags](#entity_tags)
- [expense_entities](#expense_entities)
- [expenses](#expenses)
- [field_mappings](#field_mappings)
- [file_categories](#file_categories)
- [files](#files)
- [form_submissions](#form_submissions)
- [forms](#forms)
- [holiday_shift_registrations](#holiday_shift_registrations)
- [hrm_assets](#hrm_assets)
- [hrm_contracts](#hrm_contracts)
- [hrm_leave_requests](#hrm_leave_requests)
- [hrm_profiles](#hrm_profiles)
- [hrm_salary_advances](#hrm_salary_advances)
- [import_jobs](#import_jobs)
- [inventory_logs](#inventory_logs)
- [invoice_items](#invoice_items)
- [invoices](#invoices)
- [lead_offers](#lead_offers)
- [leads](#leads)
- [login_attempts](#login_attempts)
- [mail_queue](#mail_queue)
- [marketing_campaigns](#marketing_campaigns)
- [monthly_payslips](#monthly_payslips)
- [night_shift_registrations](#night_shift_registrations)
- [note_mentions](#note_mentions)
- [notes](#notes)
- [notifications](#notifications)
- [persons](#persons)
- [pipeline_stages](#pipeline_stages)
- [product_categories](#product_categories)
- [products](#products)
- [project_documents](#project_documents)
- [project_roster](#project_roster)
- [projects](#projects)
- [purchase_order_items](#purchase_order_items)
- [purchase_orders](#purchase_orders)
- [quote_items](#quote_items)
- [quotes](#quotes)
- [quyen_truy_cap](#quyen_truy_cap)
- [refresh_tokens](#refresh_tokens)
- [round_consultants](#round_consultants)
- [routing_rules](#routing_rules)
- [sales_order_items](#sales_order_items)
- [sales_orders](#sales_orders)
- [schema_migrations](#schema_migrations)
- [segments](#segments)
- [sent_notifications](#sent_notifications)
- [sheet_connections](#sheet_connections)
- [sheet_sync_records](#sheet_sync_records)
- [suppliers](#suppliers)
- [sync_queue](#sync_queue)
- [system_settings](#system_settings)
- [tags](#tags)
- [task_focus_logs](#task_focus_logs)
- [task_hidden_users](#task_hidden_users)
- [task_muted_notifications](#task_muted_notifications)
- [teams](#teams)
- [telegram_queue](#telegram_queue)
- [tenants](#tenants)
- [ticket_comments](#ticket_comments)
- [ticket_notify_settings](#ticket_notify_settings)
- [tickets](#tickets)
- [user_notification_settings](#user_notification_settings)
- [users](#users)
- [weekend_shift_registrations](#weekend_shift_registrations)
- [workflow_task_templates](#workflow_task_templates)
- [workflows](#workflows)
- [zalo_queue](#zalo_queue)

---

### accounts

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO |  | `0` |  |  |
| **tenant_id** | `int(11)` | NO |  | `1` |  |  |
| **username** | `varchar(100)` | YES |  | `NULL` |  |  |
| **password_hash** | `varchar(255)` | YES |  | `NULL` |  |  |
| **password** | `varchar(255)` | YES |  | `NULL` |  |  |
| **name** | `varchar(200)` | NO |  | *NULL* |  |  |
| **job_title** | `varchar(150)` | YES |  | `NULL` |  |  |
| **email** | `varchar(255)` | NO |  | *NULL* |  |  |
| **role** | `enum('super_admin','admin','manager','assistant','sales','viewer','superadmin','director','hr','accountant','marketing','sale_admin','saleadmin')` | YES |  | `sales` |  |  |
| **status** | `enum('active','inactive','leave')` | YES |  | `active` |  |  |
| **is_confirmed** | `tinyint(1)` | YES |  | `0` |  |  |
| **confirm_token** | `varchar(64)` | YES |  | `NULL` |  |  |
| **last_login** | `timestamp` | YES |  | `NULL` |  |  |
| **avatar** | `varchar(255)` | YES |  | `NULL` |  |  |
| **signature_url** | `longtext` | YES |  | `NULL` |  | Chữ ký mẫu cá nhân |
| **zalo_chat_id** | `varchar(255)` | YES |  | `NULL` |  |  |
| **telegram_chat_id** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **dob** | `date` | YES |  | `NULL` |  |  |
| **gender** | `varchar(20)` | YES |  | `NULL` |  |  |
| **citizen_id** | `varchar(50)` | YES |  | `NULL` |  |  |
| **address** | `text` | YES |  | `NULL` |  |  |
| **bank_name** | `varchar(150)` | YES |  | `NULL` |  |  |
| **bank_account** | `varchar(100)` | YES |  | `NULL` |  |  |
| **phone** | `varchar(50)` | YES |  | `NULL` |  |  |
| **is_active** | `tinyint(1)` | NO |  | `1` |  |  |
| **team_id** | `int(11)` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### active_compensation_logs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **round_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **consultant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **admin_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **amount** | `int(11)` | NO |  | *NULL* |  |  |
| **reason** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_at** | `datetime` | YES |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### activities

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_by** | `int(11)` | YES | MUL | `NULL` |  |  |
| **type** | `varchar(50)` | NO |  | `task` |  |  |
| **subject** | `varchar(255)` | NO |  | *NULL* |  |  |
| **body** | `text` | YES |  | `NULL` |  |  |
| **status** | `enum('planned','done','cancelled')` | NO | MUL | `planned` |  |  |
| **priority** | `enum('low','medium','high')` | NO |  | `medium` |  |  |
| **start_date** | `datetime` | YES |  | `NULL` |  |  |
| **due_date** | `datetime` | YES | MUL | `NULL` |  |  |
| **done_at** | `datetime` | YES |  | `NULL` |  |  |
| **related_type** | `varchar(50)` | YES | MUL | `NULL` |  |  |
| **related_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **tags** | `varchar(255)` | YES |  | `NULL` |  |  |
| **participant_ids** | `varchar(255)` | YES |  | `NULL` |  |  |
| **progress** | `int(11)` | NO |  | `0` |  |  |
| **require_approval** | `tinyint(1)` | NO |  | `0` |  |  |
| **approver_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **approval_status** | `varchar(50)` | YES |  | `NULL` |  |  |
| **link** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `datetime` | YES |  | `NULL` |  |  |
| **edit_history** | `longtext` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### activity_comments

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **activity_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **content** | `text` | YES |  | `NULL` |  |  |
| **attachments** | `longtext` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **parent_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **subtask_id** | `varchar(255)` | YES | MUL | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### activity_dependencies

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **activity_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **predecessor_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **dependency_type** | `varchar(10)` | NO |  | `FS` |  |  |
| **lag_days** | `int(11)` | NO |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### admin_logs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **account_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **action** | `varchar(100)` | NO | MUL | *NULL* |  |  |
| **details** | `longtext` | YES |  | `NULL` |  | JSON details |
| **log_type** | `varchar(50)` | YES |  | `NULL` | VIRTUAL GENERATED |  |
| **ip_address** | `varchar(45)` | YES |  | `NULL` |  |  |
| **created_at** | `datetime` | YES | MUL | `current_timestamp()` |  |  |
| **is_rolled_back** | `tinyint(1)` | YES |  | `0` |  | Đánh dấu log đã được hoàn tác |

[Back to top](#table-of-contents)

---

### ai_rag_search_cache

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **query_hash** | `varchar(32)` | NO | PRI | *NULL* |  |  |
| **results** | `longtext` | NO |  | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### ai_training_chunks

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | YES | MUL | `1` |  |  |
| **doc_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **chunk_index** | `int(11)` | NO |  | *NULL* |  |  |
| **content** | `text` | NO | MUL | *NULL* |  |  |
| **vector** | `longtext` | NO |  | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **vector_norm** | `float` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### ai_training_docs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **content** | `longtext` | YES |  | `NULL` |  |  |
| **tags** | `varchar(255)` | YES |  | `NULL` |  |  |
| **source_type** | `enum('manual','web','file','folder')` | NO |  | *NULL* |  |  |
| **parent_id** | `int(11)` | YES | MUL | `0` |  |  |
| **is_active** | `tinyint(1)` | YES |  | `1` |  |  |
| **status** | `varchar(50)` | YES |  | `pending` |  |  |
| **file_path** | `varchar(500)` | YES |  | `NULL` |  |  |
| **file_size** | `bigint(20) unsigned` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **created_by** | `varchar(255)` | YES | MUL | `System` |  |  |
| **version** | `int(11)` | YES |  | `1` |  |  |

[Back to top](#table-of-contents)

---

### ai_vector_cache

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **hash** | `varchar(32)` | NO | PRI | *NULL* |  |  |
| **vector** | `longtext` | NO |  | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **vector_norm** | `double` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### attendance_bulk_request_details

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **request_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **check_in_date** | `date` | NO | MUL | *NULL* |  |  |
| **suggested_check_in** | `time` | YES |  | `NULL` |  |  |
| **suggested_check_out** | `time` | YES |  | `NULL` |  |  |
| **reason** | `varchar(255)` | NO |  | *NULL* |  |  |
| **approved** | `tinyint(1)` | YES |  | `1` |  |  |

[Back to top](#table-of-contents)

---

### attendance_bulk_requests

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **month_period** | `varchar(7)` | NO |  | *NULL* |  |  |
| **status** | `enum('pending_manager','pending_hr','approved','rejected')` | YES | MUL | `pending_manager` |  |  |
| **manager_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **hr_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **admin_note** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### audit_logs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `bigint(20)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | YES | MUL | `1` |  |  |
| **user_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **action** | `varchar(100)` | NO | MUL | *NULL* |  |  |
| **resource** | `varchar(100)` | NO | MUL | *NULL* |  |  |
| **resource_id** | `int(11)` | YES |  | `NULL` |  |  |
| **old_data** | `longtext` | YES |  | `NULL` |  |  |
| **new_data** | `longtext` | YES |  | `NULL` |  |  |
| **ip_address** | `varchar(45)` | YES |  | `NULL` |  |  |
| **user_agent** | `varchar(500)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### batches

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **product_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **supplier_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **po_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **batch_code** | `varchar(50)` | NO | MUL | *NULL* |  |  |
| **import_date** | `date` | NO |  | *NULL* |  |  |
| **expiry_date** | `date` | YES |  | `NULL` |  |  |
| **import_price** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **initial_qty** | `int(11)` | NO |  | `0` |  |  |
| **current_qty** | `int(11)` | NO |  | `0` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **status** | `enum('active','archived')` | YES |  | `active` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### blocked_leads

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | YES | MUL | `1` |  |  |
| **phone** | `varchar(50)` | YES | MUL | `NULL` |  |  |
| **email** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **reason** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_by** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_at** | `timestamp` | YES |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### capi_logs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **lead_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **event_name** | `enum('CompleteRegistration','Schedule','Purchase','BAD')` | NO |  | *NULL* |  |  |
| **payload_hash** | `varchar(64)` | NO |  | *NULL* |  |  |
| **sent_payload** | `text` | NO |  | *NULL* |  |  |
| **response_status** | `int(11)` | NO | MUL | *NULL* |  |  |
| **response_body** | `text` | YES |  | `NULL` |  |  |
| **sent_at** | `timestamp` | NO | MUL | `current_timestamp()` |  |  |
| **full_name** | `varchar(255)` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### check_ins

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **check_in_date** | `date` | NO |  | *NULL* |  |  |
| **check_in_time** | `time` | NO |  | *NULL* |  |  |
| **late_minutes** | `int(11)` | YES |  | `0` |  | Số phút đi trễ |
| **selfie_url** | `varchar(255)` | YES |  | `NULL` |  |  |
| **status** | `enum('approved','pending_approval','rejected')` | NO |  | `approved` |  |  |
| **reason** | `varchar(255)` | YES |  | `NULL` |  |  |
| **sla_notified_at** | `datetime` | YES |  | `NULL` |  |  |
| **admin_note** | `varchar(255)` | YES |  | `NULL` |  | Ghi chú phê duyệt từ Admin/Manager |
| **check_out_time** | `datetime` | YES |  | `NULL` |  |  |
| **early_minutes** | `int(11)` | YES |  | `0` |  |  |
| **check_out_status** | `varchar(50)` | YES |  | `NULL` |  |  |
| **latitude** | `varchar(50)` | YES |  | `NULL` |  | Vĩ độ check-in |
| **longitude** | `varchar(50)` | YES |  | `NULL` |  | Kinh độ check-in |
| **location_address** | `varchar(500)` | YES |  | `NULL` |  | Địa chỉ check-in |
| **checkout_latitude** | `varchar(50)` | YES |  | `NULL` |  | Vĩ độ check-out |
| **checkout_longitude** | `varchar(50)` | YES |  | `NULL` |  | Kinh độ check-out |
| **checkout_location_address** | `varchar(500)` | YES |  | `NULL` |  | Địa chỉ check-out |

[Back to top](#table-of-contents)

---

### cloud_files

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **uploaded_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **updated_by** | `int(11)` | YES | MUL | `NULL` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **file_path** | `varchar(500)` | NO |  | *NULL* |  |  |
| **mime_type** | `varchar(100)` | YES |  | `NULL` |  |  |
| **file_size** | `bigint(20) unsigned` | YES |  | `0` |  |  |
| **category** | `varchar(100)` | YES |  | `general` |  |  |
| **visibility** | `enum('shared','personal')` | NO | MUL | `shared` |  |  |
| **is_public** | `tinyint(1)` | YES |  | `0` |  |  |
| **project_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **campaign_id** | `int(11)` | YES | MUL | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### comments

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **entity_type** | `varchar(50)` | NO | MUL | *NULL* |  |  |
| **entity_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **body** | `text` | NO |  | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **parent_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **attachments** | `longtext` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### communication_logs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **lead_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **type** | `enum('zalo','email')` | NO |  | *NULL* |  |  |
| **recipient** | `varchar(255)` | NO |  | *NULL* |  |  |
| **status** | `enum('sent','failed')` | NO |  | *NULL* |  |  |
| **error_message** | `text` | YES |  | `NULL` |  |  |
| **sent_at** | `datetime` | YES | MUL | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### companies

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **owner_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(255)` | NO | MUL | *NULL* |  |  |
| **tax_id** | `varchar(50)` | YES | MUL | `NULL` |  |  |
| **bank_name** | `varchar(255)` | YES |  | `NULL` |  |  |
| **bank_account_number** | `varchar(100)` | YES |  | `NULL` |  |  |
| **bank_account_name** | `varchar(255)` | YES |  | `NULL` |  |  |
| **industry** | `varchar(150)` | YES |  | `NULL` |  |  |
| **website** | `varchar(255)` | YES |  | `NULL` |  |  |
| **social_link** | `varchar(255)` | YES |  | `NULL` |  |  |
| **stage_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **phone** | `varchar(50)` | YES |  | `NULL` |  |  |
| **email** | `varchar(255)` | YES |  | `NULL` |  |  |
| **address** | `text` | YES |  | `NULL` |  |  |
| **ward** | `varchar(100)` | YES |  | `NULL` |  |  |
| **city** | `varchar(100)` | YES |  | `NULL` |  |  |
| **expected_revenue** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **country** | `varchar(100)` | YES |  | `Việt Nam` |  |  |
| **size** | `enum('1-10','11-50','51-200','201-500','500+')` | YES |  | `NULL` |  |  |
| **status** | `enum('active','inactive','prospect')` | NO | MUL | `prospect` |  |  |
| **legal_representative** | `varchar(255)` | YES |  | `NULL` |  |  |
| **erp_code** | `varchar(100)` | YES |  | `NULL` |  |  |
| **tags** | `longtext` | YES |  | `NULL` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `timestamp` | YES |  | `NULL` |  |  |
| **sla_level** | `varchar(50)` | NO |  | `standard` |  |  |
| **wholesale_price** | `tinyint(1)` | NO |  | `0` |  |  |
| **vat_exempt** | `tinyint(1)` | NO |  | `0` |  |  |
| **dedicated_rep_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **logo_url** | `varchar(255)` | YES |  | `NULL` |  |  |
| **tier** | `varchar(50)` | YES |  | `f1` |  | Cấp đại lý: f1, f2, f3, ctv |
| **parent_id** | `int(11)` | YES | MUL | `NULL` |  | Đại lý cấp trên trực tiếp |
| **commission_rate** | `decimal(5,2)` | YES |  | `0.00` |  | Tỷ lệ hoa hồng liên kết % |
| **focus_markets** | `text` | YES |  | `NULL` |  | Phân khúc/Thị trường thế mạnh |
| **agent_count** | `int(11)` | YES |  | `0` |  | Số lượng sales |

[Back to top](#table-of-contents)

---

### consultant_leaves

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **consultant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **start_date** | `date` | NO |  | *NULL* |  |  |
| **end_date** | `date` | NO |  | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### consultants

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO |  | `0` |  |  |
| **tenant_id** | `int(11)` | NO |  | `1` |  |  |
| **name** | `varchar(200)` | NO |  | *NULL* |  |  |
| **job_title** | `varchar(150)` | YES |  | `NULL` |  |  |
| **email** | `varchar(255)` | NO |  | *NULL* |  |  |
| **role** | `enum('super_admin','admin','manager','assistant','sales','viewer','superadmin','director','hr','accountant','marketing','sale_admin','saleadmin')` | YES |  | `sales` |  |  |
| **status** | `enum('active','inactive','leave')` | YES |  | `active` |  |  |
| **leave_start** | `date` | YES |  | `NULL` |  |  |
| **leave_end** | `date` | YES |  | `NULL` |  |  |
| **work_start_time** | `varchar(5)` | YES |  | `08:00` |  |  |
| **work_end_time** | `varchar(5)` | YES |  | `17:30` |  |  |
| **work_schedule** | `longtext` | YES |  | `NULL` |  |  |
| **avatar** | `varchar(255)` | YES |  | `NULL` |  |  |
| **signature_url** | `longtext` | YES |  | `NULL` |  | Chữ ký mẫu cá nhân |
| **zalo_chat_id** | `varchar(255)` | YES |  | `NULL` |  |  |
| **telegram_chat_id** | `varchar(255)` | YES |  | `NULL` |  |  |
| **vacation_mode** | `tinyint(1)` | YES |  | `0` |  |  |
| **overtime_mode** | `tinyint(1)` | YES |  | `0` |  |  |
| **team_id** | `int(11)` | YES |  | `NULL` |  |  |
| **dob** | `date` | YES |  | `NULL` |  |  |
| **gender** | `varchar(20)` | YES |  | `NULL` |  |  |
| **citizen_id** | `varchar(50)` | YES |  | `NULL` |  |  |
| **address** | `text` | YES |  | `NULL` |  |  |
| **bank_name** | `varchar(150)` | YES |  | `NULL` |  |  |
| **bank_account** | `varchar(100)` | YES |  | `NULL` |  |  |
| **extra_fields_json** | `longtext` | YES |  | `NULL` |  |  |
| **use_custom_work_hours** | `tinyint(1)` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **phone** | `varchar(50)` | YES |  | `NULL` |  |  |
| **is_active** | `tinyint(1)` | NO |  | `1` |  |  |

[Back to top](#table-of-contents)

---

### contact_emails

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **contact_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **email** | `varchar(255)` | NO |  | *NULL* |  |  |
| **type** | `enum('work','personal','other')` | YES |  | `work` |  |  |
| **is_primary** | `tinyint(1)` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### contact_phones

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **contact_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **phone** | `varchar(50)` | NO |  | *NULL* |  |  |
| **type** | `enum('mobile','work','home','fax','other')` | YES |  | `mobile` |  |  |
| **is_primary** | `tinyint(1)` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### contacts

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **person_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **duplicate_flag** | `tinyint(1)` | NO |  | `0` |  |  |
| **duplicate_with_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **project_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **company_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **owner_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **collaborator_ids** | `text` | YES |  | `NULL` |  | JSON array or comma-separated list of co-caring sale IDs |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **full_name** | `varchar(255)` | YES |  | `NULL` |  |  |
| **email** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **phone** | `varchar(50)` | YES | MUL | `NULL` |  |  |
| **avatar_url** | `text` | YES |  | `NULL` |  |  |
| **mobile** | `varchar(50)` | YES | MUL | `NULL` |  |  |
| **birthday** | `date` | YES |  | `NULL` |  |  |
| **job_title** | `varchar(150)` | YES |  | `NULL` |  |  |
| **department** | `varchar(150)` | YES |  | `NULL` |  |  |
| **source** | `varchar(100)` | YES |  | `other` |  |  |
| **status** | `enum('lead','qualified','customer','churned')` | NO | MUL | `lead` |  |  |
| **pipeline_status** | `varchar(50)` | NO | MUL | `chua_xac_dinh` |  |  |
| **temperature** | `enum('hot','warm','neutral','cool','cold')` | NO | MUL | `neutral` |  |  |
| **suggested_temperature** | `enum('hot','warm','neutral','cool','cold')` | NO |  | `neutral` |  |  |
| **temperature_updated_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **tags** | `longtext` | YES |  | `NULL` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **total_spent** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **order_count** | `int(11)` | NO |  | `0` |  |  |
| **last_order_at** | `datetime` | YES |  | `NULL` |  |  |
| **address** | `text` | YES |  | `NULL` |  |  |
| **city** | `varchar(100)` | YES |  | `NULL` |  |  |
| **ward** | `varchar(100)` | YES |  | `NULL` |  |  |
| **expected_revenue** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **win_probability** | `tinyint(3)` | YES |  | `50` |  |  |
| **last_contact** | `datetime` | YES |  | `NULL` |  |  |
| **lead_score** | `tinyint(3)` | YES |  | `0` |  |  |
| **stage_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **ttl1_completed** | `tinyint(1)` | YES |  | `0` |  |  |
| **ttl1_data** | `longtext` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO | MUL | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `timestamp` | YES | MUL | `NULL` |  |  |
| **security_expires_at** | `datetime` | YES |  | `NULL` |  |  |
| **parallel_assigned** | `tinyint(1)` | YES |  | `0` |  |  |
| **gender** | `varchar(20)` | YES |  | `NULL` |  |  |
| **zalo_link** | `varchar(255)` | YES |  | `NULL` |  |  |
| **fb_link** | `varchar(255)` | YES |  | `NULL` |  |  |
| **customer_type** | `varchar(50)` | YES |  | `NULL` |  |  |
| **industry** | `varchar(100)` | YES |  | `NULL` |  |  |
| **budget_range** | `varchar(100)` | YES |  | `NULL` |  |  |
| **campaign_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **not_lead_proposed** | `tinyint(1)` | YES |  | `0` |  |  |
| **not_lead_proposed_by** | `int(11)` | YES |  | `NULL` |  |  |
| **not_lead_proposed_at** | `timestamp` | YES |  | `NULL` |  |  |
| **phone2** | `varchar(50)` | YES |  | `NULL` |  | Số điện thoại 2 / phụ |
| **dob** | `date` | YES |  | `NULL` |  | Ngày sinh |
| **citizen_id** | `varchar(50)` | YES | MUL | `NULL` |  | Số CCCD / CMND |
| **passport** | `varchar(50)` | YES |  | `NULL` |  |  |
| **district** | `varchar(100)` | YES |  | `NULL` |  | Quận / Huyện |
| **company** | `varchar(200)` | YES |  | `NULL` |  | Công ty làm việc |
| **tax_code** | `varchar(50)` | YES |  | `NULL` |  | Mã số thuế |
| **budget** | `decimal(15,2)` | YES |  | `0.00` |  | Ngân sách tài chính |
| **demand_type** | `varchar(100)` | YES |  | `NULL` |  | Mục đích nhu cầu (Ở/Đầu tư/Cho thuê) |
| **property_type** | `varchar(100)` | YES |  | `NULL` |  | Loại BĐS quan tâm |
| **bedroom_count** | `varchar(50)` | YES |  | `NULL` |  | Số phòng ngủ mong muốn |
| **preferred_location** | `varchar(255)` | YES |  | `NULL` |  | Khu vực / Dự án quan tâm |
| **utm_campaign** | `varchar(255)` | YES |  | `NULL` |  | Tên chiến dịch Ads (UTM Campaign) |
| **utm_medium** | `varchar(255)` | YES |  | `NULL` |  | Hình thức Ads (UTM Medium) |
| **utm_content** | `varchar(255)` | YES |  | `NULL` |  | Mẫu QC / Adset (UTM Content) |
| **utm_term** | `varchar(255)` | YES |  | `NULL` |  | Từ khóa Ads (UTM Term) |
| **platform** | `varchar(100)` | YES |  | `NULL` |  | Nền tảng Data (Meta/Google/TikTok/Zalo) |
| **form_name** | `varchar(255)` | YES |  | `NULL` |  | Tên Form / Landing Page |
| **zalo_phone** | `varchar(50)` | YES |  | `NULL` |  | Số Zalo / Link Zalo |
| **facebook_link** | `varchar(255)` | YES |  | `NULL` |  | Link Facebook cá nhân |

[Back to top](#table-of-contents)

---

### cooperation_slips

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **contact_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **deposit_slip_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **version** | `int(11)` | NO |  | `1` |  |  |
| **total_percentage** | `int(11)` | NO |  | `100` |  |  |
| **shares_json** | `longtext` | NO |  | *NULL* |  |  |
| **signatures_json** | `longtext` | YES |  | `NULL` |  |  |
| **status** | `enum('pending_signatures','pending_manager_approval','approved','rejected','disputed','approved_pending_signatures')` | NO | MUL | `pending_signatures` |  |  |
| **dispute_details** | `text` | YES |  | `NULL` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **attachment_url** | `varchar(500)` | YES |  | `NULL` |  |  |
| **dieu_chinh_tu_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **approved_by** | `int(11)` | YES |  | `NULL` |  |  |
| **approved_at** | `timestamp` | NO |  | `0000-00-00 00:00:00` |  |  |
| **adjustment_request_user_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **adjustment_request_reason** | `text` | YES |  | `NULL` |  |  |
| **adjustment_request_at** | `timestamp` | NO |  | `0000-00-00 00:00:00` |  |  |
| **adjustment_request_shares_json** | `text` | YES |  | `NULL` |  |  |
| **adjustment_request_commission** | `bigint(20)` | YES |  | `NULL` |  |  |
| **full_name** | `varchar(255)` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### custom_field_values

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **custom_field_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **entity_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **value_text** | `text` | YES |  | `NULL` |  |  |
| **value_number** | `decimal(15,4)` | YES |  | `NULL` |  |  |
| **value_date** | `date` | YES |  | `NULL` |  |  |
| **value_json** | `longtext` | YES |  | `NULL` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### custom_fields

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **entity_type** | `enum('contact','company','deal')` | NO |  | *NULL* |  |  |
| **field_key** | `varchar(100)` | NO |  | *NULL* |  |  |
| **label** | `varchar(200)` | NO |  | *NULL* |  |  |
| **field_type** | `enum('text','number','date','dropdown','multiselect','checkbox','url','email','phone')` | NO |  | `text` |  |  |
| **options** | `longtext` | YES |  | `NULL` |  |  |
| **is_required** | `tinyint(1)` | YES |  | `0` |  |  |
| **is_filterable** | `tinyint(1)` | YES |  | `1` |  |  |
| **order_index** | `smallint(6)` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### data_reports

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **lead_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **consultant_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **round_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **reason** | `varchar(255)` | YES |  | `NULL` |  |  |
| **status** | `varchar(20)` | YES | MUL | `pending` |  |  |
| **created_at** | `datetime` | YES | MUL | `current_timestamp()` |  |  |
| **resolved_at** | `datetime` | YES |  | `NULL` |  |  |
| **resolved_by** | `varchar(100)` | YES |  | `NULL` |  | Tên admin duyệt ticket |
| **reject_reason** | `varchar(255)` | YES |  | `NULL` |  | Lý do từ chối ticket |
| **approval_reason** | `varchar(255)` | YES |  | `NULL` |  | Lý do duyệt ticket |

[Back to top](#table-of-contents)

---

### deal_stage_history

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **deal_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **from_stage** | `int(11)` | YES |  | `NULL` |  |  |
| **to_stage** | `int(11)` | NO |  | *NULL* |  |  |
| **moved_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **moved_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### deals

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **stage_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **company_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **owner_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **title** | `varchar(255)` | NO |  | *NULL* |  |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **priority** | `enum('low','medium','high')` | NO |  | `medium` |  |  |
| **value** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **currency** | `char(3)` | NO |  | `VND` |  |  |
| **probability** | `tinyint(3) unsigned` | NO |  | `50` |  |  |
| **expected_close_date** | `date` | YES | MUL | `NULL` |  |  |
| **actual_close_date** | `date` | YES |  | `NULL` |  |  |
| **source** | `varchar(100)` | YES |  | `NULL` |  |  |
| **lost_reason** | `text` | YES |  | `NULL` |  |  |
| **tags** | `longtext` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `timestamp` | YES |  | `NULL` |  |  |
| **expected_close** | `date` | YES |  | `NULL` |  |  |
| **switched_from_deal_id** | `int(11)` | YES | MUL | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### deposit_milestones

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **deposit_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **milestone_name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **expected_amount** | `decimal(15,2)` | NO |  | *NULL* |  |  |
| **expected_pay_date** | `date` | YES | MUL | `NULL` |  | Ngày thanh toán dự kiến |
| **original_amount** | `decimal(15,2)` | YES |  | `NULL` |  |  |
| **actual_amount** | `decimal(15,2)` | YES |  | `NULL` |  |  |
| **unc_file_path** | `varchar(500)` | YES |  | `NULL` |  |  |
| **status** | `enum('pending','paid','approved','failed')` | NO |  | `pending` |  |  |
| **approval_date** | `timestamp` | YES |  | `NULL` |  |  |
| **approved_by** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **last_reminded_at** | `timestamp` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### deposits

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **contact_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **project_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **unit_code** | `varchar(100)` | NO |  | *NULL* |  |  |
| **price** | `decimal(15,2)` | NO |  | *NULL* |  |  |
| **expected_commission** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **status** | `enum('pending_admin','approved','cancelled')` | NO | MUL | `pending_admin` |  |  |
| **cancelled_reason** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **auto_remind** | `tinyint(1)` | YES |  | `1` |  |  |
| **remind_days_before** | `int(11)` | YES |  | `3` |  |  |
| **remind_at_hour** | `int(11)` | YES |  | `8` |  |  |
| **remind_target** | `int(11)` | YES |  | `1` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **currency** | `varchar(10)` | YES |  | `VND` |  |  |
| **exchange_rate** | `decimal(15,4)` | YES |  | `1.0000` |  |  |
| **accountant_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **participant_ids** | `varchar(255)` | YES |  | `NULL` |  |  |
| **full_name** | `varchar(255)` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### distribution_logs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **lead_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **assigned_to** | `int(11)` | YES | MUL | `NULL` |  |  |
| **round_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **status** | `varchar(50)` | YES | MUL | `NULL` |  |  |
| **message** | `mediumtext` | YES |  | `NULL` |  |  |
| **received_at** | `datetime` | YES | MUL | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### distribution_rounds

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **round_name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **description** | `mediumtext` | YES |  | `NULL` |  |  |
| **cc_emails** | `mediumtext` | YES |  | `NULL` |  |  |
| **last_assigned_consultant_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **is_active** | `tinyint(1)` | YES |  | `1` |  |  |
| **project_id** | `int(11)` | YES | MUL | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### duplicate_log

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **entity_type** | `enum('contact','company')` | NO |  | *NULL* |  |  |
| **original_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **duplicate_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **match_field** | `varchar(50)` | NO |  | *NULL* |  |  |
| **resolved** | `tinyint(1)` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### email_otps

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **email** | `varchar(255)` | NO | MUL | *NULL* |  |  |
| **otp_code** | `varchar(10)` | NO |  | *NULL* |  |  |
| **type** | `varchar(50)` | NO |  | `2fa` |  |  |
| **expires_at** | `datetime` | NO |  | *NULL* |  |  |
| **is_used** | `tinyint(1)` | NO |  | `0` |  |  |
| **created_at** | `datetime` | YES |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### enterprise_comments

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **post_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **parent_id** | `int(11)` | YES | MUL | `NULL` |  | ID of parent comment for nested replies |
| **content** | `text` | NO |  | *NULL* |  |  |
| **attachments_json** | `longtext` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `timestamp` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### enterprise_honors

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **title** | `varchar(255)` | NO |  | *NULL* |  |  |
| **badge** | `varchar(255)` | NO |  | *NULL* |  |  |
| **reason** | `text` | NO |  | *NULL* |  |  |
| **hearts_count** | `int(11)` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### enterprise_honors_reactions

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **honor_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **reaction_count** | `int(11)` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### enterprise_posts

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **content** | `text` | NO |  | *NULL* |  |  |
| **attachments_json** | `longtext` | YES |  | `NULL` |  | JSON array of media files (URLs, type: image/video/file) |
| **visibility** | `varchar(50)` | YES |  | `global` |  |  |
| **team_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **tags_json** | `varchar(255)` | YES |  | `[]` |  | JSON array of hashtags |
| **link_metadata_json** | `longtext` | YES |  | `NULL` |  | Parsed URL metadata (url, title, desc, image) |
| **created_at** | `timestamp` | NO | MUL | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `timestamp` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### enterprise_reactions

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **ref_type** | `varchar(20)` | NO | MUL | *NULL* |  | post or comment |
| **ref_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **reaction_type** | `varchar(20)` | NO |  | *NULL* |  | like, love, haha, wow, sad, angry |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### entity_tags

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **tag_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **entity_type** | `enum('contact','company','deal')` | NO | PRI | *NULL* |  |  |
| **entity_id** | `int(11)` | NO | PRI | *NULL* |  |  |

[Back to top](#table-of-contents)

---

### expense_entities

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **expense_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **entity_type** | `enum('contact','company','deal')` | NO | MUL | *NULL* |  |  |
| **entity_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **amount** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### expenses

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **approver_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **approved_at** | `datetime` | YES |  | `NULL` |  |  |
| **title** | `varchar(255)` | NO |  | *NULL* |  |  |
| **category** | `varchar(100)` | NO |  | *NULL* |  |  |
| **vendor_name** | `varchar(255)` | YES |  | `NULL` |  |  |
| **amount** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **vat_amount** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **date** | `date` | NO |  | *NULL* |  |  |
| **status** | `enum('pending','approved','rejected')` | NO | MUL | `pending` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **has_vat_invoice** | `tinyint(1)` | NO |  | `0` |  |  |
| **is_vat_inclusive** | `tinyint(1)` | NO |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `timestamp` | YES | MUL | `NULL` |  |  |
| **image_url** | `varchar(500)` | YES |  | `NULL` |  |  |
| **reject_reason** | `varchar(255)` | YES |  | `NULL` |  |  |
| **is_refunded** | `tinyint(1)` | YES |  | `0` |  |  |
| **refund_image_url** | `varchar(555)` | YES |  | `NULL` |  |  |
| **refunded_at** | `datetime` | YES |  | `NULL` |  |  |
| **refunder_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **approver_id_2** | `int(11)` | YES |  | `NULL` |  |  |
| **approver_id_3** | `int(11)` | YES |  | `NULL` |  |  |
| **status_level_1** | `varchar(50)` | YES |  | `pending` |  |  |
| **status_level_2** | `varchar(50)` | YES |  | `pending` |  |  |
| **status_level_3** | `varchar(50)` | YES |  | `pending` |  |  |
| **approval_status** | `varchar(50)` | YES |  | `pending` |  |  |

[Back to top](#table-of-contents)

---

### field_mappings

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **connection_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **sheet_column** | `varchar(255)` | NO |  | *NULL* |  |  |
| **system_field** | `varchar(100)` | NO |  | *NULL* |  |  |
| **created_at** | `datetime` | YES |  | `current_timestamp()` |  |  |
| **custom_label** | `varchar(255)` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### file_categories

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `varchar(50)` | NO | PRI | *NULL* |  |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **label** | `varchar(100)` | NO |  | *NULL* |  |  |
| **icon_type** | `varchar(50)` | YES |  | `folder` |  |  |
| **is_default** | `tinyint(1)` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **created_by** | `int(11)` | YES | MUL | `NULL` |  |  |
| **visibility** | `varchar(50)` | YES |  | `shared` |  |  |

[Back to top](#table-of-contents)

---

### files

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **uploaded_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **entity_type** | `enum('contact','company','deal','note')` | NO | MUL | *NULL* |  |  |
| **entity_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **original_name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **file_path** | `varchar(500)` | NO |  | *NULL* |  |  |
| **mime_type** | `varchar(100)` | YES |  | `NULL` |  |  |
| **file_size** | `bigint(20) unsigned` | YES |  | `0` |  |  |
| **tags** | `longtext` | YES |  | `NULL` |  |  |
| **version** | `smallint(6)` | YES |  | `1` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### form_submissions

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **form_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **data** | `longtext` | NO |  | *NULL* |  |  |
| **source_url** | `text` | YES |  | `NULL` |  |  |
| **ip_address** | `varchar(45)` | YES |  | `NULL` |  |  |
| **created_contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **status** | `enum('new','processed','spam')` | YES | MUL | `new` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### forms

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **schema** | `longtext` | NO |  | *NULL* |  |  |
| **mapping** | `longtext` | YES |  | `NULL` |  |  |
| **embed_token** | `varchar(64)` | NO | UNI | *NULL* |  |  |
| **is_active** | `tinyint(1)` | YES |  | `1` |  |  |
| **submit_count** | `int(11)` | YES |  | `0` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### holiday_shift_registrations

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **shift_date** | `date` | NO |  | *NULL* |  |  |
| **holiday_name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **approved** | `tinyint(1)` | NO |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### hrm_assets

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **asset_name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **asset_code** | `varchar(100)` | NO |  | *NULL* |  |  |
| **given_date** | `date` | NO |  | *NULL* |  |  |
| **returned_date** | `date` | YES |  | `NULL` |  |  |
| **condition_note** | `text` | YES |  | `NULL` |  |  |
| **status** | `varchar(20)` | YES |  | `assigned` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### hrm_contracts

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **contract_code** | `varchar(50)` | NO |  | *NULL* |  |  |
| **contract_type** | `varchar(30)` | YES |  | `probation` |  |  |
| **salary_base** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **salary_deal** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **salary_type** | `varchar(10)` | YES |  | `net` |  |  |
| **probation_rate** | `decimal(5,2)` | YES |  | `85.00` |  |  |
| **start_date** | `date` | NO |  | *NULL* |  |  |
| **end_date** | `date` | YES |  | `NULL` |  |  |
| **status** | `varchar(20)` | YES |  | `active` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### hrm_leave_requests

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **leave_type** | `varchar(30)` | YES |  | `annual` |  |  |
| **start_date** | `datetime` | NO |  | *NULL* |  |  |
| **end_date** | `datetime` | NO |  | *NULL* |  |  |
| **total_days** | `decimal(3,1)` | YES |  | `1.0` |  |  |
| **unpaid_days** | `decimal(3,1)` | YES |  | `0.0` |  |  |
| **reason** | `text` | YES |  | `NULL` |  |  |
| **status** | `varchar(20)` | YES |  | `pending` |  |  |
| **approved_by** | `int(11)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **approver_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **approver_id_2** | `int(11)` | YES |  | `NULL` |  |  |
| **approved_by_2** | `int(11)` | YES |  | `NULL` |  |  |
| **status_level_1** | `varchar(20)` | YES |  | `pending` |  |  |
| **status_level_2** | `varchar(20)` | YES |  | `pending` |  |  |
| **related_user_ids** | `text` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### hrm_profiles

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **user_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **joined_date** | `date` | NO |  | *NULL* |  |  |
| **base_salary** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **deal_salary** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **has_insurance** | `tinyint(1)` | YES |  | `1` |  |  |
| **allowance_meal** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **allowance_travel** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **allowance_phone** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **kpi_target** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **kpi_multiplier_rules** | `text` | YES |  | `NULL` |  |  |
| **custom_fields_json** | `text` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **annual_leave_total** | `decimal(4,1)` | YES |  | `12.0` |  | Tổng ngày phép năm được hưởng |
| **annual_leave_used** | `decimal(4,1)` | YES |  | `0.0` |  | Số ngày phép năm đã sử dụng |
| **compensatory_leave_total** | `decimal(4,1)` | YES |  | `0.0` |  | Tổng ngày nghị bù tích luũ |
| **compensatory_leave_used** | `decimal(4,1)` | YES |  | `0.0` |  | Số ngày nghị bù đã sử dụng |
| **insurance_rate_bhxh** | `decimal(5,2)` | YES |  | `8.00` |  |  |
| **insurance_rate_bhyt** | `decimal(5,2)` | YES |  | `1.50` |  |  |
| **insurance_rate_bhtn** | `decimal(5,2)` | YES |  | `1.00` |  |  |

[Back to top](#table-of-contents)

---

### hrm_salary_advances

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **amount** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **request_date** | `date` | NO |  | *NULL* |  |  |
| **reason** | `text` | YES |  | `NULL` |  |  |
| **status** | `varchar(20)` | YES |  | `pending` |  |  |
| **deducted_payslip_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **approver_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **approver_id_2** | `int(11)` | YES |  | `NULL` |  |  |
| **approved_by_2** | `int(11)` | YES |  | `NULL` |  |  |
| **status_level_1** | `varchar(20)` | YES |  | `pending` |  |  |
| **status_level_2** | `varchar(20)` | YES |  | `pending` |  |  |
| **related_user_ids** | `text` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### import_jobs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **entity_type** | `enum('contact','company','deal')` | NO |  | *NULL* |  |  |
| **file_name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **mapping** | `longtext` | YES |  | `NULL` |  |  |
| **status** | `enum('pending','processing','done','failed')` | YES |  | `pending` |  |  |
| **total_rows** | `int(11)` | YES |  | `0` |  |  |
| **imported** | `int(11)` | YES |  | `0` |  |  |
| **duplicates** | `int(11)` | YES |  | `0` |  |  |
| **errors** | `int(11)` | YES |  | `0` |  |  |
| **error_log** | `longtext` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **completed_at** | `timestamp` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### inventory_logs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **batch_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **action_type** | `enum('IMPORT','SALE','EXPORT_INTERNAL','ADJUST','RETURN')` | NO |  | *NULL* |  |  |
| **qty_change** | `int(11)` | NO |  | *NULL* |  |  |
| **reason** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_by** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **receiver_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **receiver_type** | `enum('contact','company','user')` | YES | MUL | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### invoice_items

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **invoice_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **product_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **quantity** | `decimal(10,2)` | NO |  | `1.00` |  |  |
| **unit_price** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **subtotal** | `decimal(15,2)` | NO |  | `0.00` |  |  |

[Back to top](#table-of-contents)

---

### invoices

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **deal_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **company_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **invoice_number** | `varchar(50)` | NO |  | *NULL* |  |  |
| **title** | `varchar(255)` | NO |  | *NULL* |  |  |
| **status** | `enum('draft','pending','paid','overdue','cancelled')` | NO | MUL | `draft` |  |  |
| **issue_date** | `date` | NO |  | *NULL* |  |  |
| **due_date** | `date` | NO |  | *NULL* |  |  |
| **paid_at** | `datetime` | YES |  | `NULL` |  |  |
| **subtotal** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **discount** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **tax** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **total** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **shipping_customer_pay** | `tinyint(1)` | YES |  | `1` |  | 1: Khách trả, 0: Shop trả |
| **shipping_fee** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **is_inventory_deducted** | `tinyint(1)` | YES |  | `0` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `timestamp` | YES | MUL | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### lead_offers

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **lead_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **round_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **offered_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **expires_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **status** | `enum('pending','accepted','expired','rejected')` | NO | MUL | `pending` |  |  |
| **action_reason** | `varchar(255)` | YES |  | `NULL` |  |  |
| **responded_at** | `timestamp` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### leads

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **person_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **phone** | `varchar(20)` | YES | UNI | `NULL` |  |  |
| **email** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **name** | `varchar(255)` | YES |  | `NULL` |  |  |
| **source** | `varchar(255)` | YES |  | `NULL` |  |  |
| **type** | `varchar(100)` | YES |  | `NULL` |  |  |
| **note** | `mediumtext` | YES |  | `NULL` |  |  |
| **campaign_id** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **campaign_name** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **ad_id** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **raw_payload** | `longtext` | YES |  | `NULL` |  |  |
| **assigned_to** | `int(11)` | YES | MUL | `NULL` |  |  |
| **last_assigned_at** | `datetime` | YES |  | `NULL` |  |  |
| **target_round_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **is_accepted** | `tinyint(1)` | YES |  | `0` |  |  |
| **accepted_at** | `datetime` | YES |  | `NULL` |  |  |
| **status** | `varchar(50)` | YES | MUL | `active` |  |  |
| **ai_screener_status** | `varchar(50)` | YES |  | `not_screened` |  |  |
| **ai_evaluation** | `text` | YES |  | `NULL` |  |  |
| **ai_attempts** | `int(11)` | YES |  | `0` |  |  |
| **connection_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **last_interaction_date** | `datetime` | YES | MUL | `NULL` |  |  |
| **created_at** | `timestamp` | NO | MUL | `current_timestamp()` |  |  |
| **zalo_notify_status** | `varchar(50)` | YES |  | `none` |  |  |
| **email_notify_status** | `varchar(50)` | YES |  | `none` |  |  |
| **zalo_notify_sent_at** | `datetime` | YES |  | `NULL` |  |  |
| **email_notify_sent_at** | `datetime` | YES |  | `NULL` |  |  |
| **ai_screening_started_at** | `datetime` | YES |  | `NULL` |  | Thời điểm bắt đầu gọi AI |
| **ai_prompt_tokens** | `int(11)` | YES |  | `0` |  | Số token prompt AI sử dụng |
| **ai_completion_tokens** | `int(11)` | YES |  | `0` |  | Số token completion AI sử dụng |
| **ai_total_tokens** | `int(11)` | YES |  | `0` |  | Tổng số token AI sử dụng |
| **telegram_notify_status** | `varchar(50)` | YES |  | `none` |  |  |
| **telegram_notify_sent_at** | `datetime` | YES |  | `NULL` |  | Thời gian gửi thông báo Telegram thành công |
| **phone2** | `varchar(50)` | YES |  | `NULL` |  | Số điện thoại 2 / phụ |
| **gender** | `varchar(20)` | YES |  | `NULL` |  | Giới tính |
| **dob** | `date` | YES |  | `NULL` |  | Ngày sinh |
| **citizen_id** | `varchar(50)` | YES | MUL | `NULL` |  | Số CCCD / CMND |
| **district** | `varchar(100)` | YES |  | `NULL` |  | Quận / Huyện |
| **company** | `varchar(200)` | YES |  | `NULL` |  | Công ty làm việc |
| **tax_code** | `varchar(50)` | YES |  | `NULL` |  | Mã số thuế |
| **budget** | `decimal(15,2)` | YES |  | `0.00` |  | Ngân sách tài chính |
| **demand_type** | `varchar(100)` | YES |  | `NULL` |  | Mục đích nhu cầu (Ở/Đầu tư/Cho thuê) |
| **property_type** | `varchar(100)` | YES |  | `NULL` |  | Loại BĐS quan tâm |
| **bedroom_count** | `varchar(50)` | YES |  | `NULL` |  | Số phòng ngủ mong muốn |
| **preferred_location** | `varchar(255)` | YES |  | `NULL` |  | Khu vực / Dự án quan tâm |
| **utm_campaign** | `varchar(255)` | YES |  | `NULL` |  | Tên chiến dịch Ads (UTM Campaign) |
| **utm_medium** | `varchar(255)` | YES |  | `NULL` |  | Hình thức Ads (UTM Medium) |
| **utm_content** | `varchar(255)` | YES |  | `NULL` |  | Mẫu QC / Adset (UTM Content) |
| **utm_term** | `varchar(255)` | YES |  | `NULL` |  | Từ khóa Ads (UTM Term) |
| **platform** | `varchar(100)` | YES |  | `NULL` |  | Nền tảng Data (Meta/Google/TikTok/Zalo) |
| **form_name** | `varchar(255)` | YES |  | `NULL` |  | Tên Form / Landing Page |
| **zalo_phone** | `varchar(50)` | YES |  | `NULL` |  | Số Zalo / Link Zalo |
| **facebook_link** | `varchar(255)` | YES |  | `NULL` |  | Link Facebook cá nhân |
| **next_attempt_date** | `datetime` | YES |  | `NULL` |  | Thời gian thử phân bổ lại tiếp theo |
| **full_name** | `varchar(255)` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### login_attempts

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **ip_address** | `varchar(45)` | NO | MUL | *NULL* |  |  |
| **email** | `varchar(255)` | YES |  | `NULL` |  |  |
| **attempt_time** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **is_successful** | `tinyint(1)` | NO |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### mail_queue

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **to_email** | `varchar(255)` | NO |  | *NULL* |  |  |
| **cc_email** | `varchar(255)` | YES |  | `NULL` |  |  |
| **subject** | `varchar(255)` | NO |  | *NULL* |  |  |
| **body_html** | `longtext` | NO |  | *NULL* |  |  |
| **status** | `enum('pending','processing','sent','failed')` | YES | MUL | `pending` |  |  |
| **created_at** | `datetime` | YES |  | `current_timestamp()` |  |  |
| **sent_at** | `datetime` | YES |  | `NULL` |  |  |
| **attempts** | `int(11)` | YES |  | `0` |  |  |
| **last_error** | `text` | YES |  | `NULL` |  |  |
| **lead_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **updated_at** | `datetime` | YES |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### marketing_campaigns

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **project_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **subjects_json** | `longtext` | YES |  | `NULL` |  |  |
| **thesis_milestones_json** | `longtext` | YES |  | `NULL` |  |  |
| **reminders_json** | `longtext` | YES |  | `NULL` |  |  |
| **status** | `varchar(50)` | YES |  | `active` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **reference_url** | `varchar(500)` | YES |  | `NULL` |  |  |
| **start_date** | `date` | YES |  | `NULL` |  |  |
| **end_date** | `date` | YES |  | `NULL` |  |  |
| **project_ids** | `text` | YES |  | `NULL` |  |  |
| **user_ids** | `text` | YES |  | `NULL` |  |  |
| **manager_ids** | `text` | YES |  | `NULL` |  |  |
| **document_ids** | `text` | YES |  | `NULL` |  |  |
| **folder_path** | `varchar(500)` | YES |  | `NULL` |  |  |
| **created_by** | `int(11)` | YES | MUL | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### monthly_payslips

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **month_year** | `varchar(7)` | NO |  | *NULL* |  |  |
| **work_days_required** | `int(11)` | YES |  | `26` |  |  |
| **work_days_actual** | `decimal(4,1)` | YES |  | `0.0` |  |  |
| **lateness_minutes** | `int(11)` | YES |  | `0` |  |  |
| **lateness_penalty** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **lateness_compensatory_deducted** | `decimal(5,2)` | YES |  | `0.00` |  |  |
| **lateness_annual_deducted** | `decimal(5,2)` | YES |  | `0.00` |  |  |
| **salary_basic_calculated** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **allowance_total** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **kpi_bonus** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **insurance_bhxh** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **insurance_bhyt** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **insurance_bhtn** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **tax_pit** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **advance_deduction** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **net_salary** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **status** | `varchar(20)` | YES |  | `draft` |  |  |
| **signature_url** | `text` | YES |  | `NULL` |  |  |
| **confirmed_at** | `datetime` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **overtime_days** | `decimal(4,1)` | YES |  | `0.0` |  | Số ngày tăng ca |
| **overtime_salary** | `decimal(15,2)` | YES |  | `0.00` |  | Lương tăng ca |
| **diligence_bonus** | `decimal(15,2)` | YES |  | `0.00` |  | Thưởng chuyên cần |
| **note** | `text` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### night_shift_registrations

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **shift_date** | `date` | NO |  | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **approved** | `tinyint(1)` | NO |  | `1` |  |  |

[Back to top](#table-of-contents)

---

### note_mentions

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **note_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |

[Back to top](#table-of-contents)

---

### notes

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **parent_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **entity_type** | `enum('contact','company','deal')` | NO | MUL | *NULL* |  |  |
| **entity_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **body** | `text` | NO |  | *NULL* |  |  |
| **type** | `enum('internal','public')` | NO |  | `internal` |  |  |
| **is_pinned** | `tinyint(1)` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO | MUL | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **attachment_url** | `varchar(500)` | YES |  | `NULL` |  |  |
| **channel** | `varchar(50)` | YES |  | `NULL` |  |  |
| **note_type** | `varchar(50)` | YES |  | `NULL` |  |  |
| **duration_minutes** | `int(11)` | YES |  | `0` |  |  |
| **client_feedback** | `text` | YES |  | `NULL` |  |  |
| **stuck_tag** | `varchar(100)` | YES |  | `NULL` |  |  |
| **suggested_temperature** | `varchar(20)` | YES |  | `NULL` |  |  |
| **sale_temperature** | `varchar(20)` | YES |  | `NULL` |  |  |
| **documents_sent** | `text` | YES |  | `NULL` |  |  |
| **is_heritage** | `tinyint(1)` | YES |  | `0` |  |  |
| **edit_history** | `longtext` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### notifications

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **title** | `varchar(255)` | NO |  | *NULL* |  |  |
| **body** | `text` | YES |  | `NULL` |  |  |
| **type** | `varchar(50)` | YES |  | `info` |  |  |
| **is_read** | `tinyint(1)` | NO |  | `0` |  |  |
| **link** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO | MUL | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### persons

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **phone** | `varchar(20)` | NO | UNI | *NULL* |  |  |
| **email** | `varchar(255)` | YES |  | `NULL` |  |  |
| **full_name** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **is_public** | `tinyint(1)` | YES | MUL | `0` |  |  |
| **released_to_kho_at** | `datetime` | YES | MUL | `NULL` |  |  |
| **public_count** | `int(11)` | YES |  | `0` |  |  |
| **deleted_from_databank** | `tinyint(1)` | YES | MUL | `0` |  |  |
| **is_blocked** | `tinyint(1)` | YES | MUL | `0` |  |  |

[Back to top](#table-of-contents)

---

### pipeline_stages

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(100)` | NO |  | *NULL* |  |  |
| **color** | `varchar(20)` | YES |  | `#6366f1` |  |  |
| **order_index** | `smallint(6)` | NO |  | `0` |  |  |
| **is_won** | `tinyint(1)` | NO |  | `0` |  |  |
| **is_lost** | `tinyint(1)` | NO |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **system_slug** | `varchar(50)` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### product_categories

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(100)` | NO |  | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **track_inventory** | `tinyint(1)` | YES |  | `1` |  |  |
| **has_cost** | `tinyint(1)` | YES |  | `1` |  |  |
| **track_batches** | `tinyint(1)` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### products

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_by** | `int(11)` | YES | MUL | `NULL` |  |  |
| **category_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **category** | `varchar(100)` | YES |  | `NULL` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **sku** | `varchar(100)` | YES |  | `NULL` |  |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **price** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **cost** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **currency** | `char(3)` | NO |  | `VND` |  |  |
| **unit** | `varchar(50)` | YES |  | `cái` |  |  |
| **stock_quantity** | `int(11)` | NO |  | `0` |  |  |
| **min_stock_level** | `int(11)` | NO |  | `5` |  |  |
| **is_active** | `tinyint(1)` | NO |  | `1` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **deleted_at** | `datetime` | YES |  | `NULL` |  |  |
| **track_inventory** | `tinyint(1)` | YES |  | `1` |  |  |
| **track_cost** | `tinyint(1)` | YES |  | `1` |  |  |

[Back to top](#table-of-contents)

---

### project_documents

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **project_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **file_path** | `varchar(500)` | NO |  | *NULL* |  |  |
| **file_size** | `bigint(20)` | YES |  | `0` |  |  |
| **mime_type** | `varchar(100)` | YES |  | `NULL` |  |  |
| **uploaded_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### project_roster

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **project_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **user_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### projects

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **code** | `varchar(100)` | NO | UNI | *NULL* |  |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **status** | `enum('active','completed','draft')` | YES |  | `active` |  |  |
| **location** | `varchar(255)` | YES |  | `NULL` |  |  |
| **developer** | `varchar(255)` | YES |  | `NULL` |  |  |
| **document_ids** | `text` | YES |  | `NULL` |  |  |
| **campaign_ids** | `text` | YES |  | `NULL` |  |  |
| **progress_percent** | `int(11)` | YES |  | `0` |  |  |
| **construction_status** | `varchar(100)` | YES |  | `Chưa khởi công` |  |  |
| **legal_status** | `varchar(255)` | YES |  | `Đang hoàn thiện pháp lý` |  |  |
| **scale_block_count** | `int(11)` | YES |  | `1` |  |  |
| **scale_unit_count** | `int(11)` | YES |  | `100` |  |  |
| **handover_year** | `int(11)` | YES |  | `2026` |  |  |
| **manager_ids** | `text` | YES |  | `NULL` |  |  |
| **folder_path** | `varchar(500)` | YES |  | `NULL` |  |  |
| **reference_url** | `varchar(500)` | YES |  | `NULL` |  |  |
| **created_by** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **campaign_sharing_mode** | `varchar(50)` | YES |  | `independent` |  |  |

[Back to top](#table-of-contents)

---

### purchase_order_items

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **po_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **product_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **quantity** | `int(11)` | NO |  | *NULL* |  |  |
| **unit_cost** | `decimal(15,2)` | NO |  | *NULL* |  |  |
| **subtotal** | `decimal(15,2)` | NO |  | *NULL* |  |  |

[Back to top](#table-of-contents)

---

### purchase_orders

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **supplier_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **po_number** | `varchar(50)` | NO |  | *NULL* |  |  |
| **order_date** | `date` | NO |  | *NULL* |  |  |
| **status** | `enum('draft','pending_approval','ordered','received','cancelled')` | NO |  | `draft` |  |  |
| **subtotal** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **tax** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **total** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **approver_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **approver_id_2** | `int(11)` | YES |  | `NULL` |  |  |
| **status_level_1** | `varchar(50)` | NO |  | `pending` |  |  |
| **status_level_2** | `varchar(50)` | NO |  | `pending` |  |  |
| **approved_by** | `int(11)` | YES |  | `NULL` |  |  |
| **approved_by_2** | `int(11)` | YES |  | `NULL` |  |  |
| **payment_status** | `enum('unpaid','partial','paid')` | NO |  | `unpaid` |  |  |
| **paid_amount** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **approver_id_3** | `int(11)` | YES |  | `NULL` |  |  |
| **status_level_3** | `varchar(50)` | NO |  | `pending` |  |  |
| **approval_status** | `varchar(50)` | NO |  | `pending` |  |  |

[Back to top](#table-of-contents)

---

### quote_items

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **quote_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **product_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **quantity** | `decimal(10,2)` | NO |  | `1.00` |  |  |
| **unit_price** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **discount** | `decimal(5,2)` | NO |  | `0.00` |  |  |
| **subtotal** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **sort_order** | `smallint(6)` | NO |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### quotes

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **deal_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **quote_number** | `varchar(50)` | NO |  | *NULL* |  |  |
| **title** | `varchar(255)` | NO |  | *NULL* |  |  |
| **status** | `enum('draft','sent','accepted','rejected','expired')` | NO | MUL | `draft` |  |  |
| **subtotal** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **discount** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **tax** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **total** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **valid_until** | `date` | YES |  | `NULL` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **terms** | `text` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### quyen_truy_cap

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **contact_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **invited_by** | `int(11)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### refresh_tokens

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **token_hash** | `varchar(255)` | NO | UNI | *NULL* |  |  |
| **expires_at** | `timestamp` | NO | MUL | `current_timestamp()` | on update current_timestamp() |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### round_consultants

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **round_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **consultant_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **is_active** | `tinyint(1)` | YES |  | `1` |  |  |
| **receive_ratio** | `int(11)` | YES |  | `1` |  |  |
| **skip_count** | `int(11)` | YES |  | `0` |  |  |
| **compensation_count** | `int(11)` | YES |  | `0` |  |  |
| **data_per_turn** | `int(11)` | YES |  | `1` |  |  |
| **current_turn_remaining** | `int(11)` | YES |  | `0` |  |  |
| **skipped_credit** | `int(11)` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### routing_rules

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **connection_id** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **target_round_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **condition_column** | `varchar(100)` | NO |  | *NULL* |  |  |
| **condition_operator** | `varchar(50)` | YES |  | `contains` |  |  |
| **condition_value** | `varchar(255)` | NO |  | *NULL* |  |  |
| **priority** | `int(11)` | YES |  | `0` |  |  |
| **conditions_json** | `longtext` | YES |  | `NULL` |  |  |
| **logical_operator** | `varchar(10)` | YES |  | `AND` |  |  |

[Back to top](#table-of-contents)

---

### sales_order_items

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **so_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **product_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **quantity** | `decimal(10,2)` | NO |  | `1.00` |  |  |
| **unit_price** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **discount** | `decimal(5,2)` | NO |  | `0.00` |  |  |
| **subtotal** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **sort_order** | `smallint(6)` | NO |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### sales_orders

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **company_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **deal_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **quote_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **so_number** | `varchar(50)` | NO |  | *NULL* |  |  |
| **order_date** | `date` | NO |  | *NULL* |  |  |
| **delivery_date** | `date` | YES |  | `NULL` |  |  |
| **status** | `enum('draft','pending_approval','approved','processing','completed','cancelled')` | NO |  | `draft` |  |  |
| **payment_status** | `enum('unpaid','partial','paid')` | NO |  | `unpaid` |  |  |
| **paid_amount** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **subtotal** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **discount** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **tax** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **total** | `decimal(15,2)` | NO |  | `0.00` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **terms** | `text` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### schema_migrations

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **migration** | `varchar(255)` | NO | PRI | *NULL* |  |  |
| **applied_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### segments

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(200)` | NO |  | *NULL* |  |  |
| **entity_type** | `enum('contact','company','deal')` | NO |  | *NULL* |  |  |
| **filters** | `longtext` | NO |  | *NULL* |  |  |
| **is_shared** | `tinyint(1)` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### sent_notifications

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **notify_type** | `varchar(50)` | NO |  | *NULL* |  |  |
| **notify_date** | `date` | NO |  | *NULL* |  |  |
| **sent_at** | `datetime` | YES |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### sheet_connections

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **sheet_name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **spreadsheet_id** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **connection_type** | `varchar(20)` | YES |  | `sheets` |  |  |
| **webhook_token** | `varchar(64)` | NO |  | *NULL* |  |  |
| **is_active** | `tinyint(1)` | YES |  | `1` |  |  |
| **sync_interval** | `int(11)` | YES |  | `5` |  |  |
| **last_sync_at** | `datetime` | YES |  | `NULL` |  |  |
| **sync_status** | `varchar(50)` | YES |  | `idle` |  |  |
| **email_template** | `mediumtext` | YES |  | `NULL` |  |  |
| **created_at** | `datetime` | YES |  | `current_timestamp()` |  |  |
| **require_both_contact** | `tinyint(1)` | YES |  | `0` |  |  |
| **sync_mode** | `enum('all','new_only')` | YES |  | `all` |  |  |
| **is_initialized** | `tinyint(1)` | YES |  | `0` |  |  |
| **is_silent** | `tinyint(1)` | YES |  | `0` |  |  |
| **sync_saleperson** | `tinyint(1)` | YES |  | `0` |  |  |
| **last_error** | `varchar(255)` | YES |  | `NULL` |  |  |
| **two_way_sync** | `tinyint(1)` | YES |  | `0` |  |  |
| **google_script_url** | `varchar(512)` | YES |  | `NULL` |  |  |
| **lead_recall_minutes** | `int(11)` | YES |  | `0` |  |  |
| **sync_error_count** | `int(11)` | YES |  | `0` |  |  |
| **notify_admin** | `tinyint(1)` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### sheet_sync_records

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **connection_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **row_hash** | `varchar(64)` | NO | PRI | *NULL* |  |  |
| **synced_at** | `datetime` | YES |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### suppliers

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **contact_name** | `varchar(255)` | YES |  | `NULL` |  |  |
| **email** | `varchar(255)` | YES |  | `NULL` |  |  |
| **phone** | `varchar(50)` | YES |  | `NULL` |  |  |
| **address** | `text` | YES |  | `NULL` |  |  |
| **tax_code** | `varchar(50)` | YES |  | `NULL` |  |  |
| **notes** | `text` | YES |  | `NULL` |  |  |
| **total_ordered** | `decimal(15,2)` | YES |  | `0.00` |  |  |
| **deleted_at** | `timestamp` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **contact_position** | `varchar(255)` | YES |  | `NULL` |  |  |
| **website** | `varchar(255)` | YES |  | `NULL` |  |  |
| **scale_capital** | `varchar(255)` | YES |  | `NULL` |  |  |
| **typical_projects** | `text` | YES |  | `NULL` |  |  |
| **focused_type** | `varchar(255)` | YES |  | `NULL` |  |  |
| **prestige_tier** | `varchar(50)` | YES |  | `NULL` |  |  |
| **cooperation_status** | `varchar(50)` | YES |  | `active` |  |  |
| **bank_account** | `varchar(255)` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### sync_queue

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **lead_id** | `int(11)` | YES | UNI | `NULL` |  |  |
| **connection_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **status** | `varchar(20)` | YES | MUL | `pending` |  |  |
| **attempts** | `int(11)` | YES |  | `0` |  |  |
| **next_retry_at** | `datetime` | YES |  | `NULL` |  |  |
| **last_error** | `text` | YES |  | `NULL` |  |  |
| **created_at** | `datetime` | YES |  | `current_timestamp()` |  |  |
| **updated_at** | `datetime` | YES |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### system_settings

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **setting_key** | `varchar(100)` | NO | PRI | *NULL* |  |  |
| **setting_value** | `mediumtext` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### tags

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(100)` | NO |  | *NULL* |  |  |
| **color** | `varchar(20)` | YES |  | `#6366f1` |  |  |
| **entity_type** | `enum('contact','company','deal','all')` | YES |  | `all` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### task_focus_logs

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **task_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **duration_minutes** | `int(11)` | NO |  | `25` |  |  |
| **completed_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### task_hidden_users

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **task_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **user_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **hidden_at** | `datetime` | YES |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### task_muted_notifications

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **task_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **user_id** | `int(11)` | NO | PRI | *NULL* |  |  |
| **muted_at** | `datetime` | YES |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### teams

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **avatar_url** | `text` | YES |  | `NULL` |  |  |
| **leader_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **branch** | `varchar(255)` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **kpi_target** | `decimal(15,2)` | YES |  | `NULL` |  |  |
| **max_members** | `int(11)` | YES |  | `NULL` |  |  |
| **priority_weight** | `int(11)` | YES |  | `1` |  |  |
| **focus_project** | `varchar(255)` | YES |  | `NULL` |  |  |
| **co_leader_ids** | `text` | YES |  | `NULL` |  | JSON array or comma-separated list of co-manager user IDs |

[Back to top](#table-of-contents)

---

### telegram_queue

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **bot_token** | `varchar(255)` | NO |  | *NULL* |  |  |
| **chat_id** | `varchar(255)` | NO | MUL | *NULL* |  |  |
| **body_text** | `text` | NO |  | *NULL* |  |  |
| **status** | `enum('pending','processing','sent','failed')` | YES | MUL | `pending` |  |  |
| **created_at** | `datetime` | YES |  | `current_timestamp()` |  |  |
| **sent_at** | `datetime` | YES |  | `NULL` |  |  |
| **attempts** | `int(11)` | YES |  | `0` |  |  |
| **last_error** | `text` | YES |  | `NULL` |  |  |
| **lead_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **updated_at** | `datetime` | YES |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### tenants

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **slug** | `varchar(100)` | NO | UNI | *NULL* |  |  |
| **plan** | `enum('free','pro','enterprise')` | NO |  | `free` |  |  |
| **logo_url** | `text` | YES |  | `NULL` |  |  |
| **primary_color** | `varchar(20)` | YES |  | `#BD1D2D` |  |  |
| **currency** | `char(3)` | YES |  | `VND` |  |  |
| **timezone** | `varchar(50)` | YES |  | `Asia/Ho_Chi_Minh` |  |  |
| **is_active** | `tinyint(1)` | NO |  | `1` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

### ticket_comments

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **ticket_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **body** | `text` | NO |  | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **parent_id** | `int(11)` | YES | MUL | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### ticket_notify_settings

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **account_id** | `int(11)` | NO | MUL | *NULL* |  |  |

[Back to top](#table-of-contents)

---

### tickets

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **contact_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **assignee_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **subject** | `varchar(255)` | NO |  | *NULL* |  |  |
| **customer_name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **status** | `enum('open','in_progress','resolved','closed')` | NO | MUL | `open` |  |  |
| **priority** | `enum('low','medium','high','urgent')` | NO |  | `medium` |  |  |
| **due_date** | `datetime` | YES |  | `NULL` |  |  |
| **resolved_at** | `datetime` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **related_contacts** | `longtext` | YES |  | `NULL` |  |  |
| **related_users** | `longtext` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### user_notification_settings

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **email_warning** | `tinyint(1)` | YES |  | `1` |  |  |
| **email_mention** | `tinyint(1)` | YES |  | `1` |  |  |
| **email_approval_request** | `tinyint(1)` | YES |  | `1` |  |  |
| **email_project_document** | `tinyint(1)` | YES |  | `0` |  |  |
| **email_project_comment** | `tinyint(1)` | YES |  | `0` |  |  |
| **email_project_roster** | `tinyint(1)` | YES |  | `0` |  |  |
| **email_info** | `tinyint(1)` | YES |  | `0` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **matrix_config** | `longtext` | YES |  | `NULL` |  |  |

[Back to top](#table-of-contents)

---

### users

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | `1` |  |  |
| **username** | `varchar(100)` | YES | UNI | `NULL` |  |  |
| **email** | `varchar(255)` | NO | UNI | *NULL* |  |  |
| **password_hash** | `varchar(255)` | YES |  | `NULL` |  |  |
| **full_name** | `varchar(200)` | NO |  | *NULL* |  |  |
| **job_title** | `varchar(150)` | YES |  | `NULL` |  |  |
| **phone** | `varchar(50)` | YES |  | `NULL` |  |  |
| **avatar_url** | `varchar(255)` | YES |  | `NULL` |  |  |
| **signature_url** | `longtext` | YES |  | `NULL` |  | Chữ ký mẫu cá nhân |
| **role** | `enum('super_admin','admin','manager','assistant','sales','viewer','superadmin','director','hr','accountant','marketing','sale_admin','saleadmin')` | YES |  | `sales` |  |  |
| **is_active** | `tinyint(1)` | NO |  | `1` |  |  |
| **two_factor_enabled** | `tinyint(1)` | YES |  | `0` |  |  |
| **two_factor_type** | `varchar(20)` | YES |  | `email` |  |  |
| **two_factor_secret** | `varchar(255)` | YES |  | `NULL` |  |  |
| **two_factor_backup_codes** | `text` | YES |  | `NULL` |  |  |
| **status** | `enum('active','inactive','leave')` | YES |  | `active` |  |  |
| **vacation_mode** | `tinyint(1)` | YES |  | `0` |  |  |
| **leave_start** | `date` | YES |  | `NULL` |  |  |
| **leave_end** | `date` | YES |  | `NULL` |  |  |
| **work_start_time** | `varchar(5)` | YES |  | `08:00` |  |  |
| **work_end_time** | `varchar(5)` | YES |  | `17:30` |  |  |
| **work_schedule** | `longtext` | YES |  | `NULL` |  |  |
| **zalo_chat_id** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **telegram_chat_id** | `varchar(255)` | YES | MUL | `NULL` |  |  |
| **is_confirmed** | `tinyint(1)` | YES |  | `0` |  |  |
| **confirm_token** | `varchar(64)` | YES |  | `NULL` |  |  |
| **bio** | `text` | YES |  | `NULL` |  |  |
| **last_login_at** | `timestamp` | YES |  | `NULL` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |
| **updated_at** | `timestamp` | NO |  | `current_timestamp()` | on update current_timestamp() |  |
| **team_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **dob** | `date` | YES |  | `NULL` |  |  |
| **gender** | `varchar(20)` | YES |  | `NULL` |  |  |
| **citizen_id** | `varchar(50)` | YES | MUL | `NULL` |  |  |
| **address** | `text` | YES |  | `NULL` |  |  |
| **bank_name** | `varchar(150)` | YES |  | `NULL` |  |  |
| **bank_account** | `varchar(100)` | YES |  | `NULL` |  |  |
| **overtime_mode** | `tinyint(1)` | YES |  | `0` |  |  |
| **permissions_json** | `longtext` | YES |  | `NULL` |  |  |
| **extra_fields_json** | `longtext` | YES |  | `NULL` |  |  |
| **manager_behavior_mode** | `varchar(50)` | NO |  | `combined` |  |  |
| **use_custom_work_hours** | `tinyint(1)` | YES |  | `0` |  |  |

[Back to top](#table-of-contents)

---

### weekend_shift_registrations

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **user_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **shift_date** | `date` | NO |  | *NULL* |  |  |
| **approved** | `tinyint(1)` | NO |  | `1` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### workflow_task_templates

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **stage_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **team_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **title** | `varchar(255)` | NO |  | *NULL* |  |  |
| **description** | `text` | YES |  | `NULL` |  |  |
| **priority** | `enum('low','medium','high')` | NO |  | `medium` |  |  |
| **due_days_offset** | `int(11)` | NO |  | `1` |  |  |
| **require_approval** | `tinyint(4)` | NO |  | `0` |  |  |
| **is_active** | `tinyint(4)` | NO |  | `1` |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### workflows

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **tenant_id** | `int(11)` | NO | MUL | *NULL* |  |  |
| **name** | `varchar(255)` | NO |  | *NULL* |  |  |
| **trigger_type** | `varchar(100)` | NO |  | *NULL* |  |  |
| **trigger_data** | `longtext` | YES |  | `NULL` |  |  |
| **conditions** | `longtext` | YES |  | `NULL` |  |  |
| **actions** | `longtext` | NO |  | *NULL* |  |  |
| **is_active** | `tinyint(1)` | YES |  | `1` |  |  |
| **run_count** | `int(11)` | YES |  | `0` |  |  |
| **created_by** | `int(11)` | NO | MUL | *NULL* |  |  |
| **created_at** | `timestamp` | NO |  | `current_timestamp()` |  |  |

[Back to top](#table-of-contents)

---

### zalo_queue

| Column | Type | Nullable | Key | Default | Extra | Comment |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **id** | `int(11)` | NO | PRI | *NULL* | auto_increment |  |
| **bot_token** | `varchar(255)` | NO |  | *NULL* |  |  |
| **chat_id** | `varchar(255)` | NO | MUL | *NULL* |  |  |
| **body_text** | `text` | NO |  | *NULL* |  |  |
| **status** | `enum('pending','processing','sent','failed')` | YES | MUL | `pending` |  |  |
| **created_at** | `datetime` | YES |  | `current_timestamp()` |  |  |
| **sent_at** | `datetime` | YES |  | `NULL` |  |  |
| **attempts** | `int(11)` | YES |  | `0` |  |  |
| **last_error** | `text` | YES |  | `NULL` |  |  |
| **lead_id** | `int(11)` | YES | MUL | `NULL` |  |  |
| **updated_at** | `datetime` | YES |  | `current_timestamp()` | on update current_timestamp() |  |

[Back to top](#table-of-contents)

---

