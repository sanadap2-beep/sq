// =====================================================================
// controlSystem/cooldown.js - نظام الكولدون الأساسي
// =====================================================================

const fs = require("fs");
const path = require("path");
const cdFile = "./storage/cooldown.json";

// =====================================================================
// التأكد من وجود الملف
// =====================================================================

if (!fs.existsSync(cdFile)) {
  fs.writeFileSync(cdFile, JSON.stringify({}, null, 2));
}

// =====================================================================
// دوال القراءة والكتابة الآمنة
// =====================================================================

function safeReadJSON(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    return defaultValue;
  } catch (err) {
    console.error(`Error reading ${filePath}: ${err.message}`);
    return defaultValue;
  }
}

function safeWriteJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}: ${err.message}`);
    return false;
  }
}

// =====================================================================
// دوال الكولدون
// =====================================================================

function setCooldown(commandName, minutes) {
  const db = safeReadJSON(cdFile, {});
  
  db[commandName] = {
    duration: minutes,
    lastUsed: 0
  };
  
  safeWriteJSON(cdFile, db);
  
  return {
    success: true,
    message: `⏳ Cooldown set: /${commandName} → ${minutes} minutes`
  };
}

function checkCooldown(commandName) {
  const db = safeReadJSON(cdFile, {});
  
  if (!db[commandName]) return { expired: true };
  
  const now = Date.now();
  const lastUsed = db[commandName].lastUsed || 0;
  const durationMs = db[commandName].duration * 60 * 1000;
  
  if (now - lastUsed >= durationMs) {
    return { expired: true };
  }
  
  const remaining = Math.ceil((durationMs - (now - lastUsed)) / 60000);
  
  return {
    expired: false,
    remaining: remaining
  };
}

function updateLastUsed(commandName) {
  const db = safeReadJSON(cdFile, {});
  
  if (!db[commandName]) return;
  
  db[commandName].lastUsed = Date.now();
  safeWriteJSON(cdFile, db);
}

function removeCooldown(commandName) {
  const db = safeReadJSON(cdFile, {});
  if (db[commandName]) {
    delete db[commandName];
    safeWriteJSON(cdFile, db);
    return true;
  }
  return false;
}

function getCooldownList() {
  const db = safeReadJSON(cdFile, {});
  return Object.keys(db);
}

function getCooldownInfo(commandName) {
  const db = safeReadJSON(cdFile, {});
  if (db[commandName]) {
    return {
      duration: db[commandName].duration,
      lastUsed: db[commandName].lastUsed || 0,
      lastUsedFormatted: db[commandName].lastUsed ? new Date(db[commandName].lastUsed).toLocaleString() : 'Never'
    };
  }
  return null;
}

// =====================================================================
// التصدير
// =====================================================================

module.exports = {
  setCooldown,
  checkCooldown,
  updateLastUsed,
  removeCooldown,
  getCooldownList,
  getCooldownInfo,
};