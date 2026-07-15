# hello-pear-worker

> A boilerplate for shared cross-platform local backends in Pear applications

Use this repository as the starting point for a local backend that can be shared by Electron desktop apps, React Native mobile apps and standalone Bare processes. The backend stays independent of any frontend system and communicates with its host over framed IPC.

This separation is useful when the same backend must support multiple platform frontends or run from a headless Bare host. If the backend belongs to only one app, copy the implementation from [`index.js`](./index.js) into that app's `workers/main.js` instead of maintaining a separate module.

The boilerplate embeds [`pear-runtime`][pear-runtime] on desktop and [`pear-mobile`][pear-mobile] on mobile.

Example hosts:

- [hello-pear-electron][hello-pear-electron] — Electron desktop apps
- [hello-pear-bare][hello-pear-bare] — standalone desktop Bare processes
- [hello-pear-react-native][hello-pear-react-native] — React Native mobile apps

## Table of Contents

- [How It Works](#how-it-works)
  - [Runtime Selection](#runtime-selection)
  - [Arguments](#arguments)
  - [IPC Protocol](#ipc-protocol)
  - [Updates](#updates)
  - [Storage](#storage)
- [Usage](#usage)
  - [Shared Cross-Platform Backend](#shared-cross-platform-backend)
  - [Embedded Application Worker](#embedded-application-worker)
  - [Starting the Worker](#starting-the-worker)
- [Scripts](#scripts)
- [License](#license)

## How It Works

The platform-specific host starts the worker from an Electron main process, Bare CLI or React Native app and communicates with it over a framed IPC stream ([`framed-stream`][framed-stream] wrapping `Bare.IPC`). The worker contains the local backend, while the host owns its platform lifecycle and frontend.

It instantiates a `PearRuntime` with a [`Hyperswarm`][hyperswarm] and [`Corestore`][corestore], joins the swarm on the application drive's discovery key and replicates updates peer-to-peer.

### Runtime Selection

The `imports` field in `package.json` maps `pear-runtime` per platform, so the same worker code runs everywhere:

```json
"imports": {
  "pear-runtime": {
    "ios": "pear-mobile",
    "android": "pear-mobile",
    "simulator": "pear-mobile",
    "default": "pear-runtime"
  }
}
```

### Arguments

The worker reads its configuration from positional arguments passed by the parent via `PearRuntime.run(entry, args)`.

On desktop, `Bare.argv` starts with the executable path (`argv[0]`) and the worker entry path (`argv[1]`), so the passed arguments land at `Bare.argv[2..7]`; on mobile (BareKit) they land at `Bare.argv[0..3]`. The worker offsets the indices via [`which-runtime`][which-runtime] so the same argument order works on all platforms:

| `args` | `Bare.argv` desktop | `Bare.argv` mobile | Field     | Description                                                                            |
| ------ | ------------------- | ------------------ | --------- | -------------------------------------------------------------------------------------- |
| 0      | 2                   | 0                  | `updates` | `'false'` disables updates (e.g. in development)                                       |
| 1      | 3                   | 1                  | `version` | current application version (from `package.json`)                                      |
| 2      | 4                   | 2                  | `upgrade` | `pear://` upgrade link (from `package.json`)                                           |
| 3      | 5                   | 3                  | `name`    | application name                                                                       |
| 4      | 6                   | —                  | `dir`     | storage directory (not passed on mobile — resolved via [`bare-storage`][bare-storage]) |
| 5      | 7                   | —                  | `app`     | application path (not passed on mobile)                                                |

### IPC Protocol

Messages the worker **writes** to its parent:

- `Hello from worker` — sent on startup
- `updating` — an update is downloading
- `updated` — an update has been fully downloaded
- `pear:updateApplied` — reply after an update has been applied

Messages the worker **handles** from its parent:

- `pear:applyUpdate` — apply the downloaded update (swaps in the new build for the next launch)

Any other incoming message is logged.

### Updates

An update occurs when the seeded application drive behind the `upgrade` link is written to. Unless updates are disabled, the worker joins the swarm as a client on the drive's discovery key and replicates the corestore over each connection. Update lifecycle events are forwarded to the parent over IPC so the view layer can prompt for a restart.

### Storage

Peer-to-peer data is persisted in a [`Corestore`][corestore] at `<dir>/pear-runtime/corestore`. The `dir` argument is passed by the parent on desktop; on mobile it defaults to the persistent app directory via [`bare-storage`][bare-storage].

## Usage

### Shared Cross-Platform Backend

Start from this boilerplate when one local backend must be reused by multiple apps or frontend systems, or when it must also run from a headless Bare host. Keep the backend in its own module and extend `index.js` with the application's peer-to-peer and domain logic.

Each host then needs only a minimal worker entry (`workers/main.js`) that loads the shared backend module:

```js
require('my-local-backend')
```

The module can be linked locally or published for the applications that consume it. This keeps one backend implementation consistent across Electron desktop apps, React Native mobile apps and headless or standalone Bare applications.

### Embedded Application Worker

If the backend is specific to one application and will not be shared across different platform frontends or used from a headless Bare host, copy [`index.js`](./index.js) into the application's `workers/main.js` and develop it there. The backend then ships as part of that app and does not need a separate module.

### Starting the Worker

With either approach, the host starts `workers/main.js` with `PearRuntime.run(...)`, passes the [arguments](#arguments) and frames the returned IPC stream:

```js
const FramedStream = require('framed-stream')

const IPC = PearRuntime.run(require.resolve('./workers/main.js'), [
  String(updates),
  version,
  upgrade,
  name,
  storageDir, // desktop only — mobile resolves it itself
  appPath // desktop only
])
const pipe = new FramedStream(IPC)

pipe.on('data', (data) => {
  const message = data.toString()
  if (message === 'updated') pipe.write('pear:applyUpdate')
})
```

On mobile the worker entry is packaged into a worklet bundle with [`bare-pack`][bare-pack] and started via `PearRuntime.run('/worker.bundle', bundle, args)`.

See each application boilerplate's README for the host wiring and full [peer-to-peer deployment flow][hello-pear-electron-deployments].

## Scripts

- `npm test` - run [brittle][brittle] tests with `brittle-bare`
- `npm run lint` - run prettier check and lunte
- `npm run format` - format repository with prettier

## License

Apache-2.0

<!-- Reference Links -->

[hello-pear-electron]: https://github.com/holepunchto/hello-pear-electron
[hello-pear-bare]: https://github.com/holepunchto/hello-pear-bare
[hello-pear-react-native]: https://github.com/holepunchto/hello-pear-react-native
[hello-pear-electron-deployments]: https://github.com/holepunchto/hello-pear-electron#deployments
[pear-runtime]: https://github.com/holepunchto/pear-runtime
[pear-mobile]: https://github.com/holepunchto/pear-mobile
[bare]: https://github.com/holepunchto/bare
[hyperswarm]: https://github.com/holepunchto/hyperswarm
[corestore]: https://github.com/holepunchto/corestore
[framed-stream]: https://github.com/holepunchto/framed-stream
[bare-storage]: https://github.com/holepunchto/bare-storage
[which-runtime]: https://github.com/holepunchto/which-runtime
[bare-pack]: https://github.com/holepunchto/bare-pack
[brittle]: https://github.com/holepunchto/brittle
