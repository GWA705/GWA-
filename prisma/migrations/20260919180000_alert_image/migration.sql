-- Optional image for a must-read pop-up alert (a flyer / notice shown in the modal).
ALTER TABLE "DealerAlert" ADD COLUMN "imageStorageKey" TEXT;
ALTER TABLE "DealerAlert" ADD COLUMN "imageMime" TEXT;
