-- Foto hisobotlar: base64 data URI uchun VARCHAR(4000) yetarli emas
ALTER TABLE "client_photo_reports" ALTER COLUMN "image_url" SET DATA TYPE TEXT;
