(function (window, document, endpoint, propertyId) {
    'use strict';

    // SINGLETON GUARD
    if (window._mfTrackerLoaded) {
        console.warn('MailFlow Tracker: Already loaded');
        return;
    }
    
    // BOT & CRAWLER PROTECTION
    var botRegex = /bot|crawler|spider|crawling|headless|lighthouse|slurp|facebookexternalhit|whatsapp|telegram|discordbot|google|bing|yahoo|duckduckbot|baiduspider|yandex|qwant|sogou|curl|wget/i;
    if (botRegex.test(navigator.userAgent || '') || navigator.webdriver) {
        window._mfTrackerLoaded = true;
        console.warn('MailFlow Tracker: Bot/Crawler detected. Tracking disabled to prevent 0s noise.');
        return;
    }
    
    window._mfTrackerLoaded = true;

    var CONFIG = {
        endpoint: endpoint,
        propertyId: propertyId,
        heartbeat: 10000,
        batchInterval: 3000
    };

    // --- UTILS ---
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function getCookie(name) {
        try {
            var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? decodeURIComponent(match[2]) : null;
        } catch (e) { return null; }
    }

    function setCookie(name, value, days) {
        try {
            var d = new Date();
            d.setTime(d.getTime() + ((days || 365) * 24 * 60 * 60 * 1000));
            document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
        } catch (e) { }
    }

    function getStorage(key) {
        try { return localStorage.getItem(key) || getCookie(key); } catch (e) { return getCookie(key); }
    }

    function setStorage(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { }
        if (key === '_mf_vid') {
            setCookie(key, value, 365);
        }
    }

    function getTrafficSource() {
        var params = new URLSearchParams(window.location.search);
        var source = {
            utm_source: params.get('utm_source') || null,
            utm_medium: params.get('utm_medium') || null,
            utm_campaign: params.get('utm_campaign') || null,
            utm_content: params.get('utm_content') || null,
            utm_term: params.get('utm_term') || null,
            referrer: document.referrer || null
        };
        if (!source.utm_source && !source.utm_medium) {
            if (source.referrer && source.referrer.indexOf(window.location.hostname) === -1) {
                if (source.referrer.match(/google|bing|yahoo|duckduckgo/i)) {
                    source.utm_source = 'google'; source.utm_medium = 'organic';
                } else if (source.referrer.match(/facebook|fb\.com/i)) {
                    source.utm_source = 'facebook'; source.utm_medium = 'social';
                } else if (source.referrer.match(/tiktok/i)) {
                    source.utm_source = 'tiktok'; source.utm_medium = 'social';
                } else if (source.referrer.match(/instagram/i)) {
                    source.utm_source = 'instagram'; source.utm_medium = 'social';
                } else {
                    source.utm_source = 'referral'; source.utm_medium = 'referral';
                }
            } else {
                source.utm_source = 'direct'; source.utm_medium = 'none';
            }
        }
        return source;
    }

    // --- STATE ---
    var visitorId = getStorage('_mf_vid');
    if (!visitorId) {
        visitorId = generateUUID();
    }
    // Always sync _mf_vid to both localStorage and document.cookie (BUG-FSV-08)
    setStorage('_mf_vid', visitorId);
    var sessionStart = Date.now();
    var eventQueue = [];
    var isProcessing = false;
    var maxScroll = 0;
    var totalActiveTime = 0;
    var lastVisibleResume = Date.now();
    var lastPing = 0;

    // --- DETECTION ---
    function detectOS() {
        var ua = navigator.userAgent;
        if (/Windows/.test(ua)) return 'Windows';
        if (/Macintosh/.test(ua)) return 'macOS';
        if (/Linux/.test(ua)) return 'Linux';
        if (/Android/.test(ua)) return 'Android';
        if (/iOS|iPhone|iPad/.test(ua)) return 'iOS';
        return 'Unknown';
    }

    function detectBrowser() {
        var ua = navigator.userAgent;
        if (/Chrome/.test(ua) && !/Edge|OPR/.test(ua)) return 'Chrome';
        if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari';
        if (/Firefox/.test(ua)) return 'Firefox';
        if (/Edge/.test(ua)) return 'Edge';
        if (/OPR/.test(ua)) return 'Opera';
        return 'Unknown';
    }

    // --- COLLECTOR ---
    function track(type, data) {
        eventQueue.push({ type: type, data: data || {}, timestamp: Date.now() });
        saveQueue();
        if (type === 'pageview' || eventQueue.length >= 5) flush();
    }

    function saveQueue() { try { localStorage.setItem('_mf_queue', JSON.stringify(eventQueue)); } catch (e) { } }
    function loadQueue() {
        var q = null;
        try { q = localStorage.getItem('_mf_queue'); } catch (e) { }
        if (q) { try { var items = JSON.parse(q); if (Array.isArray(items)) eventQueue = items.concat(eventQueue); } catch (e) { } }
    }

    function flush(isUnload) {
        if (eventQueue.length === 0 || (isProcessing && !isUnload) || !navigator.onLine) return;
        isProcessing = true;

        var batchSize = isUnload ? 20 : 10;
        var batch = eventQueue.slice(0, batchSize);
        var payload = {
            property_id: CONFIG.propertyId,
            visitor_id: visitorId,
            traffic_source: getTrafficSource(),
            device_info: {
                ua: navigator.userAgent,
                screen: window.screen.width + 'x' + window.screen.height,
                lang: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                os: detectOS(),
                browser: detectBrowser()
            },
            events: batch
        };
        var data = JSON.stringify(payload);

        if (isUnload && navigator.sendBeacon) {
            var blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon(CONFIG.endpoint, blob);
            eventQueue.splice(0, batch.length);
            saveQueue();
            isProcessing = false;
            return;
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', CONFIG.endpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                isProcessing = false;
                if (xhr.status >= 200 && xhr.status < 300) {
                    eventQueue.splice(0, batch.length);
                    saveQueue();
                    if (eventQueue.length > 0) setTimeout(function () { flush(false); }, 1000);
                } else { console.warn('Tracker Sync Failed', xhr.status); }
            }
        };
        xhr.send(data);
    }

    // Reliability: Flush on visibility hidden (tab switch/minimize) or unload
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flush(true);
    });
    window.addEventListener('pagehide', function () { flush(true); });

    // --- AUTO TRACKING (PAGEVIEWS) ---
    function trackPageView() {
        totalActiveTime = 0;
        lastVisibleResume = Date.now();
        maxScroll = 0;
        var currentUrl = window.location.href;
        var retryCount = 0;
        var maxRetries = 10;

        function getAndTrack() {
            var pageTitle = document.title;
            var h1 = document.querySelector('h1');
            var h1Text = h1 && h1.innerText ? h1.innerText.trim() : '';

            var isUrl = /^(https?:\/\/|www\.)/i.test(pageTitle);
            if ((isUrl || !pageTitle) && h1Text) {
                pageTitle = h1Text;
            }

            if (!pageTitle && retryCount < maxRetries) {
                retryCount++;
                setTimeout(getAndTrack, 500);
                return;
            }

            if (!pageTitle) {
                var path = window.location.pathname;
                pageTitle = path === '/' ? 'Home' : path.split('/').pop().replace(/[-_]/g, ' ') || 'Untitled';
            }

            track('pageview', {
                url: currentUrl,
                title: pageTitle,
                referrer: document.referrer,
                source: getTrafficSource()
            });
        }

        getAndTrack();
    }

    // Initial load
    trackPageView();

    // SPA Route Change Detection
    var lastUrl = window.location.href;

    window.addEventListener('popstate', function () {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            trackPageView();
        }
    });

    var originalPushState = history.pushState;
    history.pushState = function () {
        originalPushState.apply(this, arguments);
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            trackPageView();
        }
    };

    var originalReplaceState = history.replaceState;
    history.replaceState = function () {
        originalReplaceState.apply(this, arguments);
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            trackPageView();
        }
    };

    // --- CLICK TRACKING (JOURNEY & HEATMAP) ---
    function findMeaningfulText(el, level) {
        if (!el || level > 3) return '';

        var trackName = el.getAttribute('data-track-name') || el.getAttribute('data-track') || '';
        if (trackName.trim()) return trackName.trim();

        var attr = el.getAttribute('aria-label') || el.title || el.placeholder || el.alt || (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button' || el.type === 'reset') ? el.value : '') || '';
        if (attr.trim()) return attr.trim();

        for (var i = 0; i < el.childNodes.length; i++) {
            var node = el.childNodes[i];
            if (node.nodeType === 3 && node.textContent.trim()) {
                var txt = node.textContent.trim();
                if (txt.length > 1) return txt;
            }
        }

        if (el.tagName.toLowerCase() === 'svg') {
            var title = el.querySelector('title');
            if (title && title.textContent) return title.textContent.trim();
        }

        for (var j = 0; j < el.children.length; j++) {
            var childText = findMeaningfulText(el.children[j], level + 1);
            if (childText) return childText;
        }

        return '';
    }

    function discoverClickText(target) {
        var el = target;
        var upLevel = 0;
        var maxUp = 5;

        while (el && upLevel < maxUp && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
            var text = findMeaningfulText(el, 0);
            if (text && text.length > 1 && text.length < 200) return text.trim();

            if (upLevel <= 1) {
                var prev = el.previousElementSibling;
                if (prev) {
                    var pText = findMeaningfulText(prev, 1);
                    if (pText && pText.length > 1 && pText.length < 100) return pText.trim() + ' (near)';
                }
                var next = el.nextElementSibling;
                if (next) {
                    var nText = findMeaningfulText(next, 1);
                    if (nText && nText.length > 1 && nText.length < 100) return nText.trim() + ' (near)';
                }
            }

            el = el.parentElement;
            upLevel++;
        }
        return '';
    }

    function getSelector(el) {
        if (!el) return '';
        if (el.id) return '#' + el.id;
        if (el.className && typeof el.className === 'string' && el.className.trim()) return '.' + el.className.trim().split(/\s+/).join('.');
        return el.tagName ? el.tagName.toLowerCase() : '';
    }

    document.addEventListener('click', function (e) {
        var selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            return;
        }

        var target = e.target;
        var element = target.closest('a, button, input[type="submit"], input[type="button"], [role="button"], [onclick], .trackable');

        if (!element && target && target.tagName !== 'BODY') {
            try {
                var style = window.getComputedStyle(target);
                if (style && style.cursor === 'pointer') {
                    element = target;
                }
            } catch (err) {}
        }

        var meta = {
            x: e.pageX, y: e.pageY,
            vw: window.innerWidth, vh: window.innerHeight,
            path: window.location.pathname
        };

        var trackedText = discoverClickText(element || target);
        var trackedTag = element ? element.tagName.toLowerCase() : target.tagName.toLowerCase();
        if (trackedText.length > 100) trackedText = trackedText.substring(0, 100) + '...';
        if (!trackedText) trackedText = 'Unknown Click';

        if (element) {
            track('click', {
                tag: element.tagName,
                text: trackedText,
                href: element.href || null,
                id: element.id || null,
                class: element.className || null,
                selector: getSelector(element),
                ...meta
            });
            if (element.tagName === 'A') flush(true);
        } else {
            var contextTexts = [];
            if (!trackedText || trackedText === 'Unknown Click') {
                var directText = (target.textContent || '').trim();
                if (directText && directText.length > 0 && directText.length < 200) {
                    trackedText = directText.substring(0, 100);
                }
            }

            var parent = target.parentElement;
            if (parent) {
                var siblings = Array.from(parent.children);
                siblings.forEach(function (sibling) {
                    if (sibling !== target) {
                        var sibText = (sibling.textContent || '').trim();
                        if (sibText && sibText.length > 0 && sibText.length < 100) {
                            contextTexts.push(sibText.substring(0, 50));
                        }
                    }
                });
            }

            var context = contextTexts.slice(0, 3).join(' | ').substring(0, 150);

            track('canvas_click', {
                ...meta,
                element: trackedTag,
                text: trackedText,
                context: context || null,
                classes: target.className || null,
                selector: getSelector(target)
            });
        }
    }, true);

    // --- SCROLL TRACKING (ENGAGEMENT MILESTONES) ---
    var trackedMilestones = { 25: false, 50: false, 75: false, 90: false, 100: false };
    var scrollTimer = null;
    document.addEventListener('scroll', function () {
        if (scrollTimer) return;
        scrollTimer = setTimeout(function () {
            var s = window.scrollY || window.pageYOffset || 0;
            var h = window.innerHeight || document.documentElement.clientHeight || 0;
            var d = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
            var p = d > h ? Math.round((s + h) / d * 100) : 100;
            if (p > 100) p = 100;
            
            [25, 50, 75, 90, 100].forEach(function (m) {
                if (p >= m && !trackedMilestones[m]) {
                    trackedMilestones[m] = true;
                    track('scroll', { percent: m, depth: p });
                }
            });

            if (p > maxScroll) {
                maxScroll = p;
            }
            scrollTimer = null;
        }, 500);
    });

    // --- HEARTBEAT & ENGAGEMENT TIME ---
    function sendPing(isUnload) {
        if (document.visibilityState === 'hidden' && !isUnload) return;
        if (Date.now() - lastPing < 1000 && !isUnload) return;
        lastPing = Date.now();

        var currentActive = totalActiveTime;
        if (document.visibilityState === 'visible') {
            currentActive += Date.now() - lastVisibleResume;
        }

        var d = {
            duration: Math.floor((Date.now() - sessionStart) / 1000),
            page_time: Math.floor(currentActive / 1000),
            max_scroll: maxScroll,
            is_exit: isUnload
        };
        if (isUnload && navigator.sendBeacon) {
            var payload = { property_id: CONFIG.propertyId, visitor_id: visitorId, events: [{ type: 'ping', data: d, timestamp: Date.now() }] };
            navigator.sendBeacon(CONFIG.endpoint, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
        } else { track('ping', d); }
    }

    setInterval(function () { if (document.visibilityState === 'visible') sendPing(false); }, CONFIG.heartbeat);
    window.addEventListener('beforeunload', function () { sendPing(true); });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            totalActiveTime += Date.now() - lastVisibleResume;
            sendPing(false);
        } else {
            lastVisibleResume = Date.now();
        }
    });

    loadQueue();
    setInterval(flush, CONFIG.batchInterval);

    // --- AI CHATBOT INJECTION ---
    if (window._mf_config && window._mf_config.ai_chat) {
        var chatScript = document.createElement('script');
        chatScript.src = 'https://automation.ideas.edu.vn/ai-chat-embedded.js';
        chatScript.async = true;
        document.head.appendChild(chatScript);
    }

})(window, document, 'https://automation.ideas.edu.vn/mail_api/track.php', (function(){ if(window._mf_config && window._mf_config.property_id) return window._mf_config.property_id; var c = document.currentScript; if(c && c.getAttribute('data-website-id')) return c.getAttribute('data-website-id'); var s = document.querySelector('script[data-website-id]'); if(s) return s.getAttribute('data-website-id'); return window._mf_property_id || null; })());
