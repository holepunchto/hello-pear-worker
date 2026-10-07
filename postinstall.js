const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { name, version, dependencies } = require('./package.json')

const header = '// AUTO-GENERATED: REMOVE THIS COMMENT BEFORE EDITING'

function main({ save = false } = {}) {
  const root = process.env.npm_config_local_prefix || process.env.INIT_CWD
  if (
    !root ||
    !process.env.npm_execpath ||
    process.env.npm_config_global === 'true' ||
    process.env.HELLO_PEAR_WORKER_INSTALLING === '1' ||
    fs.realpathSync(root) === fs.realpathSync(__dirname)
  ) {
    return
  }

  const worker = path.join(root, 'workers', 'main.js')
  let copy = true
  try {
    copy = fs.readFileSync(worker, 'utf8').split(/\r?\n/).includes(header)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  if (!copy && !save) return

  const source = copy
    ? `${header}\n\n${fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8')}`
    : null
  const packages = Object.entries(dependencies).map(([name, range]) => `${name}@${range}`)
  if (!save) {
    // Keep this package until the parent install saves it to the project.
    const resolved = process.env.npm_package_resolved
    const spec = resolved === 'null' ? `file:${__dirname}` : resolved || version
    packages.unshift(`${name}@${spec}`)
  }

  execFileSync(
    process.execPath,
    [
      process.env.npm_execpath,
      'install',
      '--prefix',
      root,
      ...(save ? ['--save-prod'] : ['--no-save', '--package-lock=false']),
      ...packages
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, HELLO_PEAR_WORKER_INSTALLING: '1' }
    }
  )

  if (!copy) return
  fs.mkdirSync(path.dirname(worker), { recursive: true })
  fs.writeFileSync(worker, source)
}

module.exports = main

if (require.main === module) main()
