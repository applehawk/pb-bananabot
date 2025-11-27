-- Исправление статуса существующих транзакций типа ADMIN_ADJUSTMENT
-- Эти транзакции должны быть помечены как COMPLETED, а не PENDING

-- Сначала проверим, сколько транзакций будет обновлено
SELECT 
    COUNT(*) as total_to_update,
    SUM("creditsAdded") as total_credits
FROM "Transaction"
WHERE "type" = 'ADMIN_ADJUSTMENT' 
  AND "status" = 'PENDING';

-- Обновляем статус на COMPLETED и устанавливаем completedAt
UPDATE "Transaction"
SET 
    "status" = 'COMPLETED',
    "completedAt" = COALESCE("completedAt", "createdAt")
WHERE "type" = 'ADMIN_ADJUSTMENT' 
  AND "status" = 'PENDING';

-- Проверяем результат
SELECT 
    "type",
    "status",
    COUNT(*) as count,
    SUM("creditsAdded") as total_credits
FROM "Transaction"
WHERE "type" = 'ADMIN_ADJUSTMENT'
GROUP BY "type", "status"
ORDER BY "status";
