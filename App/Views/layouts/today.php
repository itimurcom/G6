<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= isset($title) ? htmlspecialchars($title) : 'Сьогодні' ?></title>

<?php
  \App\Security\Csrf::ensureToken();
  $__csrf = \App\Security\Csrf::token();
?>
<meta name="csrf-token" content="<?= htmlspecialchars($__csrf, ENT_QUOTES) ?>">


  <!-- Base UI styles -->
  <script>
    (function () {
      try {
        var v = localStorage.getItem('ui-font-scale');
        if (v) document.documentElement.style.setProperty('--font-scale', v);
      } catch (e) { /* no-op */ }

      try {
        var f = (localStorage.getItem('ui-font-family') || 'inter').toLowerCase();
        if (['inter','sfpro','arial'].indexOf(f) === -1) f = 'inter';
        document.documentElement.setAttribute('data-ui-font', f);
      } catch (e) { /* no-op */ }
    })();
  </script>
  <link rel="stylesheet" href="/assets/css/style.css">

  <?php if (!empty($extra_css)): ?>
    <?php foreach ((array)$extra_css as $href): ?>
      <?php if (file_exists($_SERVER['DOCUMENT_ROOT'].$href)) { ?>
        <link rel="stylesheet" href="<?= htmlspecialchars($href) ?>?v=<?= htmlspecialchars($ver ?? time()) ?>">
      <?php } ?>
    <?php endforeach; ?>
  <?php endif; ?>

  <!-- G6 favicons (server default, JS will live-swap) -->
  <link id="g6-fav-16" rel="icon" type="image/png" sizes="16x16" href="/assets/favicon/light/favicon-16x16.png">
  <link id="g6-fav-32" rel="icon" type="image/png" sizes="32x32" href="/assets/favicon/light/favicon-32x32.png">

  <script>
    (function(){
      var MAP = {
        light: { f16: "/assets/favicon/light/favicon-16x16.png", f32: "/assets/favicon/light/favicon-32x32.png" },
        dark:  { f16: "/assets/favicon/dark/favicon-16x16.png",  f32: "/assets/favicon/dark/favicon-32x32.png"  }
      };
      function getTheme() {
        var de = document.documentElement;
        if (de.dataset && de.dataset.theme) return de.dataset.theme;
        if (de.classList && de.classList.contains('dark')) return 'dark';
        return 'light';
      }
      function g6FavApply(){
        var t = getTheme(), m = MAP[t] || MAP.light;
        var l16 = document.getElementById('g6-fav-16');
        var l32 = document.getElementById('g6-fav-32');
        if (l16) l16.href = m.f16;
        if (l32) l32.href = m.f32;
      }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', g6FavApply, {once:true});
      else g6FavApply();
      var mo = new MutationObserver(g6FavApply);
      mo.observe(document.documentElement, {attributes:true, attributeFilter:['class','data-theme']});
      window.addEventListener('themechange', g6FavApply);
      if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: dark)');
        if (mq.addEventListener) mq.addEventListener('change', g6FavApply);
        else if (mq.addListener) mq.addListener(g6FavApply);
      }
      window.g6FavApply = g6FavApply;
    })();
  </script>
</head>

<body>
  <?php
  // Inline SVG sprite partial (для <use href="#id">)
  $viewsRoot   = dirname(__DIR__);          // App/Views
  $partialsDir = $viewsRoot . '/layouts/partials';
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
