from flask import Flask, render_template, request, jsonify, send_file, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import mysql.connector
from mysql.connector import Error
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from web3 import Web3
import json
import os
import random
import qrcode
import io
import base64
import requests
from datetime import datetime, timedelta
import uuid
from cryptography.fernet import Fernet
import ipfshttpclient
from PIL import Image
from functools import wraps

app = Flask(__name__)
CORS(app, supports_credentials=True)

app.config.update(
    DB_HOST='localhost',
    DB_USER='root',
    DB_PASSWORD='',
    DB_NAME='blockchain_credentials',
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USERNAME='blockchainveritas@gmail.com',
    MAIL_PASSWORD='bjhclzpjtsgovbpl',
    MAIL_USE_TLS=True,
    UPLOAD_FOLDER='uploads',
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,
    ALLOWED_EXTENSIONS={'txt', 'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'},
    IPFS_API_URL='http://127.0.0.1:5001',
    SECRET_KEY='the-super-duper-secret-key-that-only-abdelkadir-knows-about'
)

app.secret_key = app.config['SECRET_KEY']
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ENCRYPTION_KEY = Fernet.generate_key()
cipher_suite = Fernet(ENCRYPTION_KEY)

def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host=app.config['DB_HOST'],
            user=app.config['DB_USER'],
            password=app.config['DB_PASSWORD'],
            database=app.config['DB_NAME']
        )
        return connection
    except Error as e:
        print(f"Database connection error: {e}")
        return None

def close_db_connection(connection, cursor=None):
    if cursor:
        cursor.close()
    if connection and connection.is_connected():
        connection.close()

with open("build/contract.json", "r") as f:
    data = json.load(f)

abi = data["abi"]
contract_address = data["address"]

w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:7545"))
contract = w3.eth.contract(address=contract_address, abi=abi)

with open("ganache_accounts.json", "r") as f:
    GANACHE_KEYS = json.load(f)["accounts"]

available_accounts = GANACHE_KEYS.copy()
in_use_accounts = []

def get_unique_account():
    if not available_accounts:
        return None
    account = random.choice(available_accounts)
    available_accounts.remove(account)
    in_use_accounts.append(account)
    return account

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def encrypt_private_key(private_key):
    return cipher_suite.encrypt(private_key.encode()).decode()

def decrypt_private_key(encrypted_key):
    return cipher_suite.decrypt(encrypted_key.encode()).decode()

def upload_to_ipfs(file_path):
    try:
        ipfs_api_url = "http://127.0.0.1:5001/api/v0/add"
        
        with open(file_path, 'rb') as file:
            files = {'file': file}
            response = requests.post(
                ipfs_api_url,
                files=files,
                params={'wrap-with-directory': 'false'}
            )
            
        if response.status_code == 200:
            result_lines = response.text.strip().split('\n')
            for line in result_lines:
                result = json.loads(line)
                if result.get('Name') and result.get('Hash'):
                    print(f"✅ IPFS upload successful: {result['Hash']}")
                    return result['Hash']
            raise Exception("No valid hash found in IPFS response")
        else:
            raise Exception(f"IPFS API returned status {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ IPFS upload error: {e}")
        return None

def generate_qr_code(data):
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = io.BytesIO()
    img.save(buffered)
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return img_str

def send_email(to_email, subject, body, is_html=False):
    try:
        msg = MIMEMultipart()
        msg['From'] = app.config['MAIL_USERNAME']
        msg['To'] = to_email
        msg['Subject'] = subject
        
        if is_html:
            msg.attach(MIMEText(body, 'html'))
        else:
            msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT'])
        server.starttls()
        server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
        text = msg.as_string()
        server.sendmail(app.config['MAIL_USERNAME'], to_email, text)
        server.quit()
        return True
    except Exception as e:
        print(f"Email sending error: {e}")
        return False

def log_credential_history(credential_id, action_type, user_id=None, verification_result=None, ip_address=None):
    connection = get_db_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor()
        query = """
        INSERT INTO credential_history 
        (credential_id, action_type, performed_by_user_id, verification_result, performed_by_ip)
        VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(query, (credential_id, action_type, user_id, verification_result, ip_address))
        connection.commit()
        return True
    except Error as e:
        print(f"History logging error: {e}")
        return False
    finally:
        close_db_connection(connection, cursor)

def require_login(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session or not session['logged_in']:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()
        
        # 'mobile' is no longer checked or required
        if not all([username, email, password]):
            return jsonify({"error": "Username, email, and password are required"}), 400
        
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        
        account = get_unique_account()
        if not account:
            return jsonify({"error": "No blockchain accounts available"}), 500
        
        password_hash = generate_password_hash(password)
        private_key = account["private_key"]
        
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500
        
        try:
            cursor = connection.cursor()
            
            cursor.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
            if cursor.fetchone():
                return jsonify({"error": "Username or email already exists"}), 400
            
            # The 'mobile_number' column has been removed from the query
            query = """
            INSERT INTO users (username, email, password_hash, blockchain_address, private_key)
            VALUES (%s, %s, %s, %s, %s)
            """
            # The 'mobile' variable has been removed from the execute call
            cursor.execute(query, (username, email, password_hash, account["address"], private_key))
            connection.commit()
            user_id = cursor.lastrowid
            
            subject = "Welcome to Blockchain Credentials!"
            body = f"""
            Dear {username},
            
            Welcome to our Blockchain Credential System!
            
            Your account has been created successfully:
            - Username: {username}
            - Email: {email}
            - Blockchain Address: {account["address"]}
            
            You can now log in and start issuing or verifying credentials.
            
            Best regards,
            Blockchain Credentials Team
            """
            send_email(email, subject, body)
            
            return jsonify({
                "message": "Registration successful",
                "user_id": user_id,
                "username": username,
                "email": email,
                "blockchain_address": account["address"]
            }), 201
            
        except Error as e:
            return jsonify({"error": f"Database error: {str(e)}"}), 500
        finally:
            close_db_connection(connection, cursor)
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        username = data.get("username", "").strip()
        password = data.get("password", "").strip()
        
        print(f"🔐 Login attempt for: {username}")
        
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
        
        connection = get_db_connection()
        if not connection:
            print("❌ Database connection failed")
            return jsonify({"error": "Database connection failed"}), 500
        
        try:
            cursor = connection.cursor()
            
            query = """
            SELECT id, username, email, password_hash, blockchain_address, private_key, is_active
            FROM users WHERE (username = %s OR email = %s) AND is_active = TRUE
            """
            cursor.execute(query, (username, username))
            user = cursor.fetchone()
            
            if not user:
                print(f"❌ User not found: {username}")
                return jsonify({"error": "Invalid username or password"}), 401
            
            print(f"✅ User found: {user[1]}")
            
            password_check = check_password_hash(user[3], password)
            print(f"🔑 Password check result: {password_check}")
            
            if not password_check:
                print("❌ Password verification failed")
                return jsonify({"error": "Invalid username or password"}), 401
            
            cursor.execute("UPDATE users SET last_login = NOW() WHERE id = %s", (user[0],))
            connection.commit()
            
            private_key = user[5]
            
            session['user_id'] = user[0]
            session['username'] = user[1]
            session['email'] = user[2]
            session['blockchain_address'] = user[4]
            session['logged_in'] = True
            
            print(f"✅ Login successful for: {user[1]}")
            
            return jsonify({
                "user_id": user[0],
                "username": user[1],
                "email": user[2],
                "address": user[4],
                "private_key": private_key
            }), 200
            
        except Error as e:
            print(f"❌ Database error during login: {e}")
            return jsonify({"error": f"Database error: {str(e)}"}), 500
        finally:
            close_db_connection(connection, cursor)
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200

@app.route("/check-session", methods=["GET"])
def check_session():
    if 'logged_in' in session and session['logged_in']:
        connection = get_db_connection()
        if connection:
            try:
                cursor = connection.cursor()
                query = """
                SELECT id, username, email, blockchain_address, private_key
                FROM users WHERE id = %s AND is_active = TRUE
                """
                cursor.execute(query, (session['user_id'],))
                user = cursor.fetchone()
                
                if user:
                    private_key = user[4]
                    return jsonify({
                        "logged_in": True,
                        "user_id": user[0],
                        "username": user[1],
                        "email": user[2],
                        "address": user[3],
                        "private_key": private_key
                    }), 200
                    
            except Error as e:
                print(f"Session check database error: {e}")
            finally:
                close_db_connection(connection, cursor)
    
    return jsonify({"logged_in": False}), 200

@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed"}), 400
        
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        ipfs_hash = upload_to_ipfs(file_path)
        os.remove(file_path)
        
        if ipfs_hash:
            return jsonify({
                "ipfs_hash": ipfs_hash,
                "filename": filename
            }), 200
        else:
            return jsonify({"error": "IPFS upload failed"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/issue", methods=["POST"])
@require_login
def issue_credential():
    try:
        req_data = request.get_json()
        issuer = req_data.get("issuer")
        owner_identifier = req_data.get("owner")
        ipfs_hash = req_data.get("ipfs_hash")
        credential_type = req_data.get("credential_type")

        if not all([issuer, owner_identifier, ipfs_hash, credential_type]):
            return jsonify({"error": "Missing required fields"}), 400

        owner_type = "email" if "@" in owner_identifier else "address"
        actual_owner_address = owner_identifier
        owner_email = None
        
        if owner_type == "email":
            connection = get_db_connection()
            if connection:
                cursor = connection.cursor()
                cursor.execute("SELECT blockchain_address FROM users WHERE email = %s", (owner_identifier,))
                result = cursor.fetchone()
                if result:
                    actual_owner_address = result[0]
                    owner_email = owner_identifier
                close_db_connection(connection, cursor)

        nonce = w3.eth.get_transaction_count(issuer["address"])
        txn = contract.functions.issueCredential(
            actual_owner_address, ipfs_hash, credential_type
        ).build_transaction({
            "from": issuer["address"],
            "nonce": nonce,
            "gas": 2000000,
            "gasPrice": w3.to_wei("20", "gwei")
        })

        signed_txn = w3.eth.account.sign_transaction(txn, private_key=issuer["private_key"])
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        credential_id = contract.events.CredentialIssued().process_receipt(tx_receipt)[0]['args']['credentialId']
        credential_id_hex = credential_id.hex()

        connection = get_db_connection()
        if connection:
            try:
                cursor = connection.cursor()
                query = """
                INSERT INTO credentials 
                (credential_id, issuer_user_id, owner_identifier, owner_type, ipfs_hash, credential_type, transaction_hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(query, (
                    credential_id_hex, issuer.get("user_id"), owner_identifier, 
                    owner_type, ipfs_hash, credential_type, tx_hash.hex()
                ))
                connection.commit()
                log_credential_history(credential_id_hex, "issued", issuer.get("user_id"))
                
            except Error as e:
                print(f"Database save error: {e}")
            finally:
                close_db_connection(connection, cursor)
        
        verify_url = f"http://localhost:3000/verify/{credential_id_hex}"
        ipfs_url = f"https://ipfs.io/ipfs/{ipfs_hash}"
        qr_code_base64 = generate_qr_code(ipfs_url)

        issuer_email = issuer.get("email")
        if issuer_email:
            subject = f"Credential Issued Successfully - {credential_type}"
            body = f"""
            Your credential has been issued successfully!
            
            Credential Details:
            - Type: {credential_type}
            - Recipient: {owner_identifier}
            - Credential ID: {credential_id_hex}
            - Transaction Hash: {tx_hash.hex()}
            - IPFS Hash: {ipfs_hash}
            
            The recipient has been notified via email.
            """
            send_email(issuer_email, subject, body)

        if owner_email:
            subject = f"New Credential Received - {credential_type}"
            body = f"""
            You have received a new blockchain credential!
            
            Credential Details:
            - Type: {credential_type}
            - Issued by: {issuer.get('username', 'Unknown')}
            - Credential ID: {credential_id_hex}
            - IPFS Document: https://ipfs.io/ipfs/{ipfs_hash}
            
            You can verify this credential at any time using the Credential ID.
            """
            send_email(owner_email, subject, body)

        return jsonify({
            "message": "Credential issued successfully",
            "credential_id": credential_id_hex,
            "transaction_hash": tx_hash.hex(),
            "qr_code": qr_code_base64,
            "verify_url": verify_url,
            "ipfs_url": ipfs_url
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/verify/<credential_id>", methods=["GET"])
def verify_credential(credential_id):
    try:
        cred_id_bytes = bytes.fromhex(credential_id)
        owner, ipfs_hash, credential_type, timestamp, issuer_address = contract.functions.verifyCredential(cred_id_bytes).call()

        connection = get_db_connection()
        additional_info = {}
        owner_name = None
        issuer_name = None
        
        if connection:
            cursor = connection.cursor()
            
            # Get credential info and issuer details
            query = """
            SELECT c.owner_identifier, c.owner_type, c.transaction_hash, u.username, u.email
            FROM credentials c
            LEFT JOIN users u ON c.issuer_user_id = u.id
            WHERE c.credential_id = %s
            """
            cursor.execute(query, (credential_id,))
            result = cursor.fetchone()
            
            if result:
                additional_info = {
                    "owner_identifier": result[0],
                    "owner_type": result[1],
                    "transaction_hash": result[2],
                    "issuer_username": result[3],
                    "issuer_email": result[4]
                }
                issuer_name = result[3]  # Get issuer username
            
            # Get owner name - check if owner is a registered user
            # First try by email (if owner_identifier is email)
            if result and result[1] == 'email':  # owner_type is email
                cursor.execute("SELECT username FROM users WHERE email = %s", (result[0],))
                owner_result = cursor.fetchone()
                if owner_result:
                    owner_name = owner_result[0]
            
            # If not found by email, try by blockchain address
            if not owner_name:
                cursor.execute("SELECT username FROM users WHERE blockchain_address = %s", (owner,))
                owner_result = cursor.fetchone()
                if owner_result:
                    owner_name = owner_result[0]
            
            # If still no name found, try by the owner identifier directly
            if not owner_name:
                cursor.execute("SELECT username FROM users WHERE username = %s OR email = %s", (result[0] if result else owner, result[0] if result else owner))
                owner_result = cursor.fetchone()
                if owner_result:
                    owner_name = owner_result[0]
            
            close_db_connection(connection, cursor)

        client_ip = request.environ.get('HTTP_X_REAL_IP', request.remote_addr)
        log_credential_history(credential_id, "verified", None, True, client_ip)

        verify_url = f"http://localhost:3000/verify/{credential_id}"
        qr_code_base64 = generate_qr_code(f"https://ipfs.io/ipfs/{ipfs_hash}")

        response_data = {
            "owner": owner,
            "owner_name": owner_name,  # Add owner name
            "issuer": issuer_address,
            "issuer_name": issuer_name,  # Add issuer name
            "ipfs_hash": ipfs_hash,
            "credential_type": credential_type,
            "timestamp": timestamp,
            "qr_code": qr_code_base64,
            "verify_url": verify_url,
            "ipfs_url": f"https://ipfs.io/ipfs/{ipfs_hash}"
        }
        
        response_data.update(additional_info)
        return jsonify(response_data), 200

    except Exception as e:
        client_ip = request.environ.get('HTTP_X_REAL_IP', request.remote_addr)
        log_credential_history(credential_id, "verified", None, False, client_ip)
        return jsonify({"error": str(e)}), 500

@app.route("/user/<int:user_id>/recent-activity", methods=["GET"])
@require_login
def get_user_recent_activity(user_id):
    try:
        # Verify the user is requesting their own data
        if session.get('user_id') != user_id:
            return jsonify({"error": "Unauthorized"}), 403
            
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()
        
        # Get user's email and blockchain address for filtering
        cursor.execute("SELECT email, blockchain_address FROM users WHERE id = %s", (user_id,))
        user_info = cursor.fetchone()
        if not user_info:
            return jsonify({"error": "User not found"}), 404

        user_email, user_address = user_info
        
        # Query recent activities related to this user
        # This includes:
        # 1. Activities on credentials they issued
        # 2. Activities on credentials they own
        # 3. Activities they performed
        query = """
        SELECT DISTINCT
            ch.id,
            ch.credential_id,
            ch.action_type,
            ch.performed_at,
            ch.verification_result,
            ch.notes,
            c.credential_type,
            c.owner_identifier,
            c.issuer_user_id
        FROM credential_history ch
        LEFT JOIN credentials c ON ch.credential_id = c.credential_id
        WHERE 
            -- Activities on credentials they issued
            c.issuer_user_id = %s 
            OR 
            -- Activities on credentials they own
            (c.owner_identifier = %s OR c.owner_identifier = %s)
            OR
            -- Activities they performed
            ch.performed_by_user_id = %s
        ORDER BY ch.performed_at DESC
        LIMIT 10
        """
        
        cursor.execute(query, (user_id, user_email, user_address, user_id))
        activities = cursor.fetchall()

        activity_list = []
        for activity in activities:
            activity_data = {
                "id": activity[0],
                "credential_id": activity[1],
                "action_type": activity[2],
                "performed_at": activity[3].isoformat() if activity[3] else None,
                "verification_result": activity[4],
                "notes": activity[5],
                "credential_type": activity[6],
                "owner_identifier": activity[7],
                "issuer_user_id": activity[8]
            }
            activity_list.append(activity_data)

        # Add a welcome activity if this is a new user with no activities
        if not activity_list:
            activity_list.append({
                "id": 0,
                "credential_id": None,
                "action_type": "welcome",
                "performed_at": datetime.now().isoformat(),
                "verification_result": None,
                "notes": "Welcome to Blockchain Credentials!",
                "credential_type": None,
                "owner_identifier": None,
                "issuer_user_id": user_id
            })

        close_db_connection(connection, cursor)

        return jsonify({
            "activities": activity_list,
            "total_count": len(activity_list)
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/user/<int:user_id>/activity-stats", methods=["GET"])
@require_login
def get_user_activity_stats(user_id):
    try:
        if session.get('user_id') != user_id:
            return jsonify({"error": "Unauthorized"}), 403
            
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()
        
        # Get various activity statistics
        stats_query = """
        SELECT 
            COUNT(*) as total_activities,
            COUNT(CASE WHEN action_type = 'issued' THEN 1 END) as issued_count,
            COUNT(CASE WHEN action_type = 'verified' THEN 1 END) as verified_count,
            COUNT(CASE WHEN action_type = 'viewed' THEN 1 END) as viewed_count,
            COUNT(CASE WHEN DATE(performed_at) = CURDATE() THEN 1 END) as today_count,
            COUNT(CASE WHEN performed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as week_count
        FROM credential_history ch
        LEFT JOIN credentials c ON ch.credential_id = c.credential_id
        WHERE c.issuer_user_id = %s OR ch.performed_by_user_id = %s
        """
        
        cursor.execute(stats_query, (user_id, user_id))
        stats = cursor.fetchone()
        
        close_db_connection(connection, cursor)
        
        return jsonify({
            "total_activities": stats[0] if stats else 0,
            "issued_count": stats[1] if stats else 0,
            "verified_count": stats[2] if stats else 0,
            "viewed_count": stats[3] if stats else 0,
            "today_count": stats[4] if stats else 0,
            "week_count": stats[5] if stats else 0
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/user/<int:user_id>/credentials", methods=["GET"])
@require_login
def get_user_credentials(user_id):
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()
        
        issued_query = """
        SELECT credential_id, owner_identifier, owner_type, credential_type, 
               transaction_hash, issued_at, status, ipfs_hash
        FROM credentials 
        WHERE issuer_user_id = %s
        ORDER BY issued_at DESC
        """
        cursor.execute(issued_query, (user_id,))
        issued_credentials = cursor.fetchall()

        cursor.execute("SELECT email, blockchain_address FROM users WHERE id = %s", (user_id,))
        user_info = cursor.fetchone()
        if not user_info:
            return jsonify({"error": "User not found"}), 404

        owned_query = """
        SELECT credential_id, u.username as issuer_name, credential_type,
               transaction_hash, issued_at, status, ipfs_hash
        FROM credentials c
        JOIN users u ON c.issuer_user_id = u.id
        WHERE c.owner_identifier = %s OR c.owner_identifier = %s
        ORDER BY c.issued_at DESC
        """
        cursor.execute(owned_query, (user_info[0], user_info[1]))
        owned_credentials = cursor.fetchall()

        issued_list = []
        for cred in issued_credentials:
            issued_list.append({
                "credential_id": cred[0],
                "owner": cred[1],
                "owner_type": cred[2],
                "credential_type": cred[3],
                "transaction_hash": cred[4],
                "issued_at": cred[5].isoformat() if cred[5] else None,
                "status": cred[6],
                "ipfs_hash": cred[7],
                "qr_code": generate_qr_code(f"https://ipfs.io/ipfs/{cred[7]}")
            })

        owned_list = []
        for cred in owned_credentials:
            owned_list.append({
                "credential_id": cred[0],
                "issuer_name": cred[1],
                "credential_type": cred[2],
                "transaction_hash": cred[3],
                "issued_at": cred[4].isoformat() if cred[4] else None,
                "status": cred[5],
                "ipfs_hash": cred[6],
                "qr_code": generate_qr_code(f"https://ipfs.io/ipfs/{cred[6]}")
            })

        close_db_connection(connection, cursor)

        return jsonify({
            "issued": issued_list,
            "owned": owned_list
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/qr/<credential_id>", methods=["GET"])
def get_qr_code(credential_id):
    try:
        cred_id_bytes = bytes.fromhex(credential_id)
        owner, ipfs_hash, credential_type, timestamp, issuer_address = contract.functions.verifyCredential(cred_id_bytes).call()

        ipfs_url = f"https://ipfs.io/ipfs/{ipfs_hash}"
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(ipfs_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        
        return send_file(img_io, mimetype='image/png')
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": "connected" if get_db_connection() else "disconnected",
            "blockchain": "connected" if w3.is_connected() else "disconnected",
            "ipfs": "available"
        }
    }), 200

@app.route("/stats", methods=["GET"])
def get_stats():
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = connection.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE is_active = TRUE")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM credentials WHERE status = 'active'")
        total_credentials = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM credential_history WHERE action_type = 'verified'")
        total_verifications = cursor.fetchone()[0]
        
        cursor.execute("""
        SELECT COUNT(*) FROM credential_history 
        WHERE action_type = 'verified' AND performed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        """)
        verifications_24h = cursor.fetchone()[0]

        close_db_connection(connection, cursor)

        return jsonify({
            "total_users": total_users,
            "total_credentials": total_credentials,
            "total_verifications": total_verifications,
            "verifications_last_24h": verifications_24h
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({"error": "File too large"}), 413

if __name__ == "__main__":
    print("🚀 Starting Blockchain Credential API...")
    print("📊 Database:", app.config['DB_NAME'])
    print("🔗 Blockchain:", "http://127.0.0.1:7545")
    print("🗄️ Server:", "http://127.0.0.1:5000")
    print("📁 IPFS:", app.config['IPFS_API_URL'])
    print("📧 Email:", app.config['MAIL_USERNAME'])
    
    app.run(debug=True, host='0.0.0.0', port=5000)