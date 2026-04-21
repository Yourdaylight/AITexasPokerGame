import mysql.connector
import sqlite3
from flask import g
from flask import Flask, render_template_string
app = Flask(__name__)
CONFIG_TYPE = "sqlite"
# MySQL数据库连接配置
config = {
    'user': 'root',
    'password': '123456',
    'host': '192.168.1.6',
    'database': 'poker',
    'raise_on_warnings': True,
}


mysql_config = {
    'type': 'mysql',
    'user': 'root',
    'password': '123456',
    'host': '192.168.1.6',
    'database': 'poker',
    'raise_on_warnings': True,
}

sqlite_config = {
    'type': 'sqlite',
    'database': '/data/databases/poker.db',  # SQLite 数据库文件路径
}

# 扑克牌数字映射
card_numbers = {
    'a': '2',
    'b': '3',
    'c': '4',
    'd': '5',
    'e': '6',
    'f': '7',
    'g': '8',
    'h': '9',
    'i': 'T',
    'j': 'J',
    'k': 'Q',
    'l': 'K',
    'm': 'A',
}

# 扑克牌花色映射
card_suits = {
    '1': '♦',  # 方块
    '2': '♣',  # 梅花
    '3': '♥',  # 红心
    '4': '♠',  # 黑桃
}


def get_db_connection(db_type):
    if db_type == 'mysql':
        return mysql.connector.connect(**config)
    elif db_type == 'sqlite':
        db = getattr(g, '_database', None)
        if db is None:
            db = g._database = sqlite3.connect(sqlite_config['database'])
        return db
    else:
        raise ValueError("Unsupported database type")
    
def convert_handcard(hand_card):
    
    cards = hand_card.split(',')
    result = []
    for card in cards:
            number, suit = card[0], card[1]
            color = 'red' if card_suits[suit] in ['♦', '♥'] else 'black'
            result.append(f'<span style="color: {color};">{card_numbers[number]}{card_suits[suit]}</span>')
    return ' '.join(result)


def query_db(config, room_number, limit):
    try:
        cnx = get_db_connection(config)
        cursor = cnx.cursor(buffered=True) if config == 'mysql' else cnx.cursor()

        query = ("SELECT handCard, userId FROM player "
                 "WHERE roomNumber=? ORDER BY create_time DESC LIMIT ?")
        cursor.execute(query, (room_number, limit))

        results = cursor.fetchall()
        cursor.close()

        lines = []
        for (handCard, userId) in results:
            nickName = get_nickname(cnx, userId)
            line = f'{nickName}: {convert_handcard(handCard)}'
            lines.append(line)
        return lines

    except (mysql.connector.Error, sqlite3.Error) as err:
        print(f"Error: {err}")
    finally:
        if cnx:
            cnx.close()

# 修改 get_nickname 以适配 SQLite
def get_nickname(cnx, user_id):
    cursor = cnx.cursor()
    query = "SELECT nickName FROM user WHERE id=?"
    cursor.execute(query, (user_id,))
    result = cursor.fetchone()
    cursor.close()
    return result[0] if result else "Unknown"


# 示例：查询房间号123的最新5条记录
# @app.route('/')
# def show_lines():
#     room_number = 617532  # 示例房间号
#     limit = 7  # 示例限制
#     lines = query_db(CONFIG_TYPE, room_number, limit)
#     # 使用简单的HTML模板直接渲染lines
#     return render_template_string('''
#             <h1>Poker Hands for Room {{ room_number }}</h1>
#             <ul>
#             {% for line in lines %}
#                 <li>{{ line|safe }}</li>
#             {% endfor %}
#             </ul>
#     ''', lines=lines)

@app.route('/poker/<int:room_number>/<int:limit>')
def show_poker_hands(room_number, limit):
    try:
        lines = query_db(CONFIG_TYPE, room_number, limit)
        # 使用简单的HTML模板直接渲染lines，此处已对花色进行颜色处理
        return render_template_string('''
            <h1>Poker Hands for Room {{ room_number }}</h1>
            <ul>
            {% for line in lines %}
                <li>{{ line|safe }}</li>
            {% endfor %}
            </ul>
        ''', lines=lines, room_number=room_number)
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == '__main__':
    app.run(debug=True, port=5001)