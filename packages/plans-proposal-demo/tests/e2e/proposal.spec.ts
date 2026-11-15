import { expect, test, type Page } from "@playwright/test";

async function openClosedMonth(page: Page) {
  await page.goto("/");
  await page.getByLabel("Manba oyi", { exact: true }).selectOption("2026-10");
  await expect(page.getByText("Manba oyi to‘liq emas.", { exact: true })).toHaveCount(0);
}

async function openFirstBlock(page: Page) {
  await page.getByRole("button", { name: /Toshkent markaz/ }).click();
  await page.getByRole("button", { name: /Akbar Sodiqov/ }).click();
}

test("loads collapsed branch blocks and opens only one block at a time", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openClosedMonth(page);
  await expect(page.getByRole("heading", { name: "Taklifiy reja", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: /Toshkent markaz/ }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: /Akbar Sodiqov/ }).click();
  await expect(page.getByRole("table")).toHaveCount(1);
  await expect(page.getByLabel("Aziz Karimov tanlash")).toBeEnabled();
  await page.getByRole("button", { name: /Chirchiq/ }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: /Lola Mirzayeva/ }).click();
  await expect(page.getByRole("table")).toHaveCount(1);
  await expect(page.getByLabel("Bobur Nazarov tanlash")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("inline cell edits percent and amount directly in the table", async ({ page }) => {
  await openClosedMonth(page);
  await openFirstBlock(page);
  const cell = page.getByLabel("Aziz Karimov KPI 1 taklifini tahrirlash");
  const widthBefore = await cell.evaluate((el) => el.getBoundingClientRect().width);
  await cell.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Aziz Karimov KPI 1 katak editori" })).toBeVisible();
  const editorValue = page.getByLabel("Aziz Karimov KPI 1 qiymat");
  await expect
    .poll(() => editorValue.evaluate((el) => el.closest("td")!.getBoundingClientRect().width))
    .toBeGreaterThan(widthBefore + 100);
  await page.getByLabel("Aziz Karimov KPI 1 qiymat").fill("20");
  await page.getByLabel("Saqlash", { exact: true }).click();
  await expect(cell).toContainText("+20%");
  await cell.click();
  await page.getByLabel("Aziz Karimov KPI 1 usul").selectOption("amount");
  await page.getByLabel("Aziz Karimov KPI 1 qiymat").fill("5000000");
  await page.getByLabel("Saqlash", { exact: true }).click();
  await expect(cell).toContainText("Jadval formula");
  await expect(cell).toContainText("5 000 000");
});

test("bulk applies one formula to selected agents across all visible KPIs", async ({ page }) => {
  await openClosedMonth(page);
  await openFirstBlock(page);
  await page.getByLabel("Aziz Karimov tanlash").check();
  await page.getByLabel("Dilnoza Rahimova tanlash").check();
  await page.getByLabel("Ommaviy asos").selectOption("previous_plan");
  await page.getByLabel("Ommaviy qiymat").fill("15");
  await page.getByRole("button", { name: "Qo‘llash", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 ta agent × 3 ta KPI");
  await expect(page.getByLabel("Aziz Karimov KPI 1 taklifini tahrirlash")).toContainText("+15%");
  await expect(page.getByLabel("Aziz Karimov KPI 2 taklifini tahrirlash")).toContainText("+15%");
  await expect(page.getByLabel("Dilnoza Rahimova KPI 3 taklifini tahrirlash")).toContainText(
    "+15%"
  );
});

test("expanded cell editor selects the whole block and edits several cells at once", async ({
  page
}) => {
  await openClosedMonth(page);
  await openFirstBlock(page);
  await page.getByLabel("Aziz Karimov KPI 1 taklifini tahrirlash").click();
  await page.getByRole("button", { name: "Blokda hammasini tanlash", exact: true }).click();
  await expect(page.getByText(/\d+ katak · \d+ agent · \d+ KPI/)).toBeVisible();
  await page.getByLabel("Aziz Karimov KPI 1 qiymat").fill("7");
  await page.getByRole("button", { name: /Tanlangan \d+ katakka qo‘llash/ }).click();
  await expect(page.getByRole("status")).toContainText("ta katakka formula qo‘llandi");
  await expect(page.getByLabel("Aziz Karimov KPI 2 taklifini tahrirlash")).toContainText("+7%");
  await expect(page.getByLabel("Dilnoza Rahimova KPI 3 taklifini tahrirlash")).toContainText("+7%");
});

test("individual cell checkboxes edit only the chosen agent×KPI cells", async ({ page }) => {
  await openClosedMonth(page);
  await openFirstBlock(page);
  await page.getByLabel("Aziz Karimov KPI 1 katagini tanlash").check();
  await page.getByLabel("Dilnoza Rahimova KPI 2 katagini tanlash").check();
  await page.getByLabel("Ommaviy qiymat").fill("8");
  await page.getByRole("button", { name: "Qo‘llash", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 ta katakka formula qo‘llandi");
  await expect(page.getByLabel("Aziz Karimov KPI 1 taklifini tahrirlash")).toContainText("+8%");
  await expect(page.getByLabel("Dilnoza Rahimova KPI 2 taklifini tahrirlash")).toContainText("+8%");
  await expect(page.getByLabel("Aziz Karimov KPI 2 taklifini tahrirlash")).toContainText("+10%");
  await expect(page.getByLabel("Dilnoza Rahimova KPI 1 taklifini tahrirlash")).toContainText(
    "+10%"
  );
});

test("KPI header applies to its own supervisor block only", async ({ page }) => {
  await openClosedMonth(page);
  await page.getByRole("button", { name: /Chirchiq/ }).click();
  await page.getByRole("button", { name: /Lola Mirzayeva/ }).click();
  await page.getByLabel("Asosiy assortiment ustunida hammasiga o‘rnatish").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Butun blokka o‘rnatish")).toBeVisible();
  await page.getByLabel("Asosiy assortiment ustuni qiymat").fill("25");
  await page.getByRole("button", { name: "Blokka qo‘llash", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Lola Mirzayeva");
  await expect(page.getByLabel("Madina Islomova KPI 1 taklifini tahrirlash")).toContainText("+25%");
  await expect(page.getByLabel("Madina Islomova KPI 2 taklifini tahrirlash")).toContainText("+10%");
  await page.getByRole("button", { name: /Toshkent markaz/ }).click();
  await page.getByRole("button", { name: /Akbar Sodiqov/ }).click();
  await expect(page.getByLabel("Aziz Karimov KPI 1 taklifini tahrirlash")).toContainText("+10%");
});

test("missing data is blocked until a reasoned manual plan is entered", async ({ page }) => {
  await openClosedMonth(page);
  await page.getByLabel("Agent qidirish").fill("AG-007");
  await page.getByRole("button", { name: /Chirchiq/ }).click();
  await page.getByRole("button", { name: /Lola Mirzayeva/ }).click();
  await page.getByLabel("Bobur Nazarov hisob tafsiloti").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/fakt ma’lumoti yo‘q/i)).toBeVisible();
  await dialog.getByLabel("TAKLIF SUMMASI, SO‘M").fill("50000000");
  await dialog.getByRole("button", { name: "Qo‘lda saqlash" }).click();
  await expect(dialog.getByText("Qo‘lda o‘zgartirish sababi majburiy.")).toBeVisible();
  await dialog.getByLabel("SABAB (MAJBURIY)").fill("Yangi agent, hudud rejasi");
  await dialog.getByRole("button", { name: "Qo‘lda saqlash" }).click();
  await expect(dialog.getByText("Tekshiring", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Ma’lumot kerak", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("shows the previous plan in the inline editor when fact is unusable", async ({ page }) => {
  await openClosedMonth(page);
  await page.getByRole("button", { name: /Chirchiq/ }).click();
  await page.getByRole("button", { name: /Lola Mirzayeva/ }).click();
  const cell = page.getByLabel("Otabek Umarov KPI 1 taklifini tahrirlash");
  await expect(cell).toContainText("Eski reja");
  await cell.click();
  const editor = page.getByRole("group", { name: "Otabek Umarov KPI 1 katak editori" });
  await expect(editor.getByText(/Fakt yo‘q · eski reja/)).toBeVisible();
  await editor.getByRole("button", { name: "Eski rejani asos qilib olish" }).click();
  await expect(editor.getByLabel("Otabek Umarov KPI 1 asos")).toHaveValue("previous_plan");
  await page.getByLabel("Saqlash", { exact: true }).click();
  await expect(cell).toContainText("Eski reja");
  const value = (await cell.locator("span.numeric").first().textContent())?.trim();
  expect(value).not.toBe("—");
  expect(value).not.toBe("0");
});

test("one shared draft is a ready table: inline edit, per-cell history and reload persistence", async ({
  page
}) => {
  await openClosedMonth(page);
  await page.getByRole("tab", { name: /Umumiy draft/ }).click();
  await expect(
    page.getByRole("heading", { name: "Umumiy taklifiy reja drafti", exact: true })
  ).toBeVisible();
  const table = page.getByRole("table", { name: "Umumiy taklifiy reja draft jadvali" });
  await expect(table).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hamma uchun bitta umumiy draft" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Asosiy assortiment/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "MANBA FAKT" })).toHaveCount(0);
  await page.getByRole("button", { name: "Asosiy assortiment ustunini kengaytirish" }).click();
  await expect(table.getByRole("columnheader", { name: "MANBA FAKT" })).toBeVisible();
  await expect(table.getByLabel("Aziz Karimov KPI 1 tarixi")).toHaveCount(1);

  await page.getByLabel("Aziz Karimov KPI 1 qatorini tahrirlash").click();
  await expect(page.getByRole("group", { name: "Aziz Karimov KPI 1 qator editori" })).toBeVisible();
  await page.getByLabel("Aziz Karimov KPI 1 qiymat").fill("7");
  await page.getByRole("button", { name: "Qatorni saqlash", exact: true }).click();
  await expect(table.getByRole("cell", { name: "Sof fakt + 7%", exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /Umumiy draft/ }).click();
  await page.getByRole("button", { name: "Asosiy assortiment ustunini kengaytirish" }).click();
  await expect(
    page
      .getByRole("table", { name: "Umumiy taklifiy reja draft jadvali" })
      .getByRole("cell", { name: "Sof fakt + 7%", exact: true })
  ).toBeVisible();

  await page.getByLabel("Aziz Karimov KPI 1 tarixi").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Aziz Karimov · KPI 1 tarixi" })).toBeVisible();
  await expect(dialog.getByRole("table", { name: "Katak o‘zgartirishlari tarixi" })).toContainText(
    "Planlovchi"
  );
  await expect(dialog).toContainText("Formula o‘zgartirildi");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("table", { name: "Umumiy o‘zgartirishlar tarixi" })).toContainText(
    "Planlovchi"
  );
});

test("draft table groups by hierarchy and expands KPI detail columns", async ({ page }) => {
  await openClosedMonth(page);
  await page.getByRole("tab", { name: /Umumiy draft/ }).click();
  const table = page.getByRole("table", { name: "Umumiy taklifiy reja draft jadvali" });
  await expect(page.getByRole("button", { name: "Toshkent markaz blokini yopish" })).toBeVisible();
  const chirchiq = page.getByRole("button", { name: "Chirchiq blokini ochish" });
  await expect(chirchiq).toBeVisible();
  await expect(chirchiq.locator("xpath=../..")).toContainText("194 370 000");
  await chirchiq.click();
  await page.getByRole("button", { name: "Lola Mirzayeva blokini ochish" }).click();
  await expect(table.getByLabel("Bobur Nazarov KPI 1 tarixi")).toBeVisible();
  await page.getByRole("button", { name: "Asosiy assortiment ustunini kengaytirish" }).click();
  await expect(table.getByRole("columnheader", { name: "MANBA FAKT" })).toBeVisible();
  await page.getByRole("button", { name: "Asosiy assortiment ustunini yopish" }).click();
  await expect(table.getByRole("columnheader", { name: "MANBA FAKT" })).toHaveCount(0);
  await page.getByRole("button", { name: "Asosiy assortiment ustunini kengaytirish" }).click();
  await expect(table.getByRole("columnheader", { name: "MANBA FAKT" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "AMALLAR" })).toBeVisible();
  await page.getByRole("button", { name: "Samarqand blokini ochish" }).click();
  await page.getByRole("button", { name: "Rustam Karimov blokini ochish" }).click();
  await expect(table.getByText(/Eski reja .* so‘m/).first()).toBeVisible();
});

test("outcomes page lists which proposals justified and which did not", async ({ page }) => {
  await openClosedMonth(page);
  await page.getByRole("tab", { name: "Oqlash tahlili" }).click();
  await expect(
    page.getByRole("heading", { name: "Takliflar natijasi", exact: true })
  ).toBeVisible();
  const summary = page.getByRole("table", { name: "Taklif usullari xulosasi" });
  await expect(summary).toContainText("Sof fakt +10%");
  await expect(summary).toContainText("Sof fakt +5%");
  await expect(summary).toContainText("Joriy umumiy draft");
  await expect(summary.getByText("O‘zini oqladi").first()).toBeVisible();
  await expect(summary.getByText(/Oqlanmadi/).first()).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: "Taklif usullarining xodim va KPI kesimidagi natijalari"
    })
  ).toBeVisible();
  await expect(page.getByLabel("Baholash oyi")).toHaveValue("2026-10");
  await page.getByLabel("Baholash chegarasi").selectOption("10");
  await expect(page.getByText(/Farq ±10% ichida/)).toBeVisible();
});

test("outcomes matrix groups by hierarchy and expands KPI detail columns", async ({ page }) => {
  await openClosedMonth(page);
  await page.getByRole("tab", { name: "Oqlash tahlili" }).click();
  const table = page.getByRole("table", {
    name: "Taklif usullarining xodim va KPI kesimidagi natijalari"
  });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Asosiy assortiment/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "HAQIQIY FAKT" })).toHaveCount(0);
  await expect(table.getByRole("cell", { name: /Asosiy assortiment/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Toshkent markaz blokini yopish" })).toBeVisible();
  const chirchiq = page.getByRole("button", { name: "Chirchiq blokini ochish" });
  await expect(chirchiq.locator("xpath=../..")).toContainText("fakt jami");
  await chirchiq.click();
  await page.getByRole("button", { name: "Lola Mirzayeva blokini ochish" }).click();
  await expect(table.getByLabel("Bobur Nazarov KPI 1 natijasi")).toBeVisible();

  await page.getByRole("button", { name: "Asosiy assortiment ustunini kengaytirish" }).click();
  await expect(table.getByRole("columnheader", { name: "HAQIQIY FAKT" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "FAKT +10%" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "ENG YAQIN USUL" })).toBeVisible();
  const region = page.getByRole("region", {
    name: "Natijalar KPI tafsilotlari gorizontal surish maydoni"
  });
  const [scrollWidth, clientWidth] = await region.evaluate((el) => [
    el.scrollWidth,
    el.clientWidth
  ]);
  expect(scrollWidth).toBeGreaterThan(clientWidth);
  await page.getByRole("button", { name: "Asosiy assortiment ustunini yopish" }).click();
  await expect(table.getByRole("columnheader", { name: "HAQIQIY FAKT" })).toHaveCount(0);
});

test("deletes and restores a draft row and audits who did it", async ({ page }) => {
  await openClosedMonth(page);
  await page.getByRole("tab", { name: /Umumiy draft/ }).click();
  await page.getByRole("button", { name: "Asosiy assortiment ustunini kengaytirish" }).click();
  const removeButton = page.getByLabel("Aziz Karimov KPI 1 qatorini o‘chirish");
  await expect(removeButton).toHaveCount(1);
  await removeButton.click();
  await page.getByRole("dialog").getByRole("button", { name: "O‘chirish", exact: true }).click();
  await expect(page.getByText("O‘chirilgan qatorlar: 1 ta")).toBeVisible();
  await expect(page.getByLabel("Aziz Karimov KPI 1 qatorini o‘chirish")).toHaveCount(0);
  await expect(page.getByLabel("Aziz Karimov KPI 1 tarixi")).toHaveCount(0);
  await expect(
    page
      .getByRole("table", { name: "Umumiy taklifiy reja draft jadvali" })
      .getByText("Qator o‘chirilgan")
  ).toBeVisible();
  await expect(page.getByRole("table", { name: "Umumiy o‘zgartirishlar tarixi" })).toContainText(
    "Qator o‘chirildi"
  );
  await page.getByLabel("Aziz Karimov KPI 1 qatorini tiklash").click();
  await expect(page.getByLabel("Aziz Karimov KPI 1 qatorini o‘chirish")).toHaveCount(1);
});

test("exports and imports the single shared draft as JSON", async ({ page }) => {
  await openClosedMonth(page);
  await page.getByRole("tab", { name: /Umumiy draft/ }).click();
  const event = page.waitForEvent("download");
  await page.getByTitle("JSON yuklab olish").click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/^salec-umumiy-draft-.*\.json$/);
  const json = await page.evaluate(() =>
    localStorage.getItem("salec.plans-proposal.demo.shared.v3")
  );
  expect(json).toContain('"version":3');
  await page.getByLabel("Draft JSON fayli").setInputFiles({
    name: "umumiy-draft.json",
    mimeType: "application/json",
    buffer: Buffer.from(json!)
  });
  await expect(page.getByRole("status")).toContainText("umumiy draft sifatida yuklandi");
  await expect(page.getByRole("tab", { name: /Umumiy draft/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("exports CSV with KPI columns, audit reasons and quality flags", async ({ page }) => {
  await openClosedMonth(page);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV eksport" }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("salec-taklif-2026-12-dir-1.csv");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("KPI nomi");
  expect(csv).toContain("Ogohlantirishlar");
  expect(csv).toContain("NO_FACT");
  expect(csv).toContain("AG-007");
});

test("future source months are labelled as missing, not MTD", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Maqsad yili", { exact: true }).selectOption("2027");
  await page.getByLabel("Maqsad oyi", { exact: true }).selectOption("1");
  await expect(page.getByLabel("Manba oyi", { exact: true })).toHaveValue("2026-12");
  await expect(page.getByText("Manba oyi hali kelmagan.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yopilgan oyga o‘tish" }).click();
  await expect(page.getByLabel("Manba oyi", { exact: true })).toHaveValue("2026-10");
  await expect(page.getByText("Manba oyi hali kelmagan.", { exact: true })).toHaveCount(0);
});

test("mobile layout keeps the page within the viewport and opens navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Taklifiy reja", exact: true })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(overflow).toBe(false);
  await page.getByLabel("Menyuni ochish").click();
  await expect(page.getByRole("navigation", { name: "Asosiy navigatsiya" })).toBeVisible();
  await page.getByRole("button", { name: "Natijalar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Takliflar natijasi" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  ).toBe(false);
});
