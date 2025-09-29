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
      <!-- 1. Дата | Час -->
      <div class="row">
        <div>
          <label for="inputDate">Дата</label>
          <input id="inputDate" name="date" type="date" required>
        </div>
        <div>
          <label for="inputTime">Час</label>
          <input id="inputTime" name="time" type="time" required>
        </div>
      </div>
      <!-- 1b. Тривалість (днів, опц.) -->
      <div>
        <label for="inputSpanDays">Тривалість (днів, опц.)</label>
        <input id="inputSpanDays" name="span_days" type="number" min="0" step="1" placeholder="0 = одноденна">
        <!-- <small class="muted">0 або пусто → одноденна. N > 0 → дата завершення = дата початку + N днів.</small> -->
      </div>
<!-- 2. Назва події (повна ширина) -->
      <div>
        <label for="inputTitle">Назва події</label>
        <input id="inputTitle" name="title" type="text" placeholder="Напр., Статус-дзвінок" required>
      </div>

      <!-- 3. Опис (повна ширина, 3 рядки, закруглені кути як у input) -->
      <div>
        <label for="inputDescription">Опис</label>
        <textarea id="inputDescription" name="description" rows="3"
          placeholder="Детальний опис події..." style="border-radius:8px;"></textarea>
      </div>

      <!-- 4. Відповідальний | Тип -->
      <div class="row">
        <div>
          <label for="inputOwner">Відповідальний</label>
          <input id="inputOwner" name="owner" type="text" placeholder="Ім'я або команда">
        </div>
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

      <!-- 5. Вхідний номер | Вихідний номер -->
      <div class="row">
        <div>
          <label for="inputIncoming">Вхідний номер</label>
          <input id="inputIncoming" name="incoming_no" type="text" autocomplete="off" placeholder="Напр.: Вх-1234/09">
        </div>
        <div>
          <label for="inputOutgoing">Вихідний номер</label>
          <input id="inputOutgoing" name="outgoing_no" type="text" autocomplete="off" placeholder="Напр.: Вих-5678/09">
        </div>
      </div>

      <!-- Легенда (залишаємо у content, як у тебе було) -->
      <div class="legend" aria-hidden="true">
        <span class="lg"><i style="background:var(--type-mi)"></i>ТЛГ: МИ</span>
        <span class="lg"><i style="background:var(--type-nas)"></i>ТЛГ: НАС</span>
        <span class="lg"><i style="background:var(--type-evt)"></i>Захід</span>
        <span class="lg"><i style="background:var(--type-other)"></i>Інше</span>
      </div>
    </div>

    <footer>
      <span></span>
      <div style="display:flex; gap:10px;">
        <button type="button" class="btn" id="btnCancel">Скасувати</button>
        <button type="submit" class="btn" style="background:var(--accent);border-color:var(--accent);color:#fff">Зберегти</button>
      </div>
    </footer>
  </form>
</div>
