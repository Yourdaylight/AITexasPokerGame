// src/lib/database.ts
import * as sqlite3 from 'sqlite3';

export const db = new sqlite3.Database('/data/databases/poker.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});


export const logger_db = (logs: string, location: string) => {
  const currentTime = new Date();
  //写一个精确到毫秒的时间字符串
  const year = currentTime.getFullYear();
  const month = currentTime.getMonth() + 1;
  const day = currentTime.getDate();
  const hour = currentTime.getHours();
  const minute = currentTime.getMinutes();
  const second = currentTime.getSeconds();
  const milliseconds = currentTime.getMilliseconds();

  const time = `${year}-${month}-${day} ${hour}:${minute}:${second}.${milliseconds}`;
  const log_sql = `INSERT INTO logs (log_content, create_time, location, date_str) VALUES (?, ?, ?, ?)`;
  db.run(log_sql, [logs, currentTime.getTime(), location, time], function(err) {
    if (err) {
      console.log('ERROR TO LOG:', err, 'SQL:',log_sql);
    }
  });
};