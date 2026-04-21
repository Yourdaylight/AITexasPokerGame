from flask import Flask, request, jsonify  
import smtplib  
from email.mime.multipart import MIMEMultipart  
from email.mime.text import MIMEText  
  
app = Flask(__name__)  
  
mailOptions = {  
    'PROTOCOL': 'smtp',  
    'SMTP_PORT': 587,  
    'SMTP_ADDR': 'smtp.qq.com',  
    'USER': 'yikechengxushu@qq.com',  
    'PASSWD': 'opbtjvxzehebbaie',  
}  
  
@app.route('/send_email', methods=['POST'])  
def send_email():  
    try:  

        data = request.get_json()
        from_addr = data.get('from', mailOptions['USER'])  
        to_addr = data['to']  
        subject = data['subject']  
        content = data['content']  
  
        msg = MIMEMultipart()  
        msg['From'] = from_addr  
        msg['To'] = to_addr  
        msg['Subject'] = subject  
        msg.attach(MIMEText(content, 'plain', 'utf-8'))  
  
        server = smtplib.SMTP(mailOptions['SMTP_ADDR'], mailOptions['SMTP_PORT'])  
        server.starttls()  
        server.login(mailOptions['USER'], mailOptions['PASSWD'])  
        text = msg.as_string()  
        server.sendmail(from_addr, to_addr, text)  
        server.quit()  
        return jsonify({'status': 'success', 'message': 'Email sent successfully!'}), 200  
    except Exception as e:  
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500 
    
@app.route('/', methods=['GET'])
def index():
    return "Hello, World!"
  
if __name__ == '__main__':  
    app.run(debug=True,host='0.0.0.0', port=8081)