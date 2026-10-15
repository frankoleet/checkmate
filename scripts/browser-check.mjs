import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

// Uses an isolated browser profile; no installed browser profile is accessed.
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => { errors.push(error.message); console.error('Browser error:', error.message) })
const base = process.env.TEST_URL || 'http://127.0.0.1:5173'
await mkdir('.qa', { recursive: true })
const visibleCard = (code) => page.locator('.match-card:visible').filter({ has: page.locator('.match-code', { hasText: new RegExp(`^${code}$`) }) })
const clickText = (name) => page.getByRole('button', { name, exact: true }).click()
const chooseBranch = (name) => page.getByRole('tab', { name: new RegExp(name) }).first().click()
const closeSheet = () => page.getByRole('dialog').getByRole('button', { name: 'Закрыть', exact: true }).click()
async function fit(label) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }))
  assert.ok(dimensions.document <= dimensions.viewport, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`)
}
try {
  await page.goto(base)
  await page.getByLabel('Название турнира', { exact: false }).fill('Кубок шахматного клуба')
  for (const width of [360, 375, 390, 414, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await fit(`setup ${width}`)
  }
  await page.screenshot({ path: '.qa/setup-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await clickText('Вставить список участников')
  await page.getByRole('textbox', { name: 'Список участников, по одному на строку' }).fill([
    'Александр Константинопольский-ДлиннаяФамилияДляПроверки', 'Анна Смирнова', 'Михаил Волков', 'Мария Соколова',
    'Иван Петров', 'Елена Кузнецова', 'Дмитрий Орлов', 'Ольга Белова', 'Николай Морозов', 'Софья Лебедева',
    'Артём Новиков', 'Дарья Попова', 'Максим Павлов', 'Полина Фёдорова', 'Кирилл Васильев', 'Алиса Семёнова',
    'Андрей Козлов', 'Виктория Иванова', 'Сергей Егоров', 'Вероника Никитина',
  ].join('\n'))
  await clickText('Добавить список')
  await page.screenshot({ path: '.qa/setup-mobile.png', fullPage: true })
  await clickText('Начать турнир')
  assert.equal(await page.locator('.match-card:visible').count(), 10)
  await visibleCard('Игра №1').click()
  await clickText('½–½ Ничья')
  assert.ok(await page.getByText('Кто победил на тай-брейке?').isVisible())
  await page.locator('.tiebreak-button').first().click()
  assert.ok((await visibleCard('Игра №1').innerText()).includes('Тай-брейком'.toLowerCase()))
  await visibleCard('Игра №2').click()
  await clickText('1–0 Первый')
  await chooseBranch('Нижняя')
  assert.ok((await visibleCard('Игра №22').innerText()).includes('Анна Смирнова'))
  await visibleCard('Игра №22').click()
  await clickText('1–0 Первый')
  await page.reload()
  await chooseBranch('Нижняя')
  assert.ok((await visibleCard('Игра №22').innerText()).includes('Завершён'))
  await chooseBranch('Верхняя')
  await visibleCard('Игра №1').click()
  await clickText('0–1 Второй')
  assert.ok(await page.getByRole('alertdialog').isVisible())
  await clickText('Отмена')
  assert.ok((await visibleCard('Игра №1').innerText()).includes('Решён тай-брейком'))
  await visibleCard('Игра №1').click()
  await clickText('0–1 Второй')
  await clickText('Изменить и сбросить')
  await chooseBranch('Нижняя')
  assert.ok((await visibleCard('Игра №22').innerText()).includes('Можно играть'))
  await chooseBranch('Верхняя')
  await page.getByLabel('Подсветить путь игрока').selectOption({ label: '#2 · Анна Смирнова' })
  assert.ok(await page.locator('.match-card.player-highlight:visible').count() > 0)
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Включить тёмную тему' }).click()
    for (const width of [360, 375, 390, 414, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await fit(`tournament ${width} ${theme}`)
      if (width === 360 || width === 1440) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await page.screenshot({ path: `.qa/bracket-${width}-${theme}.png`, fullPage: width === 1440, animations: 'disabled' })
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await visibleCard('Игра №1').click()
  await page.screenshot({ path: '.qa/result-mobile-dark.png', animations: 'disabled' })
  await fit('result sheet')
  await closeSheet()
  await page.getByRole('button', { name: 'Включить светлую тему' }).click()
  await clickText('Поделиться')
  const share = await page.getByRole('textbox', { name: 'Ссылка на турнир' }).inputValue()
  assert.ok(share.includes('view='))
  assert.equal(await page.getByRole('dialog').locator('svg').count() > 0, true)
  await page.screenshot({ path: '.qa/share-mobile.png', animations: 'disabled' })
  const viewerContext = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const viewer = await viewerContext.newPage()
  viewer.on('pageerror', (error) => errors.push(error.message))
  await viewer.goto(share)
  assert.ok(await viewer.getByText('Просмотр по ссылке.', { exact: true }).isVisible())
  await viewer.locator('.match-card:visible').first().click()
  assert.equal(await viewer.locator('.score-button').count(), 0)
  await viewer.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await viewer.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await viewer.reload()
  assert.equal(await viewer.getByText('Просмотр по ссылке.', { exact: true }).count(), 0)
  await viewer.locator('.match-card:visible').first().click()
  assert.equal(await viewer.locator('.score-button').count(), 3)
  await viewerContext.close()
  await closeSheet()
  await clickText('Убрать подсветку')
  await page.setViewportSize({ width: 1440, height: 1000 })
  let completed = false
  let playedReset = false
  for (let step = 0; step < 50; step++) {
    if (await page.getByRole('region', { name: 'Итоги турнира' }).count()) { completed = true; break }
    let played = false
    for (const branch of ['Верхняя', 'Нижняя', 'Финал']) {
      await chooseBranch(branch)
      const card = page.locator('.match-card:visible').filter({ has: page.locator('.match-badge.playable') }).first()
      if (!await card.count()) continue
      const code = await card.getAttribute('data-match-id')
      await card.click()
      await clickText(code === 'grand-final' ? '0–1 Второй' : '1–0 Первый')
      if (code === 'reset-final') playedReset = true
      played = true
      break
    }
    assert.ok(played, 'There should be a playable next match')
  }
  assert.ok(completed && playedReset, 'Champion is decided in reset final')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.screenshot({ path: '.qa/champion-desktop.png', animations: 'disabled' })
  await clickText('Поделиться')
  assert.ok(await page.getByRole('dialog').locator('svg').count() > 0)
  const finalLink = await page.getByRole('textbox', { name: 'Ссылка на турнир' }).inputValue()
  const finalContext = await browser.newContext()
  const finalPage = await finalContext.newPage()
  await finalPage.goto(finalLink)
  assert.ok(await finalPage.getByRole('region', { name: 'Итоги турнира' }).isVisible())
  await finalContext.close()
  assert.deepEqual(errors, [])
  console.log('PASS: 7 viewport widths × 2 themes, full 20-player tournament, draw, lower bracket, correction, reload, highlighting, QR, isolated shared view and restore, reset final and champion snapshot. Screenshots: .qa/')
} finally {
  await browser.close()
}
