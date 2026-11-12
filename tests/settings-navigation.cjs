// Navigate the real category UI; older upgrade fixtures have no category shell.
module.exports=async function settingsCategory(page,id){
 await page.locator('#modal-settings').waitFor();
 if(!await page.getByTestId('settings-layout').count())return;
 let button=page.locator(`[data-settings-category="${id}"]:visible`).first();
 if(!await button.count()){
  await page.getByRole('button',{name:/^(All categories|Wszystkie kategorie|Все категории|Alle Kategorien)$/}).click();
  button=page.locator(`[data-settings-category="${id}"]:visible`).first();
 }
 await button.click();
 await page.locator(`[data-settings-option][data-category="${id}"]:visible`).first().waitFor();
};
