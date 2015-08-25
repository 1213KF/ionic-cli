var fs = require('fs'),
    _ = require('underscore'),
    Q = require('q'),
    request = require('request'),
    requestProcess = require('request-progress'),
    ProgressBar = require('progress'),
    IonicAppLib = require('ionic-app-lib'),
    Utils = IonicAppLib.utils,
    Login = IonicAppLib.login,
    Package = IonicAppLib.package,
    LoginTask = require('./login'),
    Prompt = require('./prompt'),
    Table = require('./table'),
    Task = require('./task').Task;

var Project = IonicAppLib.project;
var IonicTask = function() {};

IonicTask.prototype = new Task();

IonicTask.prototype.run = function(ionic, argv) {

  if (argv._.length < 2) {
    return Utils.fail("Specify a subcommand (build, list, or download).", 'package');
  }

  var cmd = argv._[1],
      dir = null,
      project = null,
      appId = null;

  try {
    dir = process.cwd();
    project = Project.load(dir);
    appId = project.get('app_id');
  } catch (ex) {
    return Utils.fail(ex, 'package');
  }

  switch (cmd) {
    case 'build':
      return packageBuild(ionic, argv, dir, project, appId);
    case 'list':
      return packageList(ionic, argv, dir, project, appId);
    case 'download':
      return packageDownload(ionic, argv, dir, project, appId);
  }

  return Utils.fail("Unknown subcommand '" + cmd + "'.", 'package')

};

function packageBuild(ionic, argv, dir, project, appId) {

  if (argv._.length < 3) {
    return Utils.fail("Specify a valid platform (android or ios).", 'package');
  }

  var platform = argv._[2],
      buildMode = argv.release ? 'release' : 'debug';

  if (!_.contains(['android', 'ios'], platform)) {
    return Utils.fail("Invalid platform '" + platform + "', please choose either 'android' or 'ios'.", 'package');
  }

  return Login.retrieveLogin()
    .then(function(jar) {
      if (!jar) {
        console.log('No previous login existed. Attempting to log in now.');
        return LoginTask.login(argv);
      }
      return jar;
    })
    .then(function(jar) {
      var q = Q.defer();

      if (platform === 'android') {
        if (buildMode === 'debug') {
          return Package.buildAndroidDebug(appId, dir, jar);
        } else if (buildMode === 'release') {
          return Prompt.prompt([
              { name: 'keystore', description: 'Keystore File:'.prompt, required: true },
              { name: 'keystore-password', description: 'Keystore Password:'.prompt, hidden: true, required: true },
              { name: 'key-alias', description: 'Key Alias:'.prompt, required: true },
              { name: 'key-password', description: 'Key Password:'.prompt, hidden: true, required: true }
          ], argv)
            .then(function(result) {
              var keystoreFilePath = result['keystore'],
                  keystorePassword = result['keystore-password'],
                  keyAlias = result['key-alias'],
                  keyPassword = result['key-password'],
                  keystoreFileStream = fs.createReadStream(keystoreFilePath);

              q.resolve(Package.buildAndroidRelease(appId, dir, jar, keystoreFileStream, keystorePassword, keyAlias, keyPassword));
            })
            .catch(function(ex) {
              q.reject(ex);
            });
        }
      } else if (platform === 'ios') {
        return Prompt.prompt([
            { name: 'cert', description: 'Certificate File:'.prompt, required: true },
            { name: 'cert-password', description: 'Certificate Password:'.prompt, hidden: true, required: true },
            { name: 'provisioning-profile', description: 'Provisioning Profile:'.prompt, required: true }
        ], argv)
          .then(function(result) {
            var certificateFilePath = result['cert'],
                certificatePassword = result['cert-password'],
                provisioningProfileFilePath = result['provisioning-profile'],
                certificateFileStream = fs.createReadStream(certificateFilePath),
                provisioningProfileFileStream = fs.createReadStream(provisioningProfileFilePath);

            q.resolve(Package.buildIOS(appId, dir, jar, buildMode, certificateFileStream, certificatePassword, provisioningProfileFileStream));
          })
          .catch(function(ex) {
            q.reject(ex);
          });
      }

      q.reject('Unrecognized platform/build mode.');

      return q.promise;
    })
    .catch(function(ex) {
      Utils.fail(ex, 'package');
    });

};

function determineFileExtension(platform) {
  switch (platform) {
    case 'android':
      return 'apk';
    case 'ios':
      return 'ipa';
  }

  throw new Error('Unknown platform: ' + platform);
}

function formatStatus(status) {
  switch (status) {
    case 'SUCCESS':
      return status.green;
    case 'FAILED':
      return status.red;
  }

  return status;
}

function formatDate(date) {
  var d = new Date(date);

  return d.toLocaleDateString() + ' at ' + d.toLocaleTimeString();
}

function packageList(ionic, argv, dir, project, appId) {

  var limit = 25;

  return Login.retrieveLogin()
    .then(function(jar) {
      if (!jar) {
        console.log('No previous login existed. Attempting to log in now.');
        return LoginTask.login(argv);
      }
      return jar;
    })
    .then(function(jar) {
      return Package.listBuilds(appId, jar);
    })
    .then(function(body) {
      var count = 0,
          table = new Table({ head: ['id', 'status', 'platform', 'mode', 'created', 'completed'] });

      _.each(body.data.slice(0, limit), function(build) {
        count++;

        table.push([
          build.id,
          formatStatus(build.status),
          build.platform,
          build.mode,
          formatDate(build.created),
          build.completed ? formatDate(build.completed) : ''
        ]);
      });

      console.log('');
      console.log(table.toString());
      console.log('\nShowing', String(count).yellow, 'of your latest builds.');
      console.log('');
    });

}

function packageDownload(ionic, argv, dir, project, appId) {

  var jar;

  return Login.retrieveLogin()
    .then(function(jar) {
      if (!jar) {
        console.log('No previous login existed. Attempting to log in now.');
        return LoginTask.login(argv);
      }
      return jar;
    })
    .then(function(j) {
      jar = j;

      if (argv._.length < 3) {
        return Package.listBuilds(appId, jar);
      }

      return { data: [ { id: argv._[2] } ] };
    })
    .then(function(body) {
      return Package.getBuild(appId, jar, body.data[0].id);
    })
    .then(function(body) {
      var q = Q.defer(),
          build = body.data,
          bar;

      if (build.status != 'SUCCESS' || !build.url) {
        return Q.reject(new Error('Cannot download! Build did not finish.'));
      }

      var filename = build.name + '.' + determineFileExtension(build.platform);

      requestProcess(request({ url: build.url }))
        .on('progress', function(state) {
          if (typeof bar === 'undefined') {
            bar = new ProgressBar('Downloading... [:bar]  :percent  :etas', {
              complete: '=',
              incomplete: ' ',
              width: 30,
              total: state.total
            });
          }

          bar.tick(state.received);
        })
        .on('error', function(err) {
          q.reject(err);
        })
        .pipe(fs.createWriteStream(filename))
        .on('error', function(err) {
          q.reject(err);
        })
        .on('close', function() {
          console.log('Wrote:', filename);
          q.resolve(filename);
        });

      return q.promise;
    })
    .then(function(filename) {
      console.log('Done!'.green);
    })
    .catch(function(ex) {
      Utils.fail(ex);
    });

}

exports.IonicTask = IonicTask;
