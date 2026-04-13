-- CreateTable: league_affiliates
CREATE TABLE "league_affiliates" (
    "id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "affiliate_code" VARCHAR(12) NOT NULL,
    "revenue_share_pct" INTEGER NOT NULL DEFAULT 0,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "league_affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: affiliate_referrals
CREATE TABLE "affiliate_referrals" (
    "id" SERIAL NOT NULL,
    "affiliate_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affiliate_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: affiliate_commissions
CREATE TABLE "affiliate_commissions" (
    "id" SERIAL NOT NULL,
    "affiliate_id" INTEGER NOT NULL,
    "league_id" INTEGER NOT NULL,
    "bet_slip_id" INTEGER,
    "referral_user_id" INTEGER NOT NULL,
    "bet_amount" INTEGER NOT NULL,
    "league_profit" INTEGER NOT NULL,
    "commission_pct" INTEGER NOT NULL,
    "commission_amt" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "league_affiliates_affiliate_code_key" ON "league_affiliates"("affiliate_code");
CREATE INDEX "league_affiliates_affiliate_code_idx" ON "league_affiliates"("affiliate_code");
CREATE UNIQUE INDEX "league_affiliates_league_id_user_id_key" ON "league_affiliates"("league_id", "user_id");

CREATE UNIQUE INDEX "affiliate_referrals_affiliate_id_user_id_key" ON "affiliate_referrals"("affiliate_id", "user_id");

CREATE INDEX "affiliate_commissions_affiliate_id_created_at_idx" ON "affiliate_commissions"("affiliate_id", "created_at");
CREATE INDEX "affiliate_commissions_league_id_created_at_idx" ON "affiliate_commissions"("league_id", "created_at");

-- AddForeignKey
ALTER TABLE "league_affiliates" ADD CONSTRAINT "league_affiliates_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_affiliates" ADD CONSTRAINT "league_affiliates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_affiliates" ADD CONSTRAINT "league_affiliates_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "league_affiliates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "league_affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "league_affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
