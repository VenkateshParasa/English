# 🚀 English Learning Portal - Deployment Guide

Simple guide to run the English Learning Portal using http-server.

---

## 📋 Prerequisites

- Node.js installed on your system
- Project files in a directory

---

## 🚀 Deployment Options

### Option 1: Using npm scripts (Recommended)

**Step 1: Install dependencies (one time only)**
```bash
# Navigate to project directory
cd /Users/venkateshparasa/Documents/English

# Install http-server
npm install
```

**Step 2: Start the application**
```bash
npm start
```

The app will automatically open in your browser at `http://localhost:3000`

**Benefits:**
- ✅ Convenient `npm start` command
- ✅ Consistent across all environments
- ✅ Includes all project dependencies

---

### Option 2: Using npx (No installation needed - Works NOW!)

**Run directly without any setup:**
```bash
# Navigate to project directory
cd /Users/venkateshparasa/Documents/English

# Run the server
npx http-server -p 3000 -o
```

The app will automatically open in your browser at `http://localhost:3000`

**Benefits:**
- ✅ Works immediately without installation
- ✅ No need to install dependencies
- ✅ Perfect for quick testing

---

### Option 3: If http-server is globally installed

**If you have http-server installed globally:**
```bash
# Navigate to project directory
cd /Users/venkateshparasa/Documents/English

# Run the server
http-server -p 3000 -o
```

The app will automatically open in your browser at `http://localhost:3000`

**To install http-server globally (one time):**
```bash
npm install -g http-server
```

**Benefits:**
- ✅ Simple command
- ✅ Available system-wide
- ✅ Fast startup

---

## 📝 Available npm Scripts

After running `npm install`, you can use these commands:

```bash
npm start          # Start server on port 3000 (auto-open browser)
npm run dev        # Same as start
npm run serve      # Start server on port 8080
npm test           # Start server on port 8000
```

---

## 🎯 Quick Start Guide

**Fastest way to get started:**

```bash
# 1. Navigate to project
cd /Users/venkateshparasa/Documents/English

# 2. Run with npx (no installation needed)
npx http-server -p 3000 -o
```

**Or for regular use:**

```bash
# 1. Navigate to project
cd /Users/venkateshparasa/Documents/English

# 2. Install dependencies (one time)
npm install

# 3. Start the app
npm start
```

---

## 🔧 Server Options Explained

The `-p 3000` flag sets the port to 3000
The `-o` flag automatically opens the browser
The `-c-1` flag disables caching (useful for development)

**Custom port example:**
```bash
http-server -p 8080 -o
```

**Without auto-open:**
```bash
http-server -p 3000
# Then manually open: http://localhost:3000
```

---

## ✅ Verify Installation

After starting the server, you should see:

```
Starting up http-server, serving ./
Available on:
  http://127.0.0.1:3000
  http://192.168.x.x:3000
Hit CTRL-C to stop the server
```

The app should automatically open in your default browser.

---

## 🆘 Troubleshooting

### Port already in use?
```bash
# Use a different port
npx http-server -p 3001 -o
```

### npm not found?
Install Node.js from: https://nodejs.org

### Permission denied?
```bash
# Use sudo for global installs
sudo npm install -g http-server
```

### Browser doesn't open automatically?
Manually open: `http://localhost:3000`

---

## 🛑 Stopping the Server

Press `Ctrl+C` in the terminal to stop the server.

---

## 📱 Access from Other Devices

Once the server is running, you can access it from other devices on the same network:

1. Find your computer's IP address
2. On other devices, open: `http://YOUR_IP:3000`

Example: `http://192.168.1.100:3000`

---


## 🎉 That's It!

Your English Learning Portal is now running locally!

**For production deployment to the web, see the full documentation or use platforms like:**
- GitHub Pages
- Netlify
- Vercel

---

**Happy Learning! 📚✨**