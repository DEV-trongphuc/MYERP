<?php
/**
 * api/scoring_config.php - Central configuration for Lead Scoring points
 * Edit the values here to change how many points are awarded for each action.
 */

return [
    // --- EMAIL INTERACTIONS ---
    'email_open' => 1,
    'email_click' => 5,

    // --- ZALO INTERACTIONS ---
    'zalo_follow' => 2,
    'zalo_message' => 5,
    'zalo_click' => 2,
    'zalo_zns_interact' => 3,
    'zalo_zns_click' => 5,
    'zalo_reaction' => 3,
    'zalo_feedback' => 5,

    // --- WEB / SYSTEM INTERACTIONS ---
    'form_submit' => 5,
    'purchase' => 10,
    'custom_event' => 5,
];
