async function confirmPanelStartup(page){await page.locator('[data-action="startup-confirm"]').waitFor();await page.locator('[data-action="startup-confirm"]').click();await page.waitForFunction(()=>!WallpanelMockup.state.dialog||WallpanelMockup.state.dialog.type!=='startup');}
async function openPanelSettings(page){await page.getByRole('button',{name:'Apps',exact:true}).click();await page.locator('#settingsNav').click();}
module.exports={confirmPanelStartup,openPanelSettings};
