-- Müdafiə qatı: eyni otaq/avadanlıq üçün üst-üstə düşən aktiv rezervasiyaları baza səviyyəsində
-- qadağan edir. Tətbiq səviyyəsində Serializable tranzaksiya ilə yoxlama hər halda aparılır.
-- btree_gist genişlənməsi mövcud olmayan hostinqlərdə (bəzi idarə olunan Postgres xidmətləri)
-- miqrasiya xəta vermir — sadəcə bu əlavə qat aktivləşmir.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_time_order') THEN
    ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_time_order" CHECK ("endAt" > "startAt");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentReservation_time_order') THEN
    ALTER TABLE "EquipmentReservation" ADD CONSTRAINT "EquipmentReservation_time_order" CHECK ("endAt" > "startAt");
  END IF;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS btree_gist;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'btree_gist mövcud deyil (%): üst-üstə düşmə yalnız tətbiq səviyyəsində yoxlanılacaq', SQLERRM;
    RETURN;
  END;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_no_overlap') THEN
    ALTER TABLE "Reservation"
      ADD CONSTRAINT "Reservation_no_overlap"
      EXCLUDE USING gist ("roomId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
      WHERE ("status" IN ('BOOKED', 'ACTIVE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentReservation_no_overlap') THEN
    ALTER TABLE "EquipmentReservation"
      ADD CONSTRAINT "EquipmentReservation_no_overlap"
      EXCLUDE USING gist ("equipmentId" WITH =, tsrange("startAt", "endAt", '[)') WITH &&)
      WHERE ("status" IN ('BOOKED', 'ISSUED'));
  END IF;
END $$;
