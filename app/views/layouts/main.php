<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= isset($title) ? htmlspecialchars($title) : 'Планувальник' ?></title>

  <!-- Базові стилі інтерфейсу -->
  <link rel="stylesheet" href="/assets/css/style.css">
  <?php
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $isCalendar = ($path === '/calendar' || $path === '/calendar/');
  ?>
  <?php foreach ($extra_css as $href):
    if (file_exists($_SERVER['DOCUMENT_ROOT'].$href)) { ?>
    <link rel="stylesheet" href="<?= htmlspecialchars($href) ?>?v=<?= htmlspecialchars($ver ?? time()) ?>">
  <?php } else { ?>
    <script> console.log("<?= $_SERVER['DOCUMENT_ROOT'].$href?> not found"); </script>
    <?php }endforeach; ?>
  
</head>
<body>
<!-- <?php if (!empty($modules_js)): ?>
  <?php foreach ($modules_js as $src): 
    if (file_exists($_SERVER['DOCUMENT_ROOT'].$src)) { ?>
<script type="module" src="<?= htmlspecialchars($src, ENT_QUOTES) ?>?v=<?= time() ?>"</script>    
  <?php } else { ?>
    <script> console.log("<?= $_SERVER['DOCUMENT_ROOT'].$src?> not found"); </script>
    <?php }endforeach; ?>
<?php endif; ?> -->


  <!-- Сайдбар як контейнер -->
  <aside id="sidebar" class="sidebar">
    <nav>
      <a href="/">Планування</a>
      <a href="/calendar">Календар</a>
      <a href="/cabinet">Мій кабінет</a>
    </nav>
  </aside>

  <!-- Контент сторінки в єдиному контейнері -->
  <main class="page<?= $isCalendar ? ' calendar-page' : '' ?>">
    <?php if(!$isCalendar): ?>
    <div class="page-head"></div>
    <?php endif; ?>
    <section class="container">
      <?= $content ?? '' ?>
    </section>
  </main>

  <script src="/assets/js/app.js" defer></script>
<?php if (!empty($extra_js)): ?>
  <?php foreach ($extra_js as $src): 
    if (file_exists($_SERVER['DOCUMENT_ROOT'].$src)) { ?>
<script src="<?= htmlspecialchars($src, ENT_QUOTES) ?>?v=<?= time() ?>" defer></script>
  <?php } else { ?>
    <script> console.log("<?= $_SERVER['DOCUMENT_ROOT'].$src?> not found"); </script>
    <?php }endforeach; ?>
<?php endif; ?>

</body>
</html>
