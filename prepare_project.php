<?php
// Налаштування
$outputFile = 'project_full_code.txt'; // Назва файлу, який ми створимо
$allowedExtensions = ['php', 'html', 'js', 'css', 'sql']; // Які файли читати
$ignoredDirs = ['.git', '.idea', 'vendor', 'node_modules', 'images', 'uploads']; // Які папки ігнорувати

// Функція для отримання файлів
function getDirContents($dir, &$results = array()) {
    global $ignoredDirs, $allowedExtensions;
    
    $files = scandir($dir);

    foreach ($files as $key => $value) {
        $path = realpath($dir . DIRECTORY_SEPARATOR . $value);
        
        if (!is_dir($path)) {
            $ext = pathinfo($path, PATHINFO_EXTENSION);
            if (in_array($ext, $allowedExtensions)) {
                $results[] = $path;
            }
        } else if ($value != "." && $value != "..") {
            if (!in_array($value, $ignoredDirs)) {
                getDirContents($path, $results);
            }
        }
    }
    return $results;
}

// Запуск процесу
echo "Сканування файлів...\n";
$files = getDirContents(__DIR__);

$handle = fopen($outputFile, 'w');

foreach ($files as $file) {
    // Отримуємо відносний шлях для зручності читання
    $relativePath = str_replace(__DIR__, '', $file);
    
    // Записуємо заголовок файлу
    fwrite($handle, "\n\n" . str_repeat("=", 50) . "\n");
    fwrite($handle, "FILE: " . $relativePath . "\n");
    fwrite($handle, str_repeat("=", 50) . "\n\n");
    
    // Записуємо вміст файлу
    fwrite($handle, file_get_contents($file));
    
    echo "Додано: $relativePath\n";
}

fclose($handle);

echo "\nГотово! Весь код збережено у файл: $outputFile\n";
echo "Тепер ти можеш надіслати цей файл або його вміст мені.";