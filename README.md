# 天纵 SDK 扫码登录交互原型

这是一个独立、零构建依赖即可运行的扫码登录交互原型，覆盖被扫码端二维码登录与扫码端授权确认两条链路。

## 打开方式

直接在浏览器打开 `index.html` 即可运行。

当前会话已启动本地预览服务：

```text
http://127.0.0.1:4173
```

如果后续环境安装了 npm，也可以改用：

```bash
npm run dev
```

## 主要演示路径

- 被扫码端：历史账号页或手机登录页点击左上角扫码入口，生成 120 秒有效二维码。
- 扫码端：用户中心点击“扫一扫”，完成权限提示、系统授权、扫码、二次授权确认。
- 授权成功：被扫码端 toast “登录成功”，扫码端提示当前账号已下线并回到游戏登录页。
- 失败链路：支持二维码过期、凭证失效、授权取消、gameid 不一致。
- 控制台：可切换历史账号、渠道开关、gameid、扫码登录态，并查看 mock 协议与登录日志。

## Mock 协议字段

```ts
{
  scene: "TZ_SDK_QR_LOGIN",
  gameId: string,
  qrToken: string,
  expiresAt: number,
  deviceInfo: object,
  status: "idle" | "active" | "expired" | "scanned" | "confirmed" | "canceled" | "failed" | "success"
}
```
