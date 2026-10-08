const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { dependencies, imports, repository, version } = require('./package.json')

const header = `// ${repository.url.replace(/\.git$/, '')} v`

function main() {
  const root = process.cwd()
  const worker = path.join(root, 'workers', 'main.js')
  try {
    if (!fs.readFileSync(worker, 'utf8').split(/\r?\n/, 1)[0].startsWith(header)) return
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }

  const source = `${header}${version}\n\n${fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8')}`
  const packages = Object.entries(dependencies).map(([name, range]) => `${name}@${range}`)
  execFileSync(
    process.execPath,
    [process.env.npm_execpath, 'install', '--save-prod', ...packages],
    { cwd: root, stdio: 'inherit' }
  )

  if (imports) {
    const file = path.join(root, 'package.json')
    const app = JSON.parse(fs.readFileSync(file, 'utf8'))
    app.imports = { ...imports, ...app.imports }
    fs.writeFileSync(file, JSON.stringify(app, null, 2) + '\n')
  }

  fs.mkdirSync(path.dirname(worker), { recursive: true })
  fs.writeFileSync(worker, source)
}

module.exports = main

if (require.main === module) main()
