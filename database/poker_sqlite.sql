CREATE TABLE IF NOT EXISTS command_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  gameId INTEGER,
  type TEXT,
  gameStatus INTEGER,
  counter INTEGER,
  command TEXT,
  commonCard TEXT,
  pot INTEGER,
  roomNumber INTEGER,
  create_time TEXT DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT
);

CREATE TABLE IF NOT EXISTS game (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roomNumber INTEGER,
  status INTEGER,
  commonCard TEXT,
  winners TEXT,
  pot REAL,
  create_time TEXT DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT
);

CREATE TABLE IF NOT EXISTS player (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gameId INTEGER,
  roomNumber INTEGER,
  buyIn INTEGER NOT NULL,
  handCard TEXT,
  counter INTEGER,
  userId INTEGER,
  create_time TEXT DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT
);


CREATE TABLE IF NOT EXISTS room (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  smallBlind INTEGER,
  isShort INTEGER,
  time INTEGER,
  roomNumber TEXT,
  create_time TEXT DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT
);
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickName TEXT,
  password TEXT,
  account TEXT,
  email TEXT,
  is_active INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  create_time TEXT DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT
);

