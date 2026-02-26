<?php
  // Determine current user and admin flag for inline event-thread composer in info modal.
  $me = \App\Core\Auth::user();
  $me_id = (int)($me['id'] ?? 0);
  $role = strtolower((string)($me['role'] ?? ''));
  $is_admin = in_array($role, ['admin', 'superadmin', 'root'], true) || !empty($me['is_admin']);
  $me_display = trim((string)($me['name'] ?? ''));
  if ($me_display === '') { $me_display = trim((string)($me['login'] ?? '')); }
  if ($me_display === '') { $me_display = $me_id > 0 ? ('User #' . $me_id) : 'Користувач'; }
?>
<div id="infoOverlay" class="overlay" aria-hidden="true" role="dialog" aria-modal="true" data-current-user-id="<?= $me_id ?>" data-current-user-is-admin="<?= $is_admin ? '1' : '0' ?>" data-current-user-display="<?= htmlspecialchars($me_display, ENT_QUOTES) ?>">
  <div class="modal" aria-labelledby="infoTitle">
    <!-- [DEFERRED] Delete control moved to edit modal (#btnDelete). Keep legacy #deleteEvBtn hidden to avoid duplicate controls. -->
    <style>#deleteEvBtn{display:none !important;}</style>
    <header>
      <div id="infoTitle">Деталі події</div>
      <div>
        <button type="button" id="infoClose" class="event-btn" aria-label="Закрити">×</button>
      </div>
    </header>
    <div class="content" id="infoContent"></div>
    <footer><span></span><div style="display:flex;gap:10px;flex-wrap:wrap;"><?php if ($is_admin): ?>
<button type="button" id="editEvBtn" class="btn btn--green">редагувати</button>
<?php else: ?>
<button type="button" id="editEvBtn" class="btn btn--green" hidden aria-hidden="true" tabindex="-1">редагувати</button>
<?php endif; ?>
<button type="button" id="infoOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button></div></footer>
  </div>
</div>
