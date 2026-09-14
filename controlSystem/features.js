// =====================================================================
// controlSystem/features.js - نظام الميزات المتقدمة (V2.0)
// =====================================================================
// يحتوي على: الاشتراكات، الصيانة، الصورة، الأوامر المخصصة، المسؤولون
// =====================================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// =====================================================================
// دوال القراءة والكتابة الآمنة
// =====================================================================
function safeRead(filePath, defaultValue = {}) {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, "..", filePath);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, "utf8"));
    }
    return defaultValue;
  } catch (err) {
    console.error(`[features] خطأ قراءة ${filePath}: ${err.message}`);
    return defaultValue;
  }
}

function safeWrite(filePath, data) {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, "..", filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`[features] خطأ كتابة ${filePath}: ${err.message}`);
    return false;
  }
}

// =====================================================================
// 1. نظام رموز الاشتراك بالساعة
// =====================================================================
const CODES_FILE = "./storage/subscription_codes.json";
const SUBS_FILE = "./storage/subscriptions.json";

// إنشاء رمز اشتراك جديد
function generateCode(hours, createdBy, note = "") {
  const code = "XZ-" + crypto.randomBytes(6).toString("hex").toUpperCase();
  const db = safeRead(CODES_FILE, { codes: [] });
  
  const newCode = {
    code,
    hours: parseInt(hours),
    createdAt: Date.now(),
    createdBy: String(createdBy),
    note,
    used: false,
    usedBy: null,
    usedAt: null
  };
  
  db.codes.push(newCode);
  safeWrite(CODES_FILE, db);
  
  return {
    success: true,
    code,
    hours: parseInt(hours),
    message: `✅ تم إنشاء الرمز بنجاح\n🎟️ الرمز: ${code}\n⏰ المدة: ${hours} ساعة`
  };
}

// تفعيل رمز اشتراك
function redeemCode(userId, code) {
  const db = safeRead(CODES_FILE, { codes: [] });
  const subs = safeRead(SUBS_FILE, { users: {} });
  
  // البحث عن الرمز
  const target = db.codes.find(c => c.code === code.toUpperCase() && !c.used);
  if (!target) {
    return { success: false, message: "❌ الرمز غير صالح أو مُستخدم بالفعل" };
  }
  
  const now = Date.now();
  const hoursMs = target.hours * 60 * 60 * 1000;
  const userKey = String(userId);
  
  // إذا كان لديه اشتراك سابق ولم ينتهِ، نضيف المدة عليه
  let expiresAt;
  if (subs.users[userKey] && subs.users[userKey].expiresAt > now) {
    expiresAt = subs.users[userKey].expiresAt + hoursMs;
  } else {
    expiresAt = now + hoursMs;
  }
  
  // حفظ الاشتراك
  subs.users[userKey] = {
    plan: `${target.hours} ساعة`,
    activatedAt: now,
    expiresAt,
    codes: [...(subs.users[userKey]?.codes || []), target.code]
  };
  
  // تحديث الرمز
  target.used = true;
  target.usedBy = userKey;
  target.usedAt = now;
  
  safeWrite(SUBS_FILE, subs);
  safeWrite(CODES_FILE, db);
  
  return {
    success: true,
    expiresAt,
    hours: target.hours,
    message: `✅ تم تفعيل الاشتراك بنجاح!\n⏰ المدة: ${target.hours} ساعة\n📅 ينتهي في: ${new Date(expiresAt).toLocaleString("ar-EG")}`
  };
}

// التحقق من الاشتراك
function checkSubscription(userId) {
  const subs = safeRead(SUBS_FILE, { users: {} });
  const userSub = subs.users[String(userId)];
  
  if (!userSub) {
    return { active: false, expired: false };
  }
  
  if (Date.now() >= userSub.expiresAt) {
    return { active: false, expired: true, data: userSub };
  }
  
  const remaining = userSub.expiresAt - Date.now();
  return {
    active: true,
    expired: false,
    data: userSub,
    remainingMs: remaining,
    remainingHours: Math.floor(remaining / (60 * 60 * 1000)),
    remainingMinutes: Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
  };
}

// قائمة الرموز
function listCodes(includeUsed = false) {
  const db = safeRead(CODES_FILE, { codes: [] });
  if (includeUsed) return db.codes;
  return db.codes.filter(c => !c.used);
}

// حذف رمز
function deleteCode(code) {
  const db = safeRead(CODES_FILE, { codes: [] });
  const before = db.codes.length;
  db.codes = db.codes.filter(c => c.code !== code.toUpperCase());
  if (db.codes.length !== before) {
    safeWrite(CODES_FILE, db);
    return true;
  }
  return false;
}

// =====================================================================
// 2. نظام الصيانة
// =====================================================================
const SETTINGS_FILE = "./database/settings.json";

function setMaintenance(enabled, message = "") {
  const settings = safeRead(SETTINGS_FILE, {});
  settings.maintenanceMode = enabled;
  if (message) settings.maintenanceMessage = message;
  settings.maintenanceChangedAt = Date.now();
  safeWrite(SETTINGS_FILE, settings);
  return true;
}

function isMaintenance() {
  const settings = safeRead(SETTINGS_FILE, {});
  return settings.maintenanceMode === true;
}

function getMaintenanceMessage() {
  const settings = safeRead(SETTINGS_FILE, {});
  return settings.maintenanceMessage || "🛠️ البوت في وضع الصيانة. سنعود قريباً.";
}

// =====================================================================
// 3. نظام الصورة المخصصة للبوت
// =====================================================================
const IMAGE_FILE = "./storage/botImage.json";

function setBotImage(url) {
  safeWrite(IMAGE_FILE, {
    type: "url",
    url,
    updatedAt: Date.now()
  });
  return { success: true };
}

function getBotImage() {
  const data = safeRead(IMAGE_FILE, {});
  // الصورة الافتراضية
  return data.url || "https://i.imgur.com/9Jk5Q2L.jpg";
}

function resetBotImage() {
  safeWrite(IMAGE_FILE, {
    type: "url",
    url: "https://i.imgur.com/9Jk5Q2L.jpg",
    updatedAt: Date.now()
  });
  return { success: true };
}

// =====================================================================
// 4. نظام الأوامر المخصصة
// =====================================================================
const CUSTOM_CMD_FILE = "./storage/customCommands.json";

function addCustomCommand(name, response, createdBy) {
  const db = safeRead(CUSTOM_CMD_FILE, { commands: [] });
  
  // التحقق من عدم وجود الأمر
  const existing = db.commands.find(c => c.name === name.toLowerCase());
  if (existing) {
    return { success: false, message: "❌ الأمر موجود بالفعل" };
  }
  
  db.commands.push({
    name: name.toLowerCase(),
    response,
    createdBy: String(createdBy),
    createdAt: Date.now(),
    enabled: true
  });
  
  safeWrite(CUSTOM_CMD_FILE, db);
  return { success: true, message: `✅ تم إضافة الأمر /${name}` };
}

function removeCustomCommand(name) {
  const db = safeRead(CUSTOM_CMD_FILE, { commands: [] });
  const before = db.commands.length;
  db.commands = db.commands.filter(c => c.name !== name.toLowerCase());
  if (db.commands.length !== before) {
    safeWrite(CUSTOM_CMD_FILE, db);
    return { success: true, message: `✅ تم حذف الأمر /${name}` };
  }
  return { success: false, message: "❌ الأمر غير موجود" };
}

function getCustomCommand(name) {
  const db = safeRead(CUSTOM_CMD_FILE, { commands: [] });
  const cmd = db.commands.find(c => c.name === name.toLowerCase() && c.enabled);
  return cmd ? cmd.response : null;
}

function listCustomCommands() {
  const db = safeRead(CUSTOM_CMD_FILE, { commands: [] });
  return db.commands;
}

function toggleCustomCommand(name) {
  const db = safeRead(CUSTOM_CMD_FILE, { commands: [] });
  const cmd = db.commands.find(c => c.name === name.toLowerCase());
  if (!cmd) return { success: false, message: "❌ الأمر غير موجود" };
  cmd.enabled = !cmd.enabled;
  safeWrite(CUSTOM_CMD_FILE, db);
  return { success: true, enabled: cmd.enabled };
}

// =====================================================================
// 5. نظام الوضع المجاني
// =====================================================================
function toggleFreeMode() {
  const settings = safeRead(SETTINGS_FILE, {});
  settings.freeMode = !settings.freeMode;
  settings.freeModeChangedAt = Date.now();
  safeWrite(SETTINGS_FILE, settings);
  return settings.freeMode;
}

function isFreeMode() {
  const settings = safeRead(SETTINGS_FILE, {});
  return settings.freeMode === true;
}

// =====================================================================
// 6. نظام المسؤولين المتعددين
// =====================================================================
const ADMINS_FILE = "./storage/admins.json";

function addAdmin(userId, permissions = {}) {
  const db = safeRead(ADMINS_FILE, { users: [], permissions: {} });
  const id = String(userId);
  
  if (db.users.includes(id)) {
    return { success: false, message: "❌ المستخدم مسؤول بالفعل" };
  }
  
  db.users.push(id);
  db.permissions[id] = {
    addedAt: Date.now(),
    canManageUsers: permissions.canManageUsers ?? true,
    canManageCodes: permissions.canManageCodes ?? true,
    canManageSettings: permissions.canManageSettings ?? false,
    canBroadcast: permissions.canBroadcast ?? true,
    canRestart: permissions.canRestart ?? false
  };
  
  safeWrite(ADMINS_FILE, db);
  return { success: true, message: `✅ تمت إضافة المسؤول ${id}` };
}

function removeAdmin(userId) {
  const db = safeRead(ADMINS_FILE, { users: [], permissions: {} });
  const id = String(userId);
  const before = db.users.length;
  
  db.users = db.users.filter(u => u !== id);
  delete db.permissions[id];
  
  if (db.users.length !== before) {
    safeWrite(ADMINS_FILE, db);
    return { success: true, message: `✅ تم حذف المسؤول ${id}` };
  }
  return { success: false, message: "❌ المسؤول غير موجود" };
}

function isAdmin(userId) {
  const db = safeRead(ADMINS_FILE, { users: [], permissions: {} });
  return db.users.includes(String(userId));
}

function hasAdminPermission(userId, permission) {
  const db = safeRead(ADMINS_FILE, { users: [], permissions: {} });
  const perms = db.permissions[String(userId)];
  if (!perms) return false;
  return perms[permission] === true;
}

function listAdmins() {
  const db = safeRead(ADMINS_FILE, { users: [], permissions: {} });
  return db.users.map(id => ({
    id,
    permissions: db.permissions[id] || {}
  }));
}

// =====================================================================
// 7. دوال مساعدة
// =====================================================================
function getStats() {
  return {
    freeMode: isFreeMode(),
    maintenanceMode: isMaintenance(),
    codes: listCodes().length,
    admins: listAdmins().length,
    customCommands: listCustomCommands().length
  };
}

// =====================================================================
// التصدير
// =====================================================================
module.exports = {
  // دوال مساعدة
  safeRead, safeWrite,
  
  // الاشتراكات
  generateCode, redeemCode, checkSubscription,
  listCodes, deleteCode,
  
  // الصيانة
  setMaintenance, isMaintenance, getMaintenanceMessage,
  
  // الصورة
  setBotImage, getBotImage, resetBotImage,
  
  // الأوامر المخصصة
  addCustomCommand, removeCustomCommand, getCustomCommand,
  listCustomCommands, toggleCustomCommand,
  
  // الوضع المجاني
  toggleFreeMode, isFreeMode,
  
  // المسؤولون
  addAdmin, removeAdmin, isAdmin, hasAdminPermission, listAdmins,
  
  // الإحصائيات
  getStats
};
