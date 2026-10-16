<?php
header("Content-Type: application/javascript");
// Dynamic URL detection
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$domain = $_SERVER['HTTP_HOST'];
$path = dirname($_SERVER['PHP_SELF']);
$endpoint = $protocol . $domain . $path . "/track.php";
?>
(function(window, document) {
'use strict';

var CONFIG = {
endpoint: "
<?php echo $endpoint; ?>",
pid: document.currentScript.getAttribute('data-pid') || null,
cookieName: '_mfp_vid'
};

if (!CONFIG.pid) {
console.warn("MailFlowPro: No Property ID (data-pid) found.");
return;
}

var state = {
vid: getCookie(CONFIG.cookieName),
pvid: null,
startTime: Date.now()
};

// Utils
function generateUUID() {
return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
return v.toString(16);
});
}

function setCookie(name, value, days) {
var expires = "";
if (days) {
var date = new Date();
date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
expires = "; expires=" + date.toUTCString();
}
document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
var nameEQ = name + "=";
var ca = document.cookie.split(';');
for (var i = 0; i < ca.length; i++) { var c=ca[i]; while (c.charAt(0)==' ' ) c=c.substring(1, c.length); if
    (c.indexOf(nameEQ)==0) return c.substring(nameEQ.length, c.length); } return null; } function getSelector(el) { if
    (!el) return '' ; var selector=el.tagName.toLowerCase(); if (el.id) { selector +='#' + el.id; return selector; } if
    (el.className && typeof el.className==='string' ) { selector +='.' + el.className.split(' ').join('
    .').replace(/\.+/g, '.' ); } return selector; } function send(type, meta, data) { if (!state.vid) {
    state.vid=generateUUID(); setCookie(CONFIG.cookieName, state.vid, 365); } var payload={ pid: CONFIG.pid, vid:
    state.vid, type: type, meta: meta || {}, data: data || {} }; if (state.pvid) { payload.pvid=state.pvid; } // Use
    sendBeacon for reliability on unload, XHR/Fetch otherwise if (navigator.sendBeacon) { var blob=new
    Blob([JSON.stringify(payload)], { type: 'application/json' }); navigator.sendBeacon(CONFIG.endpoint, blob); } else {
    var xhr=new XMLHttpRequest(); xhr.open("POST", CONFIG.endpoint, true);
    xhr.setRequestHeader("Content-Type", "application/json" ); xhr.send(JSON.stringify(payload)); } // For pageview, we
    expect a response with pvid, but sendBeacon/async XHR can't handle response easily in fire-and-forget mode. // So
    for pageview strictly, we might want fetch to get the ID. if (type==='pageview' && window.fetch) {
    fetch(CONFIG.endpoint, { method: 'POST' , headers: {'Content-Type': 'application/json' }, body:
    JSON.stringify(payload) }).then(r=> r.json()).then(res => {
    if (res.pvid) state.pvid = res.pvid;
    });
    }
    }

    // Handlers
    function trackPageView() {
    send('pageview', {
    url: window.location.href,
    title: document.title,
    referrer: document.referrer,
    device: {
    ua: navigator.userAgent,
    screen: window.screen.width + 'x' + window.screen.height
    }
    });
    }

    function trackClick(e) {
    var target = e.target;
    // Limit to likely interactive elements or track everything?
    // User said "heatmap", so usually EVERYTHING or at least clicks on/near elements.
    // We'll track all clicks but verify coordinates.

    send('click', {
    x: e.pageX,
    y: e.pageY,
    vw: window.innerWidth,
    vh: window.innerHeight,
    text: target.innerText ? target.innerText.substring(0, 50) : '',
    selector: getSelector(target)
    });
    }

    function beat() {
    if (!state.pvid) return;
    var duration = Math.floor((Date.now() - state.startTime) / 1000);
    var scroll = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);

    // Send via heartbeat (ping) - reuse send but this one usually doesn't need response
    var payload = {
    pid: CONFIG.pid,
    vid: state.vid,
    type: 'ping',
    pvid: state.pvid,
    duration: duration,
    scroll: scroll
    };

    if (navigator.sendBeacon) {
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(CONFIG.endpoint, blob);
    }
    }

    // Identify
    window.MailFlow = window.MailFlow || {};
    window.MailFlow.identify = function(traits) {
    send('identify', {}, traits);
    };

    // Init
    window.addEventListener('load', trackPageView);
    document.addEventListener('click', trackClick);
    
    // Form Submit Listener (Journey only, no field/trait capture)
    document.addEventListener('submit', function(e) {
        var form = e.target;
        send('form_submit', {
            selector: getSelector(form)
        });
    });

    // Heartbeat every 10s
    setInterval(beat, 10000);

    // Unload
    window.addEventListener('beforeunload', beat);

    })(window, document);
