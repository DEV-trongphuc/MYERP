<?php
echo "APCu: " . (extension_loaded('apcu') ? 'Yes' : 'No') . "\n";
echo "APC: " . (extension_loaded('apc') ? 'Yes' : 'No') . "\n";
echo "Functions:\n";
echo "apcu_store: " . (function_exists('apcu_store') ? 'Yes' : 'No') . "\n";
echo "apcu_fetch: " . (function_exists('apcu_fetch') ? 'Yes' : 'No') . "\n";
echo "apcu_inc: " . (function_exists('apcu_inc') ? 'Yes' : 'No') . "\n";
echo "apc_store: " . (function_exists('apc_store') ? 'Yes' : 'No') . "\n";
