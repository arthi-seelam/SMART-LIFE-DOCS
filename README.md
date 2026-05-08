# Smart Life Docs AI
### Digital Document Intelligence & Reminder Management System

A full-stack web application built with **HTML + CSS + JavaScript (frontend)** and **Python Flask (backend)**.  
Works with VS Code Live Server — no Node.js, no React build step needed!

---

## 📁 Project Structure

```
SmartLifeDocsAI/
├── index.html       ← Main frontend (all pages in one file)
├── style.css        ← Complete styling with dark/light theme
├── app.js           ← Frontend logic (auth, documents, reminders)
├── app.py           ← Python Flask backend (REST API)
├── README.md        ← This file
└── data/            ← Auto-created by app.py
    ├── users.json
    ├── documents.json
    ├── reminders.json
    └── uploads/
```

---

## ⚡ Quick Start (2 steps)

### Step 1 — Start the Python Backend

```bash
# Install dependencies (only once)
pip install flask flask-cors

# Run the backend
python app.py
```

You should see:
```
Smart Life Docs AI — Backend Running
URL: http://127.0.0.1:5000
```

### Step 2 — Open Frontend with VS Code Live Server

1. Open the `SmartLifeDocsAI/` folder in VS Code
2. Right-click `index.html` → **"Open with Live Server"**
3. Browser opens at `http://127.0.0.1:5500/index.html`

> ✅ That's it! Register → Login → Start uploading documents!

---

## 🔑 Test Credentials (after first registration)

Register with any email/password on the Register page.  
Data is saved in `data/users.json`.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 Auth | Register, Login, Logout with hashed passwords |
| 📊 Dashboard | Stats, category breakdown, recent docs, upcoming reminders |
| 📤 Upload | PDF, JPG, PNG with drag & drop |
| 🤖 OCR Simulation | Keyword-based text extraction (replace with Tesseract) |
| 🏷️ Auto Classification | Bill, Medical, Insurance, Certificate, Government ID, Other |
| 🔔 Reminders | Auto-created from extracted dates; add/edit/delete/mark done |
| 🔍 Search & Filter | By title, category, sort by date |
| 🌙 Dark / Light Mode | Toggle button in sidebar |
| 📱 Responsive | Mobile-friendly sidebar |

---

## 🤖 Upgrading OCR (Optional)

To use real OCR, install Tesseract and update `app.py`:

```bash
pip install pytesseract pillow pdfplumber
```

Replace the `perform_ocr()` function in `app.py`:

```python
import pytesseract
from PIL import Image
import pdfplumber

def perform_ocr(file_path, file_type, title=""):
    if file_type == "pdf":
        with pdfplumber.open(file_path) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    else:
        return pytesseract.image_to_string(Image.open(file_path))
```

---

## 🗄️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| PUT | /api/auth/me | Update profile |
| POST | /api/documents/upload | Upload & process document |
| GET | /api/documents?userId=... | Get all user documents |
| GET | /api/documents/:id | Get document details |
| DELETE | /api/documents/:id | Delete document |
| GET | /api/reminders?userId=... | Get all reminders |
| POST | /api/reminders | Add reminder |
| PUT | /api/reminders/:id | Edit reminder |
| DELETE | /api/reminders/:id | Delete reminder |

---

## 📚 College Viva Points

- **Frontend**: Pure HTML/CSS/JS, no frameworks needed
- **Backend**: Python Flask REST API with CORS
- **Storage**: JSON files (easily upgradeable to MongoDB/SQLite)
- **OCR**: Simulated (upgradeable to Tesseract.js or pytesseract)
- **Classification**: Rule-based keyword matching
- **Auth**: SHA-256 password hashing
- **Offline Mode**: Falls back to localStorage if backend is down

---

Made with ❤️ for college project — Smart Life Docs AI
