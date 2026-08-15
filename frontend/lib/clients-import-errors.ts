/** BullMQ / server import job xabarlarini foydalanuvchi uchun qisqartirish. */
export function humanizeClientImportJobError(message: string): string {
  const m = message.trim();
  if (!m) return "Импорт не выполнен.";

  if (/too many bind variables/i.test(m) || /32767/.test(m)) {
    return (
      "Ошибка базы данных при загрузке клиентов (лимит PostgreSQL). " +
      "Перезапустите dev-сервер (API + worker) и повторите импорт. " +
      "Если ошибка останется — разделите файл на части по ~20 000 строк."
    );
  }

  if (/faylda juda ko['’]p noyob mijoz/i.test(m)) {
    return (
      "Слишком много уникальных ИД клиентов в одном файле. " +
      "Разделите файл на части (например, по 10 000–20 000 строк) и импортируйте по очереди."
    );
  }

  if (/Invalid `prisma\./i.test(m)) {
    const assertion = m
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /Assertion violation|too many bind variables/i.test(l));
    if (assertion) return humanizeClientImportJobError(assertion);
    return "Ошибка базы данных при импорте. Уменьшите размер файла или повторите позже.";
  }

  if (m === "ImportFailed") return "Импорт не выполнен.";
  if (m === "ImportPollingTimeout") {
    return "Импорт не завершился вовремя. Проверьте, что background worker запущен, и повторите.";
  }

  return m;
}
