<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= isset($title) ? htmlspecialchars($title) : 'Сьогодні' ?></title>

<?php
  $partialsDir = dirname(__DIR__) . '/layouts/partials';
  $headBase = $partialsDir . '/head.base.php';
  if (is_file($headBase)) { include $headBase; }
?>
</head>

<body>
  <?php
  // Inline SVG sprite partial (для <use href="#id">)
  $icons = $partialsDir . '/icons.php';
  if (is_file($icons)) { include $icons; }
  ?>

  <?= $content ?? '' ?>

  <?php if (!empty($extra_js)): ?>
    <?php foreach ((array)$extra_js as $src): ?>
      <?php if (file_exists($_SERVER['DOCUMENT_ROOT'].$src)) { ?>
        <script src="<?= htmlspecialchars($src, ENT_QUOTES) ?>?v=<?= time() ?>" defer></script>
      <?php } ?>
    <?php endforeach; ?>
  <?php endif; ?>

  <!-- CSRF bootstrap (як і в main layout) -->
  <script src="/assets/js/services/bootstrap.csrf.js" defer></script>
  <script src="/assets/js/services/api.users.js?v=1" defer></script>
</body>
</html>
