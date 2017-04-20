const fs = require('fs')
const execSync = require('child_process').execSync
const request = require('request-promise-native')
const m3u8 = require('m3u8')
const debug = require('debug')('m3u8-downloader')

const sourceElement = document.getElementById('source')
const targetElement = document.getElementById('target')
const downloadElement = document.getElementById('download')

downloadElement.addEventListener('click', (event) => {
  const source = sourceElement.value
  debug('source', source)
  const target = targetElement.files[0].path
  debug('target', target)

  request(source).then((body) => {
    const parser = m3u8.createStream()
    parser.write(body)
    parser.on('m3u', (m3u) => {
      fetchTsList(m3u).then((buf) => {
        fs.writeFileSync(target + '/all.ts', buf)
        debug('write success')
        alert('成功合并')
        execSync(`${__dirname}/bin/ffmpeg -i ${target}/all.ts -bsf:a aac_adtstoasc -vcodec copy ${target}/test.mp4`)
        alert('成功转码')
        debug('convert success')
      })
    })
    parser.end()
  })
})

async function fetchTsList(m3u) {
  const uriList= m3u.items.PlaylistItem.map((item) => item.properties.uri)
  const bufferList = []
  await Promise.all(uriList.map(async (uri, index) => {
    debug('fetch uri', uri)
    const body = await request({
      uri,
      encoding: null,
    })
    bufferList[index] = body
  }))
  return Buffer.concat(bufferList)
}
