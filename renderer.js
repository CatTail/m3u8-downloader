const fs = require('fs')
const path = require('path')
const os = require('os')
const url = require('url')
const execSync = require('child_process').execSync

const request = require('request')
const tmp = require('tmp')
const m3u8 = require('m3u8')

const concurrent = 10
const isDevelopment = process.env.NODE_ENV === 'development'
const resourcesPath = path.join(isDevelopment ? __dirname : process.resourcesPath, 'bin')
let bin = path.join(resourcesPath, os.platform() + '_' + os.arch())
if (os.platform() === 'win32') {
  bin = bin + '.exe'
}

const $progress = $('#progress').hide()
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
  if (!source) {
    window.alert('请输入 m3u8 文件地址')
    return
  }
  if (!targetElement.files[0]) {
    window.alert('请选择保存路径')
    return
  }
  const target = targetElement.files[0].path
  log('原地址', source)
  log('目标地址', target)

  request(encodeURI(source), (err, res, body) => {
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
  // 初始化进度条
  $progress.show().progress({total: uriList.length, autoSuccess: false})
  // 分五段并发下载文件
  const segmentLength = parseInt(uriList.length / concurrent)
  const segmentList = []
  for (let index = 0; index < concurrent; index++) {
    const startIndex = index * segmentLength
    let endIndex = (index + 1) * segmentLength
    if (index === concurrent - 1) {
      endIndex = endIndex + uriList.length % concurrent + 1
    }
    segmentList.push(uriList.slice(startIndex, endIndex))
  }
  const tmpfileList = []
  await Promise.all(segmentList.map(async (segment, index) => {
    const tmpfile = tmpfileList[index] = tmp.fileSync().name
    for (let index = 0; index < segment.length; index++) {
      let uri = segment[index]
      // 将相对地址扩展为绝对地址
      if (uri[0] === '/') {
        const obj = url.parse(source)
        uri = `${obj.protocol}//${obj.hostname}${uri}`
      }
      await downloadRetry(uri, tmpfile)
    }
  }))
  log('成功下载所有文件')
  try {
    // 合并多个临时文件
    const tmpfile = tmpfileList[0]
    for (let index = 1; index < concurrent; index++) {
      await concat(tmpfileList[index], tmpfile)
    }
    // 转码为 MP4
    log('转码中')
    await delay(100)
    const convertPath = path.join(target, path.basename(source, path.extname(source)).slice(10) + '.mp4')
    execSync(`${bin} -y -i ${tmpfile} -bsf:a aac_adtstoasc -vcodec copy ${convertPath}`)
    $progress.progress('set success')
  } catch (err) {
    log(err.stack, err.message, err.name)
    throw err
  }
  log('成功转码')
}

async function downloadRetry (from, to) {
  try {
    await download(from, to)
    $progress.progress('increment')
  } catch (err) {
    await downloadRetry(from, to)
  }
}

function download (from, to) {
  return new Promise((resolve, reject) => {
    log('下载文件', from, '到', to)
    request({ uri: encodeURI(from), encoding: null, timeout: 20000 })
      .on('error', reject)
      .pipe(fs.createWriteStream(to, {flags: 'a'}))
      .on('error', reject)
      .on('finish', resolve)
  })
}

function concat (from, to) {
  return new Promise((resolve, reject) => {
    log('合并文件', from, to)
    fs.createReadStream(from)
      .on('error', reject)
      .pipe(fs.createWriteStream(to, {flags: 'a'}))
      .on('error', reject)
      .on('finish', resolve)
  })
}

function log (...messages) {
  logElement.value = logElement.value + messages.join(' ') + '\n'
  logElement.scrollTop = logElement.scrollHeight
}

function delay (timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout)
  })
}
