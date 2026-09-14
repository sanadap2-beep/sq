// =====================================================================
// controlSystem/control.js - نظام التحكم في الصلاحيات (V2.0)
// =====================================================================
// التعديلات:
// - إصلاح خطأ path غير مستورد
// - إضافة دعم الميزات الجديدة (features.js)
// - دعم الاشتراكات والمسؤولين والصيانة
// =====================================================================
const fs = require("fs");
const path = require("path"); // ✅ الإصلاح: استيراد path
const config = require("../config");
const features = require("./features"); // ✅ ربط الميزات الجديدة

// =====================================================================
// دوال القراءة والكتابة الآمنة (مُحسّنة)
// =====================================================================
function safeReadJSON(filePath, defaultValue = {}) {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, "..", filePath);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, "utf8"));
    }
    return defaultValue;
  } catch (err) {
    console.error(`[control] خطأ قراءة ${filePath}: ${err.message}`);
    return defaultValue;
  }
}

function safeWriteJSON(filePath, data) {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, "..", filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`[control] خطأ كتابة ${filePath}: ${err.message}`);
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
  return String(userId) === String(config.ownerId);
}

function isReseller(userId) {
  const db = getDB();
  return db.users && db.users.includes(String(userId));
}

// ✅ جديد: التحقق من الوضع المجاني (من features.js)
function isFreeMode() {
  return features.isFreeMode();
}

// ✅ جديد: التحقق من وضع الصيانة
function isMaintenance() {
  return features.isMaintenance();
}

function getMaintenanceMessage() {
  return features.getMaintenanceMessage();
}

// ✅ جديد: التحقق من المسؤول
function isAdmin(userId) {
  return features.isAdmin(userId);
}

function hasPermission(userId, permission) {
  return features.hasAdminPermission(userId, permission);
}

// ✅ محدّث: التحقق من الوصول (يدعم الاشتراكات)
function hasAccess(userId) {
  // الوضع المجاني يسمح للجميع
  if (isFreeMode()) return true;
  
  // المالك دائماً لديه صلاحية
  if (isOwner(userId)) return true;
  
  // الموزعون
  if (isReseller(userId)) return true;
  
  // المسؤولون
  if (isAdmin(userId)) return true;
  
  // المستخدمون الذين لديهم وصول مباشر
  let accessDb = safeReadJSON("./storage/access.json", { users: [] });
  const users = Array.isArray(accessDb.users) ? accessDb.users : [];
  if (users.includes(String(userId))) return true;
  
  // ✅ جديد: التحقق من الاشتراكات
  const sub = features.checkSubscription(userId);
  if (sub.active) return true;
  
  return false;
}

// =====================================================================
// دوال إدارة الراسيلرز (الموزعين)
// =====================================================================
function addReseller(targetId) {
  const db = getDB();
  const id = String(targetId);
  if (!db.users.includes(id)) {
    db.users.push(id);
    safeWriteJSON("./storage/resellers.json", db);
    return true;
  }
  return false;
}

function removeReseller(targetId) {
  const db = getDB();
  const id = String(targetId);
  const filtered = db.users.filter(u => u !== id);
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
  const id = String(userId);
  if (!access.users.includes(id)) {
    access.users.push(id);
    safeWriteJSON("./storage/access.json", access);
    return true;
  }
  return false;
}

function removeAccess(userId) {
  const access = safeReadJSON("./storage/access.json", { users: [] });
  const id = String(userId);
  const filtered = access.users.filter(u => u !== id);
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
// دوال الإحصائيات (مُحسّنة)
// =====================================================================
function getStats() {
  const featureStats = features.getStats();
  return {
    ownerId: config.ownerId,
    freeMode: isFreeMode(),
    maintenanceMode: isMaintenance(),
    resellers: getResellers().length,
    accessUsers: getAccessList().length,
    blacklist: getBlacklist().length,
    whitelist: getWhitelist().length,
    // ✅ جديد: إحصائيات الميزات
    codes: featureStats.codes,
    admins: featureStats.admins,
    customCommands: featureStats.customCommands
  };
}

// =====================================================================
// التصدير
// =====================================================================
module.exports = {
  // دوال مساعدة
  safeReadJSON,
  safeWriteJSON,
  
  // الصلاحيات
  isOwner,
  isReseller,
  isFreeMode,
  isMaintenance,
  getMaintenanceMessage,
  isAdmin,
  hasPermission,
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
