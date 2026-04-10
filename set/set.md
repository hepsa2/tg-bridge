# 部署教程
> 以手机为例

## telegram端部署
1. 私聊BotFather机器人，按要求创建机器人
2. 记录下Bot的Token（数字+英文字符串），注意请勿公开暴露Token
3. 私聊页面点击该机器人设置按钮
4. 点击group privacy
5. turn off
6. 把机器人拉入指定群聊/频道并添加管理

## cloudflare端部署
1. 注册cloudflare账号
2. 进入🔶workers&pages页面
3. 创建，选择hello word并等待创建
4. 右上角三点，选择<>edit code
5. 删除原有代码，把下面代码完整复制上：
6. 修改代码开头部分，引号内把token换成你创建机器人的token，secret key是桥接控制台登陆密码，请勿公开暴露
7. 之后点击蓝色Deploy保存

```
// ========================================================
//  TG 桥接 Worker v2 - Cloudflare Workers
//  KV Namespace 绑定名称：MESSAGES_KV
// ========================================================
const BOT_TOKEN  = '000000:KamSOKWSK1928';
const SECRET_KEY = 'your-secret-key-change-this';
const TG_API     = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ── 配置 ─────────────────────────────────────────────────
const CHAT_CONFIG = {
  private: [
    { id: '-000000000', name: '私密群1示例' },
    { id: '-000000000', name: '2群' },
  ],
  public: [
    { id: '-000000000', name: '公开群1' },
    { id: '-000000000', name: '公开2群' },
  ],
  channels: [
    { id: '@xxxxxxx',              name: '你自己的频道，且机器人是频道管理',      canSend: true  },
    { id: '@xxxxxxx',             name: '别人的',     canSend: false },
    { id: '@xxxxxxx',                  name: '别人的', canSend: false },
    { id: '@xxxxxxx',    name: '别人的',   canSend: false },
    { id: '@xxxxxxx',             name: '别人的',     canSend: false },
  ],
  // ── 私聊联系人配置 ────────────────────────────────────
  // 填写 Telegram 用户的数字 ID（不是用户名），用户需先向机器人发送 /start
  // 可通过让用户在群里发 /getid 获取其 chat id（私聊机器人后也会返回）
  contacts: [
    // { id: '123456789', name: '联系人A' },
    // { id: '987654321', name: '联系人B' },
  ],
};

// ── CORS ─────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const jsonResp = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// ── 主入口 ───────────────────────────────────────────────
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(req) {
  const { pathname } = new URL(req.url);

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Webhook（无需鉴权）
  if (pathname === '/webhook' && req.method === 'POST') {
    return onWebhook(req);
  }

  // 登录验证
  if (pathname === '/api/auth' && req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    const ok = body.key === SECRET_KEY;
    return jsonResp({ ok }, ok ? 200 : 401);
  }

  // 公开配置
  if (pathname === '/api/config') {
    return jsonResp(CHAT_CONFIG);
  }

  // ── 以下需要鉴权 ──
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${SECRET_KEY}`) {
    return jsonResp({ error: 'Unauthorized' }, 401);
  }

  if (pathname === '/api/messages' && req.method === 'GET') {
    return onGetMessages(req);
  }

  if (pathname === '/api/send' && req.method === 'POST') {
    return onSend(req);
  }

  // 清空某会话消息（可选）
  if (pathname === '/api/clear' && req.method === 'POST') {
    return onClear(req);
  }

  return new Response('Not Found', { status: 404, headers: CORS });
}

// ── Webhook：接收 Telegram 消息 ──────────────────────────
async function onWebhook(req) {
  try {
    const update = await req.json();

    const msg = update.message
              || update.channel_post
              || update.edited_message
              || update.edited_channel_post;

    if (!msg) return new Response('ok', { headers: CORS });

    const chatId   = String(msg.chat.id);
    const chatType = msg.chat.type; // 'private' | 'group' | 'supergroup' | 'channel'
    const text     = msg.text || msg.caption || '';

    // ── /getid 指令 ───────────────────────────────────────
    if (text.startsWith('/getid')) {
      let reply = `当前 Chat ID：\`${chatId}\`\n类型：${chatType}`;
      if (msg.from) {
        reply += `\n\n你的用户 ID：\`${msg.from.id}\``;
        if (msg.from.username) reply += `\n用户名：@${msg.from.username}`;
      }
      await tgSend(chatId, reply);
      return new Response('ok', { headers: CORS });
    }

    // ── /start 指令（私聊） ───────────────────────────────
    if (chatType === 'private' && text.startsWith('/start')) {
      const uid = msg.from ? String(msg.from.id) : chatId;
      const name = msg.from
        ? (msg.from.first_name || '') + (msg.from.last_name ? ' ' + msg.from.last_name : '')
        : chatId;
      await tgSend(chatId,
        `✅ 你好，${name}！\n机器人桥接已就绪。\n你的用户 ID：\`${uid}\`\n请将此 ID 告知管理员，以便将你加入联系人列表。`
      );
    }

    // ── 存储消息 ──────────────────────────────────────────
    if (text) {
      // 检查是否为已配置联系人的私聊
      const isKnownContact = chatType === 'private' &&
        CHAT_CONFIG.contacts.some(c => String(c.id) === chatId);

      if (chatType !== 'private' || isKnownContact) {
        await storeMessage(chatId, msg, text);
      }
    }

    return new Response('ok', { headers: CORS });
  } catch (e) {
    return new Response('error: ' + e.message, { status: 500, headers: CORS });
  }
}

// ── 存储消息到 KV ─────────────────────────────────────────
async function storeMessage(chatId, msg, text) {
  const key = `m:${chatId}`;
  let msgs = [];
  try {
    const raw = await MESSAGES_KV.get(key);
    if (raw) msgs = JSON.parse(raw);
  } catch {}

  let from = '未知';
  if (msg.from) {
    from = (msg.from.first_name || '');
    if (msg.from.last_name)  from += ' ' + msg.from.last_name;
    if (msg.from.username)   from += ` (@${msg.from.username})`;
  } else if (msg.chat) {
    from = msg.chat.title || msg.chat.username || 'Channel';
  }

  msgs.unshift({
    id:   msg.message_id,
    from,
    text,
    date: msg.date,
    ts:   Date.now(),
  });

  // 保留最新 200 条，TTL 7 天
  await MESSAGES_KV.put(key, JSON.stringify(msgs.slice(0, 200)), {
    expirationTtl: 604800,
  });
}

// ── 获取消息 ─────────────────────────────────────────────
async function onGetMessages(req) {
  const params = new URL(req.url).searchParams;
  const chatId = params.get('chatId');
  if (!chatId) return jsonResp({ error: 'missing chatId' }, 400);
  try {
    const raw = await MESSAGES_KV.get(`m:${chatId}`);
    return jsonResp(raw ? JSON.parse(raw) : []);
  } catch {
    return jsonResp([]);
  }
}

// ── 发送消息 ─────────────────────────────────────────────
async function onSend(req) {
  const { chatId, text } = await req.json().catch(() => ({}));
  if (!chatId || !text) return jsonResp({ error: '缺少 chatId 或 text' }, 400);

  const res    = await tgSendRaw(chatId, text);
  const result = await res.json();

  if (result.ok) {
    await storeMessage(chatId, {
      message_id: result.result.message_id,
      from: { first_name: '【Web发送】' },
      chat: {},
      date: Math.floor(Date.now() / 1000),
    }, text);
  }
  return jsonResp(result);
}

// ── 清空会话 ─────────────────────────────────────────────
async function onClear(req) {
  const { chatId } = await req.json().catch(() => ({}));
  if (!chatId) return jsonResp({ error: 'missing chatId' }, 400);
  await MESSAGES_KV.delete(`m:${chatId}`);
  return jsonResp({ ok: true });
}

// ── TG 发送辅助 ──────────────────────────────────────────
function tgSendRaw(chatId, text) {
  return fetch(`${TG_API}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function tgSend(chatId, text) {
  const r = await tgSendRaw(chatId, text);
  return r.json();
}
```
复制完后记得划到末尾部分，看看左下角有没有多出红色下划线的大括号，如果有记得删掉（这是手机粘贴代码常见问题）<br>

## CloudflareKV设置
1. 菜单栏找到📂storage→worker KV
2. 创建一个name space,名字填tg-messages
3. 回到之前worker页面，选binding,name写MESSAGES_KV,下面选择之前创建的tg-messages
4. 之后点击保存即可

## 回到telegram
1. 在指定群组发送/getid，获取群组id
2. 回到cfworker代码编辑页面，修改公开/私密群组id
3. 还差一步：注册webhook
4. 补全下面网址（中括号需要删除）

```
https://api.telegram.org/bot【此处填写Bot Token】/setWebhook?url=【此处填写worker地址，格式如https://xxxx】/webhook
```
> worker地址在worker操作页面有写

5. 之后浏览器输入网址并访问页面，看到ok,true则成功。

## 在入口页登陆你的控制台：
[入口页](https://github.io/hepsa2/tg-bridge)

