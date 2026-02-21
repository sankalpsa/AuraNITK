# 🛠️ NITKnot — Internal Setup Guide

This document is for collaborators and authorized developers only.

## 🚀 Quick Setup

1.  **Clone the Repo**:
    ```bash
    git clone https://github.com/sankalpsa/NITKnot.git
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    Create a `.env` file in the root directory and fill in the following:
    ```env
    PORT=3000
    JWT_SECRET=your_super_secret_key
    NODE_ENV=development

    # Email Config (Required)
    SMTP_EMAIL=your@gmail.com
    SMTP_PASSWORD=your_gmail_app_password

    # Optional: Cloudinary
    CLOUDINARY_CLOUD_NAME=your_cloud
    CLOUDINARY_API_KEY=your_key
    CLOUDINARY_API_SECRET=your_secret
    ```

4.  **Database**:
    - The server will automatically initialize `nitknot.db` (SQLite) on the first run.

5.  **Run Application**:
    ```bash
    npm start
    ```

---

## 📂 Project Structure
- `server.js`: Main Express & Socket.io logic
- `db.js`: Database wrapper (PostgreSQL for production, SQLite for local)
- `public/`: Frontend assets (SPA)
- `uploads/`: Local storage for images/audio (if not using Cloudinary)

## 🧪 Testing Tips
- When registering locally, check the server console for the **OTP code**.
- Use the **Profile Creator** tool to generate test accounts quickly.
