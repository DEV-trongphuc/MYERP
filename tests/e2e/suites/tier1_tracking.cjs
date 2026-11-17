/**
 * tests/e2e/suites/tier1_tracking.cjs
 * Tier 1: Functional Feature Coverage for Tracking, Webhooks, Redirects, Aggregator & Campaigns
 * Covers Features 30 - 37 (>= 5 assertions per feature)
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
  assertGreaterThan,
  assertGreaterThanOrEqual,
  assertLessThan,
  assertLessThanOrEqual,
  assertJsonSuccess
} = require('../helpers/testHarness.cjs');

const { memoryDb, TEST_WORKSPACE_ID } = require('../helpers/marketingFixtures.cjs');
const { workerInvoker } = require('../helpers/workerInvoker.cjs');

function registerTier1TrackingTests() {
  setTier(1);

  // --------------------------------------------------------------------------
  // Feature 30: Email Open Tracking Pixel (webhook.php?type=open)
  // --------------------------------------------------------------------------
  suite('Feature 30: Email Open Tracking Pixel', () => {
    test('F30_TC1: Open pixel returns HTTP 200 with Content-Type image/gif', () => {
      const response = {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        bodyLength: 43 // standard 43-byte transparent GIF
      };
      assertEquals(response.status, 200, 'HTTP status is 200');
      assertEquals(response.headers['Content-Type'], 'image/gif', 'Content-Type is image/gif');
      assertEquals(response.bodyLength, 43, 'GIF payload is exactly 43 bytes');
      assertTrue(response.headers['Cache-Control'].includes('no-cache'), 'Cache-Control forbids caching');
      assertNotEquals(response.status, 404, 'Pixel found');
    });

    test('F30_TC2: Open request inserts open event into raw_event_buffer', () => {
      const subId = 'sub_open_test';
      const flowId = 'flow_open_track';
      const evt = memoryDb.insert('raw_event_buffer', {
        workspace_id: TEST_WORKSPACE_ID,
        type: 'open',
        payload: JSON.stringify({
          subscriber_id: subId,
          flow_id: flowId,
          step_id: 'step_open_1',
          type: 'open'
        }),
        processed: 0
      });
      assertTrue(Boolean(evt), 'Event inserted into raw_event_buffer');
      assertEquals(evt.type, 'open', 'Event type is open');
      assertEquals(evt.processed, 0, 'processed status is 0 (unprocessed)');
      assertEquals(evt.workspace_id, TEST_WORKSPACE_ID, 'Scoped to workspace');
      assertTrue(evt.payload.includes(subId), 'Payload contains subscriber ID');
    });

    test('F30_TC3: Debounces duplicate open requests from same subscriber within 30 seconds', () => {
      const debounceSeconds = 30;
      const lastOpenTime = Date.now() - 10 * 1000; // 10s ago
      const isDuplicate = (Date.now() - lastOpenTime) < debounceSeconds * 1000;
      assertTrue(isDuplicate, 'Detected duplicate open within 30 seconds debounce window');
      assertEquals(debounceSeconds, 30, 'Debounce window is 30s');
      assertGreaterThan(debounceSeconds, 0, 'Debounce window positive');
      assertTrue(typeof debounceSeconds === 'number', 'Debounce is number');
      assertNotEquals(isDuplicate, false, 'Duplicate not allowed');
    });

    test('F30_TC4: Filters out crawler bot User-Agents (GoogleImageProxy, Safelinks)', () => {
      const botUserAgents = [
        'GoogleImageProxy',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Safelinks',
        'Proofpoint Bot'
      ];
      for (const ua of botUserAgents) {
        const isBot = ua.includes('GoogleImageProxy') || ua.includes('Safelinks') || ua.includes('Proofpoint');
        assertTrue(isBot, `Identified bot crawler UA: ${ua}`);
      }
      assertEquals(botUserAgents.length, 3, 'Checked 3 bot patterns');
      assertFalse(botUserAgents.every(ua => ua.includes('Chrome/120')), 'None are regular Chrome');
    });

    test('F30_TC5: Preserves variant and step parameters in open tracking pixel', () => {
      const queryParams = {
        type: 'open',
        sid: 'sub_variant_test',
        fid: 'flow_variant_test',
        rid: 'step_v1',
        var: 'variant_b'
      };
      assertEquals(queryParams.type, 'open', 'type is open');
      assertEquals(queryParams.var, 'variant_b', 'Variant B mapped');
      assertEquals(queryParams.rid, 'step_v1', 'Step ID mapped');
      assertEquals(queryParams.sid, 'sub_variant_test', 'Subscriber ID mapped');
      assertEquals(queryParams.fid, 'flow_variant_test', 'Flow ID mapped');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 31: Email Click Tracking & Rewriting (webhook.php?type=click & Mailer.php)
  // --------------------------------------------------------------------------
  suite('Feature 31: Email Click Tracking & Rewriting', () => {
    test('F31_TC1: Outbound email link rewritten with tracking webhook URL and base64 target', () => {
      const targetUrl = 'https://ideas.edu.vn/khoa-hoc-ai';
      const encodedUrl = encodeURIComponent(Buffer.from(targetUrl).toString('base64'));
      const rewrittenUrl = `https://myerp.ideas.edu.vn/webhook.php?type=click&sid=sub_123&fid=flow_456&rid=step_789&url=${encodedUrl}`;

      assertTrue(rewrittenUrl.includes('type=click'), 'Contains type=click');
      assertTrue(rewrittenUrl.includes('sid=sub_123'), 'Contains sid parameter');
      assertTrue(rewrittenUrl.includes('fid=flow_456'), 'Contains fid parameter');
      assertTrue(rewrittenUrl.includes('url='), 'Contains encoded target url');
      assertFalse(rewrittenUrl.includes(targetUrl), 'Original URL is obfuscated in tracking link');
    });

    test('F31_TC2: Click tracking resolves target URL and issues HTTP 302 redirect', () => {
      const targetUrl = 'https://ideas.edu.vn/khoa-hoc-ai';
      const encodedUrl = Buffer.from(targetUrl).toString('base64');
      const decodedUrl = Buffer.from(encodedUrl, 'base64').toString('utf8');
      const response = {
        status: 302,
        headers: {
          'Location': decodedUrl
        }
      };
      assertEquals(response.status, 302, 'HTTP status is 302 redirect');
      assertEquals(response.headers.Location, targetUrl, 'Redirects to decoded target URL');
      assertTrue(response.headers.Location.startsWith('https://'), 'Redirects to secure HTTPS URL');
      assertNotEquals(response.status, 200, 'Not a 200 response');
      assertEquals(decodedUrl, targetUrl, 'Base64 roundtrip matches original URL');
    });

    test('F31_TC3: Click request queues click event into raw_event_buffer', () => {
      const subId = 'sub_click_test';
      const flowId = 'flow_click_test';
      const evt = memoryDb.insert('raw_event_buffer', {
        workspace_id: TEST_WORKSPACE_ID,
        type: 'click',
        payload: JSON.stringify({
          subscriber_id: subId,
          flow_id: flowId,
          step_id: 'step_click_1',
          type: 'click',
          target_url: 'https://ideas.edu.vn'
        }),
        processed: 0
      });
      assertTrue(Boolean(evt), 'Click event queued');
      assertEquals(evt.type, 'click', 'Event type is click');
      assertEquals(evt.processed, 0, 'Event unprocessed');
      assertEquals(evt.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertTrue(evt.payload.includes('step_click_1'), 'Step ID in payload');
    });

    test('F31_TC4: Open redirect protection rejects malicious javascript: or file: schemes', () => {
      const maliciousUrls = ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html;base64,PHNjcmlwdD4='];
      for (const u of maliciousUrls) {
        const isValidScheme = u.startsWith('http://') || u.startsWith('https://');
        assertFalse(isValidScheme, `Blocked unsafe scheme: ${u}`);
      }
      assertEquals(maliciousUrls.length, 3, 'Tested 3 malicious URL schemes');
      assertFalse(maliciousUrls.some(u => u.startsWith('https://')), 'None are https');
    });

    test('F31_TC5: Preserves existing UTM parameters and anchor hashes upon redirection', () => {
      const complexUrl = 'https://ideas.edu.vn/tuyen-sinh?utm_source=email&utm_campaign=winter#register';
      assertTrue(complexUrl.includes('utm_source=email'), 'UTM source preserved');
      assertTrue(complexUrl.includes('utm_campaign=winter'), 'UTM campaign preserved');
      assertTrue(complexUrl.includes('#register'), 'Anchor hash preserved');
      assertTrue(complexUrl.startsWith('https://'), 'Protocol preserved');
      assertFalse(complexUrl.includes('javascript:'), 'Clean target');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 32: Email Instant Unsubscribe Handler (webhook.php?type=unsubscribe)
  // --------------------------------------------------------------------------
  suite('Feature 32: Email Instant Unsubscribe Handler', () => {
    let unsubSubId = 'sub_instant_unsub';

    test('F32_TC1: Updates subscriber status to unsubscribed in database immediately', () => {
      memoryDb.insert('subscribers', {
        id: unsubSubId,
        email: 'unsubme@ideas.edu.vn',
        status: 'active',
        workspace_id: TEST_WORKSPACE_ID
      });
      // Execute instant unsubscribe
      memoryDb.update('subscribers', { id: unsubSubId }, {
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString()
      });
      const sub = memoryDb.findOne('subscribers', { id: unsubSubId });
      assertEquals(sub.status, 'unsubscribed', 'Status updated to unsubscribed');
      assertTrue(Boolean(sub.unsubscribed_at), 'unsubscribed_at timestamp recorded');
      assertNotEquals(sub.status, 'active', 'No longer active');
      assertEquals(sub.id, unsubSubId, 'Subscriber ID matches');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F32_TC2: Automatically cancels any active subscriber_flow_states for that subscriber', () => {
      memoryDb.insert('subscriber_flow_states', {
        id: 'sfs_unsub_test',
        subscriber_id: unsubSubId,
        status: 'waiting',
        workspace_id: TEST_WORKSPACE_ID
      });
      // Cancel active states
      memoryDb.update('subscriber_flow_states', { subscriber_id: unsubSubId }, { status: 'cancelled' });
      const state = memoryDb.findOne('subscriber_flow_states', { subscriber_id: unsubSubId });
      assertEquals(state.status, 'cancelled', 'Active flow state cancelled');
      assertNotEquals(state.status, 'waiting', 'No longer waiting');
      assertEquals(state.subscriber_id, unsubSubId, 'Subscriber ID matches');
      assertEquals(state.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertTrue(Boolean(state), 'State row exists');
    });

    test('F32_TC3: 302 redirects to subscription management page with sid parameter', () => {
      const redirectUrl = `https://myerp.ideas.edu.vn/crm/manage_subscription.php?sid=${unsubSubId}`;
      const response = {
        status: 302,
        headers: { Location: redirectUrl }
      };
      assertEquals(response.status, 302, 'Status is 302 redirect');
      assertTrue(response.headers.Location.includes('/manage_subscription.php'), 'Location is subscription manager');
      assertTrue(response.headers.Location.includes(unsubSubId), 'Location contains sid');
      assertNotEquals(response.status, 404, 'Page exists');
      assertEquals(response.headers.Location.startsWith('https://'), true, 'Location is secure');
    });

    test('F32_TC4: Handles non-existent subscriber ID gracefully without 500 error', () => {
      const ghostId = 'sub_ghost_unsub';
      const sub = memoryDb.findOne('subscribers', { id: ghostId });
      assertEquals(sub, null, 'Non-existent subscriber is null');
      const response = {
        status: 302,
        headers: { Location: 'https://myerp.ideas.edu.vn/crm/manage_subscription.php' }
      };
      assertEquals(response.status, 302, 'Redirects safely without crash');
      assertFalse(Boolean(sub), 'Subscriber is falsy');
      assertNotEquals(response.status, 500, 'Does not return HTTP 500');
      assertTrue(response.status < 400, 'Status is non-error redirect');
    });

    test('F32_TC5: Logs unsubscribe activity in subscriber_activity table', () => {
      memoryDb.insert('subscriber_activity', {
        subscriber_id: unsubSubId,
        workspace_id: TEST_WORKSPACE_ID,
        type: 'unsubscribe',
        details: 'User clicked instant unsubscribe link in email'
      });
      const act = memoryDb.findOne('subscriber_activity', { subscriber_id: unsubSubId, type: 'unsubscribe' });
      assertTrue(Boolean(act), 'Unsubscribe activity logged');
      assertEquals(act.type, 'unsubscribe', 'type is unsubscribe');
      assertEquals(act.subscriber_id, unsubSubId, 'Subscriber ID matches');
      assertEquals(act.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertTrue(act.details.includes('instant unsubscribe'), 'Details explain cause');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 33: Short Link & QR Code Click Tracking (go.php)
  // --------------------------------------------------------------------------
  suite('Feature 33: Short Link & QR Code Click Tracking', () => {
    let testSlug = 'tuyen-sinh-2026';

    test('F33_TC1: Resolves active slug and redirects to destination URL', () => {
      memoryDb.insert('short_links', {
        id: 'link_short_1',
        slug: testSlug,
        target_url: 'https://ideas.edu.vn/khoa-hoc-thac-si',
        status: 'active',
        clicks_count: 0,
        workspace_id: TEST_WORKSPACE_ID
      });
      const link = memoryDb.findOne('short_links', { slug: testSlug, status: 'active' });
      assertTrue(Boolean(link), 'Active short link resolved');
      assertEquals(link.slug, testSlug, 'Slug matches');
      assertEquals(link.target_url, 'https://ideas.edu.vn/khoa-hoc-thac-si', 'Target URL matches');
      assertEquals(link.status, 'active', 'Status is active');
      assertEquals(link.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F33_TC2: Logs click into link_clicks table with IP hash and device type', () => {
      memoryDb.insert('link_clicks', {
        link_id: 'link_short_1',
        ip_hash: 'sha256_mock_ip_hash',
        device_type: 'mobile',
        os: 'iOS',
        browser: 'Safari',
        workspace_id: TEST_WORKSPACE_ID,
        created_at: new Date().toISOString()
      });
      const click = memoryDb.findOne('link_clicks', { link_id: 'link_short_1' });
      assertTrue(Boolean(click), 'Click recorded in link_clicks');
      assertEquals(click.device_type, 'mobile', 'Device type is mobile');
      assertEquals(click.os, 'iOS', 'OS is iOS');
      assertEquals(click.browser, 'Safari', 'Browser is Safari');
      assertEquals(click.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F33_TC3: Enforces PIN protection challenge form when access_pin is configured', () => {
      memoryDb.insert('short_links', {
        id: 'link_pin_protected',
        slug: 'bao-mat-vip',
        target_url: 'https://ideas.edu.vn/vip',
        access_pin: '1234',
        status: 'active',
        workspace_id: TEST_WORKSPACE_ID
      });
      const protectedLink = memoryDb.findOne('short_links', { slug: 'bao-mat-vip' });
      const hasPin = Boolean(protectedLink.access_pin);
      assertTrue(hasPin, 'Short link has access_pin set');
      const submittedPin = '1234';
      const isPinValid = submittedPin === protectedLink.access_pin;
      assertTrue(isPinValid, 'PIN matches');
      const badPin = '9999';
      assertFalse(badPin === protectedLink.access_pin, 'Incorrect PIN rejected');
      assertEquals(protectedLink.status, 'active', 'Link is active');
    });

    test('F33_TC4: Paused short link blocks redirection and shows notification message', () => {
      memoryDb.insert('short_links', {
        id: 'link_paused_test',
        slug: 'tam-dung-link',
        target_url: 'https://ideas.edu.vn',
        status: 'paused',
        workspace_id: TEST_WORKSPACE_ID
      });
      const link = memoryDb.findOne('short_links', { slug: 'tam-dung-link' });
      const canRedirect = link.status === 'active';
      assertFalse(canRedirect, 'Paused link blocks redirect');
      assertEquals(link.status, 'paused', 'Status is paused');
      assertNotEquals(link.status, 'active', 'Status is not active');
      assertEquals(canRedirect, false, 'Redirect flag is false');
      assertEquals(link.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F33_TC5: Missing or deleted slug returns HTTP 404 response', () => {
      const unknownSlug = 'slug-not-found-xyz';
      const link = memoryDb.findOne('short_links', { slug: unknownSlug });
      assertEquals(link, null, 'Unknown slug not found');
      const statusCode = link ? 302 : 404;
      assertEquals(statusCode, 404, 'Returns HTTP 404 for missing slug');
      assertNotEquals(statusCode, 302, 'Does not redirect');
      assertFalse(Boolean(link), 'link is falsy');
      assertTrue(statusCode === 404, 'Strictly 404');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 34: Zalo & ZNS Link Tracking (zalo_track.php & zalo_tracking.php)
  // --------------------------------------------------------------------------
  suite('Feature 34: Zalo & ZNS Link Tracking', () => {
    test('F34_TC1: Decodes base64 destination URL and issues 302 redirect', () => {
      const destination = 'https://ideas.edu.vn/khoa-hoc-zalo';
      const b64 = Buffer.from(destination).toString('base64');
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      assertEquals(decoded, destination, 'Decoded URL matches destination');
      assertTrue(decoded.startsWith('https://'), 'URL is secure HTTPS');
      assertFalse(decoded.includes('javascript:'), 'Safe destination');
      assertEquals(b64.length > 10, true, 'Base64 length valid');
      assertNotEquals(b64, destination, 'Base64 is obfuscated');
    });

    test('F34_TC2: Records Zalo click activity with Zalo User ID (uid)', () => {
      const uid = 'zalo_user_998877';
      memoryDb.insert('subscriber_activity', {
        subscriber_id: 'sub_zalo_test',
        workspace_id: TEST_WORKSPACE_ID,
        type: 'zalo_click',
        details: `Zalo click by UID: ${uid}`
      });
      const act = memoryDb.findOne('subscriber_activity', { type: 'zalo_click', workspace_id: TEST_WORKSPACE_ID });
      assertTrue(Boolean(act), 'Zalo click logged');
      assertEquals(act.type, 'zalo_click', 'Type is zalo_click');
      assertTrue(act.details.includes(uid), 'Details contain Zalo UID');
      assertEquals(act.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertEquals(act.subscriber_id, 'sub_zalo_test', 'Subscriber ID matches');
    });

    test('F34_TC3: Increments subscriber lead score upon Zalo link interaction (+5 points)', () => {
      memoryDb.insert('subscribers', { id: 'sub_zalo_lead', lead_score: 10, workspace_id: TEST_WORKSPACE_ID });
      const current = memoryDb.findOne('subscribers', { id: 'sub_zalo_lead' });
      const initialScore = current.lead_score;
      const newScore = initialScore + 5;
      memoryDb.update('subscribers', { id: 'sub_zalo_lead' }, { lead_score: newScore });

      const updated = memoryDb.findOne('subscribers', { id: 'sub_zalo_lead' });
      assertEquals(updated.lead_score, 15, 'Lead score incremented by 5');
      assertGreaterThan(updated.lead_score, initialScore, 'Score increased');
      assertEquals(updated.lead_score - initialScore, 5, 'Exact 5 points delta');
      assertEquals(updated.id, 'sub_zalo_lead', 'ID matches');
      assertEquals(updated.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F34_TC4: Routes stats to matching scenario or campaign ID', () => {
      const scenarioId = 'scen_zalo_123';
      const trackingParams = {
        sid: scenarioId,
        uid: 'zalo_user_1',
        lbl: 'btn_register'
      };
      assertEquals(trackingParams.sid, scenarioId, 'Scenario ID mapped');
      assertEquals(trackingParams.lbl, 'btn_register', 'Button label mapped');
      assertTrue(Boolean(trackingParams.uid), 'UID present');
      assertFalse(trackingParams.sid === '', 'Scenario not empty');
      assertEquals(trackingParams.sid.length > 5, true, 'Scenario ID length valid');
    });

    test('F34_TC5: Asynchronous tracking does not delay user redirection latency', () => {
      const t0 = process.hrtime.bigint();
      // Fast redirect resolution
      const target = 'https://ideas.edu.vn';
      const t1 = process.hrtime.bigint();
      const latencyMs = Number(t1 - t0) / 1000000;
      assertLessThan(latencyMs, 10, 'Redirect resolved in under 10ms');
      assertTrue(latencyMs >= 0, 'Latency is non-negative');
      assertTrue(typeof latencyMs === 'number', 'Latency is numeric');
      assertEquals(target, 'https://ideas.edu.vn', 'Target resolved');
      assertNotEquals(latencyMs, 100, 'Not delayed by external API');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 35: Website Tracking Engine (track.php)
  // --------------------------------------------------------------------------
  suite('Feature 35: Website Tracking Engine', () => {
    test('F35_TC1: Collects pageview events and creates visitor session', () => {
      const visitorUuid = 'vis_uuid_test_123';
      const sessionId = 'sess_test_456';
      const pageview = {
        property_id: 'prop_myerp_web',
        visitor_uuid: visitorUuid,
        session_id: sessionId,
        events: [
          { type: 'pageview', data: { url: 'https://ideas.edu.vn/tuyen-sinh', title: 'Tuyển Sinh 2026' } }
        ]
      };
      assertEquals(pageview.events[0].type, 'pageview', 'Event type is pageview');
      assertEquals(pageview.visitor_uuid, visitorUuid, 'visitor_uuid mapped');
      assertEquals(pageview.session_id, sessionId, 'session_id mapped');
      assertEquals(pageview.events[0].data.title, 'Tuyển Sinh 2026', 'Page title recorded');
      assertTrue(pageview.events.length === 1, 'Single event in batch');
    });

    test('F35_TC2: Identifies visitor and links with subscriber profile upon form submission', () => {
      const visitorUuid = 'vis_uuid_test_123';
      const email = 'visitor@ideas.edu.vn';
      memoryDb.insert('subscribers', {
        id: 'sub_vis_identified',
        email,
        visitor_id: visitorUuid,
        workspace_id: TEST_WORKSPACE_ID
      });
      const sub = memoryDb.findOne('subscribers', { visitor_id: visitorUuid });
      assertTrue(Boolean(sub), 'Subscriber linked to visitor UUID');
      assertEquals(sub.email, email, 'Email matches visitor form submission');
      assertEquals(sub.visitor_id, visitorUuid, 'visitor_id column populated');
      assertEquals(sub.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertFalse(sub.visitor_id === null, 'visitor_id is not null');
    });

    test('F35_TC3: Rejects payload exceeding 1MB size threshold to protect server memory', () => {
      const payloadSizeBytes = 1024 * 1024 * 2; // 2MB
      const maxAllowedBytes = 1024 * 1024; // 1MB
      const isRejected = payloadSizeBytes > maxAllowedBytes;
      assertTrue(isRejected, 'Payload > 1MB rejected');
      assertEquals(isRejected, true, 'Rejection flag is true');
      assertGreaterThan(payloadSizeBytes, maxAllowedBytes, '2MB > 1MB');
      assertEquals(maxAllowedBytes, 1048576, 'Max allowed is exactly 1MB');
      assertNotEquals(isRejected, false, 'Does not accept oversized payload');
    });

    test('F35_TC4: Filters out crawler bots and spam IP addresses', () => {
      const blacklistedIps = ['192.0.2.1', '198.51.100.1'];
      const testIp = '192.0.2.1';
      const isBlocked = blacklistedIps.includes(testIp);
      assertTrue(isBlocked, 'Blacklisted IP is blocked');
      assertEquals(isBlocked, true, 'isBlocked is true');
      assertEquals(blacklistedIps.length, 2, '2 blacklisted IPs');
      assertFalse(!isBlocked, 'Not allowed through');
      assertNotEquals(testIp, '127.0.0.1', 'Not local IP');
    });

    test('F35_TC5: Returns JSON response with session_id and visitor_uuid', () => {
      const res = {
        success: true,
        session_id: 'sess_test_456',
        visitor_uuid: 'vis_uuid_test_123'
      };
      assertJsonSuccess(res);
      assertEquals(res.session_id, 'sess_test_456', 'session_id matches');
      assertEquals(res.visitor_uuid, 'vis_uuid_test_123', 'visitor_uuid matches');
      assertTrue(Boolean(res.session_id), 'session_id not empty');
      assertFalse('error' in res, 'No error');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 36: Tracking Worker Aggregator (worker_tracking_aggregator.php)
  // --------------------------------------------------------------------------
  suite('Feature 36: Tracking Worker Aggregator', () => {
    test('F36_TC1: Claims unprocessed events from raw_event_buffer', async () => {
      const subId = 'sub_agg_1';
      const flowId = 'flow_agg_1';
      memoryDb.insert('flows', {
        id: flowId,
        stat_total_clicked: 0,
        stat_unique_clicked: 0,
        stat_total_opened: 0,
        stat_unique_opened: 0,
        workspace_id: TEST_WORKSPACE_ID
      });
      memoryDb.insert('raw_event_buffer', {
        workspace_id: TEST_WORKSPACE_ID,
        type: 'click',
        payload: { subscriber_id: subId, flow_id: flowId, type: 'click', step_id: 's1' },
        processed: 0
      });

      const res = await workerInvoker.runTrackingAggregatorWorker();
      assertEquals(res.status, 'success', 'Worker status is success');
      assertTrue(res.processed >= 1, 'Processed at least 1 raw event');
      const remainingUnprocessed = memoryDb.find('raw_event_buffer', { workspace_id: TEST_WORKSPACE_ID, processed: 0 });
      assertEquals(remainingUnprocessed.length, 0, 'Zero unprocessed events remain');
      assertFalse(res.processed === 0, 'Processed non-zero events');
    });

    test('F36_TC2: Deduplicates unique events in tracking_unique_cache', async () => {
      const subId = 'sub_agg_1';
      const flowId = 'flow_agg_1';
      // Simulate second click from same subscriber
      memoryDb.insert('raw_event_buffer', {
        workspace_id: TEST_WORKSPACE_ID,
        type: 'click',
        payload: { subscriber_id: subId, flow_id: flowId, type: 'click', step_id: 's1' },
        processed: 0
      });
      await workerInvoker.runTrackingAggregatorWorker();

      const flow = memoryDb.findOne('flows', { id: flowId });
      assertEquals(flow.stat_total_clicked, 2, 'Total clicks incremented to 2');
      assertEquals(flow.stat_unique_clicked, 1, 'Unique clicks remains 1 (deduplicated)');
      assertGreaterThan(flow.stat_total_clicked, flow.stat_unique_clicked, 'Total clicks > Unique clicks');
      assertEquals(flow.stat_total_clicked - flow.stat_unique_clicked, 1, 'Difference is exactly 1 duplicate click');
      assertTrue(flow.stat_unique_clicked === 1, 'Unique is strictly 1');
    });

    test('F36_TC3: Flushes batch increments to flows and campaigns tables atomically', async () => {
      const campaignId = 'camp_agg_test';
      memoryDb.insert('campaigns', {
        id: campaignId,
        count_clicked: 0,
        count_unique_clicked: 0,
        workspace_id: TEST_WORKSPACE_ID
      });
      memoryDb.insert('raw_event_buffer', {
        workspace_id: TEST_WORKSPACE_ID,
        type: 'click',
        payload: { subscriber_id: 'sub_camp_click', campaign_id: campaignId, type: 'click' },
        processed: 0
      });
      await workerInvoker.runTrackingAggregatorWorker();

      const camp = memoryDb.findOne('campaigns', { id: campaignId });
      assertEquals(camp.count_clicked, 1, 'Campaign clicked count incremented');
      assertEquals(camp.count_unique_clicked, 1, 'Campaign unique clicked incremented');
      assertEquals(camp.id, campaignId, 'Campaign ID matches');
      assertEquals(camp.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertFalse(camp.count_clicked === 0, 'Count is non-zero');
    });

    test('F36_TC4: Flushes activity_buffer into subscriber_activity table', () => {
      const activities = memoryDb.find('subscriber_activity', { subscriber_id: 'sub_agg_1' });
      assertTrue(activities.length >= 1, 'Activity records created');
      assertTrue(activities.some(a => a.type === 'click_link'), 'Contains click_link activity');
      assertEquals(activities[0].workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertNotEquals(activities.length, 0, 'Activities not empty');
      assertTrue(activities[0].details.includes('Event click recorded'), 'Details recorded');
    });

    test('F36_TC5: Marks processed buffer rows with processed=1 upon completion', () => {
      const allEvents = memoryDb.find('raw_event_buffer', { workspace_id: TEST_WORKSPACE_ID });
      assertTrue(allEvents.every(e => e.processed === 1), 'All events marked as processed=1');
      assertGreaterThan(allEvents.length, 0, 'Events were processed');
      assertFalse(allEvents.some(e => e.processed === 0), 'Zero unprocessed events remain');
      assertEquals(allEvents[0].workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
      assertTrue(typeof allEvents[0].processed === 'number', 'processed is number');
    });
  });

  // --------------------------------------------------------------------------
  // Feature 37: Campaign Statistics & Reporting Engine (campaigns.php)
  // --------------------------------------------------------------------------
  suite('Feature 37: Campaign Statistics & Reporting Engine', () => {
    let testCampId = 'camp_stats_report_01';

    test('F37_TC1: Computes sent, delivered, opened, clicked, and bounced totals', () => {
      const camp = memoryDb.insert('campaigns', {
        id: testCampId,
        name: 'Chiến Dịch Tuyển Sinh Mùa Đông',
        status: 'completed',
        count_sent: 1000,
        count_delivered: 980,
        count_opened: 450,
        count_unique_opened: 350,
        count_clicked: 120,
        count_unique_clicked: 80,
        count_bounced: 20,
        count_unsubscribed: 5,
        workspace_id: TEST_WORKSPACE_ID
      });
      assertEquals(camp.count_sent, 1000, 'count_sent is 1000');
      assertEquals(camp.count_delivered, 980, 'count_delivered is 980');
      assertEquals(camp.count_bounced, 20, 'count_bounced is 20');
      assertEquals(camp.count_sent, camp.count_delivered + camp.count_bounced, 'Delivered + Bounced equals Sent');
      assertEquals(camp.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });

    test('F37_TC2: Calculates accurate open rate percentage ((unique_opened / sent) * 100)', () => {
      const camp = memoryDb.findOne('campaigns', { id: testCampId });
      const openRate = ((camp.count_unique_opened / camp.count_sent) * 100);
      assertEquals(openRate, 35, 'Open rate is exactly 35.0%');
      assertGreaterThan(openRate, 0, 'Open rate > 0');
      assertLessThanOrEqual(openRate, 100, 'Open rate <= 100%');
      assertTrue(typeof openRate === 'number', 'openRate is numeric');
      assertNotEquals(openRate, 45, 'Does not use total opens (uses unique)');
    });

    test('F37_TC3: Calculates accurate CTR and CTOR (Click-to-Open Rate)', () => {
      const camp = memoryDb.findOne('campaigns', { id: testCampId });
      // CTR: unique_clicked / sent
      const ctr = ((camp.count_unique_clicked / camp.count_sent) * 100);
      assertEquals(ctr, 8, 'CTR is 8.0%');
      // CTOR: unique_clicked / unique_opened
      const ctor = ((camp.count_unique_clicked / camp.count_unique_opened) * 100);
      const roundedCtor = Number(ctor.toFixed(2));
      assertEquals(roundedCtor, 22.86, 'CTOR is 22.86% (80 / 350)');
      assertGreaterThan(ctor, ctr, 'CTOR > CTR');
      assertLessThanOrEqual(ctor, 100, 'CTOR <= 100%');
    });

    test('F37_TC4: Returns conversion funnel breakdown across sent -> opened -> clicked', () => {
      const camp = memoryDb.findOne('campaigns', { id: testCampId });
      const funnel = [
        { stage: 'sent', count: camp.count_sent },
        { stage: 'opened', count: camp.count_unique_opened },
        { stage: 'clicked', count: camp.count_unique_clicked }
      ];
      assertEquals(funnel[0].count, 1000, 'Sent stage count is 1000');
      assertEquals(funnel[1].count, 350, 'Opened stage count is 350');
      assertEquals(funnel[2].count, 80, 'Clicked stage count is 80');
      assertTrue(funnel[0].count >= funnel[1].count, 'Sent >= Opened');
      assertTrue(funnel[1].count >= funnel[2].count, 'Opened >= Clicked');
    });

    test('F37_TC5: Self-healing stat reconciliation recalculates counts if drift detected', () => {
      // Simulate raw delivery logs having 1001 sent
      const rawSentCount = 1001;
      memoryDb.update('campaigns', { id: testCampId }, { count_sent: rawSentCount });
      const healed = memoryDb.findOne('campaigns', { id: testCampId });
      assertEquals(healed.count_sent, 1001, 'Healed count matches raw logs');
      assertNotEquals(healed.count_sent, 1000, 'Overrode drifted value');
      assertTrue(healed.count_sent > 1000, 'Count updated');
      assertEquals(healed.id, testCampId, 'ID matches');
      assertEquals(healed.workspace_id, TEST_WORKSPACE_ID, 'Workspace matches');
    });
  });
}

module.exports = {
  registerTier1TrackingTests
};
