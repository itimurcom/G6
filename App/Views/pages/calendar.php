<div class="layout">
  <main class="calendar">
    <header class="cal-header">
      <div class="heading">
        <div id="monthLabel" class="title"></div>
        <div id="todayLabel" class="subtle"></div>
      </div>

      <div class="nav-filters">
        <div class="nav">
          <button id="btnPrev" class="btn">‹</button>
          <button id="btnToday" class="btn">Сьогодні</button>
          <button id="btnNext" class="btn">›</button>
        </div>
        <!-- <div id="typeFiltersBar" class="type-filters">
          <button id="btnTypeEvt" class="tbtn evt" type="button">Захід</button>
          <button id="btnTypeMi" class="tbtn mi" type="button">ТЛГ: МИ</button>
          <button id="btnTypeNas" class="tbtn nas" type="button">ТЛГ: НАС</button>
          <button id="btnTypeOther" class="tbtn other" type="button">Інше</button>
          <button id="btnTypeReset" class="tbtn reset-type" type="button" title="Скинути" style="display:none">×</button>
        </div> -->
        <div id="typeFiltersBar" class="legend type-filters">
          <button id="btnTypeEvt"   class="lg tbtn ev" type="button"><i style="background:var(--type-evt)"></i>Захід</button>
          <button id="btnTypeMi"    class="lg tbtn ev" type="button"><i style="background:var(--type-mi)"></i>ТЛГ: МИ</button>
          <button id="btnTypeNas"   class="lg tbtn ev" type="button"><i style="background:var(--type-nas)"></i>ТЛГ: НАС</button>
          <button id="btnTypeOther" class="lg tbtn ev" type="button"><i style="background:var(--type-other)"></i>Інше</button>
          <button id="btnTypeOverdue" class="lg tbtn ev ev--overdue-flash" type="button"><i style="background:brown;"></i>Прострочені</button>
          <button id="btnTypeReset" class="lg tbtn reset-type" type="button" title="Скинути" style="display:none">×</button>
        </div>
      </div>

      <div></div>
    </header>

    <div class="filters">
      <input id="filterText" class="input ev" type="search" placeholder="Пошук: назва або відповідальний">
      <button id="btnClearFilters" class="btn">Скинути</button>
    </div>
    <div id="quickFilters" class="quick-filters">
      <button class="chip evt" data-type="evt" data-text="ВКЗ" type="button">ВКЗ</button>
      <button class="chip evt" data-type="evt" data-text="Селектор" type="button">Селектор</button>
      <button class="chip neutral" data-type="all" data-text="Донесення" type="button">Донесення</button>
      <button class="chip mi" data-type="mi" data-text="Доповідь" type="button">Доповідь</button>
      <button class="chip nas" data-type="nas" data-text="Донесення" type="button">Донесення</button>
      <button class="chip other" data-type="other" data-text="Інше" type="button">Інше</button>
    </div>

    <section class="weekdays" id="weekdays"></section>
    <section class="grid" id="grid" aria-live="polite"></section>

    <div class="legend">
      <span class="lg"><i style="background:var(--today)"></i>Сьогодні</span>
      <span class="lg"><i style="background:var(--type-mi)"></i>ТЛГ: МИ</span>
      <span class="lg"><i style="background:var(--type-nas)"></i>ТЛГ: НАС</span>
      <span class="lg"><i style="background:var(--type-evt)"></i>Захід</span>
      <span class="lg"><i style="background:var(--type-other)"></i>Інше</span>
      <span class="lg ev--overdue-flash"><i style="background:brown;"></i>Прострочені</span>
      <span class="subtle" style="margin-left:auto">Клік по вільному місцю дня — додати; перетягни картку, щоб перенести</span>
    </div>

    <div class="bottom-actions" aria-label="Файлові дії">
      <button id="btnExport" class="icon-btn" title="Записати JSON" aria-label="Записати JSON">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 14 12 9 17 14"></polyline>
          <line x1="12" y1="9" x2="12" y2="21"></line>
        </svg>
      </button>
      <button id="btnImport" class="icon-btn" title="Зчитати JSON" aria-label="Зчитати JSON">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </button>
    </div>
  </main>

  <aside class="today-panel" id="todayPanel">
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
  </aside>
</div>

<input id="filePicker" type="file" accept="application/json,.json" style="display:none" />

<button id="btnChat" class="chat-btn" title="Чат-приклад" aria-label="Чат">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
</button>
<div id="chatOverlay" class="overlay" aria-hidden="true">
  <div class="modal" style="width:min(700px,94vw)">
    <header>
      <div>Чат — приклад розшифровки «ВКЗ» за сьогодні</div>
      <button type="button" id="chatClose" class="event-btn" aria-label="Закрити">×</button>
    </header>
    <div id="chatContent" class="content" style="padding-top:8px"></div>
    <footer><span></span><div style="display:flex;gap:10px;"><button id="chatOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button></div></footer>
  </div>
</div>

<? include __DIR__ . '/../layouts/modals/editEvent.php'; ?>
<? include __DIR__ . '/../layouts/modals/infoEvent.php'; ?>