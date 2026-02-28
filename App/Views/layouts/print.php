<!doctype html>
<html lang="uk" data-ui-font="inter">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= isset($title) ? htmlspecialchars($title, ENT_QUOTES) : 'PDF export' ?></title>
  <link rel="stylesheet" href="/assets/css/style.css?v=<?= time() ?>">
  <link rel="stylesheet" href="/assets/css/icons.css?v=<?= time() ?>">
  <link rel="stylesheet" href="/assets/css/pdf-export.css?v=<?= time() ?>">
</head>
<body class="print-doc print-doc--<?= htmlspecialchars($doc_mode ?? 'generic', ENT_QUOTES) ?>">
<?php
  $viewsRoot   = dirname(__DIR__);
  $icons = $viewsRoot . '/layouts/partials/icons.php';
  if (is_file($icons)) { include $icons; }
?>
  <div class="print-shell">
    <div class="print-toolbar" data-print-toolbar>
      <div class="print-toolbar__meta">
        <strong><?= htmlspecialchars($doc_title ?? 'Документ', ENT_QUOTES) ?></strong>
        <span><?= htmlspecialchars($doc_subtitle ?? '', ENT_QUOTES) ?></span>
      </div>
      <div class="print-toolbar__actions">
        <button type="button" class="btn btn--print-primary" data-print-now>
          <svg class="event-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v7H6z"></path></svg>
          Друк / PDF
        </button>
        <button type="button" class="btn btn--print-secondary" data-close-window>Закрити</button>
      </div>
    </div>

    <article class="print-paper">
      <?= $content ?? '' ?>
    </article>
  </div>

  <script>
    (function(){
      var printBtn = document.querySelector('[data-print-now]');
      var closeBtn = document.querySelector('[data-close-window]');
      if (printBtn) printBtn.addEventListener('click', function(){ window.print(); });
      if (closeBtn) closeBtn.addEventListener('click', function(){
        try { window.close(); } catch(e) {}
        try { history.back(); } catch(e) {}
      });
      var auto = <?= !empty($autoprint) ? 'true' : 'false' ?>;
      if (auto) {
        window.addEventListener('load', function(){ setTimeout(function(){ try { window.print(); } catch(e) {} }, 120); }, { once:true });
      }
    })();
  </script>
</body>
</html>
