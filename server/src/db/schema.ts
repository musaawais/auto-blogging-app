import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsTable = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  wordPressSiteId: integer("wordpress_site_id"),
  defaultWordCount: integer("default_word_count").notNull().default(1500),
  defaultLanguage: text("default_language").notNull().default("en"),
  defaultCountry: text("default_country").notNull().default("US"),
  autoPublish: integer("auto_publish", { mode: "boolean" }).notNull().default(false),
  autoHumanize: integer("auto_humanize", { mode: "boolean" }).notNull().default(true),
  totalKeywords: integer("total_keywords").notNull().default(0),
  totalArticles: integer("total_articles").notNull().default(0),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── Keywords ──────────────────────────────────────────────────────────────────
export const keywordsTable = sqliteTable("keywords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyword: text("keyword").notNull(),
  projectId: integer("project_id").notNull(),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  wordCount: integer("word_count"),
  language: text("language").notNull().default("en"),
  country: text("country").notNull().default("US"),
  targetUrl: text("target_url"),
  category: text("category"),
  publishDate: text("publish_date"),
  articleId: integer("article_id"),
  searchVolume: integer("search_volume"),
  difficulty: integer("difficulty"),
  intent: text("intent"),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── Articles ──────────────────────────────────────────────────────────────────
export const articlesTable = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug"),
  keyword: text("keyword").notNull(),
  keywordId: integer("keyword_id").notNull(),
  projectId: integer("project_id").notNull(),
  status: text("status").notNull().default("draft"),
  content: text("content"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  wordCount: integer("word_count"),
  readabilityScore: integer("readability_score"),
  seoScore: integer("seo_score"),
  aiScore: integer("ai_score"),
  featuredImageUrl: text("featured_image_url"),
  imageCount: integer("image_count").notNull().default(0),
  faqJson: text("faq_json"),
  schemaJson: text("schema_json"),
  aiProvider: text("ai_provider"),
  imageProvider: text("image_provider"),
  wordPressSiteId: integer("wordpress_site_id"),
  wordPressPostId: integer("wordpress_post_id"),
  wordPressPostUrl: text("wordpress_post_url"),
  publishedAt: text("published_at"),
  scheduledAt: text("scheduled_at"),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── WordPress Sites ───────────────────────────────────────────────────────────
export const wordPressSitesTable = sqliteTable("wordpress_sites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  username: text("username").notNull(),
  appPasswordEncrypted: text("app_password_encrypted").notNull(),
  status: text("status").notNull().default("active"),
  postsPublished: integer("posts_published").notNull().default(0),
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── Workflow Jobs ─────────────────────────────────────────────────────────────
export const workflowJobsTable = sqliteTable("workflow_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keywordId: integer("keyword_id").notNull(),
  articleId: integer("article_id"),
  projectId: integer("project_id").notNull(),
  status: text("status").notNull().default("pending"),
  currentStep: text("current_step"),
  totalSteps: integer("total_steps").notNull().default(4),
  completedSteps: integer("completed_steps").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── Publishing Queue ──────────────────────────────────────────────────────────
export const publishingQueueTable = sqliteTable("publishing_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  articleId: integer("article_id").notNull(),
  siteId: integer("site_id").notNull(),
  categoryId: integer("category_id"),
  status: text("status").notNull().default("pending"),
  scheduledAt: text("scheduled_at"),
  publishedAt: text("published_at"),
  wordPressPostId: integer("wordpress_post_id"),
  wordPressPostUrl: text("wordpress_post_url"),
  error: text("error"),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── API Keys ──────────────────────────────────────────────────────────────────
export const apiKeysTable = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  provider: text("provider").notNull().default("openai"),
  purpose: text("purpose").notNull().default("text"),
  keyEncrypted: text("key_encrypted").notNull(),
  keyPreview: text("key_preview"),
  modelName: text("model_name"),
  endpointUrl: text("endpoint_url"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── Activity Log ──────────────────────────────────────────────────────────────
export const activityLogTable = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  entityId: integer("entity_id"),
  entityType: text("entity_type"),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsTable = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

// ── Schedules ─────────────────────────────────────────────────────────────────
export const schedulesTable = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  projectId: integer("project_id").notNull(),
  wordPressSiteId: integer("wordpress_site_id").notNull(),
  frequency: text("frequency").notNull().default("daily"),
  articlesPerRun: integer("articles_per_run").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at").default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});
