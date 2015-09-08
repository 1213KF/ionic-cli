var fs = require('fs'),
    path = require('path'),
    expandTilde = require('expand-tilde'),
    _ = require('underscore'),
    Q = require('q'),
    moment = require('moment'),
    request = require('request'),
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

  var cmd;

  if (argv._.length < 2) {
    cmd = 'list';
  } else {
    cmd = argv._[1];
  }

  var dir = null,
      project = null,
      appId = null;

  try {
    dir = process.cwd();
    project = Project.load(dir);
    appId = project.get('app_id');

    if (!appId) {
      throw new Error('Missing Ionic App ID.');
    }
  } catch (ex) {
    return Utils.fail(ex, 'package');
  }

  switch (cmd) {
    case 'build':
      return packageBuild(ionic, argv, dir, project, appId);
    case 'list':
      return packageList(ionic, argv, dir, project, appId);
    case 'info':
      return packageInfo(ionic, argv, dir, project, appId);
    case 'download':
      return packageDownload(ionic, argv, dir, project, appId);
  }

  return Utils.fail("Unknown subcommand '" + cmd + "'.", 'package')

};

function packageBuild(ionic, argv, dir, project, appId) {

  if (argv._.length < 3) {
    return Utils.fail("Specify a valid platform (android or ios).", 'package');
  }

  var jar,
      platform = argv._[2],
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
    .then(function(j) {
      var q = Q.defer();

      jar = j;

      if (platform === 'android') {
        if (buildMode === 'debug') {
          q.resolve({});
        } else if (buildMode === 'release') {
          if (typeof argv.s !== 'undefined') {
            argv['keystore'] = argv.s;
          }

          if (typeof argv.p !== 'undefined') {
            argv['keystore-password'] = argv.p;
          }

          if (typeof argv.k !== 'undefined') {
            argv['key-alias'] = argv.k;
          }

          if (typeof argv.w !== 'undefined') {
            argv['key-password'] = argv.w;
          }

          Prompt.prompt([
              { name: 'keystore', description: 'Keystore File:'.prompt, required: true },
              { name: 'keystore-password', description: 'Keystore Password:'.prompt, hidden: true, required: true },
              { name: 'key-alias', description: 'Key Alias:'.prompt, required: true },
              { name: 'key-password', description: 'Key Password:'.prompt, hidden: true, required: true }
          ], argv)
            .then(function(result) {
              q.resolve(result);
            })
            .catch(function(ex) {
              q.reject(ex);
            });
        } else {
          q.reject('Unrecognized build mode: ' + buildMode);
        }
      } else if (platform === 'ios') {
        if (typeof argv.c !== 'undefined') {
          argv['cert'] = argv.c;
        }

        if (typeof argv.p !== 'undefined') {
          argv['cert-password'] = argv.p;
        }

        if (typeof argv.r !== 'undefined') {
          argv['provisioning-profile'] = argv.r;
        }

        Prompt.prompt([
            { name: 'cert', description: 'Certificate File:'.prompt, required: true },
            { name: 'cert-password', description: 'Certificate Password:'.prompt, hidden: true, required: true },
            { name: 'provisioning-profile', description: 'Provisioning Profile:'.prompt, required: true }
        ], argv)
          .then(function(result) {
            q.resolve(result);
          })
          .catch(function(ex) {
            q.reject(ex);
          });
      } else {
        q.reject('Unrecognized platform: ' + platform);
      }

      return q.promise;
    })
    .then(function(result) {
      if (platform === 'android') {
        if (buildMode === 'debug') {
          return Package.buildAndroidDebug(dir, jar, appId);
        } else if (buildMode === 'release') {
          var keystoreFilePath = path.resolve(expandTilde(result['keystore'])),
              keystorePassword = path.resolve(expandTilde(result['keystore-password'])),
              keyAlias = result['key-alias'],
              keyPassword = result['key-password'],
              keystoreFileStream = fs.createReadStream(keystoreFilePath);

          return Package.buildAndroidRelease(dir, jar, appId, keystoreFileStream, keystorePassword, keyAlias, keyPassword)
        }
      } else if (platform === 'ios') {
        var certificateFilePath = path.resolve(expandTilde(result['cert'])),
            certificatePassword = result['cert-password'],
            provisioningProfileFilePath = path.resolve(expandTilde(result['provisioning-profile'])),
            certificateFileStream = fs.createReadStream(certificateFilePath),
            provisioningProfileFileStream = fs.createReadStream(provisioningProfileFilePath);

        return Package.buildIOS(dir, jar, appId, buildMode, certificateFileStream, certificatePassword, provisioningProfileFileStream)
      }

      return Q.reject('Unrecognized platform/build mode.');
    })
    .catch(function(ex) {
      Utils.fail(ex, 'package');
    });

};

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

  return moment(d).format('MMM Do, YYYY H:mm:ss');
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
      if (body.data.length === 0) {
        console.log('You don\'t have any builds yet!');
        console.log('Type ' + 'ionic help package'.yellow + ' to learn how to use Ionic Package.');
      } else {
        var count = 0,
            headers = ['id', 'status', 'platform', 'mode'],
            table,
            screenWidth = process.stdout.getWindowSize()[0];

        if (screenWidth > 100) {
          headers.push('created');
        }

        if (screenWidth > 125) {
          headers.push('finished');
        }

        table = new Table({ head: headers });

        _.each(body.data.slice(0, limit), function(build) {
          count++;

          var row = [
            build.id,
            formatStatus(build.status),
            build.platform,
            build.mode
          ];

          if (screenWidth > 100) {
            row.push(formatDate(build.created));
          }

          if (screenWidth > 125) {
            row.push(build.completed ? formatDate(build.completed) : '');
          }

          table.push(row);
        });

        console.log('');
        console.log(table.toString());
        console.log('\nShowing', String(count).yellow, 'of your latest builds.');
        console.log('');
      }
    })
    .catch(function(ex) {
      Utils.fail(ex, 'package');
    });

}

function packageInfo(ionic, argv, dir, project, appId) {

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
      return Package.getBuild(appId, jar, body.data[0].id, { fields: ['output'] });
    })
    .then(function(body) {
      var table = new Table(),
          build = body.data;

      table.push(
        ['id'.yellow, build.id],
        ['status'.yellow, formatStatus(build.status)],
        ['platform'.yellow, build.platform],
        ['mode'.yellow, build.mode],
        ['started'.yellow, formatDate(build.created)]
      );

      if (build.completed) {
        table.push(['completed'.yellow, formatDate(build.completed)]);
      }

      console.log('');
      console.log(table.toString());
      console.log('');

      if (build.output) {
        console.log('output'.yellow + ':');
        console.log('');
        console.log(build.output);
        console.log('');
      }

    })
    .catch(function(ex) {
      Utils.fail(ex, 'package');
    });

}

function packageDownload(ionic, argv, dir, project, appId) {

  var jar,
      bar;

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
      return Package.downloadBuild(appId, jar, body.data[0].id);
    })
    .then(function(filename) {
      if (typeof bar !== 'undefined') {
        bar.tick(bar.total);
      }

      console.log('Wrote:', filename);
      console.log('Done!'.green);
    }, null, function(state) {
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
    .catch(function(ex) {
      Utils.fail(ex);
    });

}

exports.IonicTask = IonicTask;
