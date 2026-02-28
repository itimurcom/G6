<header class="pdf-doc-head">
  <div>
    <h1><?= htmlspecialchars($doc_title ?? 'Календар за місяць', ENT_QUOTES) ?></h1>
    <div class="pdf-doc-subtitle"><?= htmlspecialchars($doc_subtitle ?? '', ENT_QUOTES) ?></div>
  </div>
  <div class="pdf-doc-generated">Сформовано: <?= htmlspecialchars($generated_at ?? '', ENT_QUOTES) ?></div>
</header>

<section class="pdf-section">
  <div class="pdf-section__head">
    <h2>Події за місяць</h2>
    <span class="pdf-doc-generated">Всього: <?= (int)($events_total ?? 0) ?></span>
  </div>

  <?php $days = $days ?? []; ?>
  <?php if (!$days): ?>
    <div class="pdf-empty">Подій за обраний місяць немає.</div>
  <?php else: ?>
    <div class="pdf-list-days">
      <?php foreach ($days as $day): ?>
        <section class="pdf-list-day">
          <div class="pdf-list-day__head">
            <h3><?= htmlspecialchars($day['title'] ?? '', ENT_QUOTES) ?></h3>
            <span><?= count($day['items'] ?? []) ?> подій</span>
          </div>

          <?php if (empty($day['items'])): ?>
            <div class="pdf-empty">Подій на цей день немає.</div>
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
                <?php foreach ($day['items'] as $item): ?>
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
        </section>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>
