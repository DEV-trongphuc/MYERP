<?php
header('Content-Type: image/svg+xml; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$endStr = $_GET['end'] ?? $_GET['target'] ?? '';
$bg = preg_replace('/[^a-fA-F0-9#]/', '', $_GET['bg'] ?? '#BD1D2D');
$color = preg_replace('/[^a-fA-F0-9#]/', '', $_GET['color'] ?? '#ffffff');
if ($bg !== '' && $bg[0] !== '#') $bg = '#' . $bg;
if ($color !== '' && $color[0] !== '#') $color = '#' . $color;
if ($bg === '') $bg = '#BD1D2D';
if ($color === '') $color = '#ffffff';

$targetTs = $endStr ? strtotime($endStr) : (time() + 86400);
if (!$targetTs) $targetTs = time() + 86400;

$diff = max(0, $targetTs - time());
$days = str_pad((string)floor($diff / 86400), 2, '0', STR_PAD_LEFT);
$hours = str_pad((string)floor(($diff % 86400) / 3600), 2, '0', STR_PAD_LEFT);
$minutes = str_pad((string)floor(($diff % 3600) / 60), 2, '0', STR_PAD_LEFT);
$seconds = str_pad((string)($diff % 60), 2, '0', STR_PAD_LEFT);

echo <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="80" viewBox="0 0 360 80">
  <rect x="6" y="6" width="76" height="68" rx="10" fill="{$bg}" />
  <text x="44" y="42" text-anchor="middle" fill="{$color}" font-family="Arial, sans-serif" font-size="24" font-weight="bold">{$days}</text>
  <text x="44" y="62" text-anchor="middle" fill="{$color}" opacity="0.85" font-family="Arial, sans-serif" font-size="10" font-weight="bold">NGÀY</text>

  <rect x="96" y="6" width="76" height="68" rx="10" fill="{$bg}" />
  <text x="134" y="42" text-anchor="middle" fill="{$color}" font-family="Arial, sans-serif" font-size="24" font-weight="bold">{$hours}</text>
  <text x="134" y="62" text-anchor="middle" fill="{$color}" opacity="0.85" font-family="Arial, sans-serif" font-size="10" font-weight="bold">GIỜ</text>

  <rect x="186" y="6" width="76" height="68" rx="10" fill="{$bg}" />
  <text x="224" y="42" text-anchor="middle" fill="{$color}" font-family="Arial, sans-serif" font-size="24" font-weight="bold">{$minutes}</text>
  <text x="224" y="62" text-anchor="middle" fill="{$color}" opacity="0.85" font-family="Arial, sans-serif" font-size="10" font-weight="bold">PHÚT</text>

  <rect x="276" y="6" width="76" height="68" rx="10" fill="{$bg}" />
  <text x="314" y="42" text-anchor="middle" fill="{$color}" font-family="Arial, sans-serif" font-size="24" font-weight="bold">{$seconds}</text>
  <text x="314" y="62" text-anchor="middle" fill="{$color}" opacity="0.85" font-family="Arial, sans-serif" font-size="10" font-weight="bold">GIÂY</text>
</svg>
SVG;
