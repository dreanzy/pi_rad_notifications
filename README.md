# rad-notifications

Windows native notification plugin for [Pi Agent](https://pi.dev).

## Installation

```bash
pi install git:github.com/dreanzy/pi_rad_notifications
# or local
pi install /path/to/pi_rad_notifications
```

Requires restart (`/reload`).

## Features

- ✅ Agent 完成/出错/中止通知
- ⚡ 长时间 bash 执行完成通知
- 💬 Agent 询问用户时通知
- Windows Toast (native) + 终端回退

## Requirements

- Node.js >= 22.19.0
- Windows 10+ (for Toast notifications)

## Development

```bash
npm ci
npm run typecheck   # type check
```

## License

MIT
