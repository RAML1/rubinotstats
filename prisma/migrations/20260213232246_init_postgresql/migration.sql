-- CreateTable
CREATE TABLE "worlds" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "pvp_type" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worlds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "world_id" INTEGER NOT NULL,
    "vocation" VARCHAR(50),
    "guild_name" VARCHAR(255),
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_snapshots" (
    "id" SERIAL NOT NULL,
    "character_id" INTEGER NOT NULL,
    "captured_date" DATE NOT NULL,
    "level" INTEGER,
    "experience" BIGINT,
    "magic_level" INTEGER,
    "fist" INTEGER,
    "club" INTEGER,
    "sword" INTEGER,
    "axe" INTEGER,
    "distance" INTEGER,
    "shielding" INTEGER,
    "fishing" INTEGER,
    "exp_rank" INTEGER,
    "ml_rank" INTEGER,
    "exp_gained" BIGINT,
    "levels_gained" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auctions" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "character_name" VARCHAR(255) NOT NULL,
    "level" INTEGER,
    "vocation" VARCHAR(50),
    "gender" VARCHAR(20),
    "world" VARCHAR(100),
    "auction_start" VARCHAR(100),
    "auction_end" VARCHAR(100),
    "sold_price" INTEGER,
    "coins_per_level" DOUBLE PRECISION,
    "magic_level" INTEGER,
    "fist" INTEGER,
    "club" INTEGER,
    "sword" INTEGER,
    "axe" INTEGER,
    "distance" INTEGER,
    "shielding" INTEGER,
    "fishing" INTEGER,
    "hit_points" INTEGER,
    "mana" INTEGER,
    "capacity" INTEGER,
    "speed" INTEGER,
    "experience" VARCHAR(50),
    "creation_date" VARCHAR(100),
    "achievement_points" INTEGER,
    "mounts_count" INTEGER,
    "outfits_count" INTEGER,
    "titles_count" INTEGER,
    "linked_tasks" INTEGER,
    "daily_reward_streak" INTEGER,
    "charm_expansion" BOOLEAN,
    "charm_points" INTEGER,
    "unused_charm_points" INTEGER,
    "spent_charm_points" INTEGER,
    "prey_slots" INTEGER,
    "prey_wildcards" INTEGER,
    "hunting_task_points" INTEGER,
    "hirelings" INTEGER,
    "hireling_jobs" INTEGER,
    "store_items_count" INTEGER,
    "boss_points" INTEGER,
    "blessings_count" INTEGER,
    "exalted_dust" VARCHAR(50),
    "gold" INTEGER,
    "bestiary" INTEGER,
    "url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "highscore_entries" (
    "id" SERIAL NOT NULL,
    "character_name" VARCHAR(255) NOT NULL,
    "world" VARCHAR(100) NOT NULL,
    "vocation" VARCHAR(50) NOT NULL,
    "level" INTEGER NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" BIGINT NOT NULL,
    "captured_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "highscore_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_stats" (
    "id" SERIAL NOT NULL,
    "vocation" VARCHAR(50) NOT NULL,
    "level_min" INTEGER NOT NULL,
    "level_max" INTEGER NOT NULL,
    "avg_price" DECIMAL,
    "median_price" DECIMAL,
    "min_price" INTEGER,
    "max_price" INTEGER,
    "price_per_level" DECIMAL,
    "price_per_ml" DECIMAL,
    "charm_point_value" DECIMAL,
    "sample_size" INTEGER,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist" (
    "id" SERIAL NOT NULL,
    "user_id" UUID,
    "character_name" VARCHAR(255),
    "auction_id" INTEGER,
    "notify_on_change" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "worlds_name_key" ON "worlds"("name");

-- CreateIndex
CREATE INDEX "characters_world_id_idx" ON "characters"("world_id");

-- CreateIndex
CREATE INDEX "characters_name_idx" ON "characters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "characters_name_world_id_key" ON "characters"("name", "world_id");

-- CreateIndex
CREATE INDEX "character_snapshots_character_id_idx" ON "character_snapshots"("character_id");

-- CreateIndex
CREATE INDEX "character_snapshots_captured_date_idx" ON "character_snapshots"("captured_date");

-- CreateIndex
CREATE UNIQUE INDEX "character_snapshots_character_id_captured_date_key" ON "character_snapshots"("character_id", "captured_date");

-- CreateIndex
CREATE UNIQUE INDEX "auctions_external_id_key" ON "auctions"("external_id");

-- CreateIndex
CREATE INDEX "auctions_vocation_idx" ON "auctions"("vocation");

-- CreateIndex
CREATE INDEX "auctions_level_idx" ON "auctions"("level");

-- CreateIndex
CREATE INDEX "auctions_world_idx" ON "auctions"("world");

-- CreateIndex
CREATE INDEX "auctions_sold_price_idx" ON "auctions"("sold_price");

-- CreateIndex
CREATE INDEX "highscore_entries_character_name_world_idx" ON "highscore_entries"("character_name", "world");

-- CreateIndex
CREATE INDEX "highscore_entries_world_category_captured_date_idx" ON "highscore_entries"("world", "category", "captured_date");

-- CreateIndex
CREATE INDEX "highscore_entries_category_captured_date_idx" ON "highscore_entries"("category", "captured_date");

-- CreateIndex
CREATE UNIQUE INDEX "highscore_entries_character_name_world_category_captured_da_key" ON "highscore_entries"("character_name", "world", "category", "captured_date");

-- CreateIndex
CREATE INDEX "market_stats_vocation_idx" ON "market_stats"("vocation");

-- CreateIndex
CREATE UNIQUE INDEX "market_stats_vocation_level_min_level_max_key" ON "market_stats"("vocation", "level_min", "level_max");

-- CreateIndex
CREATE INDEX "watchlist_user_id_idx" ON "watchlist"("user_id");

-- CreateIndex
CREATE INDEX "watchlist_auction_id_idx" ON "watchlist"("auction_id");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_snapshots" ADD CONSTRAINT "character_snapshots_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
