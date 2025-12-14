<div id="infoOverlay" class="overlay" aria-hidden="true" role="dialog" aria-modal="true">
  <div class="modal" aria-labelledby="infoTitle">
    <!-- [DEFERRED] Delete control moved to edit modal (#btnDelete). Keep legacy #deleteEvBtn hidden to avoid duplicate controls. -->
    <style>#deleteEvBtn{display:none !important;}</style>
    <header>
      <div id="infoTitle">Деталі події</div>
      <div>
        <?php
  // Determine current user and admin flag
  $me = \App\Core\Auth::user();
  $me_id = (int)($me['id'] ?? 0);
  $role = strtolower((string)($me['role'] ?? ''));
  $is_admin = ($role === 'admin') || !empty($me['is_admin']);
?>
        <button type="button" id="infoClose" class="event-btn" aria-label="Закрити">×</button>
      </div>
    </header>
    <div class="content" id="infoContent"></div>
    <footer><span></span><div style="display:flex;gap:10px;"><?php if ($is_admin): ?>
<button type="button" id="editEvBtn" class="btn btn--green">редагувати</button>
<?php else: ?>
<button type="button" id="editEvBtn" class="btn btn--green" hidden aria-hidden="true" tabindex="-1">редагувати</button>
<?php endif; ?>
<button type="button" id="infoOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button></div></footer>
  </div>
</div>