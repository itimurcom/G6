<?php
$event = $event ?? null;
$eventTitle = $event_title ?? 'Лист події';
$passportRows = is_array($passport_rows ?? null) ? $passport_rows : [];
$badges = is_array($event_badges ?? null) ? $event_badges : [];
$missingMessage = (string)($event_missing_message ?? '');
$missingDetails = (string)($event_missing_details ?? '');
$description = (string)($event_description ?? '');
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

    <section class="event-card event-thread event-thread--stage0">
      <div class="event-card__head">
        <div>
          <h2 class="event-card__title">Повідомлення по події</h2>
          <p class="event-card__hint">Етап 1 підготовлено: окремий лист події створено. Наступним патчем буде база повідомлень, API та робоча стрічка переписки.</p>
        </div>
      </div>

      <div class="event-thread__placeholder">
        <div class="event-thread__empty">
          <div class="event-thread__empty-title">Стрічка повідомлень ще не активована</div>
          <div class="event-thread__empty-text">
            У наступному патчі тут з’явиться повноцінна переписка між користувачами: аватар, ім’я, дата, текст повідомлення, редагування, видалення та позначка «відредаговано».
          </div>
        </div>

        <div class="event-thread__composer is-disabled" aria-disabled="true">
          <div class="event-thread__avatar">Aa</div>
          <div class="event-thread__composer-main">
            <div class="event-thread__composer-head">Нове повідомлення</div>
            <textarea class="event-thread__textarea" rows="4" disabled placeholder="Тут буде поле введення повідомлення..."></textarea>
            <div class="event-thread__composer-actions">
              <button type="button" class="btn" disabled>Додати файл</button>
              <button type="button" class="btn" disabled>Надіслати</button>
            </div>
            <div class="event-thread__prep-note">Вкладення (зображення / файли) — підготовчий етап, буде реалізовано окремим патчем.</div>
          </div>
        </div>
      </div>
    </section>
  <?php endif; ?>
</div>
