<div class="title">Планування</div>
<section>
  <div class="planning-toolbar" id="planning-toolbar">
    <label><input type="radio" name="planning-scope" value="all" checked> Всі задачі</label>
    <label><input type="radio" name="planning-scope" value="my"> Мої задачі</label>
  </div>
  <section id="planning-today" data-user-id="<?= (int)($_SESSION['user_id'] ?? 0) ?>"></section>
</section>
<? include ("/var/www/html/calendar.localhost/App/Views/layouts/modals/editEvent.php"); ?>
<? include ("/var/www/html/calendar.localhost/App/Views/layouts/modals/infoEvent.php"); ?>