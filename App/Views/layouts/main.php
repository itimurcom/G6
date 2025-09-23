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
  <?php if (!empty($extra_css)): ?>
    <?php foreach ((array)$extra_css as $href):
      if (file_exists($_SERVER['DOCUMENT_ROOT'].$href)) { ?>
        <link rel="stylesheet" href="<?= htmlspecialchars($href) ?>?v=<?= htmlspecialchars($ver ?? time()) ?>">
        <?php } else { ?>
            <script> console.log("<?= $_SERVER['DOCUMENT_ROOT'].$href?> not found"); </script>
    <?php }endforeach; ?>
  <?php endif; ?>
  
</head>
<body>
<!-- <?php if (!empty($modules_js)): ?>
  <?php foreach ((array)$modules_js as $src): 
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
  <?php foreach ((array)$extra_js as $src): 
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

<!-- EDIT in a square -->
<symbol id="i-edit-square" viewBox="0 0 24 24">
  <rect x="3" y="3" width="18" height="18" rx="2"/>
  <path d="M8 16l-1 4 4-1 7.5-7.5a2.2 2.2 0 0 0 0-3.1l-.3-.3a2.2 2.2 0 0 0-3.1 0L8 16z"/>
  <path d="M13.5 8.5l2 2"/>
</symbol>

<symbol id="i-fire-clock" viewBox="0 0 1024 1024">
  <g transform="translate(0,1024) scale(0.1,-0.1)" fill="currentColor" stroke="none">
    <path d="M8906 9990 c-3 -14 -8 -59 -11 -100 -17 -208 -99 -505 -194 -705
    -119 -248 -304 -482 -521 -658 -514 -415 -1268 -628 -2178 -615 l-213 3 49 65
    c105 140 185 312 223 477 29 130 36 355 15 513 -38 288 -134 575 -294 882 -37
    70 -69 124 -73 120 -3 -4 -14 -38 -24 -77 -70 -275 -224 -550 -422 -755 -218
    -226 -386 -328 -939 -570 -165 -72 -363 -164 -442 -205 -586 -303 -996 -669
    -1218 -1089 -48 -92 -159 -354 -152 -361 2 -2 74 13 159 34 337 85 616 116
    979 108 265 -5 411 -21 645 -68 1102 -220 2045 -937 2555 -1944 201 -395 323
    -798 377 -1245 21 -176 24 -618 5 -785 -16 -141 -57 -377 -82 -476 -11 -42
    -20 -82 -20 -87 0 -13 109 11 237 53 412 136 731 448 983 960 184 373 281 705
    375 1275 25 151 58 320 72 375 35 133 108 313 184 449 78 140 252 406 334 511
    80 102 203 222 277 269 66 42 195 96 230 96 22 0 22 1 -7 26 -16 14 -63 42
    -104 62 -70 34 -82 36 -191 40 -237 9 -447 -62 -888 -300 -114 -61 -257 -135
    -319 -164 -316 -150 -618 -200 -631 -106 -5 35 81 155 202 280 108 111 225
    210 461 389 343 260 569 494 729 753 211 341 309 693 310 1110 0 312 -52 575
    -179 902 -55 141 -197 431 -259 528 -32 50 -35 53 -40 30z"/>
    <path d="M3364 6550 c-750 -52 -1444 -359 -1986 -879 -429 -410 -734 -933
    -879 -1505 -80 -314 -121 -738 -84 -863 66 -221 347 -279 499 -102 50 59 63
    112 71 283 16 375 102 711 265 1041 233 473 589 850 1052 1115 340 195 734
    310 1126 328 469 22 872 -59 1277 -257 688 -337 1195 -961 1378 -1696 59 -238
    72 -348 72 -630 0 -282 -13 -392 -72 -629 -115 -461 -363 -890 -705 -1221
    -420 -407 -921 -648 -1497 -721 -185 -23 -552 -15 -726 15 -538 93 -987 319
    -1377 689 -49 47 -102 102 -119 123 l-30 38 80 61 c109 82 136 129 136 230 0
    86 -22 138 -78 187 -21 19 -198 100 -497 228 -518 222 -532 226 -628 185 -56
    -24 -116 -83 -138 -136 -8 -18 -14 -57 -14 -86 0 -72 106 -962 122 -1018 16
    -58 96 -141 154 -158 56 -16 127 -15 170 3 20 8 76 44 125 80 48 36 91 65 94
    65 3 0 63 -59 133 -131 150 -155 263 -254 427 -374 279 -203 606 -365 938
    -465 779 -233 1610 -163 2327 197 348 175 590 352 870 639 495 508 800 1160
    876 1875 22 206 15 585 -15 774 -54 351 -142 636 -291 940 -311 635 -814 1139
    -1445 1450 -271 134 -479 206 -757 264 -265 55 -598 79 -854 61z"/>
    <path d="M4960 4406 c-30 -13 -332 -160 -670 -326 -338 -167 -622 -302 -630
    -302 -8 1 -56 2 -107 2 l-92 1 -453 170 c-445 168 -453 171 -519 167 -197 -11
    -295 -226 -178 -387 28 -40 61 -58 458 -254 l427 -210 28 -53 c36 -68 111
    -138 184 -172 50 -24 69 -27 157 -27 77 0 111 4 145 19 77 34 137 84 184 154
    l44 67 634 360 c348 198 648 373 666 389 70 61 97 164 68 253 -48 145 -201
    211 -346 149z m-1293 -831 c86 -43 128 -117 121 -214 -8 -110 -88 -191 -198
    -199 -70 -5 -120 10 -166 51 -50 43 -74 96 -74 162 0 173 163 276 317 200z"/>
  </g>
</symbol>

<!-- USAGE EXAMPLES (you can delete after copy) -->
<!--
<link rel="stylesheet" href="/assets/css/icons.css">
<svg class="icon"><use href="#i-plus"></use></svg>
<svg class="icon" style="color:#16a34a"><use href="#i-check"></use></svg>
<svg class="icon icon--lg" style="color:#2563eb"><use href="#i-calendar"></use></svg>
-->

</html>

<script src="/js/bootstrap.csrf.js"></script>
