// =====================================================================
// controlSystem/control.js - نظام التحكم في الصلاحيات
// =====================================================================

const fs = require("fs");
const config = require("../config");

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
// دوال التحقق من الصلاحيات
// =====================================================================

function getDB() {
  return safeReadJSON("./storage/resellers.json", { users: [] });
}

function isOwner(userId) {
  return userId.toString() === config.ownerId.toString();
}

function isReseller(userId) {
  const db = getDB();
  return db.users.includes(userId.toString());
}

function isFreeMode() {
  const settings = safeReadJSON("./database/settings.json", { freeMode: false });
  return settings.freeMode === true;
}

function hasAccess(userId) {
  const settings = safeReadJSON("./database/settings.json", { freeMode: false });
  
  if (settings.freeMode) return true;
  if (isOwner(userId)) return true;
  if (isReseller(userId)) return true;

  let accessDb = safeReadJSON("./storage/access.json", { users: [] });
  const users = Array.isArray(accessDb.users) ? accessDb.users : [];
  if (users.includes(userId.toString())) return true;

  return false;
}

// =====================================================================
// دوال إدارة الراسيلرز
// =====================================================================

function addReseller(targetId) {
  const db = getDB();
  if (!db.users.includes(targetId)) {
    db.users.push(targetId);
    safeWriteJSON("./storage/resellers.json", db);
    return true;
  }
  return false;
}

function removeReseller(targetId) {
  const db = getDB();
  const filtered = db.users.filter(id => id !== targetId);
  if (filtered.length !== db.users.length) {
    db.users = filtered;
    safeWriteJSON("./storage/resellers.json", db);
    return true;
  }
  return false;
}

function getResellers() {
  const db = getDB();
  return db.users || [];
}

// =====================================================================
// دوال إدارة الوصول
// =====================================================================

function addAccess(userId) {
  const access = safeReadJSON("./storage/access.json", { users: [] });
  if (!access.users.includes(userId)) {
    access.users.push(userId);
    safeWriteJSON("./storage/access.json", access);
    return true;
  }
  return false;
}

function removeAccess(userId) {
  const access = safeReadJSON("./storage/access.json", { users: [] });
  const filtered = access.users.filter(id => id !== userId);
  if (filtered.length !== access.users.length) {
    access.users = filtered;
    safeWriteJSON("./storage/access.json", access);
    return true;
  }
  return false;
}

function getAccessList() {
  const access = safeReadJSON("./storage/access.json", { users: [] });
  return access.users || [];
}

// =====================================================================
// دوال الحظر والقوائم البيضاء
// =====================================================================

function isBlocked(number) {
  const blacklist = safeReadJSON("./storage/blacklist.json", []);
  return blacklist.includes(number);
}

function isWhitelisted(number) {
  const whitelist = safeReadJSON("./storage/whitelist.json", []);
  return whitelist.includes(number);
}

function blockNumber(number) {
  const blacklist = safeReadJSON("./storage/blacklist.json", []);
  if (!blacklist.includes(number)) {
    blacklist.push(number);
    safeWriteJSON("./storage/blacklist.json", blacklist);
    return true;
  }
  return false;
}

function unblockNumber(number) {
  const blacklist = safeReadJSON("./storage/blacklist.json", []);
  const filtered = blacklist.filter(n => n !== number);
  if (filtered.length !== blacklist.length) {
    safeWriteJSON("./storage/blacklist.json", filtered);
    return true;
  }
  return false;
}

function getBlacklist() {
  return safeReadJSON("./storage/blacklist.json", []);
}

function getWhitelist() {
  return safeReadJSON("./storage/whitelist.json", []);
}

function addWhitelist(number) {
  const whitelist = safeReadJSON("./storage/whitelist.json", []);
  if (!whitelist.includes(number)) {
    whitelist.push(number);
    safeWriteJSON("./storage/whitelist.json", whitelist);
    return true;
  }
  return false;
}

function removeWhitelist(number) {
  const whitelist = safeReadJSON("./storage/whitelist.json", []);
  const filtered = whitelist.filter(n => n !== number);
  if (filtered.length !== whitelist.length) {
    safeWriteJSON("./storage/whitelist.json", filtered);
    return true;
  }
  return false;
}

// =====================================================================
// دوال الإحصائيات
// =====================================================================

function getStats() {
  return {
    ownerId: config.ownerId,
    freeMode: isFreeMode(),
    resellers: getResellers().length,
    accessUsers: getAccessList().length,
    blacklist: getBlacklist().length,
    whitelist: getWhitelist().length,
  };
}

// =====================================================================
// التصدير
// =====================================================================

module.exports = {
  // الصلاحيات
  isOwner,
  isReseller,
  isFreeMode,
  hasAccess,
  
  // الراسيلرز
  addReseller,
  removeReseller,
  getResellers,
  
  // الوصول
  addAccess,
  removeAccess,
  getAccessList,
  
  // الحظر والقوائم
  isBlocked,
  isWhitelisted,
  blockNumber,
  unblockNumber,
  getBlacklist,
  getWhitelist,
  addWhitelist,
  removeWhitelist,
  
  // إحصائيات
  getStats,
};