# 📚 دليل API - ربط البوتات

## 🎯 نظرة عامة

API لربط البوتات تتيح لك ربط البوت الحالي مع بوتات أخرى بسهولة. يمكنك إدارة البوتات المرتبطة، إرسال الأوامر، واستقبال الرسائل.

---

## 🔧 المتطلبات

- Node.js 14+
- npm أو yarn
- توكن البوت الذي تريد ربطه

---

## 📦 التثبيت

```bash
# تثبيت البوت
npm install

# تشغيل البوت
node raju.js
```

---

## 🔌 نقاط النهاية (Endpoints)

### 1. **فحص الصحة**

```http
GET /api/health
```

**الوصف:** فحص حالة API

**الاستجابة:**
```json
{
  "status": "ok",
  "message": "Bug Bot API is running"
}
```

---

### 2. **ربط بوت جديد**

```http
POST /api/connect
Content-Type: application/json
```

**الوصف:** ربط بوت جديد

**البيانات:**
```json
{
  "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
  "botName": "My Bot",
  "type": "telegram"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "Successfully connected to bot",
  "connectionId": "abc123def456"
}
```

---

### 3. **فك الربط**

```http
POST /api/disconnect
Content-Type: application/json
```

**الوصف:** فك الربط مع بوت

**البيانات:**
```json
{
  "connectionId": "abc123def456"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "Successfully disconnected from bot"
}
```

---

### 4. **قائمة البوتات المرتبطة**

```http
GET /api/connections
```

**الوصف:** عرض جميع البوتات المرتبطة

**الاستجابة:**
```json
{
  "success": true,
  "connections": [
    {
      "id": "abc123def456",
      "botToken": "123456789:ABCdefGHIjklmnOPqrSTUVwxyz",
      "botName": "My Bot",
      "type": "telegram",
      "connectedAt": "2024-01-01T00:00:00.000Z",
      "status": "connected"
    }
  ]
}
```

---

### 5. **إرسال أمر**

```http
POST /api/command
Content-Type: application/json
```

**الوصف:** إرسال أمر إلى بوت مرتبط

**البيانات:**
```json
{
  "connectionId": "abc123def456",
  "command": "/start",
  "chatId": "123456789"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "Command sent successfully",
  "response": {
    "ok": true,
    "result": {
      "message_id": 1,
      "from": {
        "id": 123456789,
        "is_bot": true,
        "first_name": "My Bot"
      },
      "chat": {
        "id": 123456789,
        "first_name": "User",
        "username": "user",
        "type": "private"
      },
      "date": 1704067200,
      "text": "/start"
    }
  }
}
```

---

### 6. **إرسال رسالة**

```http
POST /api/message
Content-Type: application/json
```

**الوصف:** إرسال رسالة إلى بوت مرتبط

**البيانات:**
```json
{
  "connectionId": "abc123def456",
  "message": "Hello, World!",
  "chatId": "123456789"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "response": {
    "ok": true,
    "result": {
      "message_id": 1,
      "from": {
        "id": 123456789,
        "is_bot": true,
        "first_name": "My Bot"
      },
      "chat": {
        "id": 123456789,
        "first_name": "User",
        "username": "user",
        "type": "private"
      },
      "date": 1704067200,
      "text": "Hello, World!"
    }
  }
}
```

---

### 7. **حالة البوت**

```http
GET /api/status
```

**الوصف:** عرض حالة البوت

**الاستجابة:**
```json
{
  "success": true,
  "totalConnections": 1,
  "connections": [
    {
      "id": "abc123def456",
      "botToken": "123456789:ABCdefGHIjklmnOPqrSTUVwxyz",
      "botName": "My Bot",
      "type": "telegram",
      "connectedAt": "2024-01-01T00:00:00.000Z",
      "status": "connected"
    }
  ]
}
```

---

### 8. **إنشاء مفتاح API**

```http
POST /api/key/generate
Content-Type: application/json
```

**الوصف:** إنشاء مفتاح API جديد

**البيانات:**
```json
{
  "name": "My API Key"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "API key generated successfully",
  "apiKey": "abc123def456"
}
```

---

### 9. **حذف مفتاح API**

```http
DELETE /api/key
Content-Type: application/json
```

**الوصف:** حذف مفتاح API

**البيانات:**
```json
{
  "keyId": "abc123def456"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "API key deleted successfully"
}
```

---

### 10. **Webhook**

```http
POST /api/webhook
Content-Type: application/json
```

**الوصف:** نقطة النهاية لـ Webhook لاستقبال الرسائل

**البيانات:**
```json
{
  "event": "message",
  "data": {
    "chatId": "123456789",
    "message": "Hello, World!"
  }
}
```

**الاستجابة:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

---

## 💻 أمثلة الاستخدام

### ربط بوت جديد

```javascript
const axios = require('axios');

async function connectBot() {
  try {
    const response = await axios.post('http://localhost:3000/api/connect', {
      botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
      botName: 'My Bot',
      type: 'telegram'
    });
    
    console.log(response.data);
  } catch (error) {
    console.error(error.response.data);
  }
}

connectBot();
```

### إرسال أمر

```javascript
const axios = require('axios');

async function sendCommand() {
  try {
    const response = await axios.post('http://localhost:3000/api/command', {
      connectionId: 'abc123def456',
      command: '/start',
      chatId: '123456789'
    });
    
    console.log(response.data);
  } catch (error) {
    console.error(error.response.data);
  }
}

sendCommand();
```

---

## 📊 الأخطاء

| الكود | الوصف |
|-------|--------|
| 400 | طلب غير صالح |
| 404 | لم يتم العثور على مورد |
| 500 | خطأ في الخادم |

---

## 🎯 ملاحظات مهمة

1. **الأمان:** احتفظ بمفاتيح API في مكان آمن
2. **التوثيق:** استخدم التوثيق المناسب عند الاتصال بـ API
3. **المعدل:** احترم معدل الطلبات
4. **الأخطاء:** تعامل مع الأخطاء بشكل صحيح

---

**تم الإنشاء بواسطة:** OpenHands
**الإصدار:** 1.0
**التاريخ:** 2024