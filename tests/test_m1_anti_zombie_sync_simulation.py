import sqlite3
import datetime

def test_anti_zombie_crm_sync():
    conn = sqlite3.connect(":memory:")
    c = conn.cursor()

    # Create schema mirroring MySQL contacts, subscribers, users, pipeline_stages
    c.executescript("""
    CREATE TABLE contacts (
        id INTEGER PRIMARY KEY,
        domation_subscriber_id TEXT,
        full_name TEXT,
        email TEXT,
        phone TEXT,
        mobile TEXT,
        city TEXT,
        job_title TEXT,
        company TEXT,
        stage_id INTEGER,
        pipeline_status TEXT,
        lead_status TEXT,
        program TEXT,
        owner_id INTEGER,
        status TEXT,
        source TEXT,
        deleted_at TEXT,
        created_at TEXT,
        updated_at TEXT
    );

    CREATE TABLE subscribers (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER,
        contact_id INTEGER,
        email TEXT,
        email_norm TEXT,
        first_name TEXT,
        last_name TEXT,
        phone_number TEXT,
        phone TEXT,
        phone_norm9 TEXT,
        city TEXT,
        country TEXT,
        job_title TEXT,
        company_name TEXT,
        stage_id INTEGER,
        pipeline_status TEXT,
        lead_status TEXT,
        program TEXT,
        owner_id INTEGER,
        salesperson TEXT,
        status TEXT,
        source TEXT,
        joined_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT
    );

    CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        full_name TEXT
    );

    CREATE TABLE pipeline_stages (
        id INTEGER PRIMARY KEY,
        system_slug TEXT,
        is_won INTEGER
    );
    """)

    # Populate initial data
    # User
    c.execute("INSERT INTO users (id, full_name) VALUES (1, 'Sales Agent 1')")
    # Pipeline Stage
    c.execute("INSERT INTO pipeline_stages (id, system_slug, is_won) VALUES (1, 'lead_qualified', 0)")

    # Contact 1: Active CRM contact, but subscriber was soft-deleted
    c.execute("""
    INSERT INTO contacts (id, full_name, email, phone, stage_id, pipeline_status, lead_status, program, owner_id, status, source, deleted_at, created_at, updated_at)
    VALUES (1, 'Nguyen Van A', 'a@test.com', '0912345678', 1, 'lead_qualified', 'active', 'IELTS', 1, 'lead', 'crm', NULL, '2026-01-01', '2026-01-01')
    """)
    # Subscriber 1: Soft-deleted previously
    c.execute("""
    INSERT INTO subscribers (id, workspace_id, contact_id, email, phone_number, status, deleted_at, created_at, updated_at)
    VALUES ('crm_1', 1, 1, 'a@test.com', '0912345678', 'archived', '2026-11-10 10:00:00', '2026-01-01', '2026-11-10 10:00:00')
    """)

    # Contact 2: Soft-deleted CRM contact, but subscriber is still marked active
    c.execute("""
    INSERT INTO contacts (id, full_name, email, phone, stage_id, pipeline_status, lead_status, program, owner_id, status, source, deleted_at, created_at, updated_at)
    VALUES (2, 'Tran Van B', 'b@test.com', '0987654321', 1, 'lead_qualified', 'active', 'TOEIC', 1, 'lead', 'crm', '2026-11-12 12:00:00', '2026-01-01', '2026-11-12 12:00:00')
    """)
    # Subscriber 2: Active currently
    c.execute("""
    INSERT INTO subscribers (id, workspace_id, contact_id, email, phone_number, status, deleted_at, created_at, updated_at)
    VALUES ('crm_2', 1, 2, 'b@test.com', '0987654321', 'active', NULL, '2026-01-01', '2026-01-01')
    """)

    # Contact 3: Soft-deleted subscriber linked via domation_subscriber_id (contact_id NULL on subscriber)
    c.execute("""
    INSERT INTO contacts (id, domation_subscriber_id, full_name, email, phone, stage_id, pipeline_status, lead_status, program, owner_id, status, source, deleted_at, created_at, updated_at)
    VALUES (3, 'sub_3', 'Le Van C', 'c@test.com', '0933333333', 1, 'lead_qualified', 'active', 'SAT', 1, 'lead', 'crm', NULL, '2026-01-01', '2026-01-01')
    """)
    # Subscriber 3: Soft-deleted previously, contact_id not yet set
    c.execute("""
    INSERT INTO subscribers (id, workspace_id, contact_id, email, phone_number, status, deleted_at, created_at, updated_at)
    VALUES ('sub_3', 1, NULL, 'c@test.com', '0933333333', 'archived', '2026-11-05 08:00:00', '2026-01-01', '2026-11-05 08:00:00')
    """)

    # Contact 4: Completely fresh new contact, never subscribed
    c.execute("""
    INSERT INTO contacts (id, full_name, email, phone, stage_id, pipeline_status, lead_status, program, owner_id, status, source, deleted_at, created_at, updated_at)
    VALUES (4, 'Pham Thi D', 'd@test.com', '0944444444', 1, 'lead_qualified', 'active', 'VSTEP', 1, 'lead', 'crm', NULL, '2026-11-13', '2026-11-13')
    """)

    conn.commit()

    print("=== INITIAL STATE BEFORE CRM SYNC ===")
    c.execute("SELECT id, contact_id, status, deleted_at FROM subscribers")
    for row in c.fetchall():
        print(f"  Sub: {row}")

    # Now execute the exact 5 steps of ensureAllCrmContactsSyncedForFilter()
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    wsId = 1

    # Step 0: Propagate CRM soft-deletion to linked subscribers
    c.execute("""
        UPDATE subscribers
        SET deleted_at = ?, status = 'archived', updated_at = ?
        WHERE workspace_id = ?
          AND deleted_at IS NULL
          AND contact_id IN (SELECT id FROM contacts WHERE deleted_at IS NOT NULL)
    """, (now_str, now_str, wsId))

    # Step 1a: Link active subscribers by domation_subscriber_id
    c.execute("""
        UPDATE subscribers
        SET contact_id = (SELECT id FROM contacts WHERE contacts.domation_subscriber_id = subscribers.id AND contacts.deleted_at IS NULL)
        WHERE workspace_id = ?
          AND deleted_at IS NULL
          AND (contact_id IS NULL OR contact_id = 0)
          AND EXISTS (SELECT 1 FROM contacts WHERE contacts.domation_subscriber_id = subscribers.id AND contacts.deleted_at IS NULL)
    """, (wsId,))

    # Step 1b: Link active subscribers by email
    c.execute("""
        UPDATE subscribers
        SET contact_id = (SELECT id FROM contacts WHERE contacts.email = subscribers.email AND contacts.deleted_at IS NULL)
        WHERE workspace_id = ?
          AND deleted_at IS NULL
          AND (contact_id IS NULL OR contact_id = 0)
          AND EXISTS (SELECT 1 FROM contacts WHERE contacts.email = subscribers.email AND contacts.deleted_at IS NULL)
    """, (wsId,))

    # Step 2: Link active subscribers by phone
    c.execute("""
        UPDATE subscribers
        SET contact_id = (SELECT id FROM contacts WHERE contacts.phone = subscribers.phone_number AND contacts.deleted_at IS NULL)
        WHERE workspace_id = ?
          AND deleted_at IS NULL
          AND (contact_id IS NULL OR contact_id = 0)
          AND EXISTS (SELECT 1 FROM contacts WHERE contacts.phone = subscribers.phone_number AND contacts.deleted_at IS NULL)
    """, (wsId,))

    # Step 3: Batch-insert remaining contacts that do not have subscriber row
    # CRITICAL ANTI-ZOMBIE RULE: NOT EXISTS checks ALL subscribers (including deleted_at IS NOT NULL)
    c.execute("""
        INSERT INTO subscribers (
            id, workspace_id, contact_id, email,
            first_name, last_name, phone_number, phone,
            city, country, job_title, company_name,
            stage_id, pipeline_status, lead_status, program, owner_id, salesperson,
            status, source, joined_at, created_at, updated_at
        )
        SELECT
            'crm_' || c.id,
            ?,
            c.id,
            COALESCE(c.email, 'crm_' || c.id || '@no-email.domation'),
            COALESCE(c.full_name, 'Khách hàng'),
            '',
            c.phone,
            c.phone,
            c.city,
            'Vietnam',
            c.job_title,
            c.company,
            c.stage_id,
            c.pipeline_status,
            c.lead_status,
            c.program,
            c.owner_id,
            u.full_name,
            'active',
            'crm_sync',
            c.created_at,
            c.created_at,
            ?
        FROM contacts c
        LEFT JOIN users u ON u.id = c.owner_id
        WHERE c.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM subscribers s2
              WHERE (
                  s2.contact_id = c.id
                  OR (c.domation_subscriber_id IS NOT NULL AND c.domation_subscriber_id != '' AND s2.id = c.domation_subscriber_id)
              )
              AND s2.workspace_id = ?
          )
    """, (wsId, now_str, wsId))

    # Step 4: Sync CRM state onto ACTIVE subscribers only (s.deleted_at IS NULL)
    c.execute("""
        UPDATE subscribers
        SET stage_id = (SELECT stage_id FROM contacts WHERE contacts.id = subscribers.contact_id),
            updated_at = ?
        WHERE workspace_id = ?
          AND deleted_at IS NULL
          AND contact_id IN (SELECT id FROM contacts WHERE deleted_at IS NULL)
    """, (now_str, wsId))

    # Step 5: Backfill domation_subscriber_id from ACTIVE subscribers only
    c.execute("""
        UPDATE contacts
        SET domation_subscriber_id = (SELECT id FROM subscribers WHERE subscribers.contact_id = contacts.id AND subscribers.workspace_id = ? AND subscribers.deleted_at IS NULL)
        WHERE deleted_at IS NULL
          AND (domation_subscriber_id IS NULL OR domation_subscriber_id = '')
          AND EXISTS (SELECT 1 FROM subscribers WHERE subscribers.contact_id = contacts.id AND subscribers.workspace_id = ? AND subscribers.deleted_at IS NULL)
    """, (wsId, wsId))

    conn.commit()

    print("\n=== FINAL STATE AFTER CRM SYNC ===")
    c.execute("SELECT id, contact_id, email, status, deleted_at FROM subscribers ORDER BY id")
    subscribers_after = c.fetchall()
    for row in subscribers_after:
        print(f"  Sub: {row}")

    c.execute("SELECT id, domation_subscriber_id, deleted_at FROM contacts ORDER BY id")
    contacts_after = c.fetchall()
    for row in contacts_after:
        print(f"  Contact: {row}")

    print("\n=== ASSERTIONS & EMPIRICAL EVIDENCE ===")
    
    # 1. Check Sub 1 (linked to active Contact 1, but sub was soft-deleted)
    c.execute("SELECT status, deleted_at FROM subscribers WHERE id = 'crm_1'")
    sub1 = c.fetchone()
    assert sub1[0] == 'archived', f"Sub 1 status should be 'archived', got {sub1[0]}"
    assert sub1[1] == '2026-11-10 10:00:00', f"Sub 1 deleted_at was mutated: {sub1[1]}"
    print("[PASS] Assertion 1: Soft-deleted subscriber 'crm_1' was NOT resurrected as active!")

    # 2. Check no duplicate row was created for Contact 1
    c.execute("SELECT COUNT(*) FROM subscribers WHERE contact_id = 1")
    count_sub1 = c.fetchone()[0]
    assert count_sub1 == 1, f"Expected exactly 1 subscriber row for Contact 1, got {count_sub1}"
    print("[PASS] Assertion 2: Zero duplicate or zombie rows created for Contact 1!")

    # 3. Check Sub 2 (linked to soft-deleted Contact 2)
    c.execute("SELECT status, deleted_at FROM subscribers WHERE id = 'crm_2'")
    sub2 = c.fetchone()
    assert sub2[0] == 'archived', f"Sub 2 status should be 'archived', got {sub2[0]}"
    assert sub2[1] is not None, "Sub 2 deleted_at was NOT set by CRM soft-delete propagation!"
    print("[PASS] Assertion 3: Active subscriber 'crm_2' was properly soft-deleted when CRM Contact 2 was deleted!")

    # 4. Check Sub 3 (linked via domation_subscriber_id, sub was soft-deleted)
    c.execute("SELECT status, deleted_at FROM subscribers WHERE id = 'sub_3'")
    sub3 = c.fetchone()
    assert sub3[0] == 'archived', f"Sub 3 status should be 'archived', got {sub3[0]}"
    assert sub3[1] == '2026-11-05 08:00:00', f"Sub 3 deleted_at was mutated: {sub3[1]}"
    c.execute("SELECT COUNT(*) FROM subscribers WHERE contact_id = 3 OR id = 'crm_3'")
    count_sub3 = c.fetchone()[0]
    assert count_sub3 == 0, f"Expected 0 new rows for Contact 3, got {count_sub3}"
    print("[PASS] Assertion 4: Soft-deleted subscriber 'sub_3' linked by domation_subscriber_id was NOT resurrected!")

    # 5. Check Sub 4 (fresh Contact 4)
    c.execute("SELECT id, status, deleted_at FROM subscribers WHERE contact_id = 4")
    sub4 = c.fetchone()
    assert sub4 is not None, "Fresh Contact 4 was not synced into subscribers!"
    assert sub4[1] == 'active', f"Fresh subscriber should be active, got {sub4[1]}"
    assert sub4[2] is None, f"Fresh subscriber deleted_at should be NULL, got {sub4[2]}"
    print("[PASS] Assertion 5: Fresh Contact 4 was correctly synced as a new active subscriber 'crm_4'!")

    # 6. Check Contact 1 did not have domation_subscriber_id set to deleted sub
    c.execute("SELECT domation_subscriber_id FROM contacts WHERE id = 1")
    c1_dom = c.fetchone()[0]
    assert c1_dom is None or c1_dom == '', f"Contact 1 should not link to soft-deleted subscriber, got {c1_dom}"
    print("[PASS] Assertion 6: CRM Contact 1 does not backfill domation_subscriber_id from soft-deleted subscriber!")

    print("\nALL ANTI-ZOMBIE CRM SYNC SIMULATION TESTS PASSED EMPIRICALLY!")

if __name__ == '__main__':
    test_anti_zombie_crm_sync()
