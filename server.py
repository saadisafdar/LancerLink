import os
import sqlite3
import secrets
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder=".")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

# Configure Session Cookies
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False  # Set to True in production (HTTPS)
)

DATABASE = "lancerlink.db"

# ========================================================
# DATABASE UTILITIES
# ========================================================
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    if not os.path.exists(schema_path):
        return

    with open(schema_path, "r") as f:
        schema_sql = f.read()

    conn = get_db()
    try:
        conn.executescript(schema_sql)
        conn.commit()
    except Exception as e:
        print(f"Error initializing schema: {e}")
    finally:
        conn.close()

    # Seed initial data if users table is empty
    seed_db()

def seed_db():
    conn = get_db()
    try:
        # Check if users already exist
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        if count > 0:
            return

        # Users data
        jane_pwd = generate_password_hash("password123")
        alex_pwd = generate_password_hash("password123")
        sarah_pwd = generate_password_hash("password123")

        now = datetime.utcnow().isoformat()

        # Seed Users
        # Jane: client, starting fluid wallet $3,500.00 (350000 cents)
        # Alex: freelancer, starting fluid wallet $850.00 (85000 cents)
        # Sarah: freelancer, starting fluid wallet $1,500.00 (150000 cents) after completing Project 4
        conn.execute("""
            INSERT INTO users (id, name, email, password_hash, role, wallet_cents, bio, skills, created_at, updated_at)
            VALUES 
            ('usr_client_jane', 'Jane Cooper', 'jane@lancerlink.co', ?, 'client', 350000, 'Principal Product Manager looking for high-quality engineering services.', 'Product Management, UI/UX Strategy', ?, ?),
            ('usr_free_alex', 'Alex Mercer', 'alex@lancerlink.co', ?, 'freelancer', 85000, 'Senior Full Stack Developer specializing in database scaling and robust APIs.', 'Python, MySQL, React, Flask, Architecture', ?, ?),
            ('usr_free_sarah', 'Sarah Jenkins', 'sarah@lancerlink.co', ?, 'freelancer', 150000, 'Minimalist Brand Designer & Frontend Engineer.', 'Figma, TailwindCSS, JavaScript, Mobile Apps', ?, ?)
        """, (jane_pwd, now, now, alex_pwd, now, now, sarah_pwd, now, now))

        # Seed Projects
        # Project 1: Open project, budget $1200
        # Project 2: Hired project, budget $2500, hired Alex
        # Project 3: Submitted project, budget $3000, hired Alex
        # Project 4: Completed project, budget $1500, hired Sarah
        conn.execute("""
            INSERT INTO projects (id, client_id, title, description, category, budget_cents, status, hired_freelancer_id, hired_bid_id, escrow_cents, submitted_file, submitted_comment, submitted_at, completed_at, created_at, updated_at)
            VALUES 
            ('proj_seed_1', 'usr_client_jane', 'Custom FinTech Dashboard UI Layout', 'Looking for an expert brand and UI designer to craft a gorgeous White & Green design scheme for our web SaaS. Requires 15 wireframes.', 'Brand Design', 120000, 'open', NULL, NULL, 0, NULL, NULL, NULL, NULL, ?, ?),
            ('proj_seed_2', 'usr_client_jane', 'Scale MySQL Database Schema for Logistics CRM', 'Our current fleet tracking system is hitting bottlenecks. Need a database engineer to optimize parameters.', 'Database Engineering', 250000, 'hired', NULL, NULL, 250000, NULL, NULL, NULL, NULL, ?, ?),
            ('proj_seed_3', 'usr_client_jane', 'Mobile App for Local Courier Service', 'Develop geolocational React Native or Flutter application to handle package tracking.', 'Mobile Applications', 300000, 'submitted', NULL, NULL, 300000, 'courier_app_v1_0.zip', 'All source files packaged. Awaiting approval!', ?, NULL, ?, ?),
            ('proj_seed_4', 'usr_client_jane', 'E-commerce Website Frontend Integration', 'Build e-commerce frontend components.', 'Web Development', 150000, 'completed', NULL, NULL, 0, 'ecommerce_frontend.zip', 'Frontend code fully integrated.', ?, ?, ?, ?)
        """, (now, now, now, now, now, now, now, now, now, now, now))

        # Seed Bids
        # Bids for Project 1 (Open)
        conn.execute("""
            INSERT INTO bids (id, project_id, freelancer_id, amount_cents, timeline, pitch, status, created_at, updated_at)
            VALUES 
            ('bid_seed_alex', 'proj_seed_1', 'usr_free_alex', 110000, '5 Days', 'Hi Jane! I love white & green visual systems. I have built 4 SaaS financial interfaces.', 'pending', ?, ?),
            ('bid_seed_sarah', 'proj_seed_1', 'usr_free_sarah', 120000, '1 Week', 'Hey there. I specialize in luxury minimalist corporate systems.', 'pending', ?, ?)
        """, (now, now, now, now))

        # Bids for Project 2 (Hired)
        conn.execute("""
            INSERT INTO bids (id, project_id, freelancer_id, amount_cents, timeline, pitch, status, created_at, updated_at)
            VALUES 
            ('bid_seed_db_alex', 'proj_seed_2', 'usr_free_alex', 250000, '5 Days', 'I am an expert database designer and can scale your schema.', 'accepted', ?, ?)
        """, (now, now))

        # Bids for Project 3 (Submitted)
        conn.execute("""
            INSERT INTO bids (id, project_id, freelancer_id, amount_cents, timeline, pitch, status, created_at, updated_at)
            VALUES 
            ('bid_seed_mobile', 'proj_seed_3', 'usr_free_alex', 300000, '2 Weeks', 'Hired at standard price point.', 'accepted', ?, ?)
        """, (now, now))

        # Bids for Project 4 (Completed)
        conn.execute("""
            INSERT INTO bids (id, project_id, freelancer_id, amount_cents, timeline, pitch, status, created_at, updated_at)
            VALUES 
            ('bid_seed_retail_sarah', 'proj_seed_4', 'usr_free_sarah', 150000, '1 Week', 'Decentralized e-commerce client interface builder.', 'accepted', ?, ?)
        """, (now, now))

        # Update Project Hired References to satisfy FK constraints after seeding projects and bids
        conn.execute("UPDATE projects SET hired_freelancer_id = 'usr_free_alex', hired_bid_id = 'bid_seed_db_alex' WHERE id = 'proj_seed_2'")
        conn.execute("UPDATE projects SET hired_freelancer_id = 'usr_free_alex', hired_bid_id = 'bid_seed_mobile' WHERE id = 'proj_seed_3'")
        conn.execute("UPDATE projects SET hired_freelancer_id = 'usr_free_sarah', hired_bid_id = 'bid_seed_retail_sarah' WHERE id = 'proj_seed_4'")

        # Seed Wallet Transactions
        # Jane: $10,500 deposit. Locks of $2,500, $3,000, and $1,500. Release of $1,500. Final: $3,500.
        conn.execute("""
            INSERT INTO wallet_transactions (user_id, project_id, transaction_type, amount_cents, balance_after_cents, description, created_at)
            VALUES 
            ('usr_client_jane', NULL, 'deposit', 1050000, 1050000, 'Simulated virtual deposit', ?),
            ('usr_client_jane', 'proj_seed_2', 'escrow_lock', -250000, 800000, 'Locked escrow for: Scale MySQL Database Schema', ?),
            ('usr_client_jane', 'proj_seed_3', 'escrow_lock', -300000, 500000, 'Locked escrow for: Mobile App for Local Courier', ?),
            ('usr_client_jane', 'proj_seed_4', 'escrow_lock', -150000, 350000, 'Locked escrow for: E-commerce Website Frontend', ?)
        """, (now, now, now, now))

        # Sarah: Completed Project 4, received $1,500 release.
        conn.execute("""
            INSERT INTO wallet_transactions (user_id, project_id, transaction_type, amount_cents, balance_after_cents, description, created_at)
            VALUES 
            ('usr_free_sarah', 'proj_seed_4', 'escrow_release', 150000, 150000, 'Escrow payout for: E-commerce Website Frontend', ?)
        """, (now,))

        # Alex: deposited $850.
        conn.execute("""
            INSERT INTO wallet_transactions (user_id, project_id, transaction_type, amount_cents, balance_after_cents, description, created_at)
            VALUES 
            ('usr_free_alex', NULL, 'deposit', 85000, 85000, 'Simulated virtual deposit', ?)
        """, (now,))

        # Seed Reviews for completed Project 4
        conn.execute("""
            INSERT INTO reviews (project_id, reviewer_id, reviewee_id, reviewer_role, rating, comment, created_at)
            VALUES 
            ('proj_seed_4', 'usr_client_jane', 'usr_free_sarah', 'client', 5, 'Sarah delivered the project on time and the code is extremely clean.', ?),
            ('proj_seed_4', 'usr_free_sarah', 'usr_client_jane', 'freelancer', 5, 'Jane is an amazing client. Clear requirements and instant escrow release.', ?)
        """, (now, now))

        # Seed Messages
        conn.execute("""
            INSERT INTO messages (project_id, client_id, freelancer_id, sender_id, receiver_id, body, created_at, read_at)
            VALUES 
            ('proj_seed_1', 'usr_client_jane', 'usr_free_alex', 'usr_free_alex', 'usr_client_jane', 'Hi Jane, I can do the FinTech UI wireframes in 5 days. Check my portfolio.', ?, ?),
            ('proj_seed_1', 'usr_client_jane', 'usr_free_alex', 'usr_client_jane', 'usr_free_alex', 'Hi Alex, your portfolio looks good. Do you have experience with green colors?', ?, ?)
        """, (now, now, now, now))

        # Seed Notifications
        conn.execute("""
            INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
            VALUES 
            ('usr_client_jane', 'proj_seed_1', 'new_bid', 'New bid received from Alex Mercer ($1,100.00)', ?),
            ('usr_client_jane', 'proj_seed_1', 'new_bid', 'New bid received from Sarah Jenkins ($1,200.00)', ?),
            ('usr_free_alex', 'proj_seed_2', 'hired', 'Congratulations! You were hired for project: Scale MySQL Database Schema', ?)
        """, (now, now, now))

        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Error seeding DB: {e}")
    finally:
        conn.close()

# ========================================================
# SECURITY MIDDLEWARE & HELPER FUNCTIONS
# ========================================================
@app.before_request
def csrf_protection():
    # Only protect state-changing methods
    if request.method in ("POST", "PATCH", "PUT", "DELETE"):
        # Bypass auth routes that initialize session
        if request.path in ("/api/auth/login", "/api/auth/register", "/api/auth/logout"):
            return
        
        token = request.headers.get("X-CSRF-Token")
        session_token = session.get("csrf_token")
        
        if not session_token or token != session_token:
            return jsonify(success=False, error="CSRF token validation failed"), 403

def get_session_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return user

def calculate_milestone(status, project_id):
    if status in ("open", "cancelled"):
        return 0
    if status == "hired":
        return 1
    if status in ("submitted", "revision_requested"):
        return 2
    if status == "completed":
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM reviews WHERE project_id = ?", (project_id,))
        review_count = cursor.fetchone()[0]
        conn.close()
        if review_count >= 2:
            return 4
        return 3
    return 0

def get_user_ratings_summary(user_id):
    conn = get_db()
    cursor = conn.cursor()
    # Count ratings where the user was the reviewee and double-blind is cleared (i.e. project has 2 reviews)
    cursor.execute("""
        SELECT r.rating 
        FROM reviews r
        JOIN projects p ON r.project_id = p.id
        WHERE r.reviewee_id = ? 
          AND (SELECT COUNT(*) FROM reviews r2 WHERE r2.project_id = p.id) = 2
    """, (user_id,))
    ratings = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    if not ratings:
        return {"average": None, "count": 0}
    
    avg = round(sum(ratings) / len(ratings), 1)
    return {"average": avg, "count": len(ratings)}

# ========================================================
# STATIC ROUTES
# ========================================================
@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")

@app.route("/styles.css")
def serve_css():
    return send_from_directory(".", "styles.css")

@app.route("/app.js")
def serve_js():
    return send_from_directory(".", "app.js")

# ========================================================
# AUTHENTICATION API
# ========================================================
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "")

    if not name or not email or not password or not role:
        return jsonify(success=False, error="Missing required fields"), 400

    if role not in ("client", "freelancer"):
        return jsonify(success=False, error="Invalid role choice"), 400

    if len(password) < 6:
        return jsonify(success=False, error="Password must be at least 6 characters long"), 400

    # Simple email check
    if "@" not in email or "." not in email:
        return jsonify(success=False, error="Invalid email structure"), 400

    pwd_hash = generate_password_hash(password)
    user_id = "usr_" + secrets.token_hex(8)
    now = datetime.utcnow().isoformat()

    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO users (id, name, email, password_hash, role, wallet_cents, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        """, (user_id, name, email, pwd_hash, role, now, now))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify(success=False, error="An account with this email already exists for this role"), 409
    
    # Establish session
    session.clear()
    session["user_id"] = user_id
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(16)

    # Fetch fresh user
    user = conn.execute("SELECT id, name, email, role, wallet_cents, bio, skills FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    user_dict = dict(user)
    user_dict["wallet_cents"] = user_dict["wallet_cents"]
    
    return jsonify(success=True, data={
        "user": user_dict,
        "csrf_token": session["csrf_token"]
    }), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "")

    if not email or not password or not role:
        return jsonify(success=False, error="Missing email, password, or role"), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ? AND role = ?", (email, role)).fetchone()
    
    if not user or not check_password_hash(user["password_hash"], password):
        conn.close()
        return jsonify(success=False, error="Invalid credentials or role mismatch"), 401

    session.clear()
    session["user_id"] = user["id"]
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(16)

    user_dict = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "wallet_cents": user["wallet_cents"],
        "bio": user["bio"],
        "skills": user["skills"]
    }
    conn.close()

    return jsonify(success=True, data={
        "user": user_dict,
        "csrf_token": session["csrf_token"]
    }), 200

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify(success=True), 200

@app.route("/api/auth/me", methods=["GET"])
def me():
    user = get_session_user()
    if not user:
        return jsonify(success=False, error="Not authenticated"), 401

    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(16)

    user_dict = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "wallet_cents": user["wallet_cents"],
        "bio": user["bio"],
        "skills": user["skills"]
    }
    
    return jsonify(success=True, data={
        "user": user_dict,
        "csrf_token": session["csrf_token"]
    }), 200

# ========================================================
# USERS API
# ========================================================
@app.route("/api/users/<user_id>", methods=["GET"])
def get_user_profile(user_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    user = conn.execute("SELECT id, name, role, bio, skills, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        return jsonify(success=False, error="User not found"), 404

    summary = get_user_ratings_summary(user_id)
    user_dict = dict(user)
    user_dict["average_rating"] = summary["average"]
    user_dict["review_count"] = summary["count"]

    return jsonify(success=True, data={"user": user_dict}), 200

@app.route("/api/users/me", methods=["PATCH"])
def update_profile():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    data = request.json or {}
    bio = data.get("bio", "").strip()
    skills = data.get("skills", "").strip()

    conn = get_db()
    conn.execute("""
        UPDATE users 
        SET bio = ?, skills = ?, updated_at = ?
        WHERE id = ?
    """, (bio, skills, datetime.utcnow().isoformat(), me_user["id"]))
    conn.commit()

    user = conn.execute("SELECT id, name, email, role, wallet_cents, bio, skills FROM users WHERE id = ?", (me_user["id"],)).fetchone()
    conn.close()

    return jsonify(success=True, data={"user": dict(user)}), 200

# ========================================================
# PROJECTS API
# ========================================================
@app.route("/api/projects", methods=["GET"])
def list_projects():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    # Query filters
    client_id = request.args.get("client_id")
    hired_freelancer_id = request.args.get("hired_freelancer_id")
    status = request.args.get("status")
    category = request.args.get("category")
    search = request.args.get("search")

    query = """
        SELECT p.*, u.name as client_name 
        FROM projects p
        JOIN users u ON p.client_id = u.id
        WHERE 1=1
    """
    params = []

    if client_id:
        query += " AND p.client_id = ?"
        params.append(client_id)
    if hired_freelancer_id:
        query += " AND p.hired_freelancer_id = ?"
        params.append(hired_freelancer_id)
    if status:
        query += " AND p.status = ?"
        params.append(status)
    if category:
        query += " AND p.category = ?"
        params.append(category)
    if search:
        query += " AND (p.title LIKE ? OR p.description LIKE ? OR u.name LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    
    projects_list = []
    for r in rows:
        p_dict = dict(r)
        p_dict["milestone"] = calculate_milestone(p_dict["status"], p_dict["id"])
        
        # Pull client average ratings for freelancers to display
        c_ratings = get_user_ratings_summary(p_dict["client_id"])
        p_dict["client_rating"] = c_ratings["average"]
        p_dict["client_review_count"] = c_ratings["count"]
        
        projects_list.append(p_dict)
        
    conn.close()
    return jsonify(success=True, data={"projects": projects_list}), 200

@app.route("/api/projects/<project_id>", methods=["GET"])
def get_project(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    row = conn.execute("""
        SELECT p.*, u.name as client_name 
        FROM projects p
        JOIN users u ON p.client_id = u.id
        WHERE p.id = ?
    """, (project_id,)).fetchone()
    conn.close()

    if not row:
        return jsonify(success=False, error="Project not found"), 404

    # Authorization checks: Clients see own projects, freelancers can browse open or projects they are hired on
    p_dict = dict(row)
    p_dict["milestone"] = calculate_milestone(p_dict["status"], p_dict["id"])

    # Pull ratings
    c_ratings = get_user_ratings_summary(p_dict["client_id"])
    p_dict["client_rating"] = c_ratings["average"]
    p_dict["client_review_count"] = c_ratings["count"]

    if p_dict["status"] != "open" and me_user["role"] == "freelancer" and p_dict["hired_freelancer_id"] != me_user["id"]:
        # Verify if they had a bid to see closed conversations, but can't see the full project details unless they bid
        conn = get_db()
        bid = conn.execute("SELECT id FROM bids WHERE project_id = ? AND freelancer_id = ?", (project_id, me_user["id"])).fetchone()
        conn.close()
        if not bid:
            return jsonify(success=False, error="Unauthorized project access"), 403

    return jsonify(success=True, data={"project": p_dict}), 200

@app.route("/api/projects", methods=["POST"])
def create_project():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401
    
    if me_user["role"] != "client":
        return jsonify(success=False, error="Only clients can post contracts"), 403

    data = request.json or {}
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    category = data.get("category", "").strip()
    budget_usd = data.get("budget")

    if not title or not description or not category or budget_usd is None:
        return jsonify(success=False, error="Missing project details"), 400

    try:
        budget_cents = int(float(budget_usd) * 100)
    except (ValueError, TypeError):
        return jsonify(success=False, error="Invalid budget value"), 400

    if budget_cents <= 0:
        return jsonify(success=False, error="Budget must be greater than zero"), 400

    project_id = "proj_" + secrets.token_hex(8)
    now = datetime.utcnow().isoformat()

    conn = get_db()
    conn.execute("""
        INSERT INTO projects (id, client_id, title, description, category, budget_cents, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)
    """, (project_id, me_user["id"], title, description, category, budget_cents, now, now))
    conn.commit()
    
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()

    p_dict = dict(row)
    p_dict["milestone"] = 0
    return jsonify(success=True, data={"project": p_dict}), 201

@app.route("/api/projects/<project_id>", methods=["PATCH"])
def edit_project(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    
    if not project:
        conn.close()
        return jsonify(success=False, error="Project not found"), 404

    if project["client_id"] != me_user["id"]:
        conn.close()
        return jsonify(success=False, error="Unauthorized project edit"), 403

    if project["status"] != "open":
        conn.close()
        return jsonify(success=False, error="Cannot edit a contract that is no longer open for bidding"), 409

    data = request.json or {}
    title = data.get("title", "").strip() or project["title"]
    description = data.get("description", "").strip() or project["description"]
    category = data.get("category", "").strip() or project["category"]
    budget_usd = data.get("budget")

    budget_cents = project["budget_cents"]
    if budget_usd is not None:
        try:
            budget_cents = int(float(budget_usd) * 100)
            if budget_cents <= 0:
                raise ValueError()
        except ValueError:
            conn.close()
            return jsonify(success=False, error="Invalid budget value"), 400

    conn.execute("""
        UPDATE projects
        SET title = ?, description = ?, category = ?, budget_cents = ?, updated_at = ?
        WHERE id = ?
    """, (title, description, category, budget_cents, datetime.utcnow().isoformat(), project_id))
    conn.commit()
    
    updated = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()

    return jsonify(success=True, data={"project": dict(updated)}), 200

@app.route("/api/projects/<project_id>/cancel", methods=["POST"])
def cancel_project(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        
        if not project:
            raise ValueError("Project not found")

        if project["client_id"] != me_user["id"]:
            raise PermissionError("Unauthorized cancel operation")

        if project["status"] != "open":
            raise ValueError("Cannot cancel a hired, completed or already cancelled project")

        now = datetime.utcnow().isoformat()
        conn.execute("""
            UPDATE projects
            SET status = 'cancelled', cancelled_at = ?, updated_at = ?
            WHERE id = ?
        """, (now, now, project_id))

        # Reject all pending bids
        conn.execute("UPDATE bids SET status = 'rejected', updated_at = ? WHERE project_id = ? AND status = 'pending'", (now, project_id))

        # Notify bidders
        bidders = conn.execute("SELECT freelancer_id FROM bids WHERE project_id = ?", (project_id,)).fetchall()
        for row in bidders:
            conn.execute("""
                INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
                VALUES (?, ?, 'project_cancelled', ?, ?)
            """, (row["freelancer_id"], project_id, f"Project '{project['title']}' has been cancelled by the client.", now))

        conn.commit()
        return jsonify(success=True), 200
    except PermissionError as pe:
        conn.rollback()
        return jsonify(success=False, error=str(pe)), 403
    except ValueError as ve:
        conn.rollback()
        return jsonify(success=False, error=str(ve)), 409
    except Exception as e:
        conn.rollback()
        return jsonify(success=False, error="Internal database error"), 500
    finally:
        conn.close()

# ========================================================
# BIDS API
# ========================================================
@app.route("/api/projects/<project_id>/bids", methods=["GET"])
def list_bids(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    
    if not project:
        conn.close()
        return jsonify(success=False, error="Project not found"), 404

    # Security check: client gets all bids for their project. Freelancers can only get their own bid.
    if me_user["role"] == "client":
        if project["client_id"] != me_user["id"]:
            conn.close()
            return jsonify(success=False, error="Unauthorized bids access"), 403
        
        # Client query returns all bids with freelancer ratings
        rows = conn.execute("""
            SELECT b.*, u.name as freelancer_name 
            FROM bids b
            JOIN users u ON b.freelancer_id = u.id
            WHERE b.project_id = ? AND b.status != 'withdrawn'
        """, (project_id,)).fetchall()
        
        bids_list = []
        for r in rows:
            b_dict = dict(r)
            f_ratings = get_user_ratings_summary(b_dict["freelancer_id"])
            b_dict["freelancer_rating"] = f_ratings["average"]
            b_dict["freelancer_review_count"] = f_ratings["count"]
            bids_list.append(b_dict)
            
        conn.close()
        return jsonify(success=True, data={"bids": bids_list}), 200

    else:
        # Freelancer query returns only their own bid
        row = conn.execute("""
            SELECT b.*, u.name as freelancer_name 
            FROM bids b
            JOIN users u ON b.freelancer_id = u.id
            WHERE b.project_id = ? AND b.freelancer_id = ?
        """, (project_id, me_user["id"])).fetchone()
        conn.close()

        bids_list = [dict(row)] if row else []
        return jsonify(success=True, data={"bids": bids_list}), 200

@app.route("/api/projects/<project_id>/bids", methods=["POST"])
def submit_bid(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    if me_user["role"] != "freelancer":
        return jsonify(success=False, error="Only freelancers can bid"), 403

    data = request.json or {}
    amount_usd = data.get("amount")
    timeline = data.get("timeline", "").strip()
    pitch = data.get("pitch", "").strip()

    if amount_usd is None or not timeline or not pitch:
        return jsonify(success=False, error="Missing bid details"), 400

    try:
        amount_cents = int(float(amount_usd) * 100)
    except (ValueError, TypeError):
        return jsonify(success=False, error="Invalid bid amount"), 400

    if amount_cents <= 0:
        return jsonify(success=False, error="Bid must be greater than zero"), 400

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    
    if not project:
        conn.close()
        return jsonify(success=False, error="Project not found"), 404

    if project["client_id"] == me_user["id"]:
        conn.close()
        return jsonify(success=False, error="Cannot bid on your own project"), 403

    if project["status"] != "open":
        conn.close()
        return jsonify(success=False, error="Project is no longer open for bidding"), 409

    # Check for existing bid
    existing_bid = conn.execute("SELECT * FROM bids WHERE project_id = ? AND freelancer_id = ?", (project_id, me_user["id"])).fetchone()
    now = datetime.utcnow().isoformat()

    try:
        if existing_bid:
            # If withdrawn, we can reuse and move to pending
            if existing_bid["status"] in ("withdrawn", "rejected"):
                conn.execute("""
                    UPDATE bids
                    SET amount_cents = ?, timeline = ?, pitch = ?, status = 'pending', updated_at = ?
                    WHERE id = ?
                """, (amount_cents, timeline, pitch, now, existing_bid["id"]))
                conn.commit()
                bid_id = existing_bid["id"]
            else:
                conn.close()
                return jsonify(success=False, error="You already have an active bid on this project"), 409
        else:
            bid_id = "bid_" + secrets.token_hex(8)
            conn.execute("""
                INSERT INTO bids (id, project_id, freelancer_id, amount_cents, timeline, pitch, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            """, (bid_id, project_id, me_user["id"], amount_cents, timeline, pitch, now, now))
            conn.commit()

        # Create notification for client
        conn.execute("""
            INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
            VALUES (?, ?, 'new_bid', ?, ?)
        """, (project["client_id"], project_id, f"New bid received from {me_user['name']} (${amount_cents / 100:.2f})", now))
        conn.commit()

        bid_row = conn.execute("SELECT * FROM bids WHERE id = ?", (bid_id,)).fetchone()
        conn.close()

        return jsonify(success=True, data={"bid": dict(bid_row)}), 201

    except Exception as e:
        conn.close()
        return jsonify(success=False, error="Error processing bid"), 500

@app.route("/api/bids/<bid_id>", methods=["PATCH"])
def edit_bid(bid_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    bid = conn.execute("SELECT * FROM bids WHERE id = ?", (bid_id,)).fetchone()
    if not bid:
        conn.close()
        return jsonify(success=False, error="Bid not found"), 404

    if bid["freelancer_id"] != me_user["id"]:
        conn.close()
        return jsonify(success=False, error="Unauthorized bid edit"), 403

    project = conn.execute("SELECT * FROM projects WHERE id = ?", (bid["project_id"],)).fetchone()
    if project["status"] != "open":
        conn.close()
        return jsonify(success=False, error="Cannot edit bid on a project that is no longer open"), 409

    data = request.json or {}
    amount_usd = data.get("amount")
    timeline = data.get("timeline", "").strip() or bid["timeline"]
    pitch = data.get("pitch", "").strip() or bid["pitch"]

    amount_cents = bid["amount_cents"]
    if amount_usd is not None:
        try:
            amount_cents = int(float(amount_usd) * 100)
            if amount_cents <= 0:
                raise ValueError()
        except ValueError:
            conn.close()
            return jsonify(success=False, error="Invalid bid amount"), 400

    now = datetime.utcnow().isoformat()
    conn.execute("""
        UPDATE bids
        SET amount_cents = ?, timeline = ?, pitch = ?, updated_at = ?
        WHERE id = ?
    """, (amount_cents, timeline, pitch, now, bid_id))
    
    # Notify client about bid revision
    conn.execute("""
        INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
        VALUES (?, ?, 'bid_revised', ?, ?)
    """, (project["client_id"], project["id"], f"{me_user['name']} revised their bid to ${amount_cents / 100:.2f}", now))
    conn.commit()

    updated = conn.execute("SELECT * FROM bids WHERE id = ?", (bid_id,)).fetchone()
    conn.close()

    return jsonify(success=True, data={"bid": dict(updated)}), 200

@app.route("/api/bids/<bid_id>/withdraw", methods=["POST"])
def withdraw_bid(bid_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    bid = conn.execute("SELECT * FROM bids WHERE id = ?", (bid_id,)).fetchone()
    if not bid:
        conn.close()
        return jsonify(success=False, error="Bid not found"), 404

    if bid["freelancer_id"] != me_user["id"]:
        conn.close()
        return jsonify(success=False, error="Unauthorized bid withdrawal"), 403

    project = conn.execute("SELECT * FROM projects WHERE id = ?", (bid["project_id"],)).fetchone()
    if project["status"] != "open":
        conn.close()
        return jsonify(success=False, error="Cannot withdraw bid on locked contract"), 409

    now = datetime.utcnow().isoformat()
    conn.execute("UPDATE bids SET status = 'withdrawn', updated_at = ? WHERE id = ?", (now, bid_id))
    conn.commit()
    conn.close()

    return jsonify(success=True), 200

@app.route("/api/bids/<bid_id>/award", methods=["POST"])
def award_bid(bid_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        bid = conn.execute("SELECT * FROM bids WHERE id = ?", (bid_id,)).fetchone()
        
        if not bid:
            raise ValueError("Bid not found")

        project = conn.execute("SELECT * FROM projects WHERE id = ?", (bid["project_id"],)).fetchone()
        if not project:
            raise ValueError("Project not found")

        if project["client_id"] != me_user["id"]:
            raise PermissionError("Only the project owner can award contracts")

        if project["status"] != "open":
            raise ValueError("Project is not open for awarding")

        if bid["status"] != "pending":
            raise ValueError("Bid is no longer active or pending")

        # Check client wallet (read authoritative budget from the bid in SQLite)
        client = conn.execute("SELECT * FROM users WHERE id = ?", (me_user["id"],)).fetchone()
        amount_cents = bid["amount_cents"]

        if client["wallet_cents"] < amount_cents:
            raise ValueError("Insufficient balance in virtual wallet to lock escrow")

        now = datetime.utcnow().isoformat()
        
        # Deduct wallet
        new_balance = client["wallet_cents"] - amount_cents
        conn.execute("UPDATE users SET wallet_cents = ? WHERE id = ?", (new_balance, me_user["id"]))

        # Log wallet transaction (escrow lock)
        conn.execute("""
            INSERT INTO wallet_transactions (user_id, project_id, transaction_type, amount_cents, balance_after_cents, description, created_at)
            VALUES (?, ?, 'escrow_lock', ?, ?, ?, ?)
        """, (me_user["id"], project["id"], -amount_cents, new_balance, f"Locked escrow for project: {project['title']}", now))

        # Update project status
        conn.execute("""
            UPDATE projects
            SET status = 'hired', hired_freelancer_id = ?, hired_bid_id = ?, escrow_cents = ?, updated_at = ?
            WHERE id = ?
        """, (bid["freelancer_id"], bid_id, amount_cents, now, project["id"]))

        # Update bids statuses
        conn.execute("UPDATE bids SET status = 'accepted', updated_at = ? WHERE id = ?", (now, bid_id))
        conn.execute("UPDATE bids SET status = 'rejected', updated_at = ? WHERE project_id = ? AND id != ?", (now, project["id"], bid_id))

        # Create notifications
        conn.execute("""
            INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
            VALUES (?, ?, 'hired', ?, ?)
        """, (bid["freelancer_id"], project["id"], f"You have been hired for '{project['title']}' at ${amount_cents / 100:.2f}!", now))

        # Notify rejected bidders
        other_bidders = conn.execute("SELECT freelancer_id FROM bids WHERE project_id = ? AND id != ?", (project["id"], bid_id)).fetchall()
        for bidder in other_bidders:
            conn.execute("""
                INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
                VALUES (?, ?, 'bid_rejected', ?, ?)
            """, (bidder["freelancer_id"], project["id"], f"Your proposal on '{project['title']}' was rejected.", now))

        conn.commit()
        return jsonify(success=True), 200

    except PermissionError as pe:
        conn.rollback()
        return jsonify(success=False, error=str(pe)), 403
    except ValueError as ve:
        conn.rollback()
        return jsonify(success=False, error=str(ve)), 409
    except Exception as e:
        conn.rollback()
        return jsonify(success=False, error="Error awarding contract"), 500
    finally:
        conn.close()

# ========================================================
# MESSAGING SYSTEM API
# ========================================================
def check_messaging_access(me_user, project, freelancer_id):
    # Determine participant roles and check permissions
    if me_user["id"] != project["client_id"] and me_user["id"] != freelancer_id:
        return False, "You are not a participant in this conversation"

    # Freelancers can only view their own thread with the client
    if me_user["role"] == "freelancer" and me_user["id"] != freelancer_id:
        return False, "Unauthorized chat thread access"

    return True, None

@app.route("/api/projects/<project_id>/messages", methods=["GET"])
def get_messages(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    freelancer_id = request.args.get("freelancer_id")
    after_id_str = request.args.get("after_id", "0")

    try:
        after_id = int(after_id_str)
    except ValueError:
        after_id = 0

    if not freelancer_id:
        return jsonify(success=False, error="Missing freelancer_id parameter"), 400

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    
    if not project:
        conn.close()
        return jsonify(success=False, error="Project not found"), 404

    allowed, err = check_messaging_access(me_user, project, freelancer_id)
    if not allowed:
        conn.close()
        return jsonify(success=False, error=err), 403

    # Check if a bid exists (before hiring, freelancer can only chat if they bid)
    if project["status"] == "open":
        bid = conn.execute("SELECT id FROM bids WHERE project_id = ? AND freelancer_id = ?", (project_id, freelancer_id)).fetchone()
        if not bid:
            conn.close()
            return jsonify(success=False, error="Conversations can only be started after a bid has been submitted"), 403

    rows = conn.execute("""
        SELECT m.*, s.name as sender_name
        FROM messages m
        JOIN users s ON m.sender_id = s.id
        WHERE m.project_id = ? AND m.freelancer_id = ? AND m.id > ?
        ORDER BY m.id ASC
    """, (project_id, freelancer_id, after_id)).fetchall()
    
    conn.close()

    messages = [dict(r) for r in rows]
    return jsonify(success=True, data={"messages": messages}), 200

@app.route("/api/projects/<project_id>/messages", methods=["POST"])
def send_message(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    data = request.json or {}
    freelancer_id = data.get("freelancer_id")
    body = data.get("body", "").strip()

    if not freelancer_id or not body:
        return jsonify(success=False, error="Missing message recipient or text body"), 400

    if len(body) > 1000:
        return jsonify(success=False, error="Message length cannot exceed 1000 characters"), 400

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not project:
        conn.close()
        return jsonify(success=False, error="Project not found"), 404

    allowed, err = check_messaging_access(me_user, project, freelancer_id)
    if not allowed:
        conn.close()
        return jsonify(success=False, error=err), 403

    # Writable thread authorization
    # If hired state, only selected freelancer can message
    if project["status"] in ("hired", "submitted", "revision_requested"):
        if project["hired_freelancer_id"] != freelancer_id:
            conn.close()
            return jsonify(success=False, error="This conversation thread is closed and read-only"), 403
    elif project["status"] in ("completed", "cancelled"):
        conn.close()
        return jsonify(success=False, error="This project contract is finalized. Messages are read-only"), 403
    else: # status is 'open'
        bid = conn.execute("SELECT id FROM bids WHERE project_id = ? AND freelancer_id = ?", (project_id, freelancer_id)).fetchone()
        if not bid:
            conn.close()
            return jsonify(success=False, error="Bidders can message only after submitting their proposals"), 403

    sender_id = me_user["id"]
    receiver_id = project["client_id"] if sender_id == freelancer_id else freelancer_id
    now = datetime.utcnow().isoformat()

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO messages (project_id, client_id, freelancer_id, sender_id, receiver_id, body, created_at, read_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    """, (project_id, project["client_id"], freelancer_id, sender_id, receiver_id, body, now))
    message_id = cursor.lastrowid

    # Create unread message notification
    conn.execute("""
        INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
        VALUES (?, ?, 'new_message', ?, ?)
    """, (receiver_id, project_id, f"New message from {me_user['name']} on project '{project['title']}'", now))

    conn.commit()

    msg_row = conn.execute("""
        SELECT m.*, s.name as sender_name
        FROM messages m
        JOIN users s ON m.sender_id = s.id
        WHERE m.id = ?
    """, (message_id,)).fetchone()
    conn.close()

    return jsonify(success=True, data={"message": dict(msg_row)}), 201

@app.route("/api/messages/mark-read", methods=["POST"])
def mark_read():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    data = request.json or {}
    project_id = data.get("project_id")
    freelancer_id = data.get("freelancer_id")

    if not project_id or not freelancer_id:
        return jsonify(success=False, error="Missing parameters"), 400

    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute("""
        UPDATE messages
        SET read_at = ?
        WHERE project_id = ? AND freelancer_id = ? AND receiver_id = ? AND read_at IS NULL
    """, (now, project_id, freelancer_id, me_user["id"]))
    conn.commit()
    conn.close()

    return jsonify(success=True), 200

@app.route("/api/conversations", methods=["GET"])
def get_conversations():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    conversations = []

    if me_user["role"] == "client":
        # Get all projects owned by client, and find associated bids/chats
        projects = conn.execute("SELECT * FROM projects WHERE client_id = ?", (me_user["id"],)).fetchall()
        for p in projects:
            # Conversations exist for each freelancer who bid
            bidders = conn.execute("""
                SELECT DISTINCT b.freelancer_id, u.name as freelancer_name, u.role
                FROM bids b
                JOIN users u ON b.freelancer_id = u.id
                WHERE b.project_id = ? AND b.status != 'withdrawn'
            """, (p["id"],)).fetchall()
            
            for bidder in bidders:
                # Find last message
                last_msg = conn.execute("""
                    SELECT * FROM messages 
                    WHERE project_id = ? AND freelancer_id = ? 
                    ORDER BY id DESC LIMIT 1
                """, (p["id"], bidder["freelancer_id"])).fetchone()
                
                # Count unread messages
                unread = conn.execute("""
                    SELECT COUNT(*) FROM messages
                    WHERE project_id = ? AND freelancer_id = ? AND receiver_id = ? AND read_at IS NULL
                """, (p["id"], bidder["freelancer_id"], me_user["id"])).fetchone()[0]

                conversations.append({
                    "project_id": p["id"],
                    "project_title": p["title"],
                    "other_participant_id": bidder["freelancer_id"],
                    "other_participant_name": bidder["freelancer_name"],
                    "other_participant_role": "freelancer",
                    "freelancer_id": bidder["freelancer_id"],
                    "last_message": dict(last_msg) if last_msg else None,
                    "unread_count": unread,
                    "project_status": p["status"],
                    "is_writable": p["status"] == "open" or p["hired_freelancer_id"] == bidder["freelancer_id"]
                })
    else:
        # Freelancer role: find projects where they submitted bids
        my_bids = conn.execute("""
            SELECT b.project_id, p.title as project_title, p.status as project_status, p.client_id, u.name as client_name, p.hired_freelancer_id
            FROM bids b
            JOIN projects p ON b.project_id = p.id
            JOIN users u ON p.client_id = u.id
            WHERE b.freelancer_id = ? AND b.status != 'withdrawn'
        """, (me_user["id"],)).fetchall()

        for b in my_bids:
            last_msg = conn.execute("""
                SELECT * FROM messages 
                WHERE project_id = ? AND freelancer_id = ? 
                ORDER BY id DESC LIMIT 1
            """, (b["project_id"], me_user["id"])).fetchone()

            unread = conn.execute("""
                SELECT COUNT(*) FROM messages
                WHERE project_id = ? AND freelancer_id = ? AND receiver_id = ? AND read_at IS NULL
            """, (b["project_id"], me_user["id"], me_user["id"])).fetchone()[0]

            conversations.append({
                "project_id": b["project_id"],
                "project_title": b["project_title"],
                "other_participant_id": b["client_id"],
                "other_participant_name": b["client_name"],
                "other_participant_role": "client",
                "freelancer_id": me_user["id"],
                "last_message": dict(last_msg) if last_msg else None,
                "unread_count": unread,
                "project_status": b["project_status"],
                "is_writable": b["project_status"] == "open" or b["hired_freelancer_id"] == me_user["id"]
            })

    conn.close()
    return jsonify(success=True, data={"conversations": conversations}), 200

# ========================================================
# DELIVERABLE & REVISION WORKFLOW API
# ========================================================
@app.route("/api/projects/<project_id>/submit-work", methods=["POST"])
def submit_work(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    if me_user["role"] != "freelancer":
        return jsonify(success=False, error="Only hired freelancers can submit deliverables"), 403

    data = request.json or {}
    filename = data.get("filename", "").strip()
    comment = data.get("comment", "").strip()

    if not filename or not comment:
        return jsonify(success=False, error="Filename and submission remarks are required"), 400

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

    if not project:
        conn.close()
        return jsonify(success=False, error="Project not found"), 404

    if project["hired_freelancer_id"] != me_user["id"]:
        conn.close()
        return jsonify(success=False, error="You are not hired for this contract"), 403

    if project["status"] not in ("hired", "revision_requested"):
        conn.close()
        return jsonify(success=False, error="Deliverables cannot be submitted in the current state"), 409

    now = datetime.utcnow().isoformat()
    conn.execute("""
        UPDATE projects
        SET status = 'submitted', submitted_file = ?, submitted_comment = ?, submitted_at = ?, revision_note = NULL, revision_requested_at = NULL, updated_at = ?
        WHERE id = ?
    """, (filename, comment, now, now, project_id))

    # Log notification
    conn.execute("""
        INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
        VALUES (?, ?, 'deliverable_submitted', ?, ?)
    """, (project["client_id"], project_id, f"Contract deliverable '{filename}' submitted by {me_user['name']}.", now))

    conn.commit()
    updated = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()

    return jsonify(success=True, data={"project": dict(updated)}), 200

@app.route("/api/projects/<project_id>/request-revision", methods=["POST"])
def request_revision(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    data = request.json or {}
    note = data.get("revision_note", "").strip()

    if not note:
        return jsonify(success=False, error="Revision requests require feedback details"), 400

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

    if not project:
        conn.close()
        return jsonify(success=False, error="Project not found"), 404

    if project["client_id"] != me_user["id"]:
        conn.close()
        return jsonify(success=False, error="Only project owner can request revisions"), 403

    if project["status"] != "submitted":
        conn.close()
        return jsonify(success=False, error="Revisions can only be requested on submitted deliverables"), 409

    now = datetime.utcnow().isoformat()
    conn.execute("""
        UPDATE projects
        SET status = 'revision_requested', revision_note = ?, revision_requested_at = ?, updated_at = ?
        WHERE id = ?
    """, (note, now, now, project_id))

    # Notify freelancer
    conn.execute("""
        INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
        VALUES (?, ?, 'revision_requested', ?, ?)
    """, (project["hired_freelancer_id"], project_id, f"Client requested revision on contract '{project['title']}'. Review note: '{note[:60]}...'", now))

    conn.commit()
    updated = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()

    return jsonify(success=True, data={"project": dict(updated)}), 200

@app.route("/api/projects/<project_id>/accept-work", methods=["POST"])
def accept_work(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

        if not project:
            raise ValueError("Project not found")

        if project["client_id"] != me_user["id"]:
            raise PermissionError("Only the project owner can accept submissions")

        escrow_cents = project["escrow_cents"]
        if escrow_cents <= 0:
            raise ValueError("Duplicate payment release prevention triggered: No locked escrow found")

        if project["status"] != "submitted":
            raise ValueError("No deliverables submitted to accept")

        freelancer_id = project["hired_freelancer_id"]
        freelancer = conn.execute("SELECT * FROM users WHERE id = ?", (freelancer_id,)).fetchone()

        if not freelancer:
            raise ValueError("Contract operator account missing")

        now = datetime.utcnow().isoformat()

        # Add escrow to freelancer wallet
        new_freelancer_wallet = freelancer["wallet_cents"] + escrow_cents
        conn.execute("UPDATE users SET wallet_cents = ? WHERE id = ?", (new_freelancer_wallet, freelancer_id))

        # Log wallet transaction for freelancer (escrow release)
        conn.execute("""
            INSERT INTO wallet_transactions (user_id, project_id, transaction_type, amount_cents, balance_after_cents, description, created_at)
            VALUES (?, ?, 'escrow_release', ?, ?, ?, ?)
        """, (freelancer_id, project["id"], escrow_cents, new_freelancer_wallet, f"Escrow payment cleared for: {project['title']}", now))

        # Update project status and zero out escrow
        conn.execute("""
            UPDATE projects
            SET status = 'completed', escrow_cents = 0, completed_at = ?, updated_at = ?
            WHERE id = ?
        """, (now, now, project_id))

        # Create notifications
        conn.execute("""
            INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
            VALUES (?, ?, 'payment_released', ?, ?)
        """, (freelancer_id, project_id, f"Funds of ${escrow_cents / 100:.2f} released for '{project['title']}'.", now))

        conn.commit()
        return jsonify(success=True), 200

    except PermissionError as pe:
        conn.rollback()
        return jsonify(success=False, error=str(pe)), 403
    except ValueError as ve:
        conn.rollback()
        return jsonify(success=False, error=str(ve)), 409
    except Exception as e:
        conn.rollback()
        return jsonify(success=False, error="Error processing payment release"), 500
    finally:
        conn.close()

# ========================================================
# REVIEWS API
# ========================================================
@app.route("/api/projects/<project_id>/reviews", methods=["GET"])
def get_reviews(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    
    if not project:
        conn.close()
        return jsonify(success=False, error="Project not found"), 404

    # Determine if double blind applies
    rows = conn.execute("SELECT * FROM reviews WHERE project_id = ?", (project_id,)).fetchall()
    reviews_list = [dict(r) for r in rows]
    conn.close()

    if len(reviews_list) == 2:
        # Both submitted, reveal both reviews
        return jsonify(success=True, data={"reviews": reviews_list}), 200
    
    # Otherwise check who submitted
    my_review = next((r for r in reviews_list if r["reviewer_id"] == me_user["id"]), None)
    
    if my_review:
        # Show only my review, hide the other participant's
        return jsonify(success=True, data={"reviews": [my_review], "blinded": True}), 200
    
    # None of them reviewed, or only other participant did
    return jsonify(success=True, data={"reviews": [], "blinded": True}), 200

@app.route("/api/projects/<project_id>/reviews", methods=["POST"])
def post_review(project_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    data = request.json or {}
    rating = data.get("rating")
    comment = data.get("comment", "").strip()

    if rating is None or not comment:
        return jsonify(success=False, error="Rating (1-5) and feedback comment are required"), 400

    try:
        rating_val = int(rating)
        if rating_val < 1 or rating_val > 5:
            raise ValueError()
    except ValueError:
        return jsonify(success=False, error="Rating must be an integer between 1 and 5"), 400

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

        if not project:
            raise ValueError("Project not found")

        if project["status"] != "completed":
            raise ValueError("Feedback can only be exchanged on completed projects")

        # Must be either client or hired freelancer
        is_client = project["client_id"] == me_user["id"]
        is_freelancer = project["hired_freelancer_id"] == me_user["id"]

        if not is_client and not is_freelancer:
            raise PermissionError("You were not a contract participant on this project")

        # Define reviewee_id
        reviewee_id = project["hired_freelancer_id"] if is_client else project["client_id"]
        reviewer_role = "client" if is_client else "freelancer"

        # Check duplicate
        existing = conn.execute("SELECT id FROM reviews WHERE project_id = ? AND reviewer_id = ?", (project_id, me_user["id"])).fetchone()
        if existing:
            raise ValueError("You have already submitted your review for this project")

        now = datetime.utcnow().isoformat()
        conn.execute("""
            INSERT INTO reviews (project_id, reviewer_id, reviewee_id, reviewer_role, rating, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (project_id, me_user["id"], reviewee_id, reviewer_role, rating_val, comment, now))

        # Check if double blind is now released
        all_reviews = conn.execute("SELECT COUNT(*) FROM reviews WHERE project_id = ?", (project_id,)).fetchone()[0]
        if all_reviews == 2:
            # Notify both
            conn.execute("""
                INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
                VALUES (?, ?, 'review_submitted', 'Reviews revealed! Both participants have left feedback.', ?)
            """, (project["client_id"], project_id, now))
            conn.execute("""
                INSERT INTO notifications (user_id, project_id, notification_type, message, created_at)
                VALUES (?, ?, 'review_submitted', 'Reviews revealed! Both participants have left feedback.', ?)
            """, (project["hired_freelancer_id"], project_id, now))

        conn.commit()
        return jsonify(success=True), 201

    except PermissionError as pe:
        conn.rollback()
        return jsonify(success=False, error=str(pe)), 403
    except ValueError as ve:
        conn.rollback()
        return jsonify(success=False, error=str(ve)), 409
    except Exception as e:
        conn.rollback()
        return jsonify(success=False, error="Error saving feedback"), 500
    finally:
        conn.close()

# ========================================================
# WALLET API
# ========================================================
@app.route("/api/wallet/deposit", methods=["POST"])
def deposit_funds():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    data = request.json or {}
    amount_usd = data.get("amount")

    if amount_usd is None:
        return jsonify(success=False, error="Amount required"), 400

    try:
        amount_cents = int(float(amount_usd) * 100)
    except (ValueError, TypeError):
        return jsonify(success=False, error="Invalid deposit amount"), 400

    if amount_cents <= 0:
        return jsonify(success=False, error="Deposit amount must be positive"), 400

    if amount_cents > 10000000: # Limit $100,000 for safety
        return jsonify(success=False, error="Deposit amount exceeds Sandbox limits"), 400

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        user = conn.execute("SELECT wallet_cents FROM users WHERE id = ?", (me_user["id"],)).fetchone()
        new_balance = user["wallet_cents"] + amount_cents
        
        conn.execute("UPDATE users SET wallet_cents = ? WHERE id = ?", (new_balance, me_user["id"]))

        # Log transaction
        conn.execute("""
            INSERT INTO wallet_transactions (user_id, project_id, transaction_type, amount_cents, balance_after_cents, description, created_at)
            VALUES (?, NULL, 'deposit', ?, ?, 'Simulated sandbox deposit', ?)
        """, (me_user["id"], amount_cents, new_balance, datetime.utcnow().isoformat()))

        conn.commit()
        return jsonify(success=True, data={"wallet_cents": new_balance}), 200
    except Exception as e:
        conn.rollback()
        return jsonify(success=False, error="Transaction failed"), 500
    finally:
        conn.close()

@app.route("/api/wallet/withdraw", methods=["POST"])
def withdraw_funds():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    data = request.json or {}
    amount_usd = data.get("amount")
    bank_route = data.get("bank_route", "Demo Payout Account")

    if amount_usd is None:
        return jsonify(success=False, error="Amount required"), 400

    try:
        amount_cents = int(float(amount_usd) * 100)
    except (ValueError, TypeError):
        return jsonify(success=False, error="Invalid withdrawal amount"), 400

    if amount_cents <= 0:
        return jsonify(success=False, error="Withdrawal must be positive"), 400

    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        user = conn.execute("SELECT wallet_cents FROM users WHERE id = ?", (me_user["id"],)).fetchone()
        if user["wallet_cents"] < amount_cents:
            raise ValueError("Insufficient balance to complete payout")

        new_balance = user["wallet_cents"] - amount_cents
        conn.execute("UPDATE users SET wallet_cents = ? WHERE id = ?", (new_balance, me_user["id"]))

        # Log transaction
        conn.execute("""
            INSERT INTO wallet_transactions (user_id, project_id, transaction_type, amount_cents, balance_after_cents, description, created_at)
            VALUES (?, NULL, 'withdrawal', ?, ?, ?, ?)
        """, (me_user["id"], -amount_cents, new_balance, f"Withdrawal to {bank_route}", datetime.utcnow().isoformat()))

        conn.commit()
        return jsonify(success=True, data={"wallet_cents": new_balance}), 200
    except ValueError as ve:
        conn.rollback()
        return jsonify(success=False, error=str(ve)), 409
    except Exception as e:
        conn.rollback()
        return jsonify(success=False, error="Transaction failed"), 500
    finally:
        conn.close()

@app.route("/api/wallet/transactions", methods=["GET"])
def get_transactions():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    rows = conn.execute("""
        SELECT t.*, p.title as project_title 
        FROM wallet_transactions t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.user_id = ?
        ORDER BY t.id DESC
    """, (me_user["id"],)).fetchall()
    conn.close()

    txs = [dict(r) for r in rows]
    return jsonify(success=True, data={"transactions": txs}), 200

# ========================================================
# NOTIFICATIONS API
# ========================================================
@app.route("/api/notifications", methods=["GET"])
def list_notifications():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    rows = conn.execute("""
        SELECT n.*, p.title as project_title 
        FROM notifications n
        LEFT JOIN projects p ON n.project_id = p.id
        WHERE n.user_id = ?
        ORDER BY n.id DESC
    """, (me_user["id"],)).fetchall()
    
    # Count unread
    unread_count = conn.execute("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0", (me_user["id"],)).fetchone()[0]
    conn.close()

    notifs = [dict(r) for r in rows]
    return jsonify(success=True, data={"notifications": notifs, "unread_count": unread_count}), 200

@app.route("/api/notifications/<int:notification_id>/read", methods=["POST"])
def read_notification(notification_id):
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", (notification_id, me_user["id"]))
    conn.commit()
    conn.close()

    return jsonify(success=True), 200

@app.route("/api/notifications/read-all", methods=["POST"])
def read_all_notifications():
    me_user = get_session_user()
    if not me_user:
        return jsonify(success=False, error="Not authenticated"), 401

    conn = get_db()
    conn.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (me_user["id"],))
    conn.commit()
    conn.close()

    return jsonify(success=True), 200

# ========================================================
# SERVER LAUNCH
# ========================================================
if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
