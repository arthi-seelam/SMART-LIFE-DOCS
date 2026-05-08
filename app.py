# ============================================================
#  SMART LIFE DOCS AI — app.py
#  Python Flask Backend
#  Run: python app.py
#  Requires: pip install flask flask-cors
# ============================================================

from flask import Flask, request, jsonify
from flask_cors import CORS
import json, os, uuid, hashlib
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allow Live Server frontend to connect

# ============================================================
#  DATA STORAGE (JSON files — no database needed)
# ============================================================
DATA_DIR  = "data"
USERS_FILE     = os.path.join(DATA_DIR, "users.json")
DOCS_FILE      = os.path.join(DATA_DIR, "documents.json")
REMINDERS_FILE = os.path.join(DATA_DIR, "reminders.json")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")

def ensure_files():
    os.makedirs(DATA_DIR,   exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    for f in [USERS_FILE, DOCS_FILE, REMINDERS_FILE]:
        if not os.path.exists(f):
            with open(f, "w") as fp:
                json.dump([], fp)

def read_json(path):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except:
        return []

def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

# ============================================================
#  DOCUMENT CLASSIFICATION — keyword-based
# ============================================================
CATEGORY_KEYWORDS = {
    "Bill":        ["bill", "electricity", "water", "gas", "phone", "internet", "utility", "amount due", "due date", "units"],
    "Medical":     ["prescription", "medicine", "doctor", "hospital", "patient", "dosage", "mg", "tablet", "diagnosis", "health"],
    "Insurance":   ["insurance", "policy", "premium", "coverage", "insured", "renewal", "claim", "nominee"],
    "Certificate": ["certificate", "degree", "diploma", "marksheet", "admit", "completion", "awarded", "rank"],
    "Government ID": ["aadhaar", "pan", "passport", "voter", "license", "dob", "government", "national id"]
}

def classify_document(text, title=""):
    combined = (text + " " + title).lower()
    scores = {cat: 0 for cat in CATEGORY_KEYWORDS}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in combined:
                scores[cat] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Other"

# ============================================================
#  FIELD EXTRACTION — regex + keyword-based
# ============================================================
import re

def extract_fields(text, category):
    fields = {}
    # Due/Expiry/Renewal date
    for label in ["Due Date", "Renewal Date", "Expiry Date", "Issue Date", "Next Visit", "Date"]:
        match = re.search(rf"{label}[:\s]+([^\n]+)", text, re.IGNORECASE)
        if match:
            fields[label] = match.group(1).strip()
            break

    # Amount
    match = re.search(r"(Amount|Total|Premium|Fee)[^:\n]*[:\s]+([\₹$\d,\.]+)", text, re.IGNORECASE)
    if match:
        fields["Amount"] = match.group(2).strip()

    # Reference numbers
    match = re.search(r"(Policy|Account|Certificate|Document|Reference)\s*(No|Number|#)[.\s:]+([A-Z0-9\-]+)", text, re.IGNORECASE)
    if match:
        fields["Reference No"] = match.group(3).strip()

    # Category-specific
    if category == "Medical":
        m = re.search(r"Dr[.\s]+([^\n]+)", text, re.IGNORECASE)
        if m: fields["Doctor"] = m.group(1).strip()
        m = re.search(r"Patient[:\s]+([^\n]+)", text, re.IGNORECASE)
        if m: fields["Patient"] = m.group(1).strip()

    if category == "Bill":
        m = re.search(r"Account\s*No[:\s]+([^\n]+)", text, re.IGNORECASE)
        if m: fields["Account No"] = m.group(1).strip()
        m = re.search(r"Units[^:\n]*[:\s]+([\d]+)", text, re.IGNORECASE)
        if m: fields["Units"] = m.group(1).strip()

    return fields

# ============================================================
#  OCR SIMULATION (returns mock text; replace with Tesseract)
# ============================================================
def perform_ocr(file_path, file_type, title=""):
    """
    In a real project, use:
        import pytesseract
        from PIL import Image
        text = pytesseract.image_to_string(Image.open(file_path))
    For PDF:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            text = "".join(p.extract_text() for p in pdf.pages)

    For this demo, we return simulated OCR text.
    """
    today = datetime.now().strftime("%d/%m/%Y")
    t = title.lower()

    if any(k in t for k in ["electricity","water","gas","bill","utility"]):
        return f"""ELECTRICITY BILL
Account No: {uuid.uuid4().hex[:8].upper()}
Billing Period: {today}
Units Consumed: 320 kWh
Amount Due: Rs.2450
Due Date: {today}
Please pay before due date."""
    elif any(k in t for k in ["prescription","medicine","medical","doctor","hospital"]):
        return f"""PRESCRIPTION
Patient: Patient Name
Date: {today}
Dr. Rajesh Kumar, MBBS MD
City Hospital

Medicine 1: Paracetamol 500mg - 1 tablet twice daily
Medicine 2: Azithromycin 250mg - 1 tablet daily
Next Visit: {today}"""
    elif any(k in t for k in ["insurance","policy","premium"]):
        return f"""INSURANCE POLICY
Policy Number: INS-{uuid.uuid4().hex[:6].upper()}
Premium Amount: Rs.18500/year
Policy Start: {today}
Renewal Date: {today}
Coverage: Health Rs.5,00,000"""
    elif any(k in t for k in ["certificate","degree","diploma","marksheet"]):
        return f"""CERTIFICATE OF COMPLETION
This certifies successful completion of the course.
Issue Date: {today}
Expiry Date: {today}
Certificate No: CERT-{uuid.uuid4().hex[:6].upper()}"""
    else:
        return f"""DOCUMENT
Title: {title}
Date: {today}
Reference: REF-{uuid.uuid4().hex[:8].upper()}
Issued for official use."""

# ============================================================
#  AUTH ROUTES
# ============================================================

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json
    name     = data.get("name", "").strip()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "All fields required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password too short"}), 400

    users = read_json(USERS_FILE)
    if any(u["email"] == email for u in users):
        return jsonify({"error": "Email already registered"}), 409

    user = {
        "id":       str(uuid.uuid4()),
        "name":     name,
        "email":    email,
        "password": hash_password(password),
        "createdAt": datetime.now().isoformat()
    }
    users.append(user)
    write_json(USERS_FILE, users)
    return jsonify({"message": "Registered successfully"}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.json
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    users = read_json(USERS_FILE)
    user  = next((u for u in users if u["email"] == email and u["password"] == hash_password(password)), None)
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    return jsonify({
        "message": "Login successful",
        "user": {"id": user["id"], "name": user["name"], "email": user["email"]}
    })


@app.route("/api/auth/me", methods=["PUT"])
def update_profile():
    data    = request.json
    user_id = data.get("userId")
    name    = data.get("name", "").strip()

    users = read_json(USERS_FILE)
    for u in users:
        if u["id"] == user_id:
            u["name"] = name
            write_json(USERS_FILE, users)
            return jsonify({"message": "Updated"})
    return jsonify({"error": "User not found"}), 404

# ============================================================
#  DOCUMENT ROUTES
# ============================================================

@app.route("/api/documents/upload", methods=["POST"])
def upload_document():
    user_id  = request.form.get("userId")
    title    = request.form.get("title", "Untitled")
    category = request.form.get("category", "auto")
    file     = request.files.get("file")

    if not user_id or not file:
        return jsonify({"error": "Missing data"}), 400

    # Save file
    ext       = os.path.splitext(file.filename)[1].lower()
    file_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    file.save(file_path)

    file_type = "pdf" if ext == ".pdf" else "image"

    # OCR
    ocr_text = perform_ocr(file_path, file_type, title)

    # Classify
    if category == "auto":
        category = classify_document(ocr_text, title)

    # Extract fields
    fields = extract_fields(ocr_text, category)

    doc = {
        "id":              str(uuid.uuid4()),
        "userId":          user_id,
        "title":           title,
        "fileUrl":         f"/data/uploads/{file_name}",
        "fileType":        file_type,
        "category":        category,
        "extractedText":   ocr_text,
        "extractedFields": fields,
        "uploadDate":      datetime.now().isoformat()
    }

    docs = read_json(DOCS_FILE)
    docs.insert(0, doc)
    write_json(DOCS_FILE, docs)

    # Auto create reminders from date fields
    auto_create_reminders(doc)

    return jsonify({"document": doc}), 201


@app.route("/api/documents", methods=["GET"])
def get_documents():
    user_id = request.args.get("userId")
    docs    = read_json(DOCS_FILE)
    if user_id:
        docs = [d for d in docs if d.get("userId") == user_id]
    return jsonify({"documents": docs})


@app.route("/api/documents/<doc_id>", methods=["GET"])
def get_document(doc_id):
    docs = read_json(DOCS_FILE)
    doc  = next((d for d in docs if d["id"] == doc_id), None)
    if not doc:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"document": doc})


@app.route("/api/documents/<doc_id>", methods=["PUT"])
def update_document(doc_id):
    data = request.json
    docs = read_json(DOCS_FILE)
    for d in docs:
        if d["id"] == doc_id and d.get("userId") == data.get("userId"):
            if "title"    in data: d["title"]    = data["title"]
            if "category" in data: d["category"] = data["category"]
            write_json(DOCS_FILE, docs)
            return jsonify({"document": d})
    return jsonify({"error": "Not found"}), 404


@app.route("/api/documents/<doc_id>", methods=["DELETE"])
def delete_document(doc_id):
    data    = request.json or {}
    user_id = data.get("userId")
    docs    = read_json(DOCS_FILE)
    new     = [d for d in docs if not (d["id"] == doc_id and d.get("userId") == user_id)]
    if len(new) == len(docs):
        return jsonify({"error": "Not found"}), 404
    write_json(DOCS_FILE, new)
    return jsonify({"message": "Deleted"})

# ============================================================
#  REMINDER ROUTES
# ============================================================

def auto_create_reminders(doc):
    """Auto-create reminders from extracted date fields."""
    date_fields = ["Due Date", "Renewal Date", "Expiry Date", "Next Visit"]
    reminders   = read_json(REMINDERS_FILE)
    fields      = doc.get("extractedFields", {})
    for key in date_fields:
        if key in fields:
            reminder = {
                "id":           str(uuid.uuid4()),
                "userId":       doc["userId"],
                "documentId":   doc["id"],
                "title":        f"{key}: {doc['title']}",
                "reminderDate": datetime.now().isoformat(),  # parse actual date in production
                "status":       "pending",
                "type":         doc["category"].lower(),
                "createdAt":    datetime.now().isoformat()
            }
            reminders.insert(0, reminder)
    write_json(REMINDERS_FILE, reminders)


@app.route("/api/reminders", methods=["GET"])
def get_reminders():
    user_id   = request.args.get("userId")
    reminders = read_json(REMINDERS_FILE)
    if user_id:
        reminders = [r for r in reminders if r.get("userId") == user_id]
    return jsonify({"reminders": reminders})


@app.route("/api/reminders", methods=["POST"])
def add_reminder():
    data = request.json
    reminder = {
        "id":           str(uuid.uuid4()),
        "userId":       data.get("userId"),
        "documentId":   data.get("documentId"),
        "title":        data.get("title", "Reminder"),
        "reminderDate": data.get("reminderDate", datetime.now().isoformat()),
        "status":       "pending",
        "type":         data.get("type", "general"),
        "createdAt":    datetime.now().isoformat()
    }
    reminders = read_json(REMINDERS_FILE)
    reminders.insert(0, reminder)
    write_json(REMINDERS_FILE, reminders)
    return jsonify({"reminder": reminder}), 201


@app.route("/api/reminders/<rem_id>", methods=["PUT"])
def update_reminder(rem_id):
    data      = request.json
    reminders = read_json(REMINDERS_FILE)
    for r in reminders:
        if r["id"] == rem_id and r.get("userId") == data.get("userId"):
            if "title"        in data: r["title"]        = data["title"]
            if "reminderDate" in data: r["reminderDate"] = data["reminderDate"]
            if "status"       in data: r["status"]       = data["status"]
            if "type"         in data: r["type"]         = data["type"]
            write_json(REMINDERS_FILE, reminders)
            return jsonify({"reminder": r})
    return jsonify({"error": "Not found"}), 404


@app.route("/api/reminders/<rem_id>", methods=["DELETE"])
def delete_reminder(rem_id):
    data      = request.json or {}
    user_id   = data.get("userId")
    reminders = read_json(REMINDERS_FILE)
    new       = [r for r in reminders if not (r["id"] == rem_id and r.get("userId") == user_id)]
    if len(new) == len(reminders):
        return jsonify({"error": "Not found"}), 404
    write_json(REMINDERS_FILE, new)
    return jsonify({"message": "Deleted"})

# ============================================================
#  RUN
# ============================================================
if __name__ == "__main__":
    ensure_files()
    print("="*50)
    print("  Smart Life Docs AI — Backend Running")
    print("  URL: http://127.0.0.1:5000")
    print("  Open index.html with VS Code Live Server")
    print("="*50)
    app.run(debug=True, port=5000)
