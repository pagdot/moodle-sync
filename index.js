const fs = require('fs').promises;

const moodle = require('./moodle.js');
const config = require('./config.json');

// wrap a request in an promise
function request(url) {
   // return new pending promise
   return new Promise((resolve, reject) => {
      // select http or https module, depending on reqested url
      const lib = url.startsWith('https') ? require('https') : require('http');
      const request = lib.get(url, (response) => {
         // handle http errors
         if (response.statusCode < 200 || response.statusCode > 299) {
            reject(new Error('Failed to load page, status code: ' + response.statusCode));
          }
         // temporary data holder
         const body = [];
         // on every content chunk, push it to the data array
         response.on('data', (chunk) => body.push(chunk));
         // we are done, resolve promise with those joined chunks
         response.on('end', () => resolve(Buffer.concat(body)));
     });
     // handle connection errors of the request
     request.on('error', (err) => reject(err))
     })
}

moodle.getFiles(config.moodle_url, config.moodle_token, config.course_whitelist)
   .then(urls => {
      console.log(urls);
      return Promise.all(urls.map(dl => {
         let folder = (config.base_path + "/" + dl.course + "/" + dl.module);
         let path = folder + "/" + dl.fileName;
         fs.stat(path).then(stats => {
               if (stats.mtime < dl.time) {
                  console.log("Downloading updated file " + path)
                  return request(dl.url).then(data => fs.writeFile(path, data))
               }
            }, (err) => {
               if (err.code === "ENOENT") {
                  return fs.mkdir(folder, {recursive: true})
                     .then(console.log("Downloading new file " + path))
                     .then(request(dl.url).then(data => fs.writeFile(path, data)));
               }
            });
      }));
   }).then(() => console.log("Finished!"));