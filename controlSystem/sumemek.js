// =====================================================================
// controlSystem/sumemek.js - نظام الكولدون المتقدم
// =====================================================================

const fs = require("fs");
const path = require("path");

const COOLDOWN_FILE = "./storage/cooldown1.json";
const COOLDOWN_DURATION = 20 * 60 * 1000;
const COOLDOWN_COMMANDS = [
  "Xzesoandro",
  "Delayxzeso",
  "Xzesoiosx",
  "Uixzeso",
  "Droidx",
  "Betaxzeso",
  "Betaxzosex",
  "invisisendx",
  "Xzesox",
  "masscrash",
  "spamcall",
  "floodmsg",
  "crashgroup",
  "crashstatus",
  "crashchannel"
];

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
// تهيئة الملف
// =====================================================================

function initCooldownFile() {
  try {
    if (!fs.existsSync(COOLDOWN_FILE)) {
      safeWriteJSON(COOLDOWN_FILE, {
        enabled: false,
        users: {}
      });
    }
  } catch (error) {
    console.error("Error initializing cooldown file:", error);
  }
}

// =====================================================================
// دوال القراءة والكتابة
// =====================================================================

function readCooldownData() {
  return safeReadJSON(COOLDOWN_FILE, { enabled: false, users: {} });
}

function writeCooldownData(data) {
  return safeWriteJSON(COOLDOWN_FILE, data);
}

// =====================================================================
// دوال التحكم في الكولدون
// =====================================================================

function isCooldownEnabled() {
  const data = readCooldownData();
  return data.enabled === true;
}

function enableCooldown() {
  const data = readCooldownData();
  data.enabled = true;
  writeCooldownData(data);
  return true;
}

function disableCooldown() {
  const data = readCooldownData();
  data.enabled = false;
  writeCooldownData(data);
  return true;
}

// =====================================================================
// دوال التحقق من الكولدون
// =====================================================================

function checkCooldown(userId, command) {
  if (!isCooldownEnabled()) {
    return {
      onCooldown: false,
      remaining: 0,
      totalWait: 20
    };
  }

  const data = readCooldownData();
  const userCooldowns = data.users[userId] || {};

  if (!userCooldowns[command]) {
    return {
      onCooldown: false,
      remaining: 0,
      totalWait: 20
    };
  }

  const lastUsedTime = userCooldowns[command];
  const now = Date.now();
  const elapsed = now - lastUsedTime;
  const elapsedMinutes = Math.floor(elapsed / (60 * 1000));
  const remaining = Math.max(0, 20 - elapsedMinutes);

  return {
    onCooldown: remaining > 0,
    remaining: remaining,
    totalWait: 20
  };
}

// =====================================================================
// دوال تحديث الكولدون
// =====================================================================

function updateCooldown(userId, command) {
  const data = readCooldownData();
  if (!data.users[userId]) {
    data.users[userId] = {};
  }
  data.users[userId][command] = Date.now();
  writeCooldownData(data);
}

// =====================================================================
// دوال إعادة تعيين الكولدون
// =====================================================================

function resetUserCommandCooldown(userId, command) {
  const data = readCooldownData();
  if (data.users[userId]) {
    delete data.users[userId][command];
    writeCooldownData(data);
    return true;
  }
  return false;
}

function resetUserAllCooldowns(userId) {
  const data = readCooldownData();
  if (data.users[userId]) {
    delete data.users[userId];
    writeCooldownData(data);
    return true;
  }
  return false;
}

function resetAllCooldowns() {
  const data = {
    enabled: isCooldownEnabled(),
    users: {}
  };
  writeCooldownData(data);
  return true;
}

// =====================================================================
// دوال الحصول على معلومات الكولدون
// =====================================================================

function getUserCooldownStatus(userId) {
  const data = readCooldownData();
  const userCooldowns = data.users[userId] || {};
  const status = {};

  for (const cmd of COOLDOWN_COMMANDS) {
    const cooldownInfo = checkCooldown(userId, cmd);
    status[cmd] = {
      onCooldown: cooldownInfo.onCooldown,
      remaining: cooldownInfo.remaining,
      lastUsed: userCooldowns[cmd] ? new Date(userCooldowns[cmd]).toLocaleString('id-ID') : "Tidak pernah"
    };
  }

  return status;
}

function getAllUsersCooldown() {
  const data = readCooldownData();
  return data.users || {};
}

function getCooldownStats() {
  const data = readCooldownData();
  const users = Object.keys(data.users || {});
  let totalCommands = 0;
  
  for (const user of users) {
    totalCommands += Object.keys(data.users[user] || {}).length;
  }
  
  return {
    enabled: data.enabled,
    totalUsers: users.length,
    totalCommands: totalCommands,
    activeCooldowns: totalCommands
  };
}

// =====================================================================
// التصدير
// =====================================================================

module.exports = {
  initCooldownFile,
  checkCooldown,
  updateCooldown,
  resetUserCommandCooldown,
  resetUserAllCooldowns,
  resetAllCooldowns,
  isCooldownEnabled,
  enableCooldown,
  disableCooldown,
  getUserCooldownStatus,
  getAllUsersCooldown,
  getCooldownStats,
  COOLDOWN_COMMANDS
};