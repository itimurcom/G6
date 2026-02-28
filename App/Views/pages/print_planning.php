<header class="pdf-doc-head">
  <div>
    <h1><?= htmlspecialchars($doc_title ?? 'Планування', ENT_QUOTES) ?></h1>
    <div class="pdf-doc-subtitle"><?= htmlspecialchars($doc_subtitle ?? '', ENT_QUOTES) ?></div>
  </div>
  <div class="pdf-doc-generated">Сформовано: <?= htmlspecialchars($generated_at ?? '', ENT_QUOTES) ?></div>
</header>

<?php $sections = $sections ?? []; ?>
<?php if (!$sections): ?>
  <div class="pdf-empty">Немає даних для експорту.</div>
<?php else: ?>
  <?php foreach ($sections as $section): ?>
    <section class="pdf-section pdf-section--planning">
      <div class="pdf-section__head">
        <h2><?= htmlspecialchars($section['title'] ?? '', ENT_QUOTES) ?></h2>
        <span class="pdf-doc-generated"><?= htmlspecialchars($section['date'] ?? '', ENT_QUOTES) ?></span>
      </div>

      <?php $items = $section['items'] ?? []; ?>
      <?php if (($section['title'] ?? '') === 'Прострочені до'): ?>
        <?php if (!$items): ?>
          <div class="pdf-empty">Прострочених задач немає.</div>
        <?php else: ?>
          <?php foreach ($items as $dayIso => $dayItems): ?>
            <div class="pdf-list-day pdf-list-day--compact">
              <div class="pdf-list-day__head">
                <h3><?= htmlspecialchars((new DateTimeImmutable($dayIso))->format('d.m.Y'), ENT_QUOTES) ?></h3>
                <span><?= count($dayItems ?? []) ?> задач</span>
              </div>
              <table class="pdf-table pdf-table--events">
                <thead>
                  <tr>
                    <th style="width:92px">Час</th>
                    <th style="width:120px">Тип</th>
                    <th>Подія</th>
                    <th style="width:180px">Відповідальний</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach (($dayItems ?? []) as $item): ?>
                    <tr>
                      <td class="pdf-time"><?= htmlspecialchars($item['time'] ?? '—', ENT_QUOTES) ?></td>
                      <td><?= htmlspecialchars($item['type'] ?? '—', ENT_QUOTES) ?></td>
                      <td>
                        <strong><?= htmlspecialchars($item['title'] ?? '', ENT_QUOTES) ?></strong>
                        <?php if (!empty($item['description'])): ?>
                          <div class="pdf-table-note"><?= nl2br(htmlspecialchars((string)$item['description'], ENT_QUOTES)) ?></div>
                        <?php endif; ?>
                        <?php if (!empty($item['badges'])): ?>
                          <div class="pdf-inline-tags">
                            <?php foreach (($item['badges'] ?? []) as $badge): ?>
                              <span><?= htmlspecialchars((string)$badge, ENT_QUOTES) ?></span>
                            <?php endforeach; ?>
                          </div>
                        <?php endif; ?>
                      </td>
                      <td><?= htmlspecialchars($item['responsible'] ?? '—', ENT_QUOTES) ?></td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          <?php endforeach; ?>
        <?php endif; ?>
      <?php else: ?>
        <?php if (!$items): ?>
          <div class="pdf-empty">Подій немає.</div>
        <?php else: ?>
          <table class="pdf-table pdf-table--events">
            <thead>
              <tr>
                <th style="width:92px">Час</th>
                <th style="width:120px">Тип</th>
                <th>Подія</th>
                <th style="width:180px">Відповідальний</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($items as $item): ?>
                <tr>
                  <td class="pdf-time"><?= htmlspecialchars($item['time'] ?? '—', ENT_QUOTES) ?></td>
                  <td><?= htmlspecialchars($item['type'] ?? '—', ENT_QUOTES) ?></td>
                  <td>
                    <strong><?= htmlspecialchars($item['title'] ?? '', ENT_QUOTES) ?></strong>
                    <?php if (!empty($item['description'])): ?>
                      <div class="pdf-table-note"><?= nl2br(htmlspecialchars((string)$item['description'], ENT_QUOTES)) ?></div>
                    <?php endif; ?>
                    <?php if (!empty($item['badges'])): ?>
                      <div class="pdf-inline-tags">
                        <?php foreach (($item['badges'] ?? []) as $badge): ?>
                          <span><?= htmlspecialchars((string)$badge, ENT_QUOTES) ?></span>
                        <?php endforeach; ?>
                      </div>
                    <?php endif; ?>
                  </td>
                  <td><?= htmlspecialchars($item['responsible'] ?? '—', ENT_QUOTES) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        <?php endif; ?>
      <?php endif; ?>
    </section>
  <?php endforeach; ?>
<?php endif; ?>
