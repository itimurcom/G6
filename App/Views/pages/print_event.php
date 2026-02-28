<header class="pdf-doc-head">
  <div>
    <h1><?= htmlspecialchars($doc_title ?? 'Подія', ENT_QUOTES) ?></h1>
    <div class="pdf-doc-subtitle"><?= htmlspecialchars($doc_subtitle ?? '', ENT_QUOTES) ?></div>
  </div>
  <div class="pdf-doc-generated">Сформовано: <?= htmlspecialchars($generated_at ?? '', ENT_QUOTES) ?></div>
</header>

<?php if (!empty($error_message)): ?>
  <section class="pdf-section"><div class="pdf-empty"><?= htmlspecialchars($error_message, ENT_QUOTES) ?></div></section>
<?php else: ?>
  <?php if (!empty($badges)): ?>
    <div class="pdf-inline-tags pdf-inline-tags--top">
      <?php foreach ($badges as $tag): ?><span><?= htmlspecialchars($tag, ENT_QUOTES) ?></span><?php endforeach; ?>
    </div>
  <?php endif; ?>

  <section class="pdf-section">
    <div class="pdf-section__head"><h2>Паспорт події</h2></div>
    <table class="pdf-table pdf-table--passport">
      <tbody>
      <?php foreach (($passport_rows ?? []) as $row): ?>
        <tr>
          <th><?= htmlspecialchars($row['label'] ?? '', ENT_QUOTES) ?></th>
          <td><?= nl2br(htmlspecialchars($row['value'] ?? '—', ENT_QUOTES)) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </section>

  <?php if (trim((string)($description ?? '')) !== ''): ?>
    <section class="pdf-section">
      <div class="pdf-section__head"><h2>Опис</h2></div>
      <div class="pdf-text-block"><?= nl2br(htmlspecialchars((string)$description, ENT_QUOTES)) ?></div>
    </section>
  <?php endif; ?>

  <section class="pdf-section">
    <div class="pdf-section__head"><h2>Коментарі</h2><span><?= count($comments ?? []) ?></span></div>
    <?php if (empty($comments)): ?>
      <div class="pdf-empty">Немає коментарів.</div>
    <?php else: ?>
      <div class="pdf-comments">
        <?php foreach (($comments ?? []) as $comment): ?>
          <article class="pdf-comment">
            <div class="pdf-comment__head">
              <strong><?= htmlspecialchars($comment['author']['display'] ?? '—', ENT_QUOTES) ?></strong>
              <span><?= htmlspecialchars($comment['created_at'] ?? '—', ENT_QUOTES) ?></span>
            </div>
            <div class="pdf-comment__body"><?= nl2br(htmlspecialchars($comment['message_text'] ?? '', ENT_QUOTES)) ?></div>
            <?php if (!empty($comment['edited_at'])): ?><div class="pdf-comment__meta">Відредаговано: <?= htmlspecialchars((string)$comment['edited_at'], ENT_QUOTES) ?></div><?php endif; ?>
          </article>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </section>

  <section class="pdf-section">
    <div class="pdf-section__head"><h2>Історія змін</h2><span><?= count($history ?? []) ?></span></div>
    <?php if (empty($history)): ?>
      <div class="pdf-empty">Немає записів.</div>
    <?php else: ?>
      <table class="pdf-table pdf-table--history">
        <thead><tr><th>Дата</th><th>Користувач</th><th>Дія</th><th>Деталі</th></tr></thead>
        <tbody>
          <?php foreach (($history ?? []) as $item): ?>
            <tr>
              <td><?= htmlspecialchars($item['created_at'] ?? '—', ENT_QUOTES) ?></td>
              <td><?= htmlspecialchars($item['user_name'] ?? '—', ENT_QUOTES) ?></td>
              <td><?= htmlspecialchars($item['label'] ?? '—', ENT_QUOTES) ?></td>
              <td><?= nl2br(htmlspecialchars($item['summary'] ?? '', ENT_QUOTES)) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </section>
<?php endif; ?>
