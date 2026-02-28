<div id="eventOverlay" class="overlay" aria-hidden="true" role="dialog" aria-modal="true">
  <form id="eventModal" class="modal" aria-labelledby="modalTitle">
    <header>
      <div class="left">
        <div id="modalTitle">Нова подія</div>
      </div>
      <button type="button" id="btnClose" class="event-btn" aria-label="Закрити">×</button>
    </header>

    <div class="content">
      <!-- 1. Дата | Дні | Час -->
      <div class="row col3">
        <div>
          <label for="inputDate">Дата</label>
          <input id="inputDate" name="date" type="date" required>
        </div>
      <div>
        <label for="inputSpanDays">Тривалість (днів, опц.)</label>
        <input id="inputSpanDays" name="span_days" type="number" min="1" step="1" placeholder="1 = одноденна">
      </div>
        <div>
          <label for="inputTime">Час</label>
          <input id="inputTime" name="time" type="time" required>
        </div>
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
          <div class="owner-autocomplete">
            <input id="inputOwner" name="owner" type="text" placeholder="Ім'я (login) або довільний текст" autocomplete="off">
            <input id="inputOwnerUserId" name="owner_user_id" type="hidden" value="">
            <div id="ownerSuggest" class="owner-suggest" hidden></div>
          </div>
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
    </div>

    <footer>
      
      <div class="footer-switches" style="display:flex; gap:10px; align-items:center;">
        <label id="urgentSwitch" class="urgent-switch" title="Позначити як терміново">
          <input type="checkbox" id="inputUrgent"> Терміново
        </label>
        <label id="doneSwitch" class="done-switch" title="Позначити як виконано">
          <input type="checkbox" id="inputDone"> Виконано
        </label>
      </div>
      <div style="display:flex; gap:10px;">
        <button type="button" class="btn btn-icon" id="btnDelete" style="background:#ef4444;border-color:#ef4444;color:#fff" hidden aria-hidden="true" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg><span>Видалити</span></button>
        <button type="button" class="btn btn-icon" id="btnCancel" style="background:#3b82f6;border-color:#3b82f6;color:#fff"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg><span>Скасувати</span></button>
        <button type="submit" class="btn btn-icon" style="background:#22c55e;border-color:#22c55e;color:#fff"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"></path></svg><span>Зберегти</span></button>
      </div>
    </footer>
  </form>
</div>
