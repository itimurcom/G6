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
