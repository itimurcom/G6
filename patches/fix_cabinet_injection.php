<?php
/**
 * Repairs a previous bad injection where the line started with "= CabinetView::resolveUserIdAndAttach();"
 * Usage:
 *   php patches/fix_cabinet_injection.php /path/to/App/Controllers/CabinetController.php
 */
if ($argc < 2) { fwrite(STDERR, "Usage: php ".$argv[0]." /path/to/App/Controllers/CabinetController.php\n"); exit(2); }
$file = $argv[1];
if (!is_file($file)) { fwrite(STDERR, "File not found: $file\n"); exit(2); }
$src = file_get_contents($file);
if ($src === false) { fwrite(STDERR, "Cannot read: $file\n"); exit(2); }

$original = $src;
$fixed = 0;

// Ensure use statement
$src = preg_replace_callback('/^\s*namespace\s+[^;]+;\s*/m', function($m){
    $block = $m[0];
    if (strpos($block, 'use App\\Core\\CabinetView;') === false) { $block .= "\nuse App\\Core\\CabinetView;\n"; }
    return $block;
}, $src, 1, $nsCount);

if ($nsCount === 0 && strpos($src, 'use App\\Core\\CabinetView;') === false) {
    $src = preg_replace('/^<\?php\s*/', "<?php\nuse App\\Core\\CabinetView;\n", $src, 1);
}

// Replace bad line "= CabinetView::..."
$src = preg_replace('/^\s*=\s*CabinetView::resolveUserIdAndAttach\(\)\s*;\s*$/m', "        \$__cabinetViewId = CabinetView::resolveUserIdAndAttach();", $src, -1, $cnt1);
$fixed += $cnt1;

// Also repair variant without semicolon spacing issues
$src = preg_replace('/^\s*=\s*CabinetView::resolveUserIdAndAttach\(\);\s*$/m', "        \$__cabinetViewId = CabinetView::resolveUserIdAndAttach();", $src, -1, $cnt2);
$fixed += $cnt2;

// If there is still no proper assignment but call exists, replace the line containing the call
if ($fixed == 0 && strpos($src, 'CabinetView::resolveUserIdAndAttach()') !== false && strpos($src, '$__cabinetViewId') === false) {
    $lines = explode("\n", $src);
    for ($i=0; $i<count($lines); $i++) {
        if (strpos($lines[$i], 'CabinetView::resolveUserIdAndAttach()') !== false) {
            $lines[$i] = "        \$__cabinetViewId = CabinetView::resolveUserIdAndAttach();";
            $fixed++;
            break;
        }
    }
    $src = implode("\n", $lines);
}

if ($src !== $original) {
    if (file_put_contents($file, $src) === false) { fwrite(STDERR, "Cannot write: $file\n"); exit(2); }
    echo "Fixed $fixed occurrence(s) in: $file\n";
} else {
    echo "No changes needed in: $file\n";
}
