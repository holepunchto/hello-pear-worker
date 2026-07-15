# hello-pear-worker

> A shared cross-platform local backend worker boilerplate for Pear applications

Use this boilerplate to run the same local backend across mobile apps, desktop UIs and standalone Bare processes. `hello-pear-worker` keeps peer-to-peer networking, storage and Over-the-Air update logic behind a framed IPC interface so each platform-specific parent only needs to start the worker and handle its messages.

The worker embeds [`pear-runtime`][pear-runtime] on desktop and [`pear-mobile`][pear-mobile] on mobile.

Used by:

- [hello-pear-electron][hello-pear-electron] — Electron desktop UIs
- [hello-pear-bare][hello-pear-bare] — standalone desktop Bare processes
- [hello-pear-react-native][hello-pear-react-native] — React Native mobile UIs

## Table of Contents

- [How It Works](#how-it-works)
  - [Runtime Selection](#runtime-selection)
  - [Arguments](#arguments)
  - [IPC Protocol](#ipc-protocol)
  - [Updates](#updates)
  - [Storage](#storage)
- [Usage](#usage)
- [Scripts](#scripts)
- [License](#license)

## How It Works

The platform-specific parent starts the same worker implementation from an Electron main process, Bare CLI or React Native view layer and communicates with it over a framed IPC stream ([`framed-stream`][framed-stream] wrapping `Bare.IPC`).

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

Add the `hello-pear-worker` boilerplate to every platform shell that should use the shared local backend. Each shell needs only a minimal worker entry (`workers/main.js`):

```js
require('hello-pear-worker')
```

The parent starts the worker entry with `PearRuntime.run(...)`, passing the [arguments](#arguments), and frames the returned IPC stream:

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

On mobile the same worker entry is packaged into a worklet bundle with [`bare-pack`][bare-pack] and started via `PearRuntime.run('/worker.bundle', bundle, args)`.

This keeps the local backend consistent across mobile, desktop UI and desktop Bare applications while each parent handles only its platform-specific lifecycle and interface. See each boilerplate's README for the host wiring and full [peer-to-peer deployment flow][hello-pear-electron-deployments].

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
