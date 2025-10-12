<div class="title">Планування</div>
<section>
  <div class="planning-toolbar" id="planning-toolbar">
    <label><input type="radio" name="planning-scope" value="all" checked> Всі задачі</label>
    <label><input type="radio" name="planning-scope" value="my"> Мої задачі</label>
  </div>
  <section id="planning-today" data-user-id="<?= (int)($_SESSION['user_id'] ?? 0) ?>"></section>
</section>
    <div class="legend">
      <span class="lg"><i style="background:var(--today)"></i>Сьогодні</span>
      <span class="lg"><i style="background:var(--type-mi)"></i>ТЛГ: МИ</span>
      <span class="lg"><i style="background:var(--type-nas)"></i>ТЛГ: НАС</span>
      <span class="lg"><i style="background:var(--type-evt)"></i>Захід</span>
      <span class="lg"><i style="background:var(--type-other)"></i>Інше</span>
      <span class="lg ev--overdue-flash"><i style="background:brown;"></i>Прострочені</span>
    </div>
<? include ("/var/www/html/calendar.localhost/App/Views/layouts/modals/editEvent.php"); ?>
<? include ("/var/www/html/calendar.localhost/App/Views/layouts/modals/infoEvent.php"); ?>