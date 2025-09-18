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

<!-- Variant 3: Inline SVG Sprite (paste once near the end of <body>) -->
<svg xmlns="http://www.w3.org/2000/svg"
     style="position:absolute;width:0;height:0;overflow:hidden"
     aria-hidden="true" focusable="false">
  <!-- All icons are 24x24, outline (stroke-only), color via currentColor -->
  <!-- FLOPPY: SAVE -->
  <symbol id="i-floppy-save" viewBox="0 0 24 24">
    <path d="M4 4h11l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
    <path d="M4 10h16"/>
    <rect x="7" y="14" width="6" height="4" rx="1"/>
    <path d="M12 7v6"/>
    <path d="M9 10l3 3 3-3"/>
  </symbol>

  <!-- FLOPPY: LOAD -->
  <symbol id="i-floppy-load" viewBox="0 0 24 24">
    <path d="M4 4h11l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
    <path d="M4 10h16"/>
    <rect x="7" y="14" width="6" height="4" rx="1"/>
    <path d="M12 17v-6"/>
    <path d="M9 12l3-3 3 3"/>
  </symbol>

  <!-- OK (circle + check) -->
  <symbol id="i-ok" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9"/>
    <path d="M8 12l2.5 2.5L16 9"/>
  </symbol>

  <!-- PLUS / NEW -->
  <symbol id="i-plus" viewBox="0 0 24 24">
    <path d="M12 5v14M5 12h14"/>
  </symbol>

  <!-- CHECK (галочка) -->
  <symbol id="i-check" viewBox="0 0 24 24">
    <path d="M5 13l4 4L19 7"/>
  </symbol>

  <!-- X (хрестик) -->
  <symbol id="i-x" viewBox="0 0 24 24">
    <path d="M6 6l12 12M6 18L18 6"/>
  </symbol>

  <!-- FIRE (вогонь) -->
  <symbol id="i-fire" viewBox="0 0 24 24">
    <path d="M12 3c-3 3-5 6-5 9a7 7 0 1 0 14 0c0-3-1.5-5.7-3.5-8 .3 1.8-.2 3.3-1.2 4.5-1 1.2-2.3 2-2.3 3.6 0 1.5 1.3 2.6 2.8 2.6"/>
  </symbol>

  <!-- CALENDAR (дата) -->
  <symbol id="i-calendar" viewBox="0 0 24 24">
    <rect x="4" y="5" width="16" height="15" rx="2"/>
    <path d="M8 3v4M16 3v4M4 10h16"/>
    <rect x="7"  y="13" width="2" height="2" rx=".5"/>
    <rect x="11" y="13" width="2" height="2" rx=".5"/>
    <rect x="15" y="13" width="2" height="2" rx=".5"/>
    <rect x="7"  y="17" width="2" height="2" rx=".5"/>
    <rect x="11" y="17" width="2" height="2" rx=".5"/>
    <rect x="15" y="17" width="2" height="2" rx=".5"/>
  </symbol>


<symbol id="i-edit" viewBox="0 0 24 24">
  <!-- pencil body -->
  <path d="M3 17.25V21h3.75L18.81 8.94a2.5 2.5 0 0 0 0-3.54l-.21-.21a2.5 2.5 0 0 0-3.54 0L3 17.25z"/>
  <!-- pencil tip line (optional baseline) -->
  <path d="M14.5 6.5l3 3"/>
</symbol>

</svg>
<!-- USAGE EXAMPLES (you can delete after copy) -->
<!--
<link rel="stylesheet" href="/assets/css/icons.css">
<svg class="icon"><use href="#i-plus"></use></svg>
<svg class="icon" style="color:#16a34a"><use href="#i-check"></use></svg>
<svg class="icon icon--lg" style="color:#2563eb"><use href="#i-calendar"></use></svg>
-->

</html>
