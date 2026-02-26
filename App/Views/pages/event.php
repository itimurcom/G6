<?php
$event = $event ?? null;
$eventTitle = $event_title ?? 'Лист події';
$passportRows = is_array($passport_rows ?? null) ? $passport_rows : [];
$badges = is_array($event_badges ?? null) ? $event_badges : [];
$missingMessage = (string)($event_missing_message ?? '');
$missingDetails = (string)($event_missing_details ?? '');
$description = (string)($event_description ?? '');
$messageTotal = (int)($message_total ?? 0);
$threadBackendReady = !empty($thread_backend_ready);
$eventId = (string)($event_id ?? ($event['id'] ?? ''));
$threadCurrentUser = is_array($thread_current_user ?? null) ? $thread_current_user : [];
$currentUserId = (int)($threadCurrentUser['id'] ?? 0);
$currentUserDisplay = trim((string)($threadCurrentUser['display'] ?? ''));
$currentUserName = trim((string)($threadCurrentUser['name'] ?? ''));
$currentUserLogin = trim((string)($threadCurrentUser['login'] ?? ''));
$currentUserIsAdmin = !empty($threadCurrentUser['is_admin']);
$currentUserHasAvatar = !empty($threadCurrentUser['has_avatar']);
$currentUserAvatarUrl = (string)($threadCurrentUser['avatar_url'] ?? '');
?>

<div class="event-sheet">
  <header class="event-sheet__header">
    <div class="event-sheet__headings">
      <div class="event-sheet__eyebrow">Лист події</div>
      <h1 class="event-sheet__title"><?= htmlspecialchars($eventTitle, ENT_QUOTES, 'UTF-8') ?></h1>
      <?php if ($event): ?>
        <div class="event-sheet__meta-line">
          <span class="event-sheet__meta-item">Тип: <?= htmlspecialchars((string)($event_type_label ?? '—'), ENT_QUOTES, 'UTF-8') ?></span>
          <span class="event-sheet__dot">•</span>
          <span class="event-sheet__meta-item">Автор: <?= htmlspecialchars((string)($event_author_name ?? '—'), ENT_QUOTES, 'UTF-8') ?></span>
          <span class="event-sheet__dot">•</span>
          <span class="event-sheet__meta-item">Створено: <?= htmlspecialchars((string)($event_created_human ?? '—'), ENT_QUOTES, 'UTF-8') ?></span>
        </div>
      <?php endif; ?>
    </div>

    <div class="event-sheet__actions">
      <a class="btn" href="/calendar">Календар</a>
      <a class="btn" href="/">Планування</a>
    </div>
  </header>

  <?php if (!$event): ?>
    <section class="event-card event-card--missing">
      <div class="event-card__title">Лист події недоступний</div>
      <p class="event-card__text"><?= htmlspecialchars($missingMessage !== '' ? $missingMessage : 'Подію не вдалося відкрити.', ENT_QUOTES, 'UTF-8') ?></p>
      <?php if ($missingDetails !== ''): ?>
        <p class="event-card__hint"><?= htmlspecialchars($missingDetails, ENT_QUOTES, 'UTF-8') ?></p>
      <?php endif; ?>
    </section>
  <?php else: ?>
    <section class="event-card event-card--summary">
      <div class="event-card__summary-top">
        <div class="event-sheet__badges">
          <?php foreach ($badges as $badge): ?>
            <?php $badgeKey = (string)($badge['key'] ?? 'neutral'); ?>
            <span class="event-badge event-badge--<?= htmlspecialchars($badgeKey, ENT_QUOTES, 'UTF-8') ?>">
              <?= htmlspecialchars((string)($badge['label'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
            </span>
          <?php endforeach; ?>
        </div>
        <div class="event-sheet__identity">ID: <code><?= htmlspecialchars((string)($event['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?></code></div>
      </div>

      <div class="event-card__description">
        <?php if ($description !== ''): ?>
          <?= nl2br(htmlspecialchars($description, ENT_QUOTES, 'UTF-8')) ?>
        <?php else: ?>
          <span class="event-card__hint">Опис події поки відсутній.</span>
        <?php endif; ?>
      </div>
    </section>

    <section class="event-card">
      <div class="event-card__head">
        <div>
          <h2 class="event-card__title">Паспорт події</h2>
          <p class="event-card__hint">Верхній блок окремого листа події. Тут зібрані основні реквізити задачі.</p>
        </div>
      </div>

      <div class="event-passport">
        <table class="event-passport__table">
          <tbody>
          <?php foreach ($passportRows as $row): ?>
            <tr>
              <th><?= htmlspecialchars((string)($row['label'] ?? ''), ENT_QUOTES, 'UTF-8') ?></th>
              <td><?= nl2br(htmlspecialchars((string)($row['value'] ?? '—'), ENT_QUOTES, 'UTF-8')) ?></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </section>

    <section class="event-card event-thread">
      <div class="event-card__head">
        <div>
          <h2 class="event-card__title">Повідомлення по події</h2>
          <p class="event-card__hint">Робоча переписка по задачі: повідомлення, редагування, видалення та позначка «відредаговано». Вкладення поки на підготовчій стадії.</p>
        </div>
        <div class="event-sheet__thread-meta">
          <span class="event-badge event-badge--neutral" id="eventThreadCountBadge">Повідомлень: <?= (int)$messageTotal ?></span>
          <?php if ($threadBackendReady): ?>
            <span class="event-badge event-badge--mine">Backend API готовий</span>
            <span class="event-badge event-badge--neutral">Аудит / Активність інтегровано</span>
            <span class="event-badge event-badge--neutral">Вкладення: схема підготовлена</span>
          <?php endif; ?>
        </div>
      </div>

      <div
        class="event-thread__app"
        id="eventThreadApp"
        data-event-id="<?= htmlspecialchars($eventId, ENT_QUOTES, 'UTF-8') ?>"
        data-current-user-id="<?= (int)$currentUserId ?>"
        data-current-user-name="<?= htmlspecialchars($currentUserName, ENT_QUOTES, 'UTF-8') ?>"
        data-current-user-login="<?= htmlspecialchars($currentUserLogin, ENT_QUOTES, 'UTF-8') ?>"
        data-current-user-display="<?= htmlspecialchars($currentUserDisplay, ENT_QUOTES, 'UTF-8') ?>"
        data-current-user-is-admin="<?= $currentUserIsAdmin ? '1' : '0' ?>"
        data-current-user-has-avatar="<?= $currentUserHasAvatar ? '1' : '0' ?>"
        data-current-user-avatar-url="<?= htmlspecialchars($currentUserAvatarUrl, ENT_QUOTES, 'UTF-8') ?>"
      >
        <div class="event-thread__status" id="eventThreadStatus" hidden></div>

        <div class="event-thread__list" id="eventThreadList" aria-live="polite"></div>

        <div class="event-thread__composer" id="eventThreadComposer">
          <div class="event-thread__avatar" id="eventThreadComposerAvatar">Aa</div>
          <div class="event-thread__composer-main">
            <div class="event-thread__composer-head">Нове повідомлення</div>
            <textarea
              class="event-thread__textarea"
              id="eventThreadTextarea"
              rows="4"
              maxlength="20000"
              placeholder="Напишіть повідомлення по задачі..."
            ></textarea>
            <div class="event-thread__composer-actions">
              <button type="button" class="btn" id="eventThreadAttachmentBtn" disabled>Додати файл</button>
              <button type="button" class="btn" id="eventThreadSubmitBtn">Надіслати</button>
            </div>
            <div class="event-thread__prep-note">Вкладення (зображення / файли) — підготовчий етап. Кнопка вже є як точка розширення, але поки недоступна.</div>
          </div>
        </div>
      </div>
    </section>
  <?php endif; ?>
</div>
