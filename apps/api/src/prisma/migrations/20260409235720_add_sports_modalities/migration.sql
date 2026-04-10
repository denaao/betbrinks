-- AlterTable
ALTER TABLE "active_leagues" ADD COLUMN     "sport_id" INTEGER;

-- CreateTable
CREATE TABLE "sports" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "icon" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");

-- AddForeignKey
ALTER TABLE "active_leagues" ADD CONSTRAINT "active_leagues_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
