<header class="cal-header">
<div class="title">Планування</div>
<section>
    <div class="legend">
      <!-- <span class="lg"><i style="background:var(--today)"></i>Сьогодні</span> -->
      <span class="lg"><i style="background:var(--type-mi)"></i>ТЛГ: МИ</span>
      <span class="lg"><i style="background:var(--type-nas)"></i>ТЛГ: НАС</span>
      <span class="lg"><i style="background:var(--type-evt)"></i>Захід</span>
      <span class="lg"><i style="background:var(--type-other)"></i>Інше</span>
      <span class="lg ev--overdue-flash"><i style="background:var(--type-overdue);"></i>Прострочені</span>
    </div>
</section>
</header>
<?php
  $___planningMe = \App\Core\Auth::user() ?? [];
  $___planningRole = mb_strtolower((string)($___planningMe['role'] ?? ''));
  $___planningIsAdmin = (($___planningMe['is_admin'] ?? false) === true)
      || ((int)($___planningMe['is_admin'] ?? 0) === 1)
      || in_array($___planningRole, ['admin', 'superadmin', 'root'], true);
?>
<section>
  <div class="planning-toolbar" id="planning-toolbar" data-is-admin="<?= $___planningIsAdmin ? '1' : '0' ?>">
    <label><input type="radio" name="planning-scope" value="exec" checked>
      <svg class="planning-scope-ico planning-scope-ico--assigned" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M15.5 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="currentColor" opacity=".95"></path>
        <path d="M9.5 20.5c.5-2.8 2.8-4.8 5.9-4.8 3 0 5.2 1.8 5.8 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M3.5 12.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        <path d="M6.5 9.5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
      На виконанні
    </label>
    <label><input type="radio" name="planning-scope" value="my">
      <svg class="planning-scope-ico planning-scope-ico--my" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-user"></use></svg>
      Мої задачі
    </label>
    <?php if ($___planningIsAdmin): ?>
    <label><input type="radio" name="planning-scope" value="all"> Всі задачі</label>
    <?php endif; ?>
    <a id="btnPlanningPdf" class="btn btn--pdf-link pdf-icon-btn" href="/print/planning?scope=exec&amp;autoprint=1" target="_blank" rel="noopener" title="Експорт у PDF" aria-label="Експорт у PDF">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v7H6z"></path></svg>
    </a>
  </div>
  <section
    id="planning-today"
    data-user-id="<?= (int)($_SESSION['user_id'] ?? 0) ?>"
    data-user-login="<?= htmlspecialchars((string)((($_SESSION['user']['login'] ?? '') ?: ($_SESSION['user_login'] ?? ''))), ENT_QUOTES, 'UTF-8') ?>"
    data-user-is-admin="<?= $___planningIsAdmin ? '1' : '0' ?>"
  ></section>
</section>
<?php include __DIR__ . '/../layouts/modals/editEvent.php'; ?>
<?php include __DIR__ . '/../layouts/modals/infoEvent.php'; ?>