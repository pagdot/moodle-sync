# Moodle file sync

Syncs files from moodle courses to your harddisk

## Preparation

1. Execute

   ```sh
   npm install
   ```

   in this directory to install all dependencies.

2. Request your personal token by entering following command

   ```sh
   curl "<MOODLE_URL>/login/token.php?username=<USERNAME>&password=<PASSWORD>&service=moodle_mobile_app"
   ```

   and replacing

   - `<MOODLE_URL>` with the base url of the Moodle-server
   - `<USERNAME>` with your username
   - `<PASSWORD>` with your password

   Your access-token is in the `token`-field

   before executing it.
3. Set follwing paramters in the file `config.json`
   - `moodle_url` to the base url of the Moodle-server
   - `moodle_token` to your previously generated access-token
   - `whitelist` to your whitelisted courses.
     A course is whitelisted if the string of one entry of the whitelist
     is contained in the course name.
   - `path` to the path to store the downloaded files

## Run Script

Execute

```
npm start
```

to download all missing files and update changed files