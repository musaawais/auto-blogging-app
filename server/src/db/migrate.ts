import { sqlite } from "./index";

export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      wordpress_site_id INTEGER,
      default_word_count INTEGER NOT NULL DEFAULT 1500,
      default_language TEXT NOT NULL DEFAULT 'en',
      default_country TEXT NOT NULL DEFAULT 'US',
      auto_publish INTEGER NOT NULL DEFAULT 0,
      auto_humanize INTEGER NOT NULL DEFAULT 1,
      total_keywords INTEGER NOT NULL DEFAULT 0,
      total_articles INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      word_count INTEGER,
      language TEXT NOT NULL DEFAULT 'en',
      country TEXT NOT NULL DEFAULT 'US',
      target_url TEXT,
      category TEXT,
      publish_date TEXT,
      article_id INTEGER,
      search_volume INTEGER,
      difficulty INTEGER,
      intent TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT,
      keyword TEXT NOT NULL,
      keyword_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      content TEXT,
      meta_title TEXT,
      meta_description TEXT,
      word_count INTEGER,
      readability_score INTEGER,
      seo_score INTEGER,
      ai_score INTEGER,
      featured_image_url TEXT,
      image_count INTEGER NOT NULL DEFAULT 0,
      faq_json TEXT,
      schema_json TEXT,
      ai_provider TEXT,
      image_provider TEXT,
      wordpress_site_id INTEGER,
      wordpress_post_id INTEGER,
      wordpress_post_url TEXT,
      published_at TEXT,
      scheduled_at TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS wordpress_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      username TEXT NOT NULL,
      app_password_encrypted TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      posts_published INTEGER NOT NULL DEFAULT 0,
      last_sync_at TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS workflow_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword_id INTEGER NOT NULL,
      article_id INTEGER,
      project_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      current_step TEXT,
      total_steps INTEGER NOT NULL DEFAULT 4,
      completed_steps INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS publishing_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      site_id INTEGER NOT NULL,
      category_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_at TEXT,
      published_at TEXT,
      wordpress_post_id INTEGER,
      wordpress_post_url TEXT,
      error TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'openai',
      purpose TEXT NOT NULL DEFAULT 'text',
      key_encrypted TEXT NOT NULL,
      key_preview TEXT,
      model_name TEXT,
      endpoint_url TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_id INTEGER,
      entity_type TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      wordpress_site_id INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'daily',
      articles_per_run INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  console.log("[DB] Migrations complete");

  // Seed a default project if none exists
  const count = sqlite.prepare("SELECT COUNT(*) as c FROM projects").get() as { c: number };
  if (count.c === 0) {
    sqlite.prepare(`
      INSERT INTO projects (name, description, status) VALUES ('Default Project', 'Your first HumanSEO project', 'active')
    `).run();
    console.log("[DB] Seeded default project");
  }
}
