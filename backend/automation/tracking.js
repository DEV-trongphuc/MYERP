/**
 * MailFlow Pro - Web Analytics Tracking Script
 * Lightweight tracking for page views, clicks, scrolls, and form submissions
 * 
 * Usage: <script src="https://your-domain.com/api/tracking.js" data-site-id="YOUR_SITE_ID"></script>
 */

(function () {
    'use strict';

    // Configuration
    const script = document.currentScript;
    const API_ENDPOINT = script.src.replace('/tracking.js', '/web_analytics.php');
    const SITE_ID = script.getAttribute('data-site-id') || 'default';

    // Get or create visitor ID (anonymous tracking)
    function getVisitorId() {
        let visitorId = localStorage.getItem('mfp_visitor_id');
        if (!visitorId) {
            visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('mfp_visitor_id', visitorId);
        }
        return visitorId;
    }

    // Get or create session ID
    function getSessionId() {
        let sessionId = sessionStorage.getItem('mfp_session_id');
        if (!sessionId) {
            sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('mfp_session_id', sessionId);
        }
        return sessionId;
    }

    // Get UTM parameters from URL
    function getUTMParams() {
        const params = new URLSearchParams(window.location.search);
        return {
            utm_source: params.get('utm_source'),
            utm_medium: params.get('utm_medium'),
            utm_campaign: params.get('utm_campaign'),
            utm_term: params.get('utm_term'),
            utm_content: params.get('utm_content')
        };
    }

    // Device detection
    function getDeviceInfo() {
        const ua = navigator.userAgent;
        let deviceType = 'desktop';

        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            deviceType = 'tablet';
        } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            deviceType = 'mobile';
        }

        return {
            deviceType,
            userAgent: ua,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
        };
    }

    // Send data to server using sendBeacon (non-blocking)
    function sendData(eventType, data) {
        const payload = {
            site_id: SITE_ID,
            visitor_id: getVisitorId(),
            session_id: getSessionId(),
            event_type: eventType,
            page_url: window.location.href,
            page_title: document.title,
            referrer: document.referrer,
            timestamp: new Date().toISOString(),
            device_info: getDeviceInfo(),
            utm_params: getUTMParams(),
            ...data
        };

        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

        if (navigator.sendBeacon) {
            navigator.sendBeacon(API_ENDPOINT, blob);
        } else {
            // Fallback for older browsers
            fetch(API_ENDPOINT, {
                method: 'POST',
                body: blob,
                keepalive: true
            }).catch(() => { });
        }
    }

    // Track page view
    let pageViewStartTime = Date.now();
    let maxScrollDepth = 0;

    function trackPageView() {
        sendData('page_view', {
            duration: 0,
            scroll_depth: 0
        });
    }

    // Track page duration and scroll depth on unload
    function trackPageExit() {
        const duration = Math.round((Date.now() - pageViewStartTime) / 1000);
        sendData('page_exit', {
            duration,
            scroll_depth: maxScrollDepth
        });
    }

    // Track scroll depth
    function trackScroll() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollDepth = Math.round(((scrollTop + windowHeight) / documentHeight) * 100);

        if (scrollDepth > maxScrollDepth) {
            maxScrollDepth = Math.min(scrollDepth, 100);
        }
    }

    let scrollTimeout;
    window.addEventListener('scroll', function () {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(trackScroll, 150);
    }, { passive: true });

    // Track clicks
    function trackClick(event) {
        const target = event.target;
        const tagName = target.tagName.toLowerCase();

        // Get element text
        let elementText = target.textContent?.trim().substring(0, 500) || '';

        // Get click coordinates for heatmap
        const rect = target.getBoundingClientRect();
        const x = Math.round(event.clientX);
        const y = Math.round(event.clientY + window.pageYOffset);

        const clickData = {
            element_tag: tagName,
            element_id: target.id || null,
            element_class: target.className || null,
            element_text: elementText,
            x_position: x,
            y_position: y,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight
        };

        // Track links
        if (tagName === 'a') {
            clickData.target_url = target.href;
            clickData.event_name = 'link_click';
        }
        // Track buttons
        else if (tagName === 'button' || target.type === 'submit') {
            clickData.event_name = 'button_click';
        }
        // Track other clicks
        else {
            clickData.event_name = 'click';
        }

        sendData('click', clickData);
    }

    document.addEventListener('click', trackClick, { passive: true });

    // Track form submissions (journey only, no field/PII capture)
    function trackFormSubmit(event) {
        const form = event.target;
        sendData('form_submit', {
            form_url: form.action || window.location.href,
            form_id: form.id || null
        });
    }

    document.addEventListener('submit', trackFormSubmit, { passive: true });

    // Track video plays (YouTube, Vimeo, HTML5)
    function setupVideoTracking() {
        // HTML5 videos
        document.querySelectorAll('video').forEach(video => {
            video.addEventListener('play', function () {
                sendData('video_play', {
                    video_src: this.currentSrc || this.src,
                    event_name: 'video_play'
                });
            }, { once: true, passive: true });
        });

        // YouTube iframes (requires YouTube API)
        // Vimeo iframes (requires Vimeo API)
        // Can be extended based on needs
    }

    // Initialize tracking
    function init() {
        // Track initial page view
        trackPageView();

        // Track page exit
        window.addEventListener('beforeunload', trackPageExit);
        window.addEventListener('pagehide', trackPageExit);

        // Setup video tracking
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupVideoTracking);
        } else {
            setupVideoTracking();
        }

        // Track SPA navigation (for React, Vue, etc.)
        let lastUrl = location.href;
        new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                pageViewStartTime = Date.now();
                maxScrollDepth = 0;
                trackPageView();
            }
        }).observe(document, { subtree: true, childList: true });
    }

    // Start tracking when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for custom events
    window.MailFlowAnalytics = {
        track: function (eventName, data = {}) {
            sendData('custom', {
                event_name: eventName,
                ...data
            });
        },
        identify: function (email, userData = {}) {
            // Link visitor to subscriber
            sendData('identify', {
                email: email,
                user_data: userData
            });
        }
    };

})();
