/* Local browser QA. The prototype must never call the live HA/device API. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.WALLPANEL_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WALLPANEL_PREVIEW_URL || 'http://127.0.0.1:3000/mockup/';
const output = path.resolve('data/mockup-preview');
fs.mkdirSync(output, { recursive: true });
async function enterPin(page, pin) {
  for (const digit of pin) await page.getByRole('dialog').getByRole('button', { name: digit, exact: true }).click();
}
async function metrics(page) {
  return page.evaluate(() => {
    const content = document.getElementById('content');
    const buttons = Array.from(document.querySelectorAll('button,a')).filter(e => e.getClientRects().length);
    const cards = Array.from(document.querySelectorAll('.general-home .card'));
    return {
      horizontal: document.documentElement.scrollWidth > innerWidth,
      scroll: content.scrollHeight, height: content.clientHeight,
      smallTargets: buttons.filter(e => { const r = e.getBoundingClientRect(); return r.width < 43 || r.height < 43; }).map(e => e.getAttribute('aria-label') || e.textContent.trim()),
      overflows: cards.filter(card => { const r = card.getBoundingClientRect(); return Array.from(card.querySelectorAll('button')).some(b => { const p = b.getBoundingClientRect(); return p.bottom > r.bottom + 1 || p.right > r.right + 1; }); }).map(c => c.className)
    };
  });
}
(async () => {
  const report = [];
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, timezoneId: 'Europe/Berlin' });
      const errors = [], apiRequests = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => { apiRequests.push(route.request().url()); return route.abort(); });
      await page.goto(base);
      await page.locator('#mainNav [aria-current=page]').waitFor();
      assert.equal(await page.locator('#mainNav [aria-current=page]').textContent(), 'Home');
      assert.equal(await page.evaluate(() => WallpanelMockup.model.scenes.length), 0);
      assert.equal(await page.locator('#mainNav').getByRole('button', { name: 'Wohnzimmer', exact: true }).count(), 1);
      assert.equal(await page.locator('#mainNav').getByRole('button', { name: 'Küche', exact: true }).count(), 1);
      for (const size of [{ width: 1024, height: 768 }, { width: 1024, height: 600 }, { width: 768, height: 1024 }, { width: 800, height: 600 }, { width: 640, height: 480 }]) {
        await page.setViewportSize(size);
        const m = await metrics(page);
        assert.equal(m.horizontal, false, name + ' horizontal overflow ' + JSON.stringify(size));
        assert.deepEqual(m.smallTargets, [], name + ' touch targets ' + JSON.stringify(size));
        assert.deepEqual(m.overflows, [], name + ' card controls overflow ' + JSON.stringify(size));
        if (size.width >= 768) assert.ok(m.scroll <= m.height + 2, name + ' overview scroll ' + JSON.stringify({ size, m }));
        await page.screenshot({ path: path.join(output, name + '-' + size.width + 'x' + size.height + '.png') });
      }
      await page.setViewportSize({ width: 1024, height: 768 });
      assert.equal(await page.getByRole('button', { name: 'Live', exact: true }).count(), 0, 'Live must not be available on Home');
      assert.equal(await page.getByRole('button', { name: 'Live ansehen', exact: true }).count(), 0);
      const contentTop = await page.locator('#content').boundingBox();
      assert.ok(contentTop.y <= 80, 'compact header should free vertical space');
      await page.evaluate(() => { window.mockupCameraBeforeWaste = document.querySelector('.home-camera-image'); });
      await page.getByRole('button', { name: 'Alle Abholungen anzeigen', exact: true }).click();
      assert.equal(await page.evaluate(() => window.mockupCameraBeforeWaste === document.querySelector('.home-camera-image')), true, 'waste toggle must not rebuild camera');
      assert.equal(await page.getByRole('dialog').count(), 0, 'waste tile must not open a popup');
      assert.equal(await page.locator('.waste-inline-list > span').count(), 3);
      const expanded = await metrics(page); assert.ok(expanded.scroll <= expanded.height + 2);
      await page.getByRole('button', { name: 'Nächste Abholung anzeigen', exact: true }).click();
      assert.equal(await page.locator('.waste-name').textContent(), 'Papiertonne');
      await page.locator('.weather-metric').click();
      await page.getByRole('dialog', { name: 'Wetter & Regenkarte', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => WallpanelMockup.state.view), 'home');
      assert.equal(await page.locator('#mainNav [aria-current=page]').textContent(), 'Home');
      await page.screenshot({ path: path.join(output, name + '-weather-popup.png') });
      await page.getByRole('button', { name: 'Schließen', exact: true }).click();
      await page.getByRole('button', { name: 'Kamera Einfahrt öffnen', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Event', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.evaluate(() => WallpanelMockup.model.livePreviewActive), null);
      assert.match(await page.locator('.camera-full-image svg').getAttribute('preserveAspectRatio'), /slice$/);
      await page.screenshot({ path: path.join(output, name + '-camera-event-popup.png') });
      await page.getByRole('button', { name: 'Live', exact: true }).click();
      assert.equal(await page.evaluate(() => WallpanelMockup.model.livePreviewActive), 'driveway');
      await page.getByRole('button', { name: 'Event', exact: true }).click();
      assert.equal(await page.evaluate(() => WallpanelMockup.model.livePreviewActive), null);
      await page.getByRole('button', { name: 'Live', exact: true }).click();
      await page.getByRole('button', { name: 'Schließen', exact: true }).click();
      assert.equal(await page.evaluate(() => WallpanelMockup.model.livePreviewActive), null, 'closing must release live');
      await page.getByRole('button', { name: 'Kamera Einfahrt öffnen', exact: true }).click();
      await page.getByRole('button', { name: 'Live', exact: true }).click();
      await page.evaluate(() => WallpanelMockup.receiveAnnouncement('Bitte nach unten kommen.', 'Küche'));
      assert.equal(await page.evaluate(() => WallpanelMockup.model.livePreviewActive), null, 'incoming popup must release live preview');
      await page.getByRole('dialog', { name: 'Durchsage', exact: true }).waitFor();
      assert.equal(await page.locator('.incoming-message').textContent(), 'Bitte nach unten kommen.');
      await page.screenshot({ path: path.join(output, name + '-incoming-announcement.png') });
      await page.getByRole('button', { name: 'Gelesen', exact: true }).click();
      await page.evaluate(() => WallpanelMockup.receiveDoorbell());
      await page.getByRole('dialog', { name: 'Es hat geklingelt.', exact: true }).waitFor();
      await page.screenshot({ path: path.join(output, name + '-doorbell-popup.png') });
      await page.getByRole('button', { name: 'Erledigt', exact: true }).click();
      assert.equal(await page.locator('#homeCameraName').textContent(), 'Einfahrt');
      await page.getByRole('button', { name: 'Hof vor 12 Min.', exact: true }).click();
      assert.equal(await page.locator('#homeCameraName').textContent(), 'Hof');
      await page.evaluate(() => { WallpanelMockup.model.cameras[0].lastMotionMinutes = 0; WallpanelMockup.render(); });
      assert.equal(await page.locator('#homeCameraName').textContent(), 'Hof', 'manual camera selection must hold');
      assert.equal(await page.getByRole('button',{name:'Neueste',exact:true}).count(),0);
      await page.evaluate(()=>{WallpanelMockup.state.cameraPinnedUntil=0;WallpanelMockup.render();});
      assert.equal(await page.locator('#homeCameraName').textContent(), 'Einfahrt');
      assert.equal(await page.locator('.camera-switch').count(), 2, 'offline and DWD excluded');
      await page.locator('#mainNav').getByRole('button',{name:'Wohnzimmer',exact:true}).click();
      await page.getByRole('button', { name: 'Stehlampe ausschalten', exact: true }).click();
      await page.getByRole('button', { name: 'Stehlampe einschalten', exact: true }).waitFor();
      await page.getByRole('link',{name:'Home',exact:true}).click();
      await page.getByRole('button', { name: 'Torsteuerung öffnen', exact: true }).click();
      await page.getByRole('button', { name: 'Öffnen simulieren', exact: true }).click();
      assert.equal(await page.evaluate(() => WallpanelMockup.model.gateOpen), true);
      assert.doesNotMatch(await page.locator('.status-summary').textContent(), /Tor|Hoftor/);
      assert.equal(await page.locator('.notice-item').count(),1);
      await page.getByRole('button', { name: 'Durchsage', exact: true }).click();
      await page.getByRole('combobox', { name: 'An wen?', exact: true }).selectOption('hall-tablet');
      await page.getByRole('button', { name: 'Essen ist fertig', exact: true }).click();
      await page.getByRole('button', { name: 'Durchsage senden', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => WallpanelMockup.model.announcements[0]), { target: 'hall-tablet', message: 'Essen ist fertig!', speak: true });
      await page.getByRole('button', { name: 'Assist fragen', exact: true }).click();
      await page.getByRole('textbox', { name: 'Was möchtest du wissen?', exact: true }).fill('Wie warm ist es hier?');
      await page.getByRole('button', { name: 'Frage stellen', exact: true }).click();
      assert.match(await page.locator('#assistAnswer').textContent(), /21,3 °C/);
      await page.getByRole('button', { name: 'Schließen', exact: true }).click();
      await page.locator('#mainNav').getByRole('button', { name: 'Wohnzimmer', exact: true }).click();
      await page.getByRole('button', { name: 'Solltemperatur erhöhen', exact: true }).click();
      assert.equal(await page.evaluate(() => WallpanelMockup.model.rooms[0].target), 22.5);
      await page.getByRole('button', { name: 'Musik einstellen', exact: true }).click();
      await page.getByRole('searchbox', { name: 'Musik suchen', exact: true }).fill('Klassik');
      await page.getByRole('button', { name: 'Klassik am Morgen Ein ruhiger Start', exact: true }).click();
      await page.getByRole('button', { name: 'Musik pausieren', exact: true }).waitFor();
      await page.evaluate(()=>WallpanelMockup.openLight('sofa'));
      await page.getByRole('slider',{name:'Stehlampe Helligkeit',exact:true}).focus();await page.keyboard.press('Home');for(let i=0;i<47;i++)await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(() => WallpanelMockup.model.lights[0].brightness), 47);
      await page.getByRole('button', { name: 'Schließen', exact: true }).click();
      await page.screenshot({ path: path.join(output, name + '-room.png') });
      const tile = page.getByRole('button', { name: 'Stehlampe ausschalten', exact: true }); const box = await tile.boundingBox();
      await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down();
      await page.getByRole('dialog').waitFor(); await page.mouse.up();
      await page.getByRole('button', { name: 'Schließen', exact: true }).click();
      await page.getByRole('button', { name: 'Räume', exact: true }).click();
      assert.equal(await page.getByRole('dialog').getByRole('button', { name: /#Technik/ }).count(), 0);
      await page.getByRole('dialog').getByRole('button', { name: 'Küche 2 Lampen', exact: true }).click();
      assert.equal(await page.locator('#mainNav [aria-current=page]').textContent(), 'Küche');
      await page.getByRole('button',{name:'Apps',exact:true}).click();await page.getByRole('button', { name: 'Tablet-Einstellungen', exact: true }).click();
      assert.equal(await page.locator('#tabletSettings').count(), 0, 'profile is behind PIN');
      await enterPin(page, '9999');
      assert.match(await page.locator('#pinStatus').textContent(), /stimmt nicht/);
      await enterPin(page, '1310');
      await page.getByRole('heading', { name: 'Einstellungen für dieses Tablet', exact: true }).waitFor();
      await page.getByRole('checkbox', { name: 'Flur', exact: true }).check();
      await page.getByRole('combobox', { name: 'Schnelllicht 1', exact: true }).selectOption('halllight');
      await page.getByRole('button', { name: 'Einstellungen speichern', exact: true }).click();
      assert.equal(await page.locator('#mainNav').getByRole('button', { name: 'Flur', exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Alle Tablets', exact: true }).click();
      assert.equal(await page.locator('.tablet-row').count(), 3);
      await page.locator('.tablet-row').filter({ hasText: 'Wohnzimmer-iPad' }).getByRole('button', { name: 'Bearbeiten', exact: true }).click();
      await page.getByRole('textbox', { name: 'Name des Tablets', exact: true }).fill('Wohnzimmer neu');
      await page.getByRole('combobox', { name: 'Schrift', exact: true }).selectOption('large');
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await page.getByRole('button', { name: 'Dieses Tablet', exact: true }).click();
      assert.equal(await page.getByRole('textbox', { name: 'Name des Tablets', exact: true }).inputValue(), 'Wohnzimmer neu');
      assert.equal(await page.getByRole('checkbox', { name: 'Flur', exact: true }).isChecked(), true);
      await page.getByRole('link', { name: 'Home', exact: true }).click();
      assert.equal(await page.locator('.quick-summary').count(),0);
      for (const size of [{ width: 1024, height: 600 }, { width: 800, height: 600 }]) {
        await page.setViewportSize(size); const m = await metrics(page);
        assert.ok(m.scroll <= m.height + 2, name + ' large type overview ' + JSON.stringify({ size, m }));
        assert.deepEqual(m.overflows, [], name + ' large type card overflow');
        await page.screenshot({ path: path.join(output, name + '-large-' + size.width + 'x' + size.height + '.png') });
      }
      await page.reload();
      await page.getByRole('button',{name:'Apps',exact:true}).click();await page.getByRole('button', { name: 'Tablet-Einstellungen', exact: true }).click();
      await page.getByRole('heading', { name: 'Einstellungen entsperren', exact: true }).waitFor();
      const pinSize = await page.locator('.dialog-pin').evaluate(el => ({ scroll: el.scrollHeight, height: el.clientHeight }));
      assert.ok(pinSize.scroll <= pinSize.height + 2, 'PIN and reload button must fit the small iPad height');
      await page.screenshot({ path: path.join(output, name + '-pin-reload.png') });
      const refreshedAssets = [];
      page.on('request', request => { if (/mockup\.(?:js|css)\?_reload=/.test(request.url())) refreshedAssets.push(request.url()); });
      await page.getByRole('button', { name: 'Neu laden ohne Cache', exact: true }).click();
      await page.waitForURL(/_reload=[0-9]+/);
      await page.locator('#appsNav.active').waitFor(); // reload lands on Apps; settings need a fresh unlock
      assert.ok(refreshedAssets.some(url => /mockup\.js\?_reload=/.test(url)), 'JS must get a fresh URL');
      assert.ok(refreshedAssets.some(url => /mockup\.css\?_reload=/.test(url)), 'CSS must get a fresh URL');
      assert.equal(await page.evaluate(() => WallpanelMockup.model.tablets[0].name), 'Wohnzimmer neu', 'reload retains profile');
      assert.equal(await page.evaluate(() => WallpanelMockup.state.settingsUnlockedUntil), 0);
      assert.deepEqual(errors, []); assert.deepEqual(apiRequests, []);
      report.push({ browser: name, result: 'passed', viewports: 5, apiRequests: 0, jsErrors: 0 });
      console.log(name + ': kompakter Kopf, Müllwechsel, Wetter-Popup, vollständiges Event/Live-Bild, Live-Ende, Durchsage/Klingel-Popups und Cache-Neuladen sowie bisherige Bedienwege geprüft.');
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
})().catch(e => { console.error(e); process.exitCode = 1; });
