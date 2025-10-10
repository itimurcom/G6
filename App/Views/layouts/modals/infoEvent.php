<div id="infoOverlay" class="overlay" aria-hidden="true" role="dialog" aria-modal="true">
  <div class="modal" aria-labelledby="infoTitle">
    <header>
      <div id="infoTitle">Деталі події</div>
      <div>
        <?php
  // Determine current user and admin flag
  $me = \App\Core\Auth::user();
  $me_id = (int)($me['id'] ?? 0);
  $role = strtolower((string)($me['role'] ?? ''));
  $is_admin = ($role === 'admin') || !empty($me['is_admin']);
?><?php if ($is_admin): ?>
        <button type="button" id="editEvBtn" class="event-btn" aria-label="Редагувати">
          <svg class="icon"><use href="#i-edit"></use></svg>
        </button>
<?php else: ?>
        <!-- Non-admin: keep button in DOM, but hidden by default;
             JS will unhide for the owner (user_id === me.id) -->
        <button type="button" id="editEvBtn" class="event-btn" aria-label="Редагувати" hidden aria-hidden="true" tabindex="-1">
          <svg class="icon"><use href="#i-edit"></use></svg>
        </button>
<?php endif; ?>
        <button type="button" id="infoClose" class="event-btn" aria-label="Закрити">×</button>
      </div>
    </header>
    <div class="content" id="infoContent"></div>
    <footer><span></span><div style="display:flex;gap:10px;"><button type="button" id="infoOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button></div></footer>
  </div>
</div>
