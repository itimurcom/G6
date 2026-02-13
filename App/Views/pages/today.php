<div class="today-only-shell" data-page="today">

  <aside class="today-panel today-only" id="todayPanel">
    <div id="todayPanelInner" class="today-panel-inner">
      <header>
        <div class="today-title">Сьогодні</div>
        <div id="todayPanelDate" class="subtle"></div>
      </header>

      <section id="earlyWrap" class="fold-wrap">
        <div class="fold">
          <button id="btnEarly" class="pill" type="button">До 06:00</button>
          <span id="earlyCount" class="count"></span>
        </div>
        <div id="earlyTimeline" class="timeline"></div>
      </section>

      <div class="timeline" id="todayTimeline"></div>

      <section id="lateWrap" class="fold-wrap">
        <div class="fold">
          <button id="btnLate" class="pill" type="button">Після 24:00 (завтра до 06:00)</button>
          <span id="lateCount" class="count"></span>
        </div>
        <div id="lateTimeline" class="timeline"></div>
      </section>
    </div>
  </aside>

</div>

<?php include __DIR__ . '/../layouts/modals/editEvent.php'; ?>
<?php include __DIR__ . '/../layouts/modals/infoEvent.php'; ?>
