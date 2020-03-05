const fs = require('fs').promises;
const moodle = require('./moodle.js');

function requiereEnv(name) {
   if (!process.env[name]) {
      throw "Requiered environment variable \"" + name + "\" is missing!";
   }
   return process.env[name];
}

function envOrDefault(name, def) { return process.env[name] ? process.env[name] : def; }
function optionalEnv(name) { return envOrDefault(name, null); }

const config = {
   "moodle_url": requiereEnv("MOODLE_URL"),
   "moodle_token": requiereEnv("MOODLE_TOKEN"),
   "whitelist": requiereEnv("MOODLE_WHITELIST").split(','),
   "path": "/data",
   "interval": envOrDefault("SYNC_INTERVAL", 300),
   "gotify": {
      "url": optionalEnv("GOTIFY_URL"),
      "token": optionalEnv("GOTIFY_TOKEN"),
   }
}

// wrap a request in an promise
function request(url) {
   // return new pending promise
   return new Promise((resolve, reject) => {
      // select http or https module, depending on reqested url
      const lib = url.startsWith('https') ? require('https') : require('http');
      const request = lib.get(url, response => {
         // handle http errors
         if (response.statusCode < 200 || response.statusCode > 299) {
            reject(new Error('request: Failed to load page, status code: ' + response.statusCode));
         }
         // temporary data holder
         const body = [];
         // on every content chunk, push it to the data array
         response.on('data', chunk => body.push(chunk));
         // we are done, resolve promise with those joined chunks
         response.on('end', resolve(Buffer.concat(body)));
      });
      // handle connection errors of the request
      request.on('error', err => reject('request: ' + err))
   })
}

function sendNotifications(cfg, title, message) {
   if (!cfg || !cfg.url || !cfg.token) {
      return new Promise((resolve, reject) => {
         reject('sendNotifications: Invalid configuration')
      });
   }
   const request = require('request');

   let options = {
      method: "POST",
      json: true,
      body: {
         title: title,
         message: message,
         priority: 5
      }
   }
   let url = cfg.url + "/message?token=" + cfg.token;
   console.log('Send notification to "' + url + '"');
   return new Promise((resolve, reject) => {
      request(url, options, (error, response, body) => {
         if (error) reject('sendNotifications: ' + error + (body ? ': ' + JSON.stringify(body) : ''));
         if (response.statusCode != 200) {
            reject('sendNotifications: Invalid status code <' + response.statusCode + '>' + JSON.stringify(body));
         }
         resolve(body);
      });
   });
}


function run(config) {
   moodle.getFiles(config.moodle_url, config.moodle_token, config.whitelist)
      .then(urls => {
         //console.log(urls);
         return Promise.all(urls.map(dl => {
            let folder = (config.path + "/" + dl.course + "/" + dl.module);
            let path = folder + "/" + dl.fileName;
            return fs.stat(path).then(stats => {
               if (stats.mtime < dl.time) {
                  console.log("Downloading updated file " + path)
                  return sendNotifications(config.gotify, 'Updating file in ' + dl.course, 'Updating file "' + dl.fileName + '" in module "' + dl.module + '"')
                     .catch(error => console.log('[ERROR] ' + error))
                     .then(request(dl.url).then(data => fs.writeFile(path, data)))
               }
            }, err => {
               if (err.code === "ENOENT") {
                  return fs.mkdir(folder, { recursive: true })
                     .then(console.log("Downloading new file " + path))
                     .then(sendNotifications(config.gotify, 'New file in ' + dl.course, 'New file "' + dl.fileName + '" in module "' + dl.module + '"'))
                     .catch(error => console.log('[ERROR] ' + error))
                     .then(request(dl.url).then(data => fs.writeFile(path, data)));
               }
            });
         }));
      }).then(console.log("Finished!"));
}

console.log("Config: " + JSON.stringify(config));
console.log("Starting initial run...");
run(config);

var iId = setInterval(config => {
   console.log("Starting update...");
   run(config);
}, config.interval * 1000, config);

function handle(signal) {
   console.log("Received signal " + signal);
   console.log("Exiting...");
   clearInterval(iId);
   process.exit();
}

process.on('SIGINT', handle);
process.on('SIGTERM', handle);