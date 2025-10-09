<?php
/**
 * Fix: escapes $ in injected line to avoid interpolation.
 * Usage:
 *   php patches/inject_cabinet_user_resolver.php /path/to/App/Controllers/CabinetController.php
 */
if ($argc < 2) { fwrite(STDERR, "Usage: php ".$argv[0]." /path/to/App/Controllers/CabinetController.php\n"); exit(2); }
$file = $argv[1];
if (!is_file($file)) { fwrite(STDERR, "File not found: $file\n"); exit(2); }
$src = file_get_contents($file);
if ($src === false) { fwrite(STDERR, "Cannot read: $file\n"); exit(2); }

if (strpos($src, 'CabinetView::resolveUserIdAndAttach') !== false && strpos($src, '$__cabinetViewId') !== false) {
    echo "Already injected: $file\n";
    exit(0);
}

$src = preg_replace_callback('/^\s*namespace\s+[^;]+;\s*/m', function($m){
    $block = $m[0];
    if (strpos($block, 'use App\\Core\\CabinetView;') === false) { $block .= "\nuse App\\Core\\CabinetView;\n"; }
    return $block;
}, $src, 1, $nsCount);

if ($nsCount === 0) {
    // No namespace; add use after opening tag
    $src = preg_replace('/^<\?php\s*/', "<?php\nuse App\\Core\\CabinetView;\n", $src, 1);
}

// Pick method: index(), show(), or first public
$methods = [
    '/public\s+function\s+index\s*\(/',
    '/public\s+function\s+show\s*\(/',
    '/public\s+function\s+[A-Za-z_]\w*\s*\(/',
];
$inserted = false;
foreach ($methods as $rx) {
    if (preg_match($rx, $src, $m, PREG_OFFSET_CAPTURE)) {
        $pos = $m[0][1];
        $bracePos = strpos($src, '{', $pos);
        if ($bracePos !== false) {
            $injectAt = $bracePos + 1;
            $injection = "\n        // Resolve which user_id to show in Cabinet (with permissions)\n        \$__cabinetViewId = CabinetView::resolveUserIdAndAttach();\n";
            $src = substr($src, 0, $injectAt) . $injection . substr($src, $injectAt);
            $inserted = true;
            break;
        }
    }
}
if (!$inserted) { fwrite(STDERR, "Could not find a public method to inject into.\n"); exit(3); }
if (file_put_contents($file, $src) === false) { fwrite(STDERR, "Cannot write: $file\n"); exit(2); }
echo "Injected into: $file\n";
