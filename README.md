# hello-pear-worker

> The shared Pear worker used by all `hello-pear` boilerplates

Cross-platform [Bare][bare] worker that embeds [`pear-runtime`][pear-runtime] (desktop) / [`pear-mobile`][pear-mobile] (mobile) to provide peer-to-peer Over-the-Air updates as a local backend for the boilerplate view layers.

Used by:

- [hello-pear-electron][hello-pear-electron] — Electron desktop apps
- [hello-pear-bare][hello-pear-bare] — standalone Bare CLI processes
- [hello-pear-react-native][hello-pear-react-native] — React Native mobile apps via BareKit worklets

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

The worker is started by the host application (Electron main process, Bare CLI or React Native view layer) and communicates with it over a framed IPC stream ([`framed-stream`][framed-stream] wrapping `Bare.IPC`).

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

The worker reads its configuration from positional arguments passed by the host via `PearRuntime.run(entry, args)`:

| Index | Field     | Description                                              |
| ----- | --------- | -------------------------------------------------------- |
| 0     | `updates` | `'false'` disables updates (e.g. in development)         |
| 1     | `version` | current application version (from `package.json`)        |
| 2     | `upgrade` | `pear://` upgrade link (from `package.json`)             |
| 3     | `name`    | application name                                         |
| 4     | `dir`     | storage directory (optional — mobile resolves it itself) |
| 5     | `app`     | application path (optional — undefined on mobile)        |

On desktop, `Bare.argv` starts with the executable path and worker entry path; on mobile (BareKit) it doesn't. The worker offsets indices via [`which-runtime`][which-runtime] so the same argument order works on all platforms.

### IPC Protocol

Messages the worker **writes** to the host:

- `Hello from worker` — sent on startup
- `updating` — an update is downloading
- `updated` — an update has been fully downloaded
- `pear:updateApplied` — reply after an update has been applied

Messages the worker **handles** from the host:

- `pear:applyUpdate` — apply the downloaded update (swaps in the new build for the next launch)

Any other incoming message is logged.

### Updates

An update occurs when the seeded application drive behind the `upgrade` link is written to. Unless updates are disabled, the worker joins the swarm as a client on the drive's discovery key and replicates the corestore over each connection. Update lifecycle events are forwarded to the host over IPC so the view layer can prompt for a restart.

### Storage

Peer-to-peer data is persisted in a [`Corestore`][corestore] at `<dir>/pear-runtime/corestore`. The `dir` argument is passed by the host on desktop; on mobile it defaults to the persistent app directory via [`bare-storage`][bare-storage].

## Usage

The boilerplates currently vendor this worker as `workers/main.js` (the worker will be moved into this module). From the host:

```js
const worker = PearRuntime.run(require.resolve('./workers/main.js'), [
  String(updates),
  version,
  upgrade,
  name,
  storageDir,
  appPath
])

worker.IPC.on('data', (data) => {
  const message = data.toString()
  if (message === 'updated') worker.IPC.write('pear:applyUpdate')
})
```

See each boilerplate's README for the platform-specific wiring and full [peer-to-peer deployment flow][hello-pear-electron-deployments].

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
[brittle]: https://github.com/holepunchto/brittle
