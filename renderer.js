const fs = require('fs')
const joinPath = require('path').join
const os = require('os')
const execSync = require('child_process').execSync

const request = require('request')
const tmp = require('tmp')
const m3u8 = require('m3u8')

const isDevelopment = process.env.NODE_ENV === 'development'
const resourcesPath = joinPath(isDevelopment ? __dirname : process.resourcesPath, 'bin')
const bin = joinPath(resourcesPath, os.platform() + '_' + os.arch())

const sourceElement = document.getElementById('source')
const targetElement = document.getElementById('target')
const downloadElement = document.getElementById('download')
const logElement = document.getElementById('log')

tmp.setGracefulCleanup()

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

  request(source, (err, res, body) => {
    if (err) {
      log('无法请求资源', err.message)
      return
    }
    const parser = m3u8.createStream()
    parser.write(body)
    parser.on('m3u', (m3u) => {
      const uriList = m3u.items.PlaylistItem.map((item) => item.properties.uri)
      downloadAndConvert(source, target, uriList)
    })
    parser.end()
  })
})
async function downloadAndConvert (source, target, uriList) {
  const convertPath = joinPath(target, 'test.mp4')
  const tmpfile = tmp.fileSync().name
  for (let index = 0; index < uriList.length; index++) {
    const uri = uriList[index]
    await download(uri, tmpfile)
  }
  log('成功下载所有文件')
  try {
    execSync(`${bin} -y -i ${tmpfile} -bsf:a aac_adtstoasc -vcodec copy ${convertPath}`)
  } catch (err) {
    log(err.stack, err.message, err.name)
    throw err
  }
  log('成功转码')
}

async function download (from, to) {
  return new Promise((resolve, reject) => {
    log('下载文件', from, '到', to)
    request({ uri: from, encoding: null })
      .on('error', reject)
      .pipe(fs.createWriteStream(to, {flags: 'a'}))
      .on('finish', resolve)
  })
}

function log (...messages) {
  logElement.value = logElement.value + messages.join(' ') + '\n'
}
