(function () {
  'use strict';

  const app = document.getElementById('eventThreadApp');
  if (!app) return;

  const eventId = String(app.dataset.eventId || '').trim();
  if (!eventId) return;

  const currentUserId = parseInt(app.dataset.currentUserId || '0', 10) || 0;
  const currentUserIsAdmin = String(app.dataset.currentUserIsAdmin || '') === '1';
  const currentUserDisplay = String(app.dataset.currentUserDisplay || '').trim() || 'Користувач';

  const els = {
    status: document.getElementById('eventThreadStatus'),
    list: document.getElementById('eventThreadList'),
    textarea: document.getElementById('eventThreadTextarea'),
    submit: document.getElementById('eventThreadSubmitBtn'),
    attach: document.getElementById('eventThreadAttachmentBtn'),
    composer: document.getElementById('eventThreadComposer'),
    composerAvatar: document.getElementById('eventThreadComposerAvatar'),
    countBadge: document.getElementById('eventThreadCountBadge')
  };

  const state = {
    items: [],
    loading: false,
    saving: false,
    editingId: 0,
    editingText: ''
  };

  function initials(value) {
    const src = String(value || '').trim();
    if (!src) return '??';
    const parts = src.split(/\s+/).filter(Boolean);
    if (!parts.length) return '??';
    const first = Array.from(parts[0])[0] || '';
    const second = parts.length > 1 ? (Array.from(parts[1])[0] || '') : (Array.from(parts[0])[1] || '');
    return (first + second).toUpperCase() || '??';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateTime(value) {
    const src = String(value || '').trim();
    if (!src) return '—';
    const normalized = src.replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return src;
    try {
      return new Intl.DateTimeFormat('uk-UA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (_) {
      return src;
    }
  }

  function setStatus(message, type) {
    if (!els.status) return;
    const text = String(message || '').trim();
    if (!text) {
      els.status.hidden = true;
      els.status.textContent = '';
      els.status.classList.remove('is-error', 'is-success');
      return;
    }
    els.status.hidden = false;
    els.status.textContent = text;
    els.status.classList.toggle('is-error', type === 'error');
    els.status.classList.toggle('is-success', type === 'success');
  }

  function setComposerBusy(isBusy) {
    state.saving = !!isBusy;
    if (els.composer) els.composer.classList.toggle('is-busy', state.saving);
    if (els.submit) els.submit.disabled = state.saving;
    if (els.textarea) els.textarea.disabled = state.saving;
  }

  function canManage(item) {
    const authorId = parseInt(item && item.user_id ? item.user_id : 0, 10) || 0;
    return !!(currentUserIsAdmin || (currentUserId > 0 && authorId === currentUserId));
  }

  async function fetchJSON(url, init) {
    const response = await fetch(url, Object.assign({ credentials: 'same-origin' }, init || {}));
    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }
    if (!response.ok || !data || data.ok === false) {
      const message = data && (data.message || data.error) ? (data.message || data.error) : ('HTTP ' + response.status);
      throw new Error(String(message));
    }
    return data;
  }

  function updateCountBadge() {
    if (!els.countBadge) return;
    els.countBadge.textContent = 'Повідомлень: ' + state.items.length;
  }

  function renderEmptyState() {
    return [
      '<div class="event-thread__empty-live">',
      '<div class="event-thread__empty-live-title">Поки немає повідомлень</div>',
      '<div class="event-thread__empty-text">Почни переписку по задачі з першого повідомлення. Тут будуть показуватись аватар, автор, дата, текст, редагування та видалення.</div>',
      '</div>'
    ].join('');
  }

  function renderItem(item) {
    const author = item && item.author ? item.author : {};
    const display = String(author.display || author.name || author.login || ('User #' + (item.user_id || 0)));
    const avatar = initials(display);
    const itemId = parseInt(item.id || 0, 10) || 0;
    const isMine = currentUserId > 0 && parseInt(item.user_id || 0, 10) === currentUserId;
    const isEditing = state.editingId === itemId;
    const canEdit = canManage(item);
    const edited = !!item.edited_at;

    const classes = ['event-message'];
    if (isMine) classes.push('event-message--mine');
    if (isEditing) classes.push('is-editing');

    const actions = canEdit
      ? [
          '<div class="event-message__actions">',
          isEditing
            ? ''
            : '<button type="button" class="btn btn--ghost event-message__action" data-action="edit" data-id="' + itemId + '"><svg class="event-ui-icon" aria-hidden="true"><use href="#i-edit"></use></svg><span>Редагувати</span></button>',
          isEditing
            ? ''
            : '<button type="button" class="btn btn--danger event-message__action event-message__action--danger" data-action="delete" data-id="' + itemId + '"><svg class="event-ui-icon" aria-hidden="true"><use href="#i-trash"></use></svg><span>Видалити</span></button>',
          '</div>'
        ].join('')
      : '';

    const body = isEditing
      ? [
          '<div class="event-message__editor">',
          '<textarea rows="5" maxlength="20000" data-role="edit-text" data-id="' + itemId + '">' + esc(state.editingText) + '</textarea>',
          '<div class="event-message__editor-actions">',
          '<button type="button" class="btn btn--primary" data-action="save-edit" data-id="' + itemId + '"><svg class="event-ui-icon" aria-hidden="true"><use href="#i-check"></use></svg><span>Зберегти</span></button>',
          '<button type="button" class="btn btn--ghost" data-action="cancel-edit" data-id="' + itemId + '"><svg class="event-ui-icon" aria-hidden="true"><use href="#i-x"></use></svg><span>Скасувати</span></button>',
          '</div>',
          '</div>'
        ].join('')
      : '<div class="event-message__text">' + esc(item.message_text || '') + '</div>';

    return [
      '<article class="' + classes.join(' ') + '" data-message-id="' + itemId + '">',
      '<div class="event-message__avatar">' + esc(avatar) + '</div>',
      '<div class="event-message__bubble">',
      '<div class="event-message__meta">',
      '<span class="event-message__author">' + esc(display) + '</span>',
      '<time class="event-message__time" datetime="' + esc(item.created_at || '') + '">' + esc(formatDateTime(item.created_at)) + '</time>',
      edited ? '<span class="event-message__edited">відредаговано</span>' : '',
      actions,
      '</div>',
      body,
      '</div>',
      '</article>'
    ].join('');
  }

  function render() {
    updateCountBadge();
    if (!els.list) return;
    if (!state.items.length) {
      els.list.innerHTML = renderEmptyState();
      return;
    }
    els.list.innerHTML = state.items.map(renderItem).join('');
    if (state.editingId > 0) {
      const input = els.list.querySelector('[data-role="edit-text"][data-id="' + state.editingId + '"]');
      if (input) {
        input.focus();
        try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
      }
    }
  }

  async function loadMessages() {
    if (state.loading) return;
    state.loading = true;
    setStatus('Завантаження повідомлень...', '');
    try {
      const data = await fetchJSON('/api/event-messages/list?event_id=' + encodeURIComponent(eventId));
      state.items = Array.isArray(data.items) ? data.items : [];
      render();
      setStatus(state.items.length ? '' : 'Повідомлень ще немає. Можна залишити перше повідомлення.', 'success');
      if (!state.items.length) {
        setTimeout(function () {
          if (state.items.length === 0) setStatus('', '');
        }, 2500);
      }
    } catch (error) {
      setStatus('Не вдалося завантажити повідомлення: ' + error.message, 'error');
      render();
    } finally {
      state.loading = false;
    }
  }

  async function createMessage() {
    if (!els.textarea || state.saving) return;
    const messageText = String(els.textarea.value || '').replace(/\r\n?/g, '\n').trim();
    if (!messageText) {
      setStatus('Введи текст повідомлення.', 'error');
      els.textarea.focus();
      return;
    }
    setComposerBusy(true);
    setStatus('Збереження повідомлення...', '');
    try {
      const data = await fetchJSON('/api/event-messages/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, message_text: messageText })
      });
      const row = data && data.message ? data.message : null;
      if (row) {
        state.items = state.items.concat([row]);
        els.textarea.value = '';
        render();
        setStatus('Повідомлення додано.', 'success');
        setTimeout(function(){ setStatus('', ''); }, 1800);
      } else {
        throw new Error('Порожня відповідь сервера');
      }
    } catch (error) {
      setStatus('Не вдалося додати повідомлення: ' + error.message, 'error');
    } finally {
      setComposerBusy(false);
    }
  }

  function startEdit(id) {
    const item = state.items.find(function (x) { return parseInt(x.id || 0, 10) === id; });
    if (!item || !canManage(item)) return;
    state.editingId = id;
    state.editingText = String(item.message_text || '');
    render();
  }

  function cancelEdit() {
    state.editingId = 0;
    state.editingText = '';
    render();
  }

  async function saveEdit(id) {
    if (state.saving) return;
    const input = els.list ? els.list.querySelector('[data-role="edit-text"][data-id="' + id + '"]') : null;
    const messageText = String(input ? input.value : state.editingText).replace(/\r\n?/g, '\n').trim();
    if (!messageText) {
      setStatus('Текст повідомлення не може бути порожнім.', 'error');
      if (input) input.focus();
      return;
    }
    state.saving = true;
    render();
    setStatus('Збереження змін...', '');
    try {
      const data = await fetchJSON('/api/event-messages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, message_text: messageText })
      });
      const row = data && data.message ? data.message : null;
      if (!row) throw new Error('Порожня відповідь сервера');
      state.items = state.items.map(function (item) {
        return parseInt(item.id || 0, 10) === id ? row : item;
      });
      state.editingId = 0;
      state.editingText = '';
      render();
      setStatus('Повідомлення відредаговано.', 'success');
      setTimeout(function(){ setStatus('', ''); }, 1800);
    } catch (error) {
      setStatus('Не вдалося відредагувати повідомлення: ' + error.message, 'error');
    } finally {
      state.saving = false;
      render();
    }
  }

  async function deleteMessage(id) {
    const item = state.items.find(function (x) { return parseInt(x.id || 0, 10) === id; });
    if (!item || !canManage(item)) return;
    if (!window.confirm('Видалити це повідомлення?')) return;
    state.saving = true;
    render();
    setStatus('Видалення повідомлення...', '');
    try {
      await fetchJSON('/api/event-messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      state.items = state.items.filter(function (row) {
        return parseInt(row.id || 0, 10) !== id;
      });
      if (state.editingId === id) {
        state.editingId = 0;
        state.editingText = '';
      }
      render();
      setStatus('Повідомлення видалено.', 'success');
      setTimeout(function(){ setStatus('', ''); }, 1800);
    } catch (error) {
      setStatus('Не вдалося видалити повідомлення: ' + error.message, 'error');
    } finally {
      state.saving = false;
      render();
    }
  }

  if (els.composerAvatar) {
    els.composerAvatar.textContent = initials(currentUserDisplay);
  }

  if (els.submit) {
    els.submit.addEventListener('click', function () {
      createMessage();
    });
  }

  if (els.textarea) {
    els.textarea.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        ev.preventDefault();
        createMessage();
      }
    });
  }

  if (els.list) {
    els.list.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      const action = String(btn.dataset.action || '');
      const id = parseInt(btn.dataset.id || '0', 10) || 0;
      if (id <= 0) return;
      if (action === 'edit') {
        startEdit(id);
      } else if (action === 'cancel-edit') {
        cancelEdit();
      } else if (action === 'save-edit') {
        saveEdit(id);
      } else if (action === 'delete') {
        deleteMessage(id);
      }
    });

    els.list.addEventListener('input', function (ev) {
      const input = ev.target.closest('[data-role="edit-text"]');
      if (!input) return;
      const id = parseInt(input.dataset.id || '0', 10) || 0;
      if (id > 0 && state.editingId === id) {
        state.editingText = String(input.value || '');
      }
    });
  }

  loadMessages();
})();
