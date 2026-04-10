-- CreateTable
CREATE TABLE "active_leagues" (
    "id" SERIAL NOT NULL,
    "api_football_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "logo" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_leagues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "active_leagues_api_football_id_key" ON "active_leagues"("api_football_id");
