<div class="today-only-shell" data-page="today">

  <aside class="today-panel today-only" id="todayPanel">
    <div id="todayPanelInner" class="today-panel-inner">
      <header>
        <div class="today-title">Сьогодні</div>
        <div class="today-header-right"><div id="todayPanelDate" class="subtle"></div><a id="btnTodayPdf" class="icon-btn today-window-btn btn--pdf-link" href="/print/today?autoprint=1" target="_blank" rel="noopener" title="Експорт у PDF" aria-label="Експорт у PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v7H6z"></path></svg></a></div>
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
