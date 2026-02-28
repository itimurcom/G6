<?php
  // Determine current user and admin flag for inline event-thread composer in info modal.
  $me = \App\Core\Auth::user();
  $me_id = (int)($me['id'] ?? 0);
  $role = strtolower((string)($me['role'] ?? ''));
  $is_admin = in_array($role, ['admin', 'superadmin', 'root'], true) || !empty($me['is_admin']);
  $me_display = trim((string)($me['name'] ?? ''));
  if ($me_display === '') { $me_display = trim((string)($me['login'] ?? '')); }
  if ($me_display === '') { $me_display = $me_id > 0 ? ('User #' . $me_id) : 'Користувач'; }
  $me_has_avatar = !empty($me['has_avatar']);
  $me_avatar_url = (string)($me['avatar_url'] ?? '');
?>
<div id="infoOverlay" class="overlay" aria-hidden="true" role="dialog" aria-modal="true" data-current-user-id="<?= $me_id ?>" data-current-user-is-admin="<?= $is_admin ? '1' : '0' ?>" data-current-user-display="<?= htmlspecialchars($me_display, ENT_QUOTES) ?>" data-current-user-has-avatar="<?= $me_has_avatar ? '1' : '0' ?>" data-current-user-avatar-url="<?= htmlspecialchars($me_avatar_url, ENT_QUOTES) ?>">
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
<button type="button" id="editEvBtn" class="btn btn--green btn-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"></path></svg><span>Редагувати</span></button>
<?php else: ?>
<button type="button" id="editEvBtn" class="btn btn--green btn-icon" hidden aria-hidden="true" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"></path></svg><span>Редагувати</span></button>
<?php endif; ?>
<a id="infoPdfLink" class="btn btn--pdf-link pdf-icon-btn" href="#" target="_blank" rel="noopener" aria-disabled="true" title="Експорт у PDF" aria-label="Експорт у PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v7H6z"></path></svg></a>
<button type="button" id="infoOk" class="btn btn-icon" style="background:var(--accent);border-color:var(--accent);color:#fff"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg><span>Закрити</span></button></div></footer>
  </div>
</div>
