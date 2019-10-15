const request = require('request');

exports.getFiles = getFiles;

// wrap a request in an promise
function requestMoodle(url, data) {
   let options = {
      method: "POST",
      form: data
   }
   return new Promise((resolve, reject) => {
      request(url, options, (error, response, body) => {
            if (error) reject(error);
            if (response.statusCode != 200) {
               reject('Invalid status code <' + response.statusCode + '>');
            }
            resolve(body);
         });
   });
}

function reduce(arr) {
   return arr.reduce(
      (a, e) => Array.isArray(e) ? a.concat(reduce(e)) : a.concat([e]), 
      new Array());
}

//retrieves list of files in moodle courses shortname contains a string from whitelist
//params:
//   url:         url to moodle installation
//   token:       moodle api token
//   whitelist:   string array of fragments of course-shortnames
//return: array of fileurls (see "extractFileUrls" for more info
function getFiles(url, token, whitelist) {
   let courseFileUrls = getUid(url, token)
      .then(uid => getCourses(url, token, uid))
      .then(courses => courses.filter(c => whitelist.filter(w => c.shortname.indexOf(w) >= 0).length > 0))
      .then(courses => getCoursesContent(url, token, courses))
      .then(content => extractFileUrls(content, token));
   let assignmentFileUrls = assignmentsGetUrls(url, token, whitelist);
   return Promise.all([courseFileUrls, assignmentFileUrls]).then(
      urls => reduce(urls)
   );
}

//retrieves all courses from a user
//params:
//   url:      url to moodle installation
//   token:    moodle api token
//   uid:      moodle user id
//returns: i don't know anymore. propably an array of objects (test the url call in curl)
function getCourses(url, token, uid) {
   return requestMoodle(
      url + "/webservice/rest/server.php?moodlewsrestformat=json",
      {
         wstoken: token,
         userid: uid,
         wsfunction: "core_enrol_get_users_courses"
      }
   ).then(response => JSON.parse(response));
}

//retrieves user id from api token
//params:
//   url:   url to moodle installation
//   token: moodle api token
//returns: user id
function getUid(url, token) {
   return requestMoodle(
      url + "/webservice/rest/server.php?moodlewsrestformat=json",
      {
         wstoken: token,
         wsfunction: "core_webservice_get_site_info"
      }
   ).then(response => {
      let data = JSON.parse(response);
      //console.log(data);
      return "" + data.userid
   });
}

//retrieves content from courses
//params:
//   url:      url to moodle installation
//   token:    moodle api token
//   courses:  array of courses
//returns: array with content of all courses
function getCoursesContent(url, token, courses) {
   return Promise.all(
      courses.map(c => requestMoodle(
         url + "/webservice/rest/server.php?moodlewsrestformat=json",
         {
            courseid: c.id,
            wsfunction: "core_course_get_contents",
            wstoken: token
         }
      ).then(response => {
         let content = JSON.parse(response);
         content.name = c.shortname;
         content.id = c.id;
         return content;
      })
   ));
}

 //extract fileurls from course-content
 //params:
 //   content: array of course-contents
 //   token:   moodle api token
 //returns: array of info with all found files
 function extractFileUrls(content, token) {
   return content.map(
      course => course.map(
         section => section.modules.filter(
            module => "contents" in module
         ).map(
            module => module.contents.filter(
               content => content.type == "file"
            ).map(
               content => new Object({
                  course: course.name.trim(),
                  module: module.name.trim(),
                  fileName: content.filename.trim(),
                  url: fixFileUrl(content.fileurl, token),
                  time: new Date(content.timemodified * 1000)
               })
            )
         )
      )
   )
}

//removes forcedownload option and adds token
//params:
//   fileUrl:  of fileUrlInfo (see "extractFileUrls")
//   token:    moodle api token
//returns: fixed file url
function fixFileUrl(fileUrl, token) {
   return fileUrl.replace("?forcedownload=1", "") + "?token=" + token;
}

//retrieves fileurls from assignments
//params:
//   url:         url to moodle installation
//   token:       moodle api token
//   whitelist:   whitelist of courses
//returns: array of fileurlinfos
function assignmentsGetUrls(url, token, whitelist) {
   return requestMoodle(
      url + "/webservice/rest/server.php?moodlewsrestformat=json",
      {
         wsfunction: "mod_assign_get_assignments",
         wstoken: token
      }
   ).then(response => JSON.parse(response))
   .then(data => {
      if (!data || !data.courses) {
         return [];
      }
      //console.log(data);

      return data.courses
         .filter(course => whitelist.filter(w => course.shortname.indexOf(w) >= 0).length > 0)
         .map(
            course => course.assignments.filter(
               assignment => "introattachments" in assignment
            ).map(
               assignment => assignment.introattachments.map(
                  attatchment => new Object({
                     course: course.shortname.trim(),
                     module: assignment.name.trim(),
                     fileName: attatchment.filename.trim(),
                     url: fixFileUrl(attatchment.fileurl, token),
                     time: new Date(assignment.timemodified * 1000)
                  })
               )
            )
         )
   });
}