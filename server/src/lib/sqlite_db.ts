// src/lib/database.ts
import * as sqlite3 from 'sqlite3';

export const db = new sqlite3.Database('/data/databases/poker.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});
