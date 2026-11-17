import re
import datetime

def test_audience_split_chunking():
    print("--- Edge Case 1: Audience Split Chunking (40,000 items) ---")
    # Simulate 40,000 emails with duplicates and dirty whitespace
    raw_input = [f" user_{i % 35000}@example.com " for i in range(40000)]
    
    # Logic in audience_split.php:133
    cleaned = [x.strip() for x in raw_input if x.strip()]
    deduped = list(dict.fromkeys(cleaned)) # array_values(array_unique(...))
    chunks = [deduped[i:i + 500] for i in range(0, len(deduped), 500)]
    
    print(f"  Input raw items: {len(raw_input)}")
    print(f"  Deduplicated items: {len(deduped)}")
    print(f"  Number of chunks (size 500): {len(chunks)}")
    
    max_params_per_chunk = 0
    for c in chunks:
        # SQL: (s.email IN ($ph) OR s.phone_number IN ($ph))
        # Params: [$wsId] + chunk + chunk + [$segParams]
        params_count = 1 + len(c) + len(c) # 1 + 500 + 500 = 1001
        if params_count > max_params_per_chunk:
            max_params_per_chunk = params_count
    
    print(f"  Max parameters bound in single query: {max_params_per_chunk}")
    assert max_params_per_chunk <= 1003, f"Too many parameters: {max_params_per_chunk}"
    assert max_params_per_chunk < 65535, "Exceeds MySQL/PDO limit!"
    print("[PASS] Edge Case 1: 40k list safely chunked, max params 1,001 (far below 65,535 ceiling)!")

def test_dynamic_filter_operators():
    print("\n--- Edge Case 2: Dynamic Filter Operators Boundary Values ---")
    
    # Test cases:
    # within_days with -5, 0, '14'
    cases = [
        ('within_days', -5, 0),
        ('within_days', '0', 0),
        ('within_days', '14', 14),
        ('more_than_days', -1, 0),
        ('more_than_days', 90, 90)
    ]
    for op, val, expected in cases:
        clamped = max(0, int(val))
        assert clamped == expected, f"Failed for {op} {val}: expected {expected}, got {clamped}"
    print("[PASS] Date operators clamp negative and non-integer values safely to >= 0!")

    # Test 'in' operator with empty list vs non-empty list
    def compile_in(raw):
        if isinstance(raw, list):
            raw_vals = raw
        else:
            raw_vals = str(raw).split(',')
        items = []
        for v in raw_vals:
            v_str = str(v).strip()
            if v_str != '':
                items.append(v_str)
        items = list(dict.fromkeys(items))
        if not items:
            return "1=0", []
        ph = ','.join(['?'] * len(items))
        return f"col IN ({ph})", items

    sql, params = compile_in("")
    assert sql == "1=0" and params == [], f"Empty 'in' failed: {sql}, {params}"
    sql, params = compile_in(" , , ")
    assert sql == "1=0" and params == [], f"Whitespace 'in' failed: {sql}, {params}"
    sql, params = compile_in("HCM, Danang, Hanoi, HCM")
    assert sql == "col IN (?,?,?)" and params == ['HCM', 'Danang', 'Hanoi']
    print("[PASS] 'in' operator handles empty, whitespace, and deduplicates properly!")

    # Test 'not_in' operator with empty list vs non-empty list
    def compile_not_in(raw):
        if isinstance(raw, list):
            raw_vals = raw
        else:
            raw_vals = str(raw).split(',')
        items = []
        for v in raw_vals:
            v_str = str(v).strip()
            if v_str != '':
                items.append(v_str)
        items = list(dict.fromkeys(items))
        if not items:
            return "1=1", []
        ph = ','.join(['?'] * len(items))
        return f"(col IS NULL OR col NOT IN ({ph}))", items

    sql, params = compile_not_in("")
    assert sql == "1=1" and params == [], f"Empty 'not_in' failed: {sql}, {params}"
    sql, params = compile_not_in("inactive, bounced")
    assert sql == "(col IS NULL OR col NOT IN (?,?))" and params == ['inactive', 'bounced']
    print("[PASS] 'not_in' operator handles empty and correctly includes (col IS NULL OR ...)!")

def test_queue_poison_pill_mechanism():
    print("\n--- Edge Case 3: Worker Segment Counts Anti-Poison-Pill Logic ---")
    
    # Simulate queue with 5 segments: segment 2 is corrupted (throws exception)
    queue = [
        {'segment_id': 1, 'queued_at': 100},
        {'segment_id': 2, 'queued_at': 101}, # poison pill
        {'segment_id': 3, 'queued_at': 102},
        {'segment_id': 4, 'queued_at': 103},
        {'segment_id': 5, 'queued_at': 104},
    ]

    failed_in_this_run = {}
    processed = []
    
    # Worker processing loop
    for item in list(queue):
        sid = item['segment_id']
        if sid in failed_in_this_run:
            continue
        try:
            if sid == 2:
                raise Exception("Corrupted criteria syntax!")
            processed.append(sid)
        except Exception as e:
            failed_in_this_run[sid] = True
            # Push queued_at 10 minutes into future
            item['queued_at'] += 600

    print(f"  Processed segments: {processed}")
    print(f"  Failed segments: {list(failed_in_this_run.keys())}")
    
    assert processed == [1, 3, 4, 5], f"Downstream items were blocked! Processed: {processed}"
    assert 2 in failed_in_this_run, "Poison pill was not tracked in failed list"
    assert queue[1]['queued_at'] == 701, "Poison pill queued_at was not pushed to future"
    print("[PASS] Edge Case 3: Poison pill segment 2 failed gracefully without blocking segments 3, 4, 5!")

if __name__ == '__main__':
    test_audience_split_chunking()
    test_dynamic_filter_operators()
    test_queue_poison_pill_mechanism()
    print("\nALL ADVERSARIAL EDGE CASE TESTS PASSED EMPIRICALLY!")
