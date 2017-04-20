const fs = require('fs')
const joinPath = require('path').join
const os = require('os')
const execSync = require('child_process').execSync
const request = require('request-promise-native')
const m3u8 = require('m3u8')

const isDevelopment = process.env.NODE_ENV === 'development'
const resourcesPath = joinPath(isDevelopment ? __dirname : process.resourcesPath, 'bin')
const bin = joinPath(resourcesPath, os.platform() + '_' + os.arch())

const sourceElement = document.getElementById('source')
const targetElement = document.getElementById('target')
const downloadElement = document.getElementById('download')
const logElement = document.getElementById('log')

try {
  log('使用 ffmpeg 文件', bin)
  fs.accessSync(bin)
} catch (err) {
  log('不支持该平台')
}

downloadElement.addEventListener('click', (event) => {
  const source = sourceElement.value
  log('原地址', source)
  const target = targetElement.files[0].path
  log('目标地址', target)
  const concatPath = joinPath(target, 'all.ts')
  const convertPath = joinPath(target, 'test.mp4')

  request(source).then((body) => {
    const parser = m3u8.createStream()
    parser.write(body)
    parser.on('m3u', (m3u) => {
      fetchTsList(m3u).then((buf) => {
        fs.writeFileSync(joinPath(target, '/all.ts'), buf)
        log('成功合并')
        try {
          execSync(`${bin} -y -i ${concatPath} -bsf:a aac_adtstoasc -vcodec copy ${convertPath}`)
        } catch (err) {
          log(err.stack, err.message, err.name)
          throw err
        }
        log('成功转码')
      })
    })
    parser.end()
  })
})

async function fetchTsList (m3u) {
  const uriList = m3u.items.PlaylistItem.map((item) => item.properties.uri)
  const bufferList = []
  await Promise.all(uriList.map(async (uri, index) => {
    log('下载文件', uri)
    const body = await request({
      uri,
      encoding: null
    })
    bufferList[index] = body
  }))
  return Buffer.concat(bufferList)
}

function log (...messages) {
  logElement.value = logElement.value + messages.join(' ') + '\n'
}
