<header class="pdf-doc-head">
  <div>
    <h1><?= htmlspecialchars($doc_title ?? 'Сьогодні', ENT_QUOTES) ?></h1>
    <div class="pdf-doc-subtitle"><?= htmlspecialchars($doc_subtitle ?? '', ENT_QUOTES) ?></div>
  </div>
  <div class="pdf-doc-generated">Сформовано: <?= htmlspecialchars($generated_at ?? '', ENT_QUOTES) ?></div>
</header>

<?php foreach (($groups ?? []) as $group): ?>
  <section class="pdf-section">
    <div class="pdf-section__head">
      <h2><?= htmlspecialchars($group['title'] ?? '', ENT_QUOTES) ?></h2>
      <span><?= count($group['items'] ?? []) ?></span>
    </div>
    <?php if (empty($group['items'])): ?>
      <div class="pdf-empty">Немає записів.</div>
    <?php else: ?>
      <table class="pdf-table pdf-table--today">
        <thead>
          <tr>
            <th>Час</th>
            <th>Тип</th>
            <th>Подія</th>
            <th>Відповідальний</th>
            <th>Опис</th>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($group['items'] as $item): ?>
          <tr>
            <td class="pdf-time"><?= htmlspecialchars($item['time'] ?? '—', ENT_QUOTES) ?></td>
            <td><?= htmlspecialchars($item['type'] ?? '—', ENT_QUOTES) ?></td>
            <td>
              <strong><?= htmlspecialchars($item['title'] ?? '(без назви)', ENT_QUOTES) ?></strong>
              <?php if (!empty($item['badges'])): ?>
                <div class="pdf-inline-tags">
                  <?php foreach ($item['badges'] as $tag): ?><span><?= htmlspecialchars($tag, ENT_QUOTES) ?></span><?php endforeach; ?>
                </div>
              <?php endif; ?>
            </td>
            <td><?= htmlspecialchars($item['responsible'] ?? '—', ENT_QUOTES) ?></td>
            <td><?= nl2br(htmlspecialchars($item['description'] ?? '', ENT_QUOTES)) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </section>
<?php endforeach; ?>
