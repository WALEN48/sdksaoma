const SCENE = 'TZ_SDK_QR_LOGIN';
const LOGIN_METHOD = '扫码登录';
const EXPIRY_SECONDS = 120;
const VERSION = 'v0.1.4';
const SUCCESS_PROMPT = '扫码登录校验成功，您的账号已在扫码设备上登录，当前账号已下线';
const TARGET_SUCCESS_PROMPT = '扫码授权登录成功';
const SCAN_EXPIRED_TEXT = '二维码已过期，请重新生成';
const SCAN_INVALID_TEXT = '二维码已失效，请重新生成';
const SCAN_MISMATCH_TEXT = '无效二维码';
const QR_ENTRY_BLOCKED = new Set(['phone', 'wechat', 'lock', 'scan', 'logout']);

const state = {
  hasHistory: true,
  channelEnabled: true,
  sameGameId: true,
  qrLoginAccount: false,
  scannerPermission: false,
  scannerLoggedOut: false,
  scanMode: 'camera',
  phoneFromHistory: false,
  page: 'history',
  qrOriginPage: null,
  qr: null,
  scannerModal: null,
  targetModal: null,
  scanError: null,
  toast: '',
  logs: [],
  consoleOpen: true
};

const historicalAccounts = [
  { name: 'wensonxiao', meta: '上次登录：227天前', type: '普通账号' },
  { name: '159****3604', meta: '上次登录：228天前', type: '手机账号' },
  { name: '微信昵称', meta: '上次登录：229天前', type: '微信账号' }
];

const deviceInfo = {
  name: 'MacBook Pro Safari',
  location: '上海市',
  gameId: 'game_10086',
  app: '三国大冒险'
};

let timer = null;
const app = document.querySelector('#app');

function newQr(status = 'active') {
  const now = Date.now();
  return {
    scene: SCENE,
    gameId: 'game_10086',
    qrToken: `tz-${Math.random().toString(36).slice(2, 10)}-${now}`,
    expiresAt: now + EXPIRY_SECONDS * 1000,
    deviceInfo,
    status
  };
}

function setToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(setToast.timeout);
  setToast.timeout = window.setTimeout(() => {
    state.toast = '';
    render();
  }, 2200);
}

function addLog(type, detail) {
  state.logs.unshift({
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    type,
    detail
  });
  state.logs = state.logs.slice(0, 6);
}

function startQr() {
  state.qrOriginPage = state.page;
  state.qr = newQr();
  state.page = 'qr';
  state.scannerModal = null;
  addLog('generate_qr', `scene=${SCENE}`);
  tick();
  render();
}

function returnToLoginHome() {
  state.page = state.qrOriginPage || (state.hasHistory ? 'history' : 'phone');
  state.qrOriginPage = null;
  state.phoneFromHistory = false;
  state.qr = null;
  state.scannerModal = null;
  window.clearInterval(timer);
  render();
}

function returnToHistoryPage() {
  state.page = 'history';
  state.phoneFromHistory = false;
  state.qr = null;
  state.scannerModal = null;
  window.clearInterval(timer);
  render();
}

function handleCornerQr() {
  if (state.page === 'qr' || state.page === 'success') {
    returnToLoginHome();
    return;
  }
  startQr();
}

function expireQr(showToast = true) {
  if (!state.qr || state.qr.status !== 'active') startQr();
  state.qr.status = 'expired';
  state.qr.expiresAt = Date.now();
  addLog('qr_expired', '二维码已过期');
  if (showToast) setToast(SCAN_EXPIRED_TEXT);
  render();
}

function tick() {
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (state.qr?.status === 'active' && Date.now() >= state.qr.expiresAt) {
      expireQr(false);
    } else {
      renderCountdownOnly();
    }
  }, 1000);
}

function getRemainingSeconds() {
  if (!state.qr) return EXPIRY_SECONDS;
  return Math.max(0, Math.ceil((state.qr.expiresAt - Date.now()) / 1000));
}

function simulateScan(mode = 'camera') {
  state.scanMode = mode;
  if (!state.qr || state.qr.status !== 'active') {
    state.scannerModal = 'scanFailed';
    state.scanError = 'expired';
    addLog('scan_failed', 'credential_expired');
    setToast(SCAN_EXPIRED_TEXT);
    return;
  }
  if (!state.sameGameId) {
    state.scannerModal = 'scanFailed';
    state.scanError = 'mismatch';
    addLog('scan_failed', 'gameid_mismatch');
    setToast(SCAN_MISMATCH_TEXT);
    render();
    return;
  }
  state.qr.status = 'scanned';
  state.scannerModal = 'confirm';
  addLog('scan_success', `${mode === 'album' ? '图片' : '摄像头'}扫码成功`);
  render();
}

function confirmAuth() {
  if (!state.qr) return;
  state.qr.status = 'authorized';
  state.qrLoginAccount = true;
  state.scannerLoggedOut = true;
  state.scannerModal = 'success';
  state.targetModal = 'success';
  state.scanError = null;
  addLog(LOGIN_METHOD, '授权成功');
  render();
}

function cancelAuth() {
  if (!state.qr || state.qr.status !== 'active') startQr();
  if (state.qr) state.qr.status = 'canceled';
  state.scannerModal = null;
  state.scanError = null;
  addLog('auth_canceled', '扫码端取消授权');
  setToast('登录失败，授权已取消');
  render();
}

function ensureQr(fn) {
  if (!state.qr || state.qr.status !== 'active') startQr();
  fn();
}

function openScanner() {
  if (!state.channelEnabled) return;
  if (!state.scannerPermission) {
    state.scannerModal = 'permissionGuide';
  } else {
    state.scannerModal = 'scanner';
  }
  render();
}

function handleBlockedAction(label, blocked = false) {
  if (blocked || state.qrLoginAccount) {
    setToast('扫码登录不支持本操作');
  } else {
    setToast(`${label}功能入口已点击`);
  }
}

function icon(name) {
  const icons = {
    close: '<span class="i">×</span>',
    qr: '<svg class="qrMark" viewBox="0 0 28 28" aria-hidden="true"><path d="M4 4h8v8H4V4Zm2 2v4h4V6H6Zm10-2h8v8h-8V4Zm2 2v4h4V6h-4ZM4 16h8v8H4v-8Zm2 2v4h4v-4H6Zm11-2h3v3h-3v-3Zm5 0h2v5h-2v-5Zm-6 5h3v3h-3v-3Zm5 2h3v1h-3v-1Zm-1-4h2v2h-2v-2Z" fill="currentColor"/></svg>',
    user: '<svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20c1.8-4.2 5-6 8-6s6.2 1.8 8 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    phone: '<svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    shield: '<svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 12.5 11 14l3.5-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    image: '<svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><path d="M3 16l5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    scan: '<svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V6h3M20 9V6h-3M4 15v3h3M20 15v3h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="7.5" y="7.5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    refresh: '<svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.2-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: '<svg class="miniIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wechat: '<svg class="wechatLogo" viewBox="0 0 64 64" aria-hidden="true"><path d="M42 12c-10.5 0-19 6.7-19 15 0 4.5 2.5 8.6 6.5 11.3l-1.9 5.2 6-2.7c1.3.3 2.7.5 4.1.5 10.5 0 19-6.7 19-15s-8.5-15-19-15Z" fill="currentColor"/><circle cx="31.5" cy="26.5" r="1.7" fill="#fff"/><circle cx="38.5" cy="26.5" r="1.7" fill="#fff"/><path d="M22 26c-8.3 0-15 5.3-15 12s6.7 12 15 12c1.1 0 2.1-.1 3.1-.3l4.6 2.1-1.6-4.3c3-2 4.9-4.9 4.9-8.1 0-6.7-6.7-12-15-12Z" fill="currentColor"/><circle cx="17.5" cy="37" r="1.4" fill="#fff"/><circle cx="23.2" cy="37" r="1.4" fill="#fff"/></svg>'
  };
  return icons[name] || '';
}

function qrPattern(disabled = false) {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const x = index % 11;
    const y = Math.floor(index / 11);
    const finder =
      (x < 3 && y < 3) ||
      (x > 7 && y < 3) ||
      (x < 3 && y > 7);
    const hash = (x * 17 + y * 23 + x * y * 7) % 5;
    const filled = finder || hash === 0 || hash === 3;
    return `<span class="${filled ? 'dark' : ''}"></span>`;
  }).join('');
  return `<div class="fakeQr ${disabled ? 'muted' : ''}">${cells}</div>`;
}

function sdkShell(content, title = '', extra = '') {
  const showQrEntry = state.channelEnabled && (state.page === 'history' || (state.page === 'phone' && !state.phoneFromHistory));
  const showBack = state.page === 'qr' || state.phoneFromHistory;
  return `
    <section class="sdkCard ${extra}">
      ${showQrEntry ? `<button class="cornerQr ${state.page === 'phone' ? 'phoneEntry' : ''}" title="扫码登录" onclick="actions.cornerQr()">${icon('qr')}</button>` : ''}
      ${showBack ? (
        state.phoneFromHistory
          ? `<div class="cardBackRow"><button class="cornerBack inlineBack" title="返回" onclick="actions.backToHistory()">${icon('back')}</button></div>`
          : `<button class="cornerBack" title="返回" onclick="actions.backToHistory()">${icon('back')}</button>`
      ) : ''}
      ${title ? `<header class="sdkHeader"><strong>${title}</strong><button title="关闭">${icon('close')}</button></header>` : ''}
      <div class="sdkContent">${content}</div>
    </section>
  `;
}

function renderHistoryLogin() {
  const account = historicalAccounts[0];
  return sdkShell(`
    <button class="featuredAccount" onclick="actions.fakeLogin('${account.name}')">
      <span class="featuredAvatar"></span>
      <span><b>${account.name}</b><i>最近</i><small>${account.meta}</small></span>
      <em>⌄</em>
    </button>
    <button class="sdkGradientBtn" onclick="actions.fakeLogin('${account.name}')">立即登录</button>
    <button class="linkLogin" onclick="actions.otherLogin()">其他登录方式</button>
  `, '', 'sdkBranded historySdk');
}

function renderPhoneLogin() {
  return sdkShell(`
    <div class="form">
      <label><span class="fieldIcon">${icon('phone')}</span><input placeholder="请输入手机号" /></label>
      <p class="agreement"><span></span> 已阅读并同意 <a>《用户协议》</a> 及 <a>《隐私政策》</a></p>
      <button class="sdkGradientBtn">下一步</button>
      <nav><a>遇到问题?</a><a>账号登录</a></nav>
      <div class="thirdTitle">其他登录方式</div>
      <div class="thirds"><button class="wechat" aria-label="微信登录">${icon('wechat')}</button></div>
    </div>
  `, '', 'sdkBranded phoneSdk');
}

function renderLogs() {
  const rows = state.logs.map((item) => `<p><b>${item.time}</b><span>${item.type}</span><em>${item.detail}</em></p>`).join('');
  return `
    <section class="logs">
      <h3>登录日志</h3>
      ${rows || '<p><b>--:--:--</b><span>暂无</span><em>尚未触发扫码相关日志</em></p>'}
    </section>
  `;
}

function renderGameLogin() {
  return `
    <div class="gameBg gameHome">
      <div class="sideActions gameActions">
        <button>客服</button><button>换号</button><button>公告</button><button>协议</button><button>隐私</button>
      </div>
      <div class="serverPanel">
        <div class="serverHot">最新 <b>志在千里64服</b></div>
        <div class="serverLine"><span>荆州之战46服</span><a>点击换服</a></div>
      </div>
      <button class="gameEnter">进入游戏</button>
      <p class="gameNotice">抵制不良游戏，拒绝盗版游戏。合理安排时间，享受健康生活。</p>
    </div>
  `;
}

function renderQrLogin() {
  const st = state.qr?.status;
  const waiting = st === 'scanned';
  const authorized = st === 'authorized';
  const expired = !state.qr || st === 'expired';
  const invalid = st === 'failed';
  const canceled = st === 'canceled';
  const mask = expired || invalid || canceled || waiting || authorized;
  const statusText = waiting ? '已扫码，等待授权' : authorized ? '已授权' : canceled ? '授权已取消' : invalid ? '二维码已失效' : '二维码已过期';
  const note = expired ? '请刷新后重新扫码' : invalid ? '请重新生成二维码后再次扫码' : waiting ? '请在扫码端完成授权' : authorized ? '授权已完成' : '授权已取消';
  return sdkShell(`
    <div class="qrPanel">
      <div class="qrBox">
        ${qrPattern(mask)}
          ${mask ? `<div class="qrMask"><b>${statusText}</b><span>${note}</span>${expired || invalid || canceled ? `<button onclick="actions.startQr()">${icon('refresh')}刷新</button>` : ''}</div>` : ''}
      </div>
      <p>使用“用户中心 - 扫一扫”授权登录<br />授权状态仅本次生效</p>
      ${expired || invalid || canceled ? '' : `<small>二维码有效剩余 <b id="countdown">${getRemainingSeconds()}</b> 秒</small>`}
    </div>
  `, '', 'sdkBranded qrOnly');
}

function renderTargetDevice() {
  let content = state.scannerLoggedOut
      ? renderGameLogin()
      : state.page === 'qr'
      ? renderQrLogin()
      : state.page === 'phone'
        ? renderPhoneLogin()
        : state.hasHistory
          ? renderHistoryLogin()
          : renderPhoneLogin();
  const deviceLabel = state.scannerLoggedOut
    ? '游戏登录选服页'
    : state.page === 'phone'
    ? '手机登录主界面'
    : state.hasHistory
      ? '历史账号页'
      : '手机登录主界面';
  return `
    <article class="device desktopDevice">
      <div class="deviceTitle">
        <span>${state.scannerLoggedOut ? '被扫码端 · 已登录' : '被扫码端 · 无登录态'}</span>
        <b>${deviceLabel}</b>
      </div>
      <div class="screen sdkScreen">${content}${renderTargetModal()}</div>
    </article>
  `;
}

function renderTargetModal() {
  if (state.targetModal !== 'success') return '';
  return `
      <div class="modalLayer"><div class="dialog result">
        <h3>提示</h3>
      <p>${TARGET_SUCCESS_PROMPT}</p>
        <button class="primary wide" onclick="actions.closeTargetModal()">确定</button>
      </div></div>
    `;
}

function renderUserCenter() {
  const rows = [
    ['绑定手机', '未绑定', 'phone'],
    ['绑定微信', '未绑定', 'wechat'],
    ['修改密码', '已设置', 'lock'],
    ['扫一扫', state.channelEnabled ? '扫码登录' : '已隐藏', 'scan'],
    ['账号注销', '', 'logout'],
    ['查询、更正及删除个人信息', '', 'info'],
    ['用户协议', '', 'doc'],
    ['隐私政策', '', 'privacy']
  ];
  return rows.filter(([_, __, type]) => {
    if (type === 'scan' && (!state.channelEnabled || state.qrLoginAccount)) return false;
    return !(state.qrLoginAccount && QR_ENTRY_BLOCKED.has(type));
  }).map(([label, value, type]) => {
    const click = type === 'scan' ? 'actions.openScanner()' : `actions.blocked('${label}')`;
    const arrow = ['shield', 'info', 'doc', 'logout'].includes(type);
    return `<button class="centerRow ${type === 'scan' ? 'scanRow' : ''}" onclick="${click}">
      <i class="centerIcon ${type}">${type === 'wechat' ? icon('wechat') : ''}</i>
      <span>${label}</span>
      <em>${value || (arrow ? icon('chevron') : '')}</em>
    </button>`;
  }).join('');
}

function renderScannerDevice() {
  return `
    <article class="device phoneDevice">
      <div class="deviceTitle">
        <span>扫码端·未登录</span>
        <b>${state.scannerLoggedOut ? '手机登录SDK界面' : '用户中心'}</b>
      </div>
      <div class="phoneScreen">
        ${state.scannerLoggedOut ? `<div class="scannerLogin">${renderPhoneLogin()}</div>` : `
        <div class="gameBg">
          <div class="mountain"></div>
          <div class="sideActions"><button>客服</button><button>换号</button><button>协议</button><button>隐私</button></div>
        </div>
        <section class="userCenter">
          <header><span>用户中心</span><button>${icon('close')}</button></header>
          <div class="userProfile">
            <span class="profileIcon">●</span>
            <b>您好，wensonxiao</b>
            <button>切换账号</button>
          </div>
          <div class="userMenu">${renderUserCenter()}</div>
          <small class="sdkVersion">${VERSION}</small>
        </section>
        `}
        ${renderScannerModal()}
      </div>
    </article>
  `;
}

function renderScannerModal() {
  if (!state.scannerModal) return '';
  if (state.scannerModal === 'permissionGuide') {
    return `
      <div class="modalLayer"><div class="dialog small">
        <h3>提示</h3>
        <p>需要相机权限和相册权限以完成扫码授权登录。</p>
        <button class="primary" onclick="actions.nextPermission()">下一步</button>
        <button class="ghost" onclick="actions.closeModal()">取消</button>
      </div></div>
    `;
  }
  if (state.scannerModal === 'systemPermission') {
    return `
      <div class="modalLayer"><div class="dialog permission">
        <h3>“XXXX”需要使用以下权限</h3>
        <p><b>摄像头</b><br />用于拍摄、扫码、扫描二维码等使用场景。</p>
        <p><b>访问照片、视频和音乐文件</b><br />访问相册中的二维码图片。</p>
        <button class="confirm" onclick="actions.grantPermission()">确定</button>
        <button class="ghost" onclick="actions.closeModal()">取消</button>
      </div></div>
    `;
  }
  if (state.scannerModal === 'scanner') {
    return `
      <div class="scannerView">
        <div class="scannerChrome">
          <button class="back" onclick="actions.closeModal()">${icon('back')}</button>
          <div class="scannerMeta">
            <b>系统相机</b>
            <span>扫描对方二维码授权登录</span>
          </div>
          <button class="album" onclick="actions.scanAlbum()">${icon('image')}图片</button>
        </div>
        <div class="scannerCamera">
          <div class="scannerFrame"></div>
          <div class="scannerReticle"></div>
          <p>点击打开系统相机扫描对方二维码</p>
        </div>
        <div class="scannerActions">
          <button class="simulateScan" onclick="actions.scanCamera()">模拟扫码</button>
        </div>
      </div>
    `;
  }
  if (state.scannerModal === 'confirm') {
    return `
      <div class="modalLayer"><div class="dialog auth">
        <h3>授权确认</h3>
        <p>是否确认授权此设备登录？</p>

        <div class="actions"><button class="ghost" onclick="actions.cancelAuth()">取消</button><button class="primary" onclick="actions.confirmAuth()">确认授权</button></div>
      </div></div>
    `;
  }
  if (state.scannerModal === 'success') {
    return `
      <div class="modalLayer"><div class="dialog result">
        <h3>提示</h3>
        <p>${SUCCESS_PROMPT}</p>
        <button class="primary wide" onclick="actions.finishScanner()">确定</button>
      </div></div>
    `;
  }
  if (state.scannerModal === 'scanFailed') {
    const msg = state.scanError === 'mismatch' ? SCAN_MISMATCH_TEXT : state.scanError === 'invalid' ? SCAN_INVALID_TEXT : SCAN_EXPIRED_TEXT;
    return `
      <div class="modalLayer"><div class="dialog result">
        <h3>提示</h3>
        <p>${msg}</p>
        <button class="primary wide" onclick="actions.closeModal()">确定</button>
      </div></div>
    `;
  }
  return '';
}

function renderConsole() {
  return `
    <section class="console ${state.consoleOpen ? 'open' : ''}">
      <button class="consoleSummary" onclick="actions.toggleConsole()">
        <span>演示调试</span>
        <small>${state.consoleOpen ? '收起调试面板' : '展开调试面板'}</small>
        <i>${state.consoleOpen ? '−' : '+'}</i>
      </button>
      ${state.consoleOpen ? `
        <div class="controlGrid">
          ${toggle('hasHistory', '有历史账号')}
          ${toggle('channelEnabled', '渠道开启扫码')}
          ${toggle('sameGameId', 'gameid 一致')}
          ${toggle('qrLoginAccount', '当前为扫码登录态')}
        </div>
        <div class="buttonGrid">
          <button onclick="actions.startQr()">生成/刷新二维码</button>
          <button onclick="actions.expireQr()">二维码过期</button>
          <button onclick="actions.scanSuccess()">扫码成功</button>
          <button onclick="actions.scanInvalid()">凭证失效</button>
          <button onclick="actions.cancelAuth()">授权取消</button>
          <button onclick="actions.resetFlow()">重置流程</button>
        </div>
        ${renderLogs()}
      ` : ''}
    </section>
  `;
}

function toggle(key, label) {
  return `<label class="switch"><input type="checkbox" ${state[key] ? 'checked' : ''} onchange="actions.toggle('${key}')" /><span></span><b>${label}</b></label>`;
}

function renderCountdownOnly() {
  const node = document.querySelector('#countdown');
  if (node) node.textContent = getRemainingSeconds();
}

function render() {
  app.innerHTML = `
    <section class="prototype">
      <header class="topbar">
        <div>
          <h1>SDK扫码登录功能演示</h1>
          <small>使用已登录账号扫码确认，快速在当前设备完成游戏登录。</small>
        </div>
        <div class="statusPills"><span>二维码120秒有效</span><span>相同游戏授权</span><span>单次授权登录</span></div>
      </header>
      <section class="workspace">
        ${renderTargetDevice()}
        ${renderScannerDevice()}
        ${renderConsole()}
      </section>
      ${state.toast ? `<div class="toast">${state.toast}</div>` : ''}
    </section>
  `;
}

window.actions = {
  startQr,
  cornerQr: handleCornerQr,
  expireQr,
  openScanner,
  otherLogin() {
    state.page = 'phone';
    state.phoneFromHistory = true;
    render();
  },
  backToHistory: returnToHistoryPage,
  nextPermission() {
    state.scannerModal = 'systemPermission';
    render();
  },
  grantPermission() {
    state.scannerPermission = true;
    state.scannerModal = 'scanner';
    render();
  },
  scanCamera() {
    ensureQr(() => {
      if (!state.scannerPermission) {
        openScanner();
        return;
      }
      simulateScan('camera');
    });
  },
  scanAlbum() {
    ensureQr(() => simulateScan('album'));
  },
  scanSuccess() {
    ensureQr(() => {
      if (!state.sameGameId) {
        state.scannerModal = 'scanFailed';
        state.scanError = 'mismatch';
        addLog('scan_failed', 'gameid_mismatch');
        setToast(SCAN_MISMATCH_TEXT);
        render();
        return;
      }
      state.qr.status = 'scanned';
      state.scannerModal = 'confirm';
      state.scanError = null;
      addLog('scan_success', '扫码成功');
      render();
    });
  },
  scanInvalid() {
    ensureQr(() => {
      state.qr.status = 'failed';
      state.scannerModal = 'scanFailed';
      state.scanError = 'invalid';
      addLog('scan_failed', 'credential_invalid');
      setToast(SCAN_INVALID_TEXT);
      render();
    });
  },
  confirmAuth,
  cancelAuth,
  closeModal() {
    state.scannerModal = null;
    state.scanError = null;
    render();
  },
  closeTargetModal() {
    state.targetModal = null;
    render();
  },
  finishScanner() {
    state.scannerModal = null;
    state.scanError = null;
    state.page = 'phone';
    state.phoneFromHistory = false;
    render();
  },
  fakeLogin(name) {
    addLog('account_login', name);
    setToast('普通账号登录成功');
  },
  blocked: handleBlockedAction,
  toggleConsole() {
    state.consoleOpen = !state.consoleOpen;
    render();
  },
  toggle(key) {
    state[key] = !state[key];
    if (key === 'hasHistory') {
      state.page = state.hasHistory ? 'history' : 'phone';
      state.phoneFromHistory = false;
    }
    if (key === 'channelEnabled' && !state.channelEnabled) state.scannerModal = null;
    if (key === 'channelEnabled' && !state.channelEnabled) state.scanError = null;
    if (key === 'channelEnabled' && state.channelEnabled && state.page !== (state.hasHistory ? 'history' : 'phone')) {
      state.page = state.hasHistory ? 'history' : 'phone';
    }
    render();
  },
  reset() {
    Object.assign(state, {
      hasHistory: true,
      channelEnabled: true,
      sameGameId: true,
      qrLoginAccount: false,
      scannerPermission: false,
      scannerLoggedOut: false,
      scanMode: 'camera',
      phoneFromHistory: false,
      page: 'history',
      qrOriginPage: null,
      consoleOpen: true,
      qr: null,
      scannerModal: null,
      targetModal: null,
      scanError: null,
      toast: '',
      logs: []
    });
    window.clearInterval(timer);
    render();
  },
  resetFlow() {
    Object.assign(state, {
      qrLoginAccount: false,
      scannerPermission: false,
      scannerLoggedOut: false,
      scanMode: 'camera',
      phoneFromHistory: false,
      page: state.hasHistory ? 'history' : 'phone',
      qrOriginPage: null,
      qr: null,
      scannerModal: null,
      targetModal: null,
      scanError: null,
      toast: '',
      logs: []
    });
    window.clearInterval(timer);
    render();
  }
};

render();
