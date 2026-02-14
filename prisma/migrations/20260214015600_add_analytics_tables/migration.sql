-- CreateTable
CREATE TABLE "analytics_sessions" (
    "id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "user_agent" VARCHAR(500),
    "referrer" VARCHAR(500),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" SERIAL NOT NULL,
    "session_id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "page_path" VARCHAR(500) NOT NULL,
    "referrer" VARCHAR(500),
    "viewport_width" INTEGER,
    "viewport_height" INTEGER,
    "search_query" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_sessions_visitor_id_idx" ON "analytics_sessions"("visitor_id");

-- CreateIndex
CREATE INDEX "analytics_sessions_started_at_idx" ON "analytics_sessions"("started_at");

-- CreateIndex
CREATE INDEX "analytics_events_session_id_idx" ON "analytics_events"("session_id");

-- CreateIndex
CREATE INDEX "analytics_events_visitor_id_idx" ON "analytics_events"("visitor_id");

-- CreateIndex
CREATE INDEX "analytics_events_event_type_idx" ON "analytics_events"("event_type");

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- CreateIndex
CREATE INDEX "analytics_events_page_path_idx" ON "analytics_events"("page_path");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "analytics_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
