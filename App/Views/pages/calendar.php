<div class="layout" id="calendarLayout">
  <main class="calendar">
    <header class="cal-header">
      <div class="cal-col cal-col-left">
        <div class="heading">
          <div id="monthLabel" class="title"></div>
          <!-- <div id="todayLabel" class="subtle"></div> -->
        </div>

        <div class="nav" aria-label="Навігація календаря">
          <button id="btnPrev" class="btn">‹</button>
          <button id="btnToday" class="btn">Сьогодні</button>
          <button id="btnNext" class="btn">›</button>
          <a id="btnMonthPdf" class="btn btn--pdf-link pdf-icon-btn" href="/print/calendar-month?autoprint=1" target="_blank" rel="noopener" title="Експорт у PDF" aria-label="Експорт у PDF">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v7H6z"></path></svg>
          </a>
        </div>
      </div>

      <div class="cal-col cal-col-right">
        <div id="typeFiltersBar" class="legend type-filters" aria-label="Фільтри типів">
          <span id="btnTypeEvt"   class="lg" ><i style="background:var(--type-evt)"></i>Захід</span>
          <span id="btnTypeMi"    class="lg"><i style="background:var(--type-mi)"></i>ТЛГ: МИ</span>
          <span id="btnTypeNas"   class="lg"><i style="background:var(--type-nas)"></i>ТЛГ: НАС</span>
          <span id="btnTypeOther" class="lg"><i style="background:var(--type-other)"></i>Інше</span>
          <span id="btnTypeOverdue" class="lg ev--overdue-flash"><i style="background:var(--type-overdue);"></i>Прострочені</span>
          <span id="btnTypeAssigned" class="lg lg-scope lg-scope-assigned" title="Показати події на виконанні у мене">
            <svg class="lg-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M15.5 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="currentColor" opacity=".95"></path>
              <path d="M9.5 20.5c.5-2.8 2.8-4.8 5.9-4.8 3 0 5.2 1.8 5.8 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              <path d="M3.5 12.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              <path d="M6.5 9.5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            На виконанні
          </span>
          <span id="btnTypeMyTasks" class="lg lg-scope lg-scope-my" title="Показати мої завдання (створені мною)">
            <svg class="lg-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-user"></use></svg>
            Мої завдання
          </span>
          <span id="btnTypeReset" class="lg reset-type" title="Скинути" style="display:none">×</span>
        </div>

        <div class="filters">
          <input id="filterText" class="input ev" type="search" placeholder="Пошук: назва або відповідальний (ENTER — повний пошук)">
          <button id="btnClearFilters" class="btn">Скинути</button>
        </div>
      </div>
    </header>
    <div id="quickFilters" class="quick-filters">
      <button class="chip evt" data-type="evt" data-text="ВКЗ" type="button">ВКЗ</button>
      <button class="chip evt" data-type="evt" data-text="Селектор" type="button">Селектор</button>
      <button class="chip neutral" data-type="all" data-text="Донесення" type="button">Донесення</button>
      <button class="chip mi" data-type="mi" data-text="Доповідь" type="button">Доповідь</button>
      <button class="chip nas" data-type="nas" data-text="Донесення" type="button">Донесення</button>
      <button class="chip other" data-type="other" data-text="Інше" type="button">Інше</button>
    </div>

    <!-- Calendar full-search results (shown only on Enter) -->
    <section id="calendarSearchResults" class="calendar-search-results" hidden aria-live="polite"></section>

    <section class="weekdays" id="weekdays"></section>
    <section class="grid" id="grid" aria-live="polite"></section>

    <div class="legend">
      <span class="lg"><i style="background:var(--today)"></i>Сьогодні</span>
      <span class="lg"><i style="background:var(--type-mi)"></i>ТЛГ: МИ</span>
      <span class="lg"><i style="background:var(--type-nas)"></i>ТЛГ: НАС</span>
      <span class="lg"><i style="background:var(--type-evt)"></i>Захід</span>
      <span class="lg"><i style="background:var(--type-other)"></i>Інше</span>
      <span class="lg ev--overdue-flash"><i style="background:var(--type-overdue);"></i>Прострочені</span>
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
    <button id="todayPanelToggle" class="today-panel-toggle" type="button" aria-label="Сховати панель «Сьогодні»" title="Сховати/показати панель «Сьогодні»" aria-expanded="true"><span aria-hidden="true">›</span></button>
    <div id="todayPanelInner" class="today-panel-inner">
    <header>
      <div class="today-title">Сьогодні</div>
      <div class="today-header-right">
        <div id="todayPanelDate" class="subtle"></div>
        <button id="btnOpenTodayWindow" class="icon-btn today-window-btn" type="button"
                title="Відкрити «Сьогодні» в окремому вікні" aria-label="Відкрити «Сьогодні» в окремому вікні">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <path d="M14 3h7v7"></path>
            <path d="M10 14L21 3"></path>
            <path d="M21 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"></path>
          </svg>
        </button>
      </div>
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