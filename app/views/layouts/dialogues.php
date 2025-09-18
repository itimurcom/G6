<div id="eventOverlay" class="overlay" aria-hidden="true" role="dialog" aria-modal="true">
  <form id="eventModal" class="modal" aria-labelledby="modalTitle">
    <header>
      <div class="left">
        <div id="modalTitle">Нова подія</div>
        <label id="urgentSwitch" class="urgent-switch" title="Позначити як терміново">
          <input type="checkbox" id="inputUrgent"> Терміново
        </label>
        <label id="doneSwitch" class="done-switch" title="Позначити як виконано" style="margin-left:10px">
          <input type="checkbox" id="inputDone"> Виконано
        </label>
      </div>
      <button type="button" id="btnClose" class="event-btn" aria-label="Закрити">×</button>
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
      <div>
        <button type="button" id="editEvBtn" class="event-btn" aria-label="Редагувати">
         <svg class="icon"><use href="#i-edit"></use></svg>
          <!-- &#128190; -->
        </button>
        <button type="button" id="infoClose" class="event-btn" aria-label="Закрити">×</button>
      </div>
    </header>
    <div class="content" id="infoContent"></div>
    <footer><span></span><div style="display:flex;gap:10px;"><button type="button" id="infoOk" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Закрити</button></div></footer>
  </div>
</div>
