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
        <div id="typeFiltersBar" class="type-filters">
          <button id="btnTypeEvt" class="tbtn evt" type="button">Захід</button>
          <button id="btnTypeMi" class="tbtn mi" type="button">ТЛГ: МИ</button>
          <button id="btnTypeNas" class="tbtn nas" type="button">ТЛГ: НАС</button>
          <button id="btnTypeOther" class="tbtn other" type="button">Інше</button>
          <button id="btnTypeReset" class="tbtn reset-type" type="button" title="Скинути" style="display:none">×</button>
        </div>
      </div>

      <div></div>
    </header>

    <div class="filters">
      <input id="filterText" class="input" type="search" placeholder="Пошук: назва або відповідальний">
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

<div id="eventOverlay" class="overlay" aria-hidden="true" role="dialog" aria-modal="true">
  <form id="eventModal" class="modal" aria-labelledby="modalTitle">
    <header>
      <div class="left">
        <div id="modalTitle">Нова подія</div>
        <label id="urgentSwitch" class="urgent-switch" title="Позначити як терміново">
          <input type="checkbox" id="inputUrgent"> Терміново
        </label>
        <label id="doneSwitch" class="urgent-switch" title="Позначити як виконано" style="margin-left:10px">
          <input type="checkbox" id="inputDone"> Виконано
        </label>
      </div>
      <button type="button" id="btnClose" class="event-del" aria-label="Закрити">×</button>
    </header>
    <div class="content">
      <div class="row">
        <div><label for="inputDate">Дата</label><input id="inputDate" name="date" type="date" required></div>
        <div><label for="inputTime">Час</label><input id="inputTime" name="time" type="time" required></div>
      </div>
      <div><label for="inputTitle">Назва події</label><input id="inputTitle" name="title" type="text" placeholder="Напр., Статус-дзвінок" required></div>
      <div class="row">
        <div><label for="inputOwner">Відповідальний</label><input id="inputOwner" name="owner" type="text" placeholder="Ім'я або команда"></div>
        <div>
          <label for="inputType">Тип</label>
          <select id="inputType" name="type" required>
            <option value="mi">ТЛГ: МИ</option>
            <option value="nas">ТЛГ: НАС</option>
            <option value="evt" selected>Захід</option>
            <option value="other">Інше</option>
          </select>
        </div>
      </div>
    </div>
    <footer>
      <div class="legend" aria-hidden="true">
        <span class="lg"><i style="background:var(--type-mi)"></i>ТЛГ: МИ</span>
        <span class="lg"><i style="background:var(--type-nas)"></i>ТЛГ: НАС</span>
        <span class="lg"><i style="background:var(--type-evt)"></i>Захід</span>
        <span class="lg"><i style="background:var(--type-other)"></i>Інше</span>
      </div>
      <div style="display:flex; gap:10px;">
        <button type="button" class="btn" id="btnCancel">Скасувати</button>
        <button type="submit" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Зберегти</button>
      </div>
    </footer>
  </form>
</div>

<div id="infoOverlay" class="overlay" aria-hidden="true" role="dialog" aria-modal="true">
  <div class="modal" aria-labelledby="infoTitle">
    <header>
      <div id="infoTitle">Деталі події</div>
      <button type="button" id="infoClose" class="event-del" aria-label="Закрити">×</button>
    </header>
    <div class="content" id="infoContent"></div>
    <footer><span></span><div style="display:flex;gap:10px;"><button type="button" id="infoOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button></div></footer>
  </div>
</div>

<button id="btnChat" class="chat-btn" title="Чат-приклад" aria-label="Чат">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
</button>
<div id="chatOverlay" class="overlay" aria-hidden="true">
  <div class="modal" style="width:min(700px,94vw)">
    <header>
      <div>Чат — приклад розшифровки «ВКЗ» за сьогодні</div>
      <button type="button" id="chatClose" class="event-del" aria-label="Закрити">×</button>
    </header>
    <div id="chatContent" class="content" style="padding-top:8px"></div>
    <footer><span></span><div style="display:flex;gap:10px;"><button id="chatOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button></div></footer>
  </div>
</div>
