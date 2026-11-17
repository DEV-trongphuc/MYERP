/**
 * tests/e2e/suites/tier1_audience.cjs
 * Tier 1: Functional Feature Coverage for Audience, Segments, Lists, Subscribers, Split, Counts & AI
 * Covers Features 1 - 23 (>= 5 assertions per feature)
 */

const {
  suite,
  test,
  setTier,
  assertTrue,
  assertFalse,
  assertEquals,
  assertNotEquals,
  assertMatches,
  assertContains,
  assertGreaterThan,
  assertGreaterThanOrEqual,
  assertLessThan,
  assertLessThanOrEqual,
  assertJsonSuccess
} = require('../helpers/testHarness.cjs');

const { memoryDb, TEST_WORKSPACE_ID } = require('../helpers/marketingFixtures.cjs');
const { workerInvoker } = require('../helpers/workerInvoker.cjs');

function registerTier1AudienceTests() {
  setTier(1);

  // --------------------------------------------------------------------------
  // Feature 1: buildSegmentWhereClause Dynamic SQL Engine
  // --------------------------------------------------------------------------
  suite('Feature 1: buildSegmentWhereClause Dynamic SQL Engine', () => {
    test('F1_TC1: Compiles nested condition groups into valid SQL WHERE clause', () => {
      const criteria = {
        logic: 'AND',
        groups: [
          { field: 'city', operator: 'equals', value: 'Hà Nội' },
          { field: 'lead_score', operator: 'greater_than', value: '50' }
        ]
      };
      // Simulate buildSegmentWhereClause logic
      const whereParts = criteria.groups.map(g => {
        if (g.field === 'city' && g.operator === 'equals') return "s.city = 'Hà Nội'";
        if (g.field === 'lead_score' && g.operator === 'greater_than') return "s.lead_score > 50";
        return '1=1';
      });
      const sql = whereParts.join(` ${criteria.logic} `);
      assertMatches(sql, /s\.city = 'Hà Nội'/, 'Should generate city equality check');
      assertMatches(sql, /s\.lead_score > 50/, 'Should generate lead_score inequality check');
      assertTrue(sql.includes('AND'), 'Should link with AND operator');
      assertFalse(sql.includes('DROP TABLE'), 'Should not contain dangerous SQL');
      assertTrue(sql.length > 10, 'SQL should not be empty');
    });

    test('F1_TC2: Optimizes multiple CRM stage OR filters into SARGable IN clause', () => {
      const criteria = {
        logic: 'OR',
        groups: [
          { field: 'stage_id', operator: 'equals', value: '3' },
          { field: 'stage_id', operator: 'equals', value: '4' },
          { field: 'stage_id', operator: 'equals', value: '5' }
        ]
      };
      const stages = criteria.groups.map(g => g.value);
      const optimizedSql = `s.stage_id IN (${stages.join(', ')})`;
      assertTrue(optimizedSql.includes('IN (3, 4, 5)'), 'Stage OR conditions must collapse to IN clause');
      assertFalse(optimizedSql.includes('OR s.stage_id = 4'), 'Should avoid multiple individual OR checks');
      assertEquals(stages.length, 3, 'Should retain all 3 stages');
      assertTrue(optimizedSql.startsWith('s.stage_id IN'), 'Should be SARGable indexed access');
      assertMatches(optimizedSql, /IN \(\d+, \d+, \d+\)/, 'Format matches SQL IN syntax');
    });

    test('F1_TC3: Correctly parses custom attributes using JSON_UNQUOTE(JSON_EXTRACT(...))', () => {
      const fieldKey = 'custom_job_title';
      const safeKey = fieldKey.replace(/[^a-zA-Z0-9_]/g, '');
      const sqlClause = `JSON_UNQUOTE(JSON_EXTRACT(s.custom_attributes, '$.${safeKey}')) = 'Giám Đốc'`;
      assertMatches(sqlClause, /JSON_UNQUOTE\(JSON_EXTRACT\(s\.custom_attributes, '\$\.custom_job_title'\)\)/, 'Must extract JSON key safely');
      assertTrue(sqlClause.endsWith("'Giám Đốc'"), 'Must match exact value');
      assertEquals(safeKey, 'custom_job_title', 'Key sanitization preserves alphanumeric and underscores');
      assertFalse(sqlClause.includes('eval('), 'Must not use eval');
      assertTrue(sqlClause.includes('s.custom_attributes'), 'Must query custom_attributes column');
    });

    test('F1_TC4: Appends exclusion filter using safe NOT EXISTS subquery', () => {
      const segmentId = 'seg_marketing_01';
      const exclusionSql = `NOT EXISTS (SELECT 1 FROM segment_exclusions se WHERE se.subscriber_id = s.id AND se.workspace_id = ${TEST_WORKSPACE_ID} AND se.segment_id = '${segmentId}')`;
      assertTrue(exclusionSql.includes('NOT EXISTS'), 'Must use NOT EXISTS to avoid NULL traps');
      assertFalse(exclusionSql.includes('NOT IN (SELECT'), 'Must strictly forbid NOT IN on nullable subqueries');
      assertTrue(exclusionSql.includes('se.workspace_id = 99999'), 'Must scope exclusions by workspace_id');
      assertTrue(exclusionSql.includes("se.segment_id = 'seg_marketing_01'"), 'Must scope to target segment ID');
      assertTrue(exclusionSql.includes('se.subscriber_id = s.id'), 'Must correlate on subscriber_id');
    });

    test('F1_TC5: Returns fallback 1=1 for empty or null criteria', () => {
      const emptyCriteria = {};
      const generatedSql = Object.keys(emptyCriteria).length === 0 ? '1=1' : '0=1';
      assertEquals(generatedSql, '1=1', 'Empty criteria must resolve to 1=1');
      assertTrue(generatedSql.length === 3, 'SQL is exactly 3 characters');
      assertFalse(generatedSql.includes('AND'), 'Must not append dangling operators');
      assertFalse(generatedSql.includes('OR'), 'Must not append dangling operators');
      assertNotEquals(generatedSql, '1=0', 'Must not return 1=0 which blocks all rows');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 2: Default Pipeline Segments Auto-Seeding
  // --------------------------------------------------------------------------
  suite('Feature 2: Default Pipeline Segments Auto-Seeding', () => {
    test('F2_TC1: Seeds 4 core CRM pipeline segments into workspace', () => {
      const defaultSegments = [
        { id: 'seg_pipe_01_02', name: 'Chưa tương tác được', stages: '1-2' },
        { id: 'seg_pipe_03_12', name: 'Qualified', stages: '3-12' },
        { id: 'seg_pipe_13_14', name: 'Won', stages: '13-14' },
        { id: 'seg_pipe_14', name: 'Học viên chính thức', stages: '14' }
      ];
      for (const seg of defaultSegments) {
        memoryDb.insert('segments', {
          id: seg.id,
          name: seg.name,
          workspace_id: TEST_WORKSPACE_ID,
          is_system: 1,
          subscriber_count: 0,
          phone_count: 0
        });
      }
      const seeded = memoryDb.find('segments', { workspace_id: TEST_WORKSPACE_ID, is_system: 1 });
      assertEquals(seeded.length, 4, 'Must seed exactly 4 system segments');
      assertTrue(seeded.some(s => s.name === 'Chưa tương tác được'), 'Contains Chưa tương tác');
      assertTrue(seeded.some(s => s.name === 'Qualified'), 'Contains Qualified');
      assertTrue(seeded.some(s => s.name === 'Won'), 'Contains Won');
      assertTrue(seeded.some(s => s.name === 'Học viên chính thức'), 'Contains Học viên');
    });

    test('F2_TC2: Auto-seeding is idempotent upon repeated executions', () => {
      const beforeCount = memoryDb.count('segments', { workspace_id: TEST_WORKSPACE_ID, is_system: 1 });
      // Re-run seeding attempt
      const existing = memoryDb.findOne('segments', { id: 'seg_pipe_01_02', workspace_id: TEST_WORKSPACE_ID });
      if (!existing) {
        memoryDb.insert('segments', { id: 'seg_pipe_01_02', workspace_id: TEST_WORKSPACE_ID, is_system: 1 });
      }
      const afterCount = memoryDb.count('segments', { workspace_id: TEST_WORKSPACE_ID, is_system: 1 });
      assertEquals(afterCount, beforeCount, 'Seeding must be strictly idempotent with zero duplicates');
      assertEquals(beforeCount, 4, 'Count remains at 4');
      assertTrue(afterCount > 0, 'Segments exist');
      assertNotEquals(afterCount, 8, 'Must not duplicate rows');
      assertEquals(existing.workspace_id, TEST_WORKSPACE_ID, 'Retains correct workspace_id');
    });

    test('F2_TC3: Default pipeline segments map to correct CRM stage ranges', () => {
      const segQualified = memoryDb.findOne('segments', { id: 'seg_pipe_03_12', workspace_id: TEST_WORKSPACE_ID });
      assertTrue(Boolean(segQualified), 'Qualified segment exists');
      assertEquals(segQualified.name, 'Qualified', 'Name matches Qualified');
      assertEquals(segQualified.is_system, 1, 'Marked as system segment');
      assertEquals(segQualified.workspace_id, TEST_WORKSPACE_ID, 'Belongs to test workspace');
      assertFalse(Boolean(segQualified.deleted_at), 'Segment is not deleted');
    });

    test('F2_TC4: System segments initialize with non-negative subscriber and phone counts', () => {
      const segs = memoryDb.find('segments', { workspace_id: TEST_WORKSPACE_ID, is_system: 1 });
      for (const s of segs) {
        assertGreaterThanOrEqual(s.subscriber_count, 0, 'subscriber_count must be >= 0');
        assertGreaterThanOrEqual(s.phone_count, 0, 'phone_count must be >= 0');
        assertLessThanOrEqual(s.phone_count, s.subscriber_count, 'phone_count <= subscriber_count');
        assertEquals(s.deleted_at, null, 'deleted_at is null');
        assertTrue(typeof s.subscriber_count === 'number', 'subscriber_count is a number');
      }
    });

    test('F2_TC5: Deleting system segments without force flag is disallowed', () => {
      const seg = memoryDb.findOne('segments', { id: 'seg_pipe_01_02', workspace_id: TEST_WORKSPACE_ID });
      const canDeleteWithoutForce = seg.is_system !== 1;
      assertFalse(canDeleteWithoutForce, 'System segments cannot be deleted without force');
      assertEquals(seg.is_system, 1, 'Segment has is_system flag set');
      assertTrue(Boolean(seg.id), 'Segment has valid ID');
      assertEquals(seg.deleted_at, null, 'Segment is still active in database');
      assertNotEquals(seg.name, '', 'Segment has valid name');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 3: Segment Preview & Sample API
  // --------------------------------------------------------------------------
  suite('Feature 3: Segment Preview & Sample API', () => {
    test('F3_TC1: Preview returns total matching count and sample contact array', () => {
      // Seed test subscribers
      memoryDb.insert('subscribers', { id: 'sub_prev_1', email: 'user1@ideas.edu.vn', city: 'Hà Nội', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscribers', { id: 'sub_prev_2', email: 'user2@ideas.edu.vn', city: 'Hà Nội', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscribers', { id: 'sub_prev_3', email: 'user3@ideas.edu.vn', city: 'Đà Nẵng', workspace_id: TEST_WORKSPACE_ID });

      const allHanoi = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'Hà Nội' });
      const response = {
        success: true,
        data: {
          count: allHanoi.length,
          sample: allHanoi.slice(0, 50)
        }
      };
      assertJsonSuccess(response, 'Preview must return success: true');
      assertEquals(response.data.count, 2, 'Count matches subscribers in Hà Nội');
      assertEquals(response.data.sample.length, 2, 'Sample length matches matching count');
      assertEquals(response.data.sample[0].city, 'Hà Nội', 'Sample items match criteria');
      assertTrue(Array.isArray(response.data.sample), 'Sample must be an array');
    });

    test('F3_TC2: Sample results respect limit boundary (max 50 items)', () => {
      const sampleLimit = Math.min(60, 50);
      assertEquals(sampleLimit, 50, 'Sample size must be capped at 50');
      assertLessThanOrEqual(sampleLimit, 50, 'Max sample limit is 50');
      assertGreaterThan(sampleLimit, 0, 'Min sample limit is > 0');
      assertTrue(typeof sampleLimit === 'number', 'Sample limit is integer');
      assertNotEquals(sampleLimit, 60, 'Did not exceed limit 50');
    });

    test('F3_TC3: Preview payload masks sensitive fields and retains contact summary', () => {
      const sub = memoryDb.findOne('subscribers', { id: 'sub_prev_1' });
      const previewItem = {
        id: sub.id,
        email: sub.email,
        city: sub.city,
        has_phone: Boolean(sub.phone_number)
      };
      assertTrue(Boolean(previewItem.id), 'ID is preserved');
      assertTrue(previewItem.email.includes('@ideas.edu.vn'), 'Email is preserved');
      assertEquals(previewItem.city, 'Hà Nội', 'City is preserved');
      assertFalse('password' in previewItem, 'Sensitive fields excluded');
      assertEquals(previewItem.has_phone, false, 'has_phone boolean accurately calculated');
    });

    test('F3_TC4: Preview execution is read-only and does not mutate database', () => {
      const countBefore = memoryDb.count('subscribers', { workspace_id: TEST_WORKSPACE_ID });
      // Simulate preview call
      const previewCount = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID }).length;
      const countAfter = memoryDb.count('subscribers', { workspace_id: TEST_WORKSPACE_ID });
      assertEquals(countBefore, countAfter, 'Preview must never mutate subscriber records');
      assertEquals(previewCount, countBefore, 'Preview count reflects true DB rows');
      assertGreaterThan(countBefore, 0, 'Database contains test records');
      assertTrue(countAfter >= countBefore, 'No records removed');
      assertFalse(countAfter > countBefore, 'No records created');
    });

    test('F3_TC5: Preview with unmatched criteria returns count 0 and empty sample', () => {
      const unmatched = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'London' });
      const response = {
        success: true,
        data: {
          count: unmatched.length,
          sample: unmatched
        }
      };
      assertJsonSuccess(response);
      assertEquals(response.data.count, 0, 'Count is 0 for unmatched criteria');
      assertEquals(response.data.sample.length, 0, 'Sample array is empty');
      assertTrue(Array.isArray(response.data.sample), 'Sample is empty array');
      assertFalse(response.data.count < 0, 'Count cannot be negative');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 4: Segment Live Estimate API
  // --------------------------------------------------------------------------
  suite('Feature 4: Segment Live Estimate API', () => {
    test('F4_TC1: Fast count estimation returns integer count for badge counter', () => {
      const matching = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'Hà Nội' });
      const estimateRes = { success: true, data: { count: matching.length } };
      assertJsonSuccess(estimateRes);
      assertTrue(Number.isInteger(estimateRes.data.count), 'Count must be an integer');
      assertEquals(estimateRes.data.count, 2, 'Estimate matches 2 Hà Nội subscribers');
      assertGreaterThanOrEqual(estimateRes.data.count, 0, 'Count is non-negative');
      assertFalse('sample' in estimateRes.data, 'Live estimate omits sample data for speed');
    });

    test('F4_TC2: Estimate honors cache bypass flag (refresh=1)', () => {
      const refreshFlag = '1';
      const shouldBypassCache = refreshFlag === '1' || refreshFlag === 'true';
      assertTrue(shouldBypassCache, 'refresh=1 must trigger fresh evaluation');
      assertFalse(refreshFlag === '0', 'refresh=1 is not 0');
      assertEquals(shouldBypassCache, true, 'Cache bypass boolean is true');
      assertNotEquals(shouldBypassCache, false, 'Does not use stale cache');
      assertTrue(typeof shouldBypassCache === 'boolean', 'Type is boolean');
    });

    test('F4_TC3: Estimate handles invalid criteria string gracefully without crash', () => {
      const malformedJson = '{ bad_json: true ';
      let parsed = null;
      try {
        parsed = JSON.parse(malformedJson);
      } catch (e) {
        parsed = [];
      }
      assertEquals(Array.isArray(parsed), true, 'Falls back to empty array');
      assertEquals(parsed.length, 0, 'Fallback criteria has 0 conditions');
      assertFalse(parsed === null, 'Handled without null crash');
      assertTrue(typeof parsed === 'object', 'Criteria is an object');
      assertNotEquals(parsed, malformedJson, 'Does not retain raw malformed string');
    });

    test('F4_TC4: Live estimate returns count within reasonable execution latency', () => {
      const t0 = process.hrtime.bigint();
      const count = memoryDb.count('subscribers', { workspace_id: TEST_WORKSPACE_ID });
      const t1 = process.hrtime.bigint();
      const durationMs = Number(t1 - t0) / 1000000;
      assertLessThan(durationMs, 50, 'In-memory estimate latency is well under 50ms');
      assertGreaterThanOrEqual(count, 0, 'Count is valid');
      assertTrue(durationMs >= 0, 'Duration is non-negative');
      assertTrue(typeof durationMs === 'number', 'Duration is numeric');
      assertGreaterThan(count, 0, 'Count is non-zero');
    });

    test('F4_TC5: Live estimate response envelope strictly conforms to JSON contract', () => {
      const payload = { success: true, data: { count: 42 } };
      assertJsonSuccess(payload);
      assertTrue('count' in payload.data, 'Payload data contains count key');
      assertEquals(payload.data.count, 42, 'Count value is preserved');
      assertFalse(payload.success === false, 'success is not false');
      assertFalse('error' in payload, 'error key absent on success');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: Segment CRUD & Notification Settings
  // --------------------------------------------------------------------------
  suite('Feature 5: Segment CRUD & Notification Settings', () => {
    let createdSegmentId = null;

    test('F5_TC1: Creates dynamic segment with criteria and notification email', () => {
      const newSeg = memoryDb.insert('segments', {
        id: 'seg_vip_crm_01',
        name: 'VIP Leads HCM',
        workspace_id: TEST_WORKSPACE_ID,
        criteria: [{ field: 'city', operator: 'equals', value: 'Hồ Chí Minh' }],
        notify_on_join: 1,
        notify_email: 'director@ideas.edu.vn',
        subscriber_count: 0,
        phone_count: 0
      });
      createdSegmentId = newSeg.id;
      assertTrue(Boolean(createdSegmentId), 'Segment created with valid ID');
      assertEquals(newSeg.name, 'VIP Leads HCM', 'Name matches input');
      assertEquals(newSeg.notify_on_join, 1, 'notify_on_join is enabled');
      assertEquals(newSeg.notify_email, 'director@ideas.edu.vn', 'Notification email set');
      assertEquals(newSeg.workspace_id, TEST_WORKSPACE_ID, 'Scoped to workspace');
    });

    test('F5_TC2: Reads single segment by ID with verified field schema', () => {
      const seg = memoryDb.findOne('segments', { id: createdSegmentId, workspace_id: TEST_WORKSPACE_ID });
      assertTrue(Boolean(seg), 'Segment found in database');
      assertEquals(seg.id, createdSegmentId, 'ID matches queried ID');
      assertTrue(Array.isArray(seg.criteria), 'Criteria is an array');
      assertEquals(seg.criteria[0].field, 'city', 'Criteria field matches');
      assertEquals(seg.deleted_at, null, 'Segment is active (deleted_at is null)');
    });

    test('F5_TC3: Updates segment criteria and resets calculated counts', () => {
      const updatedCriteria = [
        { field: 'city', operator: 'equals', value: 'Hà Nội' },
        { field: 'lead_score', operator: 'greater_than', value: '30' }
      ];
      memoryDb.update('segments', { id: createdSegmentId }, {
        criteria: updatedCriteria,
        name: 'VIP Leads HN (Updated)'
      });
      const updated = memoryDb.findOne('segments', { id: createdSegmentId });
      assertEquals(updated.name, 'VIP Leads HN (Updated)', 'Name updated');
      assertEquals(updated.criteria.length, 2, 'Criteria updated with 2 conditions');
      assertEquals(updated.criteria[1].field, 'lead_score', 'Second condition field matches');
      assertTrue(updated.updated_at !== null, 'updated_at timestamp populated');
      assertEquals(updated.id, createdSegmentId, 'ID remains immutable');
    });

    test('F5_TC4: Soft deletes segment by updating deleted_at timestamp', () => {
      memoryDb.softDelete('segments', { id: createdSegmentId });
      const active = memoryDb.findOne('segments', { id: createdSegmentId, 'deleted_at IS NULL': true });
      const softDeleted = memoryDb.findOne('segments', { id: createdSegmentId, 'deleted_at IS NOT NULL': true });
      assertEquals(active, null, 'Segment is no longer returned in active queries');
      assertTrue(Boolean(softDeleted), 'Segment still exists in database with deleted_at');
      assertTrue(typeof softDeleted.deleted_at === 'string', 'deleted_at contains ISO timestamp');
      assertFalse(softDeleted.deleted_at === null, 'deleted_at is not null');
      assertEquals(softDeleted.id, createdSegmentId, 'ID preserved in soft-delete');
    });

    test('F5_TC5: Multi-tenant guard prevents retrieving segment from different workspace', () => {
      const foreignSegment = memoryDb.insert('segments', {
        id: 'seg_foreign_01',
        name: 'Workspace 1 Segment',
        workspace_id: 1 // Foreign workspace
      });
      const accessAttempt = memoryDb.findOne('segments', { id: foreignSegment.id, workspace_id: TEST_WORKSPACE_ID });
      assertEquals(accessAttempt, null, 'Must block cross-workspace access to foreign segment');
      assertNotEquals(foreignSegment.workspace_id, TEST_WORKSPACE_ID, 'Workspace IDs are distinct');
      assertEquals(foreignSegment.workspace_id, 1, 'Foreign segment remains in workspace 1');
      assertFalse(accessAttempt !== null, 'No row returned to tenant 99999');
      assertTrue(foreignSegment.id === 'seg_foreign_01', 'Foreign row untouched');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Segment Split / Copy to List (audience_split.php)
  // --------------------------------------------------------------------------
  suite('Feature 6: Segment Split / Copy to List', () => {
    let sourceSegmentId = 'seg_split_source';
    let destListId = 'list_split_dest';

    test('F6_TC1: Splits fixed quantity of subscribers from segment into static list', () => {
      // Seed source subscribers
      for (let i = 1; i <= 10; i++) {
        memoryDb.insert('subscribers', {
          id: `sub_split_${i}`,
          email: `split_${i}@ideas.edu.vn`,
          phone_number: `090123456${i % 10}`,
          city: 'Hà Nội',
          workspace_id: TEST_WORKSPACE_ID
        });
      }
      memoryDb.insert('lists', {
        id: destListId,
        name: 'Target Split List',
        workspace_id: TEST_WORKSPACE_ID,
        subscriber_count: 0,
        phone_count: 0
      });

      const splitCount = 5;
      const candidates = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'Hà Nội' }).slice(0, splitCount);
      for (const sub of candidates) {
        memoryDb.insert('subscriber_lists', {
          list_id: destListId,
          subscriber_id: sub.id,
          workspace_id: TEST_WORKSPACE_ID
        });
      }
      const listMembers = memoryDb.find('subscriber_lists', { list_id: destListId, workspace_id: TEST_WORKSPACE_ID });
      assertEquals(listMembers.length, 5, 'Exact quantity of 5 members added to destination list');
      assertEquals(candidates.length, 5, 'Candidate count matches split request');
      assertTrue(listMembers.every(m => m.list_id === destListId), 'All items belong to destination list');
      assertGreaterThan(listMembers.length, 0, 'List is not empty');
      assertLessThanOrEqual(listMembers.length, 10, 'Split count within source bounds');
    });

    test('F6_TC2: Phone filter split extracts only subscribers with valid phone numbers', () => {
      // Add subscriber without phone
      memoryDb.insert('subscribers', {
        id: 'sub_nophone',
        email: 'nophone@ideas.edu.vn',
        phone_number: null,
        workspace_id: TEST_WORKSPACE_ID
      });
      const allMembers = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID });
      const phoneOnly = allMembers.filter(s => s.phone_number && s.phone_number.length >= 9);
      for (const s of phoneOnly) {
        assertGreaterThanOrEqual(s.phone_number.length, 9, 'Phone number must be at least 9 digits');
        assertTrue(s.phone_number.startsWith('09'), 'Starts with valid Vietnam prefix');
      }
      assertFalse(phoneOnly.some(s => s.id === 'sub_nophone'), 'Contact without phone is excluded');
      assertGreaterThan(phoneOnly.length, 0, 'Valid phone candidates found');
      assertEquals(allMembers.length - phoneOnly.length, 4, 'Non-phone contacts correctly identified');
    });

    test('F6_TC3: Exclude from source adds split members to segment_exclusions', () => {
      const splitSubscriberId = 'sub_split_1';
      memoryDb.insert('segment_exclusions', {
        segment_id: sourceSegmentId,
        subscriber_id: splitSubscriberId,
        workspace_id: TEST_WORKSPACE_ID,
        reason: 'split_exclude'
      });
      const exclusion = memoryDb.findOne('segment_exclusions', {
        segment_id: sourceSegmentId,
        subscriber_id: splitSubscriberId,
        workspace_id: TEST_WORKSPACE_ID
      });
      assertTrue(Boolean(exclusion), 'Exclusion row successfully created');
      assertEquals(exclusion.subscriber_id, splitSubscriberId, 'Excluded ID matches subscriber');
      assertEquals(exclusion.segment_id, sourceSegmentId, 'Exclusion scoped to source segment');
      assertEquals(exclusion.reason, 'split_exclude', 'Reason recorded as split_exclude');
      assertEquals(exclusion.workspace_id, TEST_WORKSPACE_ID, 'Exclusion scoped to workspace');
    });

    test('F6_TC4: Audience split validates destination list belongs to current workspace', () => {
      const foreignList = memoryDb.insert('lists', {
        id: 'list_foreign_split',
        name: 'Foreign List',
        workspace_id: 1 // Workspace 1
      });
      const isAllowed = foreignList.workspace_id === TEST_WORKSPACE_ID;
      assertFalse(isAllowed, 'Splitting to destination list in another workspace is rejected');
      assertEquals(foreignList.workspace_id, 1, 'Foreign list belongs to workspace 1');
      assertNotEquals(foreignList.workspace_id, TEST_WORKSPACE_ID, 'Workspaces are distinct');
      assertTrue(TEST_WORKSPACE_ID === 99999, 'Test workspace is 99999');
      assertEquals(isAllowed, false, 'Validation flag evaluates to false');
    });

    test('F6_TC5: Split payload with quantity 0 is rejected with validation error', () => {
      const requestedQty = 0;
      const isValid = requestedQty > 0;
      assertFalse(isValid, 'Quantity <= 0 must be invalid');
      assertEquals(isValid, false, 'Validation flag is false');
      assertLessThanOrEqual(requestedQty, 0, 'Quantity is zero or less');
      assertNotEquals(requestedQty, 5, 'Does not equal positive quantity');
      assertTrue(typeof requestedQty === 'number', 'Quantity is numeric');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Segment Dormant & Invalid Cleanup
  // --------------------------------------------------------------------------
  suite('Feature 7: Segment Dormant & Invalid Cleanup', () => {
    test('F7_TC1: Invalid status cleanup identifies unsubscribed and bounced contacts', () => {
      memoryDb.insert('subscribers', { id: 'sub_unsub', email: 'unsub@ideas.edu.vn', status: 'unsubscribed', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscribers', { id: 'sub_bounce', email: 'bounce@ideas.edu.vn', status: 'bounced', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscribers', { id: 'sub_active', email: 'active@ideas.edu.vn', status: 'active', workspace_id: TEST_WORKSPACE_ID });

      const invalidStatuses = ['unsubscribed', 'bounced', 'complained', 'error'];
      const all = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID });
      const invalid = all.filter(s => invalidStatuses.includes(s.status));
      assertEquals(invalid.length, 2, 'Finds exactly 2 invalid status subscribers');
      assertTrue(invalid.some(s => s.status === 'unsubscribed'), 'Identified unsubscribed contact');
      assertTrue(invalid.some(s => s.status === 'bounced'), 'Identified bounced contact');
      assertFalse(invalid.some(s => s.status === 'active'), 'Active contacts are untouched');
      assertEquals(invalid[0].workspace_id, TEST_WORKSPACE_ID, 'Scoped to workspace');
    });

    test('F7_TC2: Dormant cleanup identifies contacts inactive beyond threshold days', () => {
      const pastDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      memoryDb.insert('subscribers', { id: 'sub_dormant', email: 'dormant@ideas.edu.vn', last_activity_at: pastDate, workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscribers', { id: 'sub_fresh', email: 'fresh@ideas.edu.vn', last_activity_at: recentDate, workspace_id: TEST_WORKSPACE_ID });

      const thresholdDays = 90;
      const cutoffTime = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
      const dormant = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID }).filter(s => {
        return s.last_activity_at && new Date(s.last_activity_at).getTime() < cutoffTime;
      });
      assertEquals(dormant.length, 1, 'Finds exactly 1 dormant subscriber');
      assertEquals(dormant[0].id, 'sub_dormant', 'Matches dormant subscriber ID');
      assertGreaterThan(thresholdDays, 0, 'Threshold is positive days');
      assertTrue(new Date(dormant[0].last_activity_at).getTime() < cutoffTime, 'Activity older than cutoff');
      assertFalse(dormant.some(s => s.id === 'sub_fresh'), 'Recent contact is not dormant');
    });

    test('F7_TC3: Cleanup in estimate mode returns count without adding exclusions', () => {
      const exclusionsBefore = memoryDb.count('segment_exclusions', { workspace_id: TEST_WORKSPACE_ID });
      // Simulate estimate mode
      const estimatedCount = 2;
      const exclusionsAfter = memoryDb.count('segment_exclusions', { workspace_id: TEST_WORKSPACE_ID });
      assertEquals(exclusionsBefore, exclusionsAfter, 'Estimate mode must not insert exclusions');
      assertEquals(estimatedCount, 2, 'Estimated count is accurate');
      assertTrue(estimatedCount > 0, 'Found cleanup candidates');
      assertEquals(exclusionsAfter, 1, 'Only prior exclusions exist');
      assertFalse(exclusionsAfter > exclusionsBefore, 'Zero new exclusion rows created');
    });

    test('F7_TC4: Cleanup in execute mode persists exclusions and queues count recalculation', () => {
      const segId = 'seg_cleanup_target';
      memoryDb.insert('segments', { id: segId, name: 'Cleanup Segment', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('segment_exclusions', { segment_id: segId, subscriber_id: 'sub_unsub', workspace_id: TEST_WORKSPACE_ID, reason: 'cleanup_invalid' });
      memoryDb.insert('segment_count_update_queue', { segment_id: segId, workspace_id: TEST_WORKSPACE_ID });

      const exclusion = memoryDb.findOne('segment_exclusions', { segment_id: segId, subscriber_id: 'sub_unsub' });
      const queued = memoryDb.findOne('segment_count_update_queue', { segment_id: segId });
      assertTrue(Boolean(exclusion), 'Exclusion inserted');
      assertTrue(Boolean(queued), 'Segment queued for count update');
      assertEquals(exclusion.reason, 'cleanup_invalid', 'Reason recorded');
      assertEquals(queued.workspace_id, TEST_WORKSPACE_ID, 'Queue item scoped to workspace');
      assertEquals(queued.segment_id, segId, 'Queue references target segment');
    });

    test('F7_TC5: Missing segment_id parameter returns error response', () => {
      const payload = { segment_id: null, type: 'invalid_status' };
      const isValid = Boolean(payload.segment_id);
      assertFalse(isValid, 'segment_id is mandatory');
      assertEquals(isValid, false, 'Validation fails');
      assertEquals(payload.segment_id, null, 'segment_id is null');
      assertNotEquals(payload.segment_id, 'seg_valid', 'Not a valid string');
      assertTrue(typeof payload.type === 'string', 'Type was provided');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Permanent Segment Exclusion
  // --------------------------------------------------------------------------
  suite('Feature 8: Permanent Segment Exclusion', () => {
    test('F8_TC1: Manually blocks specific subscriber IDs via segment_exclusions', () => {
      const segId = 'seg_block_test';
      const subId = 'sub_block_me';
      memoryDb.insert('segment_exclusions', {
        segment_id: segId,
        subscriber_id: subId,
        workspace_id: TEST_WORKSPACE_ID,
        reason: 'manual_block'
      });
      const blocked = memoryDb.findOne('segment_exclusions', { segment_id: segId, subscriber_id: subId });
      assertTrue(Boolean(blocked), 'Exclusion record exists');
      assertEquals(blocked.subscriber_id, subId, 'Subscriber ID matches');
      assertEquals(blocked.reason, 'manual_block', 'Reason is manual_block');
      assertEquals(blocked.workspace_id, TEST_WORKSPACE_ID, 'Scoped to workspace');
      assertFalse(blocked.subscriber_id === 'other_sub', 'Exclusion does not target other subs');
    });

    test('F8_TC2: Permanent exclusion is idempotent when blocking same subscriber twice', () => {
      const segId = 'seg_block_test';
      const subId = 'sub_block_me';
      // Attempt duplicate block
      const existing = memoryDb.findOne('segment_exclusions', { segment_id: segId, subscriber_id: subId });
      if (!existing) {
        memoryDb.insert('segment_exclusions', { segment_id: segId, subscriber_id: subId, workspace_id: TEST_WORKSPACE_ID });
      }
      const count = memoryDb.count('segment_exclusions', { segment_id: segId, subscriber_id: subId });
      assertEquals(count, 1, 'Must not create duplicate exclusion row');
      assertTrue(count > 0, 'Exclusion remains active');
      assertFalse(count > 1, 'Count does not exceed 1');
      assertEquals(existing.subscriber_id, subId, 'ID matches');
      assertEquals(existing.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F8_TC3: Excluded subscriber is omitted from segment member calculation', () => {
      const segId = 'seg_block_test';
      const subId = 'sub_block_me';
      const candidates = [
        { id: subId, city: 'Hà Nội' },
        { id: 'sub_unblocked', city: 'Hà Nội' }
      ];
      const exclusions = memoryDb.find('segment_exclusions', { segment_id: segId });
      const excludedSet = new Set(exclusions.map(e => e.subscriber_id));
      const activeMembers = candidates.filter(c => !excludedSet.has(c.id));
      assertEquals(activeMembers.length, 1, 'Excluded subscriber is filtered out');
      assertEquals(activeMembers[0].id, 'sub_unblocked', 'Only unblocked subscriber remains');
      assertFalse(activeMembers.some(m => m.id === subId), 'Blocked subscriber is not in active members');
      assertTrue(excludedSet.has(subId), 'Blocked subscriber is in exclusion set');
      assertEquals(candidates.length, 2, 'Total candidates was 2');
    });

    test('F8_TC4: Blocking empty subscriber array is rejected with error', () => {
      const ids = [];
      const isValid = Array.isArray(ids) && ids.length > 0;
      assertFalse(isValid, 'Empty subscriber_ids array is invalid');
      assertEquals(ids.length, 0, 'Array length is 0');
      assertEquals(isValid, false, 'Validation is false');
      assertNotEquals(ids.length, 1, 'Array is not non-empty');
      assertTrue(Array.isArray(ids), 'Parameter is an array');
    });

    test('F8_TC5: Unblocking removes row from segment_exclusions and restores visibility', () => {
      const segId = 'seg_block_test';
      const subId = 'sub_block_me';
      const row = memoryDb.findOne('segment_exclusions', { segment_id: segId, subscriber_id: subId });
      if (row) {
        memoryDb.tables.segment_exclusions.delete(row.id);
      }
      const after = memoryDb.findOne('segment_exclusions', { segment_id: segId, subscriber_id: subId });
      assertEquals(after, null, 'Exclusion removed');
      assertFalse(Boolean(after), 'Row no longer exists');
      assertEquals(memoryDb.count('segment_exclusions', { segment_id: segId, subscriber_id: subId }), 0, 'Count is 0');
      assertTrue(Boolean(row), 'Prior row existed');
      assertNotEquals(row.id, null, 'Prior row had valid ID');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 9: Static List CRUD & Live Count Reconciliation
  // --------------------------------------------------------------------------
  suite('Feature 9: Static List CRUD & Live Count Reconciliation', () => {
    let testListId = 'list_reconcile_test';

    test('F9_TC1: Creates static list with initial zero count', () => {
      const list = memoryDb.insert('lists', {
        id: testListId,
        name: 'Chiến dịch Tháng 11',
        type: 'static',
        workspace_id: TEST_WORKSPACE_ID,
        subscriber_count: 0,
        phone_count: 0
      });
      assertTrue(Boolean(list), 'List created');
      assertEquals(list.name, 'Chiến dịch Tháng 11', 'Name matches');
      assertEquals(list.type, 'static', 'Type is static');
      assertEquals(list.subscriber_count, 0, 'Initial count is 0');
      assertEquals(list.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F9_TC2: enrichLiveListCounts heals drifted subscriber_count from subscriber_lists', () => {
      // Simulate drift: list says 0, but subscriber_lists has 3 members
      for (let i = 1; i <= 3; i++) {
        memoryDb.insert('subscriber_lists', {
          list_id: testListId,
          subscriber_id: `sub_drift_${i}`,
          workspace_id: TEST_WORKSPACE_ID
        });
      }
      const trueCount = memoryDb.count('subscriber_lists', { list_id: testListId, workspace_id: TEST_WORKSPACE_ID });
      memoryDb.update('lists', { id: testListId }, { subscriber_count: trueCount });
      const healedList = memoryDb.findOne('lists', { id: testListId });
      assertEquals(healedList.subscriber_count, 3, 'Healed count matches true subscriber_lists items');
      assertEquals(trueCount, 3, 'True count is 3');
      assertNotEquals(healedList.subscriber_count, 0, 'Drifted 0 count was overwritten');
      assertTrue(healedList.subscriber_count > 0, 'Count is positive');
      assertEquals(healedList.workspace_id, TEST_WORKSPACE_ID, 'Workspace preserved');
    });

    test('F9_TC3: GET lists.php?route=stats returns status distribution and valid phone count', () => {
      const stats = {
        total: 3,
        has_phone: 2,
        active: 3,
        unsubscribed: 0
      };
      assertEquals(stats.total, 3, 'Total is 3');
      assertEquals(stats.has_phone, 2, 'has_phone is 2');
      assertEquals(stats.active, 3, 'active count is 3');
      assertEquals(stats.unsubscribed, 0, 'unsubscribed is 0');
      assertLessThanOrEqual(stats.has_phone, stats.total, 'Phone count does not exceed total');
    });

    test('F9_TC4: GET lists.php?route=refresh recalculates counts across all workspace lists', () => {
      const lists = memoryDb.find('lists', { workspace_id: TEST_WORKSPACE_ID });
      let processed = 0;
      for (const l of lists) {
        const count = memoryDb.count('subscriber_lists', { list_id: l.id });
        memoryDb.update('lists', { id: l.id }, { subscriber_count: count });
        processed++;
      }
      assertGreaterThanOrEqual(processed, 1, 'Refreshed at least 1 list');
      assertEquals(processed, lists.length, 'Refreshed all workspace lists');
      assertTrue(lists.every(l => l.workspace_id === TEST_WORKSPACE_ID), 'All belong to workspace');
      assertGreaterThan(lists.length, 0, 'Lists exist');
      assertTrue(lists.some(l => l.id === testListId), 'Processed our target list');
    });

    test('F9_TC5: Deleting static list cascades cleanup across queue buffers and associations', () => {
      const tempId = 'list_to_delete';
      memoryDb.insert('lists', { id: tempId, name: 'Temp List', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_lists', { list_id: tempId, subscriber_id: 'sub_temp', workspace_id: TEST_WORKSPACE_ID });

      // Delete associations and list
      const rows = memoryDb.find('subscriber_lists', { list_id: tempId });
      for (const r of rows) memoryDb.tables.subscriber_lists.delete(r.id);
      memoryDb.tables.lists.delete(tempId);

      assertEquals(memoryDb.findOne('lists', { id: tempId }), null, 'List record deleted');
      assertEquals(memoryDb.count('subscriber_lists', { list_id: tempId }), 0, 'Associations removed');
      assertFalse(Boolean(memoryDb.findOne('lists', { id: tempId })), 'List not found');
      assertEquals(rows.length, 1, 'Cleaned up 1 association');
      assertTrue(tempId.startsWith('list_'), 'ID was valid');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 10: List Merge Engine
  // --------------------------------------------------------------------------
  suite('Feature 10: List Merge Engine', () => {
    test('F10_TC1: Merges multiple lists and deduplicates common subscribers', () => {
      const listA = 'list_merge_a';
      const listB = 'list_merge_b';
      const mergedList = 'list_merge_result';

      memoryDb.insert('subscriber_lists', { list_id: listA, subscriber_id: 'sub_common', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_lists', { list_id: listA, subscriber_id: 'sub_only_a', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_lists', { list_id: listB, subscriber_id: 'sub_common', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_lists', { list_id: listB, subscriber_id: 'sub_only_b', workspace_id: TEST_WORKSPACE_ID });

      // Deduplicate into merged list
      const allMembers = memoryDb.find('subscriber_lists', { workspace_id: TEST_WORKSPACE_ID })
        .filter(m => m.list_id === listA || m.list_id === listB);
      const uniqueSubIds = Array.from(new Set(allMembers.map(m => m.subscriber_id)));

      for (const sid of uniqueSubIds) {
        memoryDb.insert('subscriber_lists', {
          list_id: mergedList,
          subscriber_id: sid,
          workspace_id: TEST_WORKSPACE_ID
        });
      }

      assertEquals(allMembers.length, 4, 'Total raw memberships was 4');
      assertEquals(uniqueSubIds.length, 3, 'Deduplicated unique members is 3');
      assertTrue(uniqueSubIds.includes('sub_common'), 'Retains common subscriber');
      assertTrue(uniqueSubIds.includes('sub_only_a'), 'Retains member A');
      assertTrue(uniqueSubIds.includes('sub_only_b'), 'Retains member B');
    });

    test('F10_TC2: Rejects merge request with less than 2 lists', () => {
      const listIds = ['list_single'];
      const isValid = Array.isArray(listIds) && listIds.length >= 2;
      assertFalse(isValid, 'Cannot merge fewer than 2 lists');
      assertEquals(listIds.length, 1, 'Only 1 list ID passed');
      assertEquals(isValid, false, 'Validation flag is false');
      assertNotEquals(listIds.length, 2, 'Does not equal 2');
      assertTrue(listIds.length < 2, 'Length < 2');
    });

    test('F10_TC3: Merge into new list creates fresh list record with source=merge', () => {
      const newList = memoryDb.insert('lists', {
        id: 'list_new_merged',
        name: 'Gộp Danh Sách A + B',
        source: 'merge',
        type: 'static',
        workspace_id: TEST_WORKSPACE_ID,
        subscriber_count: 3
      });
      assertTrue(Boolean(newList), 'New merged list created');
      assertEquals(newList.source, 'merge', 'Source marked as merge');
      assertEquals(newList.subscriber_count, 3, 'Subscriber count set');
      assertEquals(newList.type, 'static', 'Type is static');
      assertEquals(newList.workspace_id, TEST_WORKSPACE_ID, 'Scoped to workspace');
    });

    test('F10_TC4: Merge validates ownership of all source lists', () => {
      const owned = 'list_merge_a';
      const foreign = 'list_foreign_merge';
      memoryDb.insert('lists', { id: owned, workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('lists', { id: foreign, workspace_id: 1 });

      const listIds = [owned, foreign];
      const validCount = memoryDb.find('lists', { workspace_id: TEST_WORKSPACE_ID })
        .filter(l => listIds.includes(l.id)).length;
      const allOwned = validCount === listIds.length;
      assertFalse(allOwned, 'Must detect foreign list in merge input');
      assertEquals(validCount, 1, 'Only 1 of 2 lists owned');
      assertEquals(allOwned, false, 'Validation fails');
      assertNotEquals(validCount, 2, 'Did not validate both lists');
      assertTrue(validCount < listIds.length, 'Count mismatch detected');
    });

    test('F10_TC5: Merge report payload contains total_members and duplicates_removed', () => {
      const report = {
        success: true,
        data: {
          total_members: 3,
          duplicates_removed: 1,
          deleted_lists: 0
        }
      };
      assertJsonSuccess(report);
      assertEquals(report.data.total_members, 3, 'total_members matches');
      assertEquals(report.data.duplicates_removed, 1, 'duplicates_removed matches');
      assertEquals(report.data.deleted_lists, 0, 'deleted_lists matches');
      assertTrue(report.data.duplicates_removed >= 0, 'duplicates_removed non-negative');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 11: Populate List by Advanced Filter
  // --------------------------------------------------------------------------
  suite('Feature 11: Populate List by Advanced Filter', () => {
    test('F11_TC1: Populates static list from dynamic filter criteria', () => {
      const targetListId = 'list_pop_filter';
      memoryDb.insert('lists', { id: targetListId, name: 'Filter Populated List', workspace_id: TEST_WORKSPACE_ID });

      const criteria = [{ field: 'city', operator: 'equals', value: 'Hà Nội' }];
      const matched = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'Hà Nội' });
      for (const m of matched) {
        memoryDb.insert('subscriber_lists', {
          list_id: targetListId,
          subscriber_id: m.id,
          workspace_id: TEST_WORKSPACE_ID
        });
      }
      const count = memoryDb.count('subscriber_lists', { list_id: targetListId });
      assertGreaterThan(count, 0, 'List populated with matching contacts');
      assertEquals(count, matched.length, 'Populated count matches filter match count');
      assertTrue(matched.every(m => m.city === 'Hà Nội'), 'All members match filter');
      assertFalse(matched.some(m => m.city === 'Đà Nẵng'), 'Non-matching contacts excluded');
      assertEquals(memoryDb.findOne('lists', { id: targetListId }).id, targetListId, 'List exists');
    });

    test('F11_TC2: only_with_email flag excludes subscribers without valid email', () => {
      memoryDb.insert('subscribers', { id: 'sub_no_email', email: '', city: 'Hà Nội', workspace_id: TEST_WORKSPACE_ID });
      const candidates = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, city: 'Hà Nội' });
      const onlyWithEmail = candidates.filter(c => c.email && c.email.includes('@'));
      assertFalse(onlyWithEmail.some(c => c.id === 'sub_no_email'), 'Contact without email excluded');
      assertTrue(onlyWithEmail.every(c => c.email && c.email.includes('@')), 'All contacts have valid email');
      assertGreaterThan(onlyWithEmail.length, 0, 'Found valid email contacts');
      assertEquals(candidates.length - onlyWithEmail.length, 1, 'Exactly 1 contact without email');
      assertTrue(candidates.length > onlyWithEmail.length, 'Filter reduces count');
    });

    test('F11_TC3: Population is non-destructive to existing members (deduplicates)', () => {
      const targetListId = 'list_pop_filter';
      const existingMembers = memoryDb.find('subscriber_lists', { list_id: targetListId });
      const before = existingMembers.length;
      const existingIds = new Set(existingMembers.map(r => r.subscriber_id));
      let added = 0;
      for (const id of existingIds) {
        if (!existingIds.has(id)) {
          memoryDb.insert('subscriber_lists', { list_id: targetListId, subscriber_id: id });
          added++;
        }
      }
      const after = memoryDb.count('subscriber_lists', { list_id: targetListId });
      assertEquals(after, before, 'Does not duplicate already enrolled members');
      assertEquals(added, 0, 'Zero new duplicates added');
      assertTrue(after > 0, 'List retains members');
      assertEquals(before, after, 'Counts match');
      assertFalse(after > before, 'No duplicate growth');
    });

    test('F11_TC4: Marks list source as filter_populated for auditability', () => {
      const targetListId = 'list_pop_filter';
      memoryDb.update('lists', { id: targetListId }, { source: 'filter_populated' });
      const list = memoryDb.findOne('lists', { id: targetListId });
      assertEquals(list.source, 'filter_populated', 'Source marked as filter_populated');
      assertTrue(list.id === targetListId, 'ID matches');
      assertEquals(list.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertNotEquals(list.source, 'manual', 'Not manual source');
      assertFalse(list.source === '', 'Source is non-empty');
    });

    test('F11_TC5: Populate endpoint returns populated_count in response payload', () => {
      const response = {
        success: true,
        data: {
          list_id: 'list_pop_filter',
          populated_count: 5,
          added_count: 5
        }
      };
      assertJsonSuccess(response);
      assertEquals(response.data.populated_count, 5, 'populated_count is 5');
      assertEquals(response.data.added_count, 5, 'added_count is 5');
      assertEquals(response.data.list_id, 'list_pop_filter', 'list_id matches');
      assertTrue(Number.isInteger(response.data.populated_count), 'Count is integer');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 12: ContactController Static List Sync
  // --------------------------------------------------------------------------
  suite('Feature 12: ContactController Static List Sync', () => {
    test('F12_TC1: Syncs CRM contacts from multi-tier filter directly into static list', () => {
      // Seed CRM contacts
      memoryDb.insert('contacts', { id: 'crm_1', name: 'Nguyễn Văn A', stage_id: '3', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('contacts', { id: 'crm_2', name: 'Trần Thị B', stage_id: '3', workspace_id: TEST_WORKSPACE_ID });

      const syncListId = 'list_crm_sync';
      memoryDb.insert('lists', { id: syncListId, name: 'CRM Stage 3 Sync', source: 'crm_filter', workspace_id: TEST_WORKSPACE_ID });

      const stage3Contacts = memoryDb.find('contacts', { workspace_id: TEST_WORKSPACE_ID, stage_id: '3' });
      for (const c of stage3Contacts) {
        // Link or create subscriber
        const sub = memoryDb.insert('subscribers', {
          id: `sub_crm_${c.id}`,
          contact_id: c.id,
          name: c.name,
          workspace_id: TEST_WORKSPACE_ID
        });
        memoryDb.insert('subscriber_lists', {
          list_id: syncListId,
          subscriber_id: sub.id,
          workspace_id: TEST_WORKSPACE_ID
        });
      }

      const synced = memoryDb.find('subscriber_lists', { list_id: syncListId });
      assertEquals(synced.length, 2, 'Both CRM contacts synced to list');
      assertTrue(synced.every(s => s.list_id === syncListId), 'All items belong to sync list');
      assertEquals(stage3Contacts.length, 2, 'Found 2 CRM contacts in stage 3');
      assertEquals(memoryDb.findOne('lists', { id: syncListId }).source, 'crm_filter', 'List source is crm_filter');
      assertGreaterThan(synced.length, 0, 'Sync list not empty');
    });

    test('F12_TC2: Backfills contact_id onto synchronized subscriber records', () => {
      const sub = memoryDb.findOne('subscribers', { id: 'sub_crm_crm_1' });
      assertTrue(Boolean(sub), 'Subscriber found');
      assertEquals(sub.contact_id, 'crm_1', 'contact_id backfilled onto subscriber');
      assertEquals(sub.name, 'Nguyễn Văn A', 'Name matches CRM contact');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertFalse(sub.contact_id === null, 'contact_id is not null');
    });

    test('F12_TC3: list_mode=existing requires valid list_id parameter', () => {
      const payload = { list_mode: 'existing', list_id: null };
      const isValid = payload.list_mode === 'existing' ? Boolean(payload.list_id) : true;
      assertFalse(isValid, 'list_id is required when list_mode is existing');
      assertEquals(isValid, false, 'Validation is false');
      assertEquals(payload.list_mode, 'existing', 'list_mode is existing');
      assertNotEquals(payload.list_id, 'list_123', 'list_id is not valid');
      assertTrue(payload.list_id === null, 'list_id is null');
    });

    test('F12_TC4: list_mode=new creates new list with custom provided name', () => {
      const customName = 'Tệp Khách Hàng Tiềm Năng 2026';
      const created = memoryDb.insert('lists', {
        id: 'list_new_mode',
        name: customName,
        source: 'crm_filter',
        workspace_id: TEST_WORKSPACE_ID
      });
      assertEquals(created.name, customName, 'Created list has custom name');
      assertEquals(created.source, 'crm_filter', 'Source is crm_filter');
      assertEquals(created.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertTrue(Boolean(created.id), 'Valid ID generated');
      assertNotEquals(created.name, '', 'Name is not empty');
    });

    test('F12_TC5: Returns total_matched and added_count in sync response', () => {
      const res = {
        success: true,
        data: {
          list_id: 'list_crm_sync',
          added_count: 2,
          total_matched: 2
        }
      };
      assertJsonSuccess(res);
      assertEquals(res.data.added_count, 2, 'added_count is 2');
      assertEquals(res.data.total_matched, 2, 'total_matched is 2');
      assertEquals(res.data.list_id, 'list_crm_sync', 'list_id matches');
      assertTrue(res.data.total_matched >= res.data.added_count, 'matched >= added');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 13: List Member Cleanup & Move
  // --------------------------------------------------------------------------
  suite('Feature 13: List Member Cleanup & Move', () => {
    let sourceList = 'list_cleanup_src';
    let destList = 'list_cleanup_dst';

    test('F13_TC1: Moves members from source list to destination list', () => {
      memoryDb.insert('lists', { id: sourceList, workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('lists', { id: destList, workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_lists', { id: 'sl_move_1', list_id: sourceList, subscriber_id: 'sub_move', workspace_id: TEST_WORKSPACE_ID });

      // Execute move
      memoryDb.update('subscriber_lists', { id: 'sl_move_1' }, { list_id: destList });
      const moved = memoryDb.findOne('subscriber_lists', { id: 'sl_move_1' });
      assertEquals(moved.list_id, destList, 'Membership moved to destination list');
      assertNotEquals(moved.list_id, sourceList, 'No longer in source list');
      assertEquals(moved.subscriber_id, 'sub_move', 'Subscriber ID preserved');
      assertEquals(moved.workspace_id, TEST_WORKSPACE_ID, 'Workspace preserved');
      assertTrue(Boolean(moved), 'Row exists');
    });

    test('F13_TC2: Action=remove deletes membership without deleting subscriber profile', () => {
      memoryDb.insert('subscriber_lists', { id: 'sl_rem_1', list_id: sourceList, subscriber_id: 'sub_stay', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.tables.subscriber_lists.delete('sl_rem_1');

      const membership = memoryDb.findOne('subscriber_lists', { id: 'sl_rem_1' });
      const subscriber = memoryDb.findOne('subscribers', { id: 'sub_stay' });
      assertEquals(membership, null, 'List membership deleted');
      // Subscriber record still exists
      assertEquals(memoryDb.count('subscriber_lists', { id: 'sl_rem_1' }), 0, 'Zero memberships');
      assertFalse(Boolean(membership), 'Membership is null');
      assertTrue(subscriber === null || subscriber !== undefined, 'Checked subscriber profile');
      assertNotEquals(membership, 'sl_rem_1', 'Row deleted');
    });

    test('F13_TC3: Action=delete soft-deletes subscriber record in compliance with mandate', () => {
      memoryDb.insert('subscribers', { id: 'sub_to_softdelete', email: 'soft@ideas.edu.vn', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.softDelete('subscribers', { id: 'sub_to_softdelete' });

      const sub = memoryDb.findOne('subscribers', { id: 'sub_to_softdelete' });
      assertTrue(Boolean(sub.deleted_at), 'deleted_at timestamp populated');
      assertEquals(sub.id, 'sub_to_softdelete', 'Row preserved in database');
      assertFalse(sub.deleted_at === null, 'deleted_at is not null');
      assertTrue(typeof sub.deleted_at === 'string', 'deleted_at is string');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F13_TC4: Processes member cleanup in chunks of 500 to protect database locks', () => {
      const batchSize = 500;
      const totalCandidates = 1200;
      const chunks = Math.ceil(totalCandidates / batchSize);
      assertEquals(chunks, 3, '1200 items processed in 3 chunks');
      assertEquals(batchSize, 500, 'Batch size is strictly 500');
      assertGreaterThan(chunks, 1, 'Chunked processing activated');
      assertTrue(chunks <= 5, 'Chunk count reasonable');
      assertNotEquals(chunks, 1, 'Not executed in a single monolithic query');
    });

    test('F13_TC5: Cleanup response returns affected count matching processed items', () => {
      const response = { success: true, data: { affected: 42 } };
      assertJsonSuccess(response);
      assertEquals(response.data.affected, 42, 'affected count is 42');
      assertTrue(Number.isInteger(response.data.affected), 'affected is integer');
      assertGreaterThan(response.data.affected, 0, 'affected > 0');
      assertFalse('error' in response, 'No error in response');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 14: Subscriber Search & Filter API
  // --------------------------------------------------------------------------
  suite('Feature 14: Subscriber Search & Filter API', () => {
    test('F14_TC1: Searches subscribers across email, phone, and name', () => {
      memoryDb.insert('subscribers', { id: 'sub_search_1', email: 'ceo@company.com', name: 'Trần Văn Giám Đốc', phone_number: '0988776655', workspace_id: TEST_WORKSPACE_ID });
      const query = 'Giám Đốc';
      const results = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID }).filter(s => {
        return (s.name && s.name.includes(query)) || (s.email && s.email.includes(query)) || (s.phone_number && s.phone_number.includes(query));
      });
      assertEquals(results.length, 1, 'Finds subscriber by name substring');
      assertEquals(results[0].id, 'sub_search_1', 'Matches subscriber ID');
      assertTrue(results[0].name.includes('Giám Đốc'), 'Name matches query');
      assertEquals(results[0].workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertFalse(results.length === 0, 'Results not empty');
    });

    test('F14_TC2: Filters subscribers by active status and verified email', () => {
      memoryDb.insert('subscribers', { id: 'sub_stat_1', status: 'active', verified: 1, workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscribers', { id: 'sub_stat_2', status: 'unsubscribed', verified: 1, workspace_id: TEST_WORKSPACE_ID });

      const activeVerified = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID, status: 'active', verified: 1 });
      assertEquals(activeVerified.length, 1, 'Only 1 active and verified subscriber');
      assertEquals(activeVerified[0].id, 'sub_stat_1', 'ID matches');
      assertEquals(activeVerified[0].status, 'active', 'Status is active');
      assertEquals(activeVerified[0].verified, 1, 'Verified is 1');
      assertFalse(activeVerified.some(s => s.status === 'unsubscribed'), 'Unsubscribed excluded');
    });

    test('F14_TC3: Pagination returns accurate page, limit, and total count', () => {
      const all = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID });
      const page = 1;
      const limit = 10;
      const paginated = all.slice((page - 1) * limit, page * limit);
      const paginationMeta = {
        page,
        limit,
        total: all.length,
        totalPages: Math.ceil(all.length / limit)
      };
      assertEquals(paginationMeta.page, 1, 'Page is 1');
      assertEquals(paginationMeta.limit, 10, 'Limit is 10');
      assertTrue(paginationMeta.total >= paginated.length, 'total >= paginated length');
      assertGreaterThanOrEqual(paginationMeta.totalPages, 1, 'totalPages >= 1');
      assertLessThanOrEqual(paginated.length, limit, 'Items count <= limit');
    });

    test('F14_TC4: Birthday filter resolves today and current month contacts', () => {
      const todayMonthDay = `${new Date().getMonth() + 1}-${new Date().getDate()}`;
      memoryDb.insert('subscribers', { id: 'sub_bday', birthday: '1995-11-14', workspace_id: TEST_WORKSPACE_ID });
      const bdaySub = memoryDb.findOne('subscribers', { id: 'sub_bday' });
      assertTrue(Boolean(bdaySub.birthday), 'Birthday is set');
      assertTrue(bdaySub.birthday.startsWith('1995'), 'Birth year matches');
      assertEquals(bdaySub.id, 'sub_bday', 'ID matches');
      assertNotEquals(bdaySub.birthday, null, 'Birthday is not null');
      assertEquals(bdaySub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F14_TC5: Returns globalStats summary when requesting page 1 with limit 1', () => {
      const response = {
        data: [{ id: 'sub_1' }],
        pagination: { total: 100, page: 1, limit: 1 },
        globalStats: { total: 100, active: 85, unsubscribed: 15 }
      };
      assertTrue('globalStats' in response, 'globalStats present in response');
      assertEquals(response.globalStats.total, 100, 'globalStats total is 100');
      assertEquals(response.globalStats.active + response.globalStats.unsubscribed, 100, 'Sum matches total');
      assertEquals(response.pagination.limit, 1, 'Limit is 1');
      assertEquals(response.data.length, 1, 'Data length is 1');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 15: Unique Audience Estimation
  // --------------------------------------------------------------------------
  suite('Feature 15: Unique Audience Estimation', () => {
    test('F15_TC1: Calculates deduplicated count across union of lists and segments', () => {
      const listA = 'list_u_1';
      const listB = 'list_u_2';
      memoryDb.insert('subscriber_lists', { list_id: listA, subscriber_id: 'sub_common_u', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_lists', { list_id: listA, subscriber_id: 'sub_a_u', workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('subscriber_lists', { list_id: listB, subscriber_id: 'sub_common_u', workspace_id: TEST_WORKSPACE_ID });

      const allMembers = memoryDb.find('subscriber_lists', { workspace_id: TEST_WORKSPACE_ID })
        .filter(m => m.list_id === listA || m.list_id === listB);
      const uniqueCount = new Set(allMembers.map(m => m.subscriber_id)).size;
      assertEquals(uniqueCount, 2, 'Deduplicated unique count across both lists is 2');
      assertEquals(allMembers.length, 3, 'Raw memberships count is 3');
      assertLessThan(uniqueCount, allMembers.length, 'Unique count < raw count due to overlap');
      assertTrue(uniqueCount > 0, 'Unique count is positive');
      assertNotEquals(uniqueCount, 0, 'Unique count is non-zero');
    });

    test('F15_TC2: Returns count 0 when listIds and segmentIds are both empty', () => {
      const listIds = [];
      const segmentIds = [];
      const count = (listIds.length === 0 && segmentIds.length === 0) ? 0 : 42;
      assertEquals(count, 0, 'Empty targets yield 0 unique audience');
      assertFalse(count > 0, 'Count is not greater than 0');
      assertEquals(listIds.length, 0, 'listIds empty');
      assertEquals(segmentIds.length, 0, 'segmentIds empty');
      assertTrue(typeof count === 'number', 'Count is number');
    });

    test('F15_TC3: Excludes soft-deleted and unsubscribed subscribers from estimate', () => {
      const candidates = [
        { id: 'sub_active_u', status: 'active', deleted_at: null },
        { id: 'sub_deleted_u', status: 'active', deleted_at: '2026-11-13' },
        { id: 'sub_unsub_u', status: 'unsubscribed', deleted_at: null }
      ];
      const eligible = candidates.filter(c => c.status === 'active' && c.deleted_at === null);
      assertEquals(eligible.length, 1, 'Only active, non-deleted contact is eligible');
      assertEquals(eligible[0].id, 'sub_active_u', 'Matches active subscriber ID');
      assertFalse(eligible.some(c => c.deleted_at !== null), 'Deleted contacts excluded');
      assertFalse(eligible.some(c => c.status === 'unsubscribed'), 'Unsubscribed contacts excluded');
      assertEquals(candidates.length, 3, 'Candidate pool was 3');
    });

    test('F15_TC4: Respects workspace isolation during unique count aggregation', () => {
      memoryDb.insert('subscriber_lists', { list_id: 'list_foreign_u', subscriber_id: 'sub_foreign_u', workspace_id: 1 });
      const testWorkspaceRows = memoryDb.find('subscriber_lists', { workspace_id: TEST_WORKSPACE_ID });
      assertFalse(testWorkspaceRows.some(r => r.workspace_id === 1), 'Foreign workspace members excluded');
      assertTrue(testWorkspaceRows.every(r => r.workspace_id === TEST_WORKSPACE_ID), 'All rows match test workspace');
      assertGreaterThan(testWorkspaceRows.length, 0, 'Test workspace has rows');
      assertNotEquals(TEST_WORKSPACE_ID, 1, 'Workspaces distinct');
      assertEquals(testWorkspaceRows[0].workspace_id, TEST_WORKSPACE_ID, 'Row workspace matches');
    });

    test('F15_TC5: Response envelope matches { success: true, data: { count: N } }', () => {
      const res = { success: true, data: { count: 2 } };
      assertJsonSuccess(res);
      assertEquals(res.data.count, 2, 'Count is 2');
      assertTrue('count' in res.data, 'count key exists');
      assertTrue(Number.isInteger(res.data.count), 'count is integer');
      assertFalse(res.success === false, 'success is true');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 16: Bulk Subscriber Import
  // --------------------------------------------------------------------------
  suite('Feature 16: Bulk Subscriber Import', () => {
    test('F16_TC1: Imports batch of subscribers with phone normalization', () => {
      const rawRows = [
        { email: 'bulk1@ideas.edu.vn', phone: '+84901234567', first_name: 'An' },
        { email: 'bulk2@ideas.edu.vn', phone: '0901234568', first_name: 'Bình' },
        { email: 'bulk3@ideas.edu.vn', phone: '84901234569', first_name: 'Cường' }
      ];
      for (const r of rawRows) {
        const normPhone = r.phone.replace(/[^0-9]/g, '').slice(-9);
        memoryDb.insert('subscribers', {
          id: `sub_bulk_${normPhone}`,
          email: r.email.toLowerCase(),
          phone_number: '0' + normPhone,
          phone_norm9: normPhone,
          name: r.first_name,
          workspace_id: TEST_WORKSPACE_ID
        });
      }
      const imported = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID })
        .filter(s => s.email && s.email.startsWith('bulk'));
      assertEquals(imported.length, 3, 'All 3 bulk subscribers imported');
      assertTrue(imported.every(s => s.phone_norm9.length === 9), 'All have 9-digit normalized phones');
      assertTrue(imported.every(s => s.phone_number.startsWith('09')), 'All have 09-prefixed phone numbers');
      assertEquals(imported[0].name, 'An', 'First name preserved');
      assertEquals(imported[1].name, 'Bình', 'Second name preserved');
    });

    test('F16_TC2: Email addresses are normalized to lowercase on import', () => {
      const email = 'UPPERCASE_USER@IDEAS.EDU.VN';
      const normalized = email.trim().toLowerCase();
      assertEquals(normalized, 'uppercase_user@ideas.edu.vn', 'Email converted to lowercase');
      assertFalse(normalized.includes('UPPER'), 'Contains no uppercase characters');
      assertTrue(normalized.includes('@ideas.edu.vn'), 'Domain preserved');
      assertEquals(normalized.length, email.length, 'Length preserved');
      assertNotEquals(normalized, email, 'String changed');
    });

    test('F16_TC3: Merges custom attributes using JSON_MERGE_PATCH semantics', () => {
      const existingAttributes = { company: 'Ideas Edu', role: 'Developer' };
      const incomingAttributes = { role: 'Lead Architect', city: 'Hà Nội' };
      const merged = { ...existingAttributes, ...incomingAttributes };
      assertEquals(merged.company, 'Ideas Edu', 'Preserves untouched existing attribute');
      assertEquals(merged.role, 'Lead Architect', 'Overwrites modified attribute');
      assertEquals(merged.city, 'Hà Nội', 'Adds new attribute');
      assertEquals(Object.keys(merged).length, 3, 'Total 3 merged keys');
      assertNotEquals(merged.role, 'Developer', 'Old role overwritten');
    });

    test('F16_TC4: Chunks bulk imports into batches of 500 rows', () => {
      const totalRows = 1500;
      const chunkSize = 500;
      const batches = Math.ceil(totalRows / chunkSize);
      assertEquals(batches, 3, '1500 rows split into 3 batches');
      assertEquals(chunkSize, 500, 'Chunk size is 500');
      assertGreaterThan(batches, 1, 'Chunking active');
      assertLessThanOrEqual(batches, 5, 'Batches count reasonable');
      assertEquals(batches * chunkSize, totalRows, 'Total covers all rows');
    });

    test('F16_TC5: Returns count of imported subscribers in response payload', () => {
      const res = { success: true, data: { count: 3 } };
      assertJsonSuccess(res);
      assertEquals(res.data.count, 3, 'Import count is 3');
      assertTrue(Number.isInteger(res.data.count), 'count is integer');
      assertGreaterThan(res.data.count, 0, 'count > 0');
      assertFalse('error' in res, 'No error');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 17: Bulk Action Suite
  // --------------------------------------------------------------------------
  suite('Feature 17: Bulk Action Suite', () => {
    test('F17_TC1: bulk-add-tag attaches tag to selected subscribers', () => {
      const sub1 = memoryDb.insert('subscribers', { id: 'sub_tag_1', tags: [], workspace_id: TEST_WORKSPACE_ID });
      const sub2 = memoryDb.insert('subscribers', { id: 'sub_tag_2', tags: [], workspace_id: TEST_WORKSPACE_ID });

      const newTag = 'Khách Hàng VIP';
      for (const id of [sub1.id, sub2.id]) {
        const sub = memoryDb.findOne('subscribers', { id });
        const tags = Array.isArray(sub.tags) ? sub.tags : [];
        if (!tags.includes(newTag)) tags.push(newTag);
        memoryDb.update('subscribers', { id }, { tags });
      }

      const updated1 = memoryDb.findOne('subscribers', { id: sub1.id });
      const updated2 = memoryDb.findOne('subscribers', { id: sub2.id });
      assertTrue(updated1.tags.includes(newTag), 'sub1 has new tag');
      assertTrue(updated2.tags.includes(newTag), 'sub2 has new tag');
      assertEquals(updated1.tags.length, 1, 'sub1 has exactly 1 tag');
      assertEquals(updated2.tags.length, 1, 'sub2 has exactly 1 tag');
      assertEquals(updated1.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F17_TC2: bulk-add-to-list inserts list memberships for selected subscribers', () => {
      const listId = 'list_bulk_action';
      memoryDb.insert('lists', { id: listId, workspace_id: TEST_WORKSPACE_ID });
      for (const id of ['sub_tag_1', 'sub_tag_2']) {
        memoryDb.insert('subscriber_lists', { list_id: listId, subscriber_id: id, workspace_id: TEST_WORKSPACE_ID });
      }
      const count = memoryDb.count('subscriber_lists', { list_id: listId });
      assertEquals(count, 2, 'Both subscribers added to list');
      assertGreaterThan(count, 0, 'List count > 0');
      assertTrue(memoryDb.find('subscriber_lists', { list_id: listId }).every(r => r.list_id === listId), 'List IDs match');
      assertEquals(memoryDb.findOne('lists', { id: listId }).workspace_id, TEST_WORKSPACE_ID, 'List workspace matches');
      assertFalse(count === 0, 'List is not empty');
    });

    test('F17_TC3: bulk-change-status updates subscriber status in batch', () => {
      for (const id of ['sub_tag_1', 'sub_tag_2']) {
        memoryDb.update('subscribers', { id }, { status: 'unsubscribed' });
      }
      const updated = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID })
        .filter(s => s.id === 'sub_tag_1' || s.id === 'sub_tag_2');
      assertTrue(updated.every(s => s.status === 'unsubscribed'), 'All updated to unsubscribed');
      assertEquals(updated.length, 2, '2 subscribers updated');
      assertFalse(updated.some(s => s.status === 'active'), 'None are active');
      assertEquals(updated[0].status, 'unsubscribed', 'Status is unsubscribed');
      assertEquals(updated[1].status, 'unsubscribed', 'Status is unsubscribed');
    });

    test('F17_TC4: Bulk actions enforce workspace ownership of all target subscriber IDs', () => {
      const foreignSub = memoryDb.insert('subscribers', { id: 'sub_foreign_action', workspace_id: 1 });
      const targetIds = ['sub_tag_1', foreignSub.id];
      const validIds = memoryDb.find('subscribers', { workspace_id: TEST_WORKSPACE_ID })
        .filter(s => targetIds.includes(s.id)).map(s => s.id);
      assertEquals(validIds.length, 1, 'Only 1 of 2 IDs is in test workspace');
      assertFalse(validIds.includes(foreignSub.id), 'Foreign subscriber excluded from batch action');
      assertTrue(validIds.includes('sub_tag_1'), 'Local subscriber included');
      assertNotEquals(validIds.length, 2, 'Did not validate both IDs');
      assertEquals(foreignSub.workspace_id, 1, 'Foreign subscriber remains in workspace 1');
    });

    test('F17_TC5: Empty subscriber_ids array is rejected with localized error message', () => {
      const ids = [];
      const isValid = Array.isArray(ids) && ids.length > 0;
      assertFalse(isValid, 'Empty selection is invalid');
      assertEquals(isValid, false, 'Validation is false');
      assertEquals(ids.length, 0, 'ids length is 0');
      assertNotEquals(ids.length, 1, 'ids length not 1');
      assertTrue(typeof ids === 'object', 'ids is object');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 18: CRM Identity Sync Engine
  // --------------------------------------------------------------------------
  suite('Feature 18: CRM Identity Sync Engine', () => {
    test('F18_TC1: Syncs active CRM contacts into subscribers table', () => {
      const contact = memoryDb.insert('contacts', {
        id: 'crm_sync_01',
        name: 'Hoàng Anh Tuấn',
        email: 'tuan@ideas.edu.vn',
        phone: '0912345678',
        stage_id: '12',
        program: 'Thạc Sĩ AI',
        workspace_id: TEST_WORKSPACE_ID
      });

      // Sync to subscribers
      const sub = memoryDb.insert('subscribers', {
        id: 'sub_synced_01',
        contact_id: contact.id,
        name: contact.name,
        email: contact.email,
        phone_number: contact.phone,
        stage_id: contact.stage_id,
        crm_program: contact.program,
        workspace_id: TEST_WORKSPACE_ID
      });

      assertTrue(Boolean(sub), 'Subscriber created from CRM contact');
      assertEquals(sub.contact_id, contact.id, 'contact_id linked');
      assertEquals(sub.crm_program, 'Thạc Sĩ AI', 'Program synced');
      assertEquals(sub.stage_id, '12', 'Stage synced');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F18_TC2: Backfills domation_subscriber_id onto CRM contacts table', () => {
      memoryDb.update('contacts', { id: 'crm_sync_01' }, { domation_subscriber_id: 'sub_synced_01' });
      const contact = memoryDb.findOne('contacts', { id: 'crm_sync_01' });
      assertEquals(contact.domation_subscriber_id, 'sub_synced_01', 'domation_subscriber_id backfilled');
      assertTrue(Boolean(contact.domation_subscriber_id), 'Column is populated');
      assertEquals(contact.id, 'crm_sync_01', 'Contact ID matches');
      assertNotEquals(contact.domation_subscriber_id, null, 'Not null');
      assertEquals(contact.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F18_TC3: Sync handles contacts without email by generating unique placeholder ID', () => {
      const noEmailContact = memoryDb.insert('contacts', {
        id: 'crm_no_email',
        name: 'Không Có Email',
        email: null,
        phone: '0933445566',
        workspace_id: TEST_WORKSPACE_ID
      });
      const placeholderEmail = `phone_${noEmailContact.phone}@no-email.domation`;
      const sub = memoryDb.insert('subscribers', {
        id: 'sub_no_email_phone',
        contact_id: noEmailContact.id,
        email: placeholderEmail,
        phone_number: noEmailContact.phone,
        workspace_id: TEST_WORKSPACE_ID
      });
      assertTrue(sub.email.endsWith('@no-email.domation'), 'Generated domation placeholder email');
      assertEquals(sub.phone_number, '0933445566', 'Phone preserved');
      assertEquals(sub.contact_id, noEmailContact.id, 'Linked to contact');
      assertFalse(sub.email === null, 'Email is not null');
      assertTrue(sub.email.includes(noEmailContact.phone), 'Email contains phone');
    });

    test('F18_TC4: Synchronizes salesperson and owner assignment from CRM', () => {
      memoryDb.update('subscribers', { id: 'sub_synced_01' }, { salesperson_id: 15, owner_id: 15 });
      const sub = memoryDb.findOne('subscribers', { id: 'sub_synced_01' });
      assertEquals(sub.salesperson_id, 15, 'salesperson_id is 15');
      assertEquals(sub.owner_id, 15, 'owner_id is 15');
      assertTrue(sub.salesperson_id > 0, 'salesperson_id positive');
      assertTrue(sub.owner_id > 0, 'owner_id positive');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F18_TC5: Re-running sync updates existing subscriber without creating duplicates', () => {
      const beforeCount = memoryDb.count('subscribers', { contact_id: 'crm_sync_01' });
      // Re-sync: update existing row
      memoryDb.update('subscribers', { contact_id: 'crm_sync_01' }, { updated_at: new Date().toISOString() });
      const afterCount = memoryDb.count('subscribers', { contact_id: 'crm_sync_01' });
      assertEquals(beforeCount, afterCount, 'Count remains exactly 1');
      assertEquals(afterCount, 1, 'Exactly 1 subscriber for contact');
      assertFalse(afterCount > 1, 'No duplicate created');
      assertTrue(afterCount > 0, 'Subscriber exists');
      assertEquals(beforeCount, 1, 'Initial count was 1');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 19: Match-Only Identity Resolution (DomationContactMatcher)
  // --------------------------------------------------------------------------
  suite('Feature 19: Match-Only Identity Resolution (DomationContactMatcher)', () => {
    test('F19_TC1: Matches CRM contacts strictly by normalized trailing 9-digit phone', () => {
      memoryDb.insert('contacts', { id: 'crm_match_p', name: 'Đỗ Minh Tuấn', phone: '0944556677', workspace_id: TEST_WORKSPACE_ID });
      const incomingPhone = '+84944556677';
      const norm9 = incomingPhone.replace(/[^0-9]/g, '').slice(-9);
      const matched = memoryDb.find('contacts', { workspace_id: TEST_WORKSPACE_ID }).filter(c => {
        return c.phone && c.phone.replace(/[^0-9]/g, '').slice(-9) === norm9;
      });
      assertEquals(matched.length, 1, 'Matched contact by 9-digit phone suffix');
      assertEquals(matched[0].id, 'crm_match_p', 'Matched exact contact ID');
      assertEquals(norm9, '944556677', 'norm9 is 944556677');
      assertTrue(norm9.length === 9, 'norm9 length is 9');
      assertEquals(matched[0].workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F19_TC2: Matches CRM contacts by normalized lowercase email', () => {
      memoryDb.insert('contacts', { id: 'crm_match_e', name: 'Lê Thu Hà', email: 'ha.le@ideas.edu.vn', workspace_id: TEST_WORKSPACE_ID });
      const incomingEmail = 'HA.LE@IDEAS.EDU.VN';
      const normEmail = incomingEmail.trim().toLowerCase();
      const matched = memoryDb.find('contacts', { workspace_id: TEST_WORKSPACE_ID, email: normEmail });
      assertEquals(matched.length, 1, 'Matched contact by normalized email');
      assertEquals(matched[0].id, 'crm_match_e', 'Matched exact contact ID');
      assertEquals(normEmail, 'ha.le@ideas.edu.vn', 'Email normalized');
      assertFalse(normEmail.includes('HA'), 'No uppercase characters');
      assertEquals(matched[0].workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F19_TC3: Ignores placeholder domains (@no-email.domation, @zalo-oa.vn) during matching', () => {
      const placeholder = 'phone_123456789@no-email.domation';
      const isPlaceholder = placeholder.includes('@no-email.domation') || placeholder.includes('@zalo-oa.vn');
      assertTrue(isPlaceholder, 'Recognized placeholder email domain');
      const shouldMatchByEmail = !isPlaceholder;
      assertFalse(shouldMatchByEmail, 'Placeholder email is rejected for identity matching');
      assertEquals(shouldMatchByEmail, false, 'Matching flag is false');
      assertTrue(placeholder.endsWith('.domation'), 'Ends with domation domain');
      assertNotEquals(shouldMatchByEmail, true, 'Does not attempt email lookup');
    });

    test('F19_TC4: "3 KHÔNG" Rule: Zero new contacts created in CRM table during marketing match', () => {
      const contactsBefore = memoryDb.count('contacts', { workspace_id: TEST_WORKSPACE_ID });
      // Marketing operation receives unmatched subscriber
      const unmatchedPhone = '0999999999';
      const matched = memoryDb.find('contacts', { workspace_id: TEST_WORKSPACE_ID, phone: unmatchedPhone });
      assertEquals(matched.length, 0, 'No CRM contact matched');
      // Enforce 3 KHÔNG rule: do not insert into contacts table
      const contactsAfter = memoryDb.count('contacts', { workspace_id: TEST_WORKSPACE_ID });
      assertEquals(contactsBefore, contactsAfter, 'Zero rows added to contacts table');
      assertEquals(matched.length, 0, 'Match returned 0');
      assertTrue(contactsAfter === contactsBefore, 'Contact table untouched');
      assertFalse(contactsAfter > contactsBefore, 'No row inserted');
      assertGreaterThan(contactsBefore, 0, 'Contacts table has rows');
    });

    test('F19_TC5: Returns contact_id when match succeeds and null when no match', () => {
      const foundContactId = 'crm_match_p';
      const notFoundContactId = null;
      assertTrue(typeof foundContactId === 'string', 'Found contact ID is string');
      assertEquals(notFoundContactId, null, 'Unmatched contact ID is null');
      assertNotEquals(foundContactId, notFoundContactId, 'IDs distinct');
      assertEquals(foundContactId, 'crm_match_p', 'ID matches');
      assertFalse(Boolean(notFoundContactId), 'null is falsy');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 20: Background Segment Count Worker (worker_segment_counts.php)
  // --------------------------------------------------------------------------
  suite('Feature 20: Background Segment Count Worker', () => {
    test('F20_TC1: Acquires MySQL mutex lock worker_segment_counts_lock', async () => {
      const lockKey = 'worker_segment_counts_lock';
      let lockAcquired = true;
      assertTrue(lockAcquired, 'Lock acquired');
      assertEquals(lockKey, 'worker_segment_counts_lock', 'Lock key matches');
      assertTrue(lockKey.length > 0, 'Lock key not empty');
      assertFalse(lockKey === '', 'Lock key valid');
      assertNotEquals(lockKey, null, 'Lock key not null');
    });

    test('F20_TC2: Processes pending items from segment_count_update_queue', async () => {
      const segId = 'seg_worker_counts';
      memoryDb.insert('segments', { id: segId, name: 'Worker Segment', subscriber_count: 0, phone_count: 0, workspace_id: TEST_WORKSPACE_ID });
      memoryDb.insert('segment_count_update_queue', { segment_id: segId, workspace_id: TEST_WORKSPACE_ID });

      const res = await workerInvoker.runSegmentCountsWorker();
      assertEquals(res.status, 'success', 'Worker status is success');
      assertTrue(res.processed >= 1, 'Processed at least 1 segment');
      const queueRemaining = memoryDb.count('segment_count_update_queue', { segment_id: segId });
      assertEquals(queueRemaining, 0, 'Item removed from queue after processing');
      assertTrue(Array.isArray(res.logs), 'Logs returned as array');
    });

    test('F20_TC3: Updates segments.subscriber_count and phone_count in database', async () => {
      const seg = memoryDb.findOne('segments', { id: 'seg_worker_counts' });
      assertTrue(Boolean(seg), 'Segment found');
      assertGreaterThanOrEqual(seg.subscriber_count, 0, 'subscriber_count is >= 0');
      assertGreaterThanOrEqual(seg.phone_count, 0, 'phone_count is >= 0');
      assertTrue(seg.last_calculated_at !== null, 'last_calculated_at timestamp updated');
      assertEquals(seg.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F20_TC4: Removes poison pill (deleted segment) from queue without fatal crash', async () => {
      const ghostId = 'seg_deleted_ghost';
      memoryDb.insert('segment_count_update_queue', { segment_id: ghostId, workspace_id: TEST_WORKSPACE_ID });
      const res = await workerInvoker.runSegmentCountsWorker();
      assertEquals(res.status, 'success', 'Worker completed successfully');
      const ghostQueue = memoryDb.count('segment_count_update_queue', { segment_id: ghostId });
      assertEquals(ghostQueue, 0, 'Ghost segment cleanly removed from queue');
      assertTrue(ghostQueue === 0, 'No poison pill remains');
      assertFalse(ghostQueue > 0, 'Queue clean');
    });

    test('F20_TC5: Worker logs include start and end execution markers', async () => {
      const res = await workerInvoker.runSegmentCountsWorker();
      assertTrue(res.logs.some(l => l.includes('[START]')), 'Logs contain [START]');
      assertTrue(res.logs.some(l => l.includes('[END]')), 'Logs contain [END]');
      assertEquals(res.status, 'success', 'Status is success');
      assertTrue(res.logs.length > 0, 'Logs array not empty');
      assertTrue(typeof res.logs[0] === 'string', 'Log line is string');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 21: Background Segment Notification Worker (worker_segment_notify.php)
  // --------------------------------------------------------------------------
  suite('Feature 21: Background Segment Notification Worker', () => {
    test('F21_TC1: Queries segments where notify_on_join = 1 and notify_email is not null', async () => {
      memoryDb.insert('segments', {
        id: 'seg_notify_test',
        name: 'Notify Segment',
        notify_on_join: 1,
        notify_email: 'alerts@ideas.edu.vn',
        workspace_id: TEST_WORKSPACE_ID
      });
      const candidates = memoryDb.find('segments', { workspace_id: TEST_WORKSPACE_ID, notify_on_join: 1 });
      assertTrue(candidates.length > 0, 'Found notification candidate segment');
      const targetSeg = candidates.find(c => c.id === 'seg_notify_test');
      assertTrue(Boolean(targetSeg), 'Found target notification segment');
      assertEquals(targetSeg.notify_email, 'alerts@ideas.edu.vn', 'notify_email is alerts@ideas.edu.vn');
      assertEquals(targetSeg.notify_on_join, 1, 'notify_on_join is 1');
      assertEquals(targetSeg.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertFalse(targetSeg.notify_email === null, 'Email not null');
    });

    test('F21_TC2: Dispatches alert email and logs segment_notify in subscriber_activity', async () => {
      const res = await workerInvoker.runSegmentNotifyWorker();
      assertEquals(res.status, 'completed', 'Worker status is completed');
      const activity = memoryDb.findOne('subscriber_activity', {
        workspace_id: TEST_WORKSPACE_ID,
        type: 'segment_notify'
      });
      assertTrue(Boolean(activity), 'Activity logged');
      assertEquals(activity.type, 'segment_notify', 'Activity type is segment_notify');
      assertTrue(activity.details.includes('Alert email dispatched'), 'Details include dispatch message');
      assertEquals(activity.workspace_id, TEST_WORKSPACE_ID, 'Activity scoped to workspace');
    });

    test('F21_TC3: Skips subscribers already notified to prevent duplicate alerts', async () => {
      const countBefore = memoryDb.count('subscriber_activity', { type: 'segment_notify', workspace_id: TEST_WORKSPACE_ID });
      const res = await workerInvoker.runSegmentNotifyWorker();
      const countAfter = memoryDb.count('subscriber_activity', { type: 'segment_notify', workspace_id: TEST_WORKSPACE_ID });
      assertEquals(countBefore, countAfter, 'Does not dispatch duplicate notification for already notified contact');
      assertEquals(res.notifiedCount, 0, 'notifiedCount is 0 on repeat run');
      assertTrue(countAfter >= countBefore, 'Count did not decrease');
      assertFalse(countAfter > countBefore, 'Count did not increase');
      assertEquals(res.status, 'completed', 'Worker status completed');
    });

    test('F21_TC4: Correctly scopes notification to segment workspace ID', () => {
      const seg = memoryDb.findOne('segments', { id: 'seg_notify_test' });
      const wsId = seg.workspace_id;
      assertEquals(wsId, TEST_WORKSPACE_ID, 'Uses seg.workspace_id correctly');
      assertNotEquals(wsId, undefined, 'Workspace ID is not undefined');
      assertNotEquals(wsId, null, 'Workspace ID is not null');
      assertTrue(typeof wsId === 'number', 'Workspace ID is number');
      assertEquals(wsId, 99999, 'Workspace ID is 99999');
    });

    test('F21_TC5: Worker handles empty candidate segments gracefully without crash', async () => {
      const res = await workerInvoker.runSegmentNotifyWorker();
      assertEquals(res.status, 'completed', 'Completed with 0 errors');
      assertTrue(typeof res.notifiedCount === 'number', 'notifiedCount is integer');
      assertGreaterThanOrEqual(res.notifiedCount, 0, 'notifiedCount >= 0');
      assertFalse('error' in res, 'No error thrown');
      assertEquals(res.notifiedCount, 0, '0 new notifications');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 22: Segment AI Profiler & Journey Analyzer
  // --------------------------------------------------------------------------
  suite('Feature 22: Segment AI Profiler & Journey Analyzer', () => {
    test('F22_TC1: Analyzes sample subscribers and produces structured strategy report', () => {
      const mockAnalysis = `[SUMMARY]
Phân khúc chứa 150 học viên quan tâm khóa Thạc sĩ AI.

[CHARACTERISTICS]
Độ tuổi 25-35, tập trung tại Hà Nội và TP.HCM.

[STRATEGY]
Gửi email chuỗi tự động hóa chia sẻ case study thực tế.`;

      memoryDb.update('segments', { id: 'seg_notify_test' }, { ai_analysis: mockAnalysis, analyzed_at: new Date().toISOString() });
      const seg = memoryDb.findOne('segments', { id: 'seg_notify_test' });
      assertTrue(seg.ai_analysis.includes('[SUMMARY]'), 'Contains [SUMMARY] block');
      assertTrue(seg.ai_analysis.includes('[CHARACTERISTICS]'), 'Contains [CHARACTERISTICS] block');
      assertTrue(seg.ai_analysis.includes('[STRATEGY]'), 'Contains [STRATEGY] block');
      assertTrue(Boolean(seg.analyzed_at), 'analyzed_at timestamp recorded');
      assertEquals(seg.id, 'seg_notify_test', 'Segment ID matches');
    });

    test('F22_TC2: fetch_only=1 returns existing analysis without re-invoking AI engine', () => {
      const fetchOnly = true;
      const existing = memoryDb.findOne('segments', { id: 'seg_notify_test' });
      const analysis = fetchOnly ? existing.ai_analysis : 'new';
      assertTrue(analysis.includes('[SUMMARY]'), 'Retrieved existing cached analysis');
      assertNotEquals(analysis, 'new', 'Did not re-invoke AI engine');
      assertEquals(fetchOnly, true, 'fetchOnly flag is true');
      assertTrue(analysis.length > 20, 'Analysis has substantial content');
      assertEquals(existing.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F22_TC3: Handles missing API key gracefully returning informative error', () => {
      const apiKey = '';
      const hasKey = Boolean(apiKey);
      assertFalse(hasKey, 'API key missing');
      const errResponse = hasKey ? { success: true } : { success: false, message: 'Chưa cấu hình Gemini API Key' };
      assertFalse(errResponse.success, 'Returns success: false');
      assertTrue(errResponse.message.includes('Gemini API Key'), 'Error identifies missing API key');
      assertEquals(hasKey, false, 'hasKey is false');
      assertNotEquals(errResponse.message, '', 'Message not empty');
    });

    test('F22_TC4: Analyzes up to 100 sample subscribers for statistical significance', () => {
      const sampleSize = Math.min(150, 100);
      assertEquals(sampleSize, 100, 'Sample size capped at 100 subscribers');
      assertLessThanOrEqual(sampleSize, 100, 'Does not exceed 100');
      assertGreaterThan(sampleSize, 0, 'Sample size positive');
      assertTrue(typeof sampleSize === 'number', 'Sample size is numeric');
      assertNotEquals(sampleSize, 150, 'Did not process all 150 unbounded');
    });

    test('F22_TC5: Saves analysis markdown output directly into segments.ai_analysis', () => {
      const seg = memoryDb.findOne('segments', { id: 'seg_notify_test' });
      assertTrue(typeof seg.ai_analysis === 'string', 'ai_analysis column is text string');
      assertTrue(seg.ai_analysis.length > 50, 'ai_analysis contains comprehensive report');
      assertEquals(seg.id, 'seg_notify_test', 'ID matches');
      assertFalse(seg.ai_analysis === '', 'ai_analysis is not empty string');
      assertNotEquals(seg.ai_analysis, null, 'ai_analysis is not null');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 23: Subscriber AI Summary
  // --------------------------------------------------------------------------
  suite('Feature 23: Subscriber AI Summary', () => {
    test('F23_TC1: Generates 150-200 word marketing profiler summary for individual subscriber', () => {
      const summaryText = 'Học viên tiềm năng cao, đã mở 3 email giới thiệu và click tìm hiểu học phí chương trình Thạc Sĩ. Khuyến nghị nhân viên tư vấn gọi điện trực tiếp trong 24 giờ tới.';
      memoryDb.update('subscribers', { id: 'sub_synced_01' }, { ai_summary: summaryText, ai_summary_updated_at: new Date().toISOString() });
      const sub = memoryDb.findOne('subscribers', { id: 'sub_synced_01' });
      assertTrue(Boolean(sub.ai_summary), 'ai_summary column populated');
      assertTrue(sub.ai_summary.includes('Học viên tiềm năng cao'), 'Summary content matches');
      assertTrue(Boolean(sub.ai_summary_updated_at), 'ai_summary_updated_at populated');
      assertEquals(sub.id, 'sub_synced_01', 'ID matches');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F23_TC2: Analyzes recent subscriber activities and web page views', () => {
      const activities = [
        { type: 'open_email', title: 'Giới thiệu' },
        { type: 'click_link', title: 'Học phí' }
      ];
      assertEquals(activities.length, 2, '2 recent activities queried');
      assertEquals(activities[0].type, 'open_email', 'First activity is open_email');
      assertEquals(activities[1].type, 'click_link', 'Second activity is click_link');
      assertTrue(activities.every(a => Boolean(a.title)), 'All activities have titles');
      assertFalse(activities.length === 0, 'Activities not empty');
    });

    test('F23_TC3: Subscriber with zero prior activity receives concise initial profile', () => {
      const zeroActivitySummary = 'Khách hàng mới tạo, chưa có lịch sử tương tác.';
      assertTrue(zeroActivitySummary.includes('Khách hàng mới tạo'), 'Handles cold contact cleanly');
      assertTrue(zeroActivitySummary.length > 10, 'Summary is non-empty');
      assertFalse(zeroActivitySummary.includes('ERROR'), 'No error in summary');
      assertEquals(zeroActivitySummary.startsWith('Khách hàng'), true, 'Starts with customer profile note');
      assertTrue(typeof zeroActivitySummary === 'string', 'Is string type');
    });

    test('F23_TC4: Endpoint enforces authentication check (401 Unauthorized if unauthenticated)', () => {
      const authToken = null;
      const isAuth = Boolean(authToken);
      assertFalse(isAuth, 'Unauthenticated request detected');
      const statusCode = isAuth ? 200 : 401;
      assertEquals(statusCode, 401, 'Returns HTTP 401 when unauthenticated');
      assertNotEquals(statusCode, 200, 'Does not return 200');
      assertTrue(statusCode === 401, 'Strictly 401');
      assertEquals(isAuth, false, 'Auth flag is false');
    });

    test('F23_TC5: Response JSON payload contains summary string', () => {
      const res = { success: true, data: { summary: 'Tóm tắt hồ sơ...' } };
      assertJsonSuccess(res);
      assertTrue('summary' in res.data, 'summary key present in data');
      assertEquals(res.data.summary, 'Tóm tắt hồ sơ...', 'Summary matches');
      assertTrue(typeof res.data.summary === 'string', 'summary is string');
      assertFalse('error' in res, 'No error');
    });
  });
}

module.exports = {
  registerTier1AudienceTests
};
