CREATE TABLE IF NOT EXISTS ai_conversation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  room_id TEXT DEFAULT '',
  game_id INTEGER DEFAULT 0,
  hand_card TEXT DEFAULT '',
  common_card TEXT DEFAULT '',
  stage TEXT DEFAULT '',
  title TEXT DEFAULT '',
  messages TEXT NOT NULL DEFAULT '[]',
  create_time TEXT DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversation_user_id ON ai_conversation(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_update_time ON ai_conversation(update_time);
