var ioLib = require('ionic-app-lib').ioConfig,
    argv = require('optimist').argv,
    fs = require('fs'),
    prompt = require('prompt'),
    IonicProject = require('./project'),
    IonicTask = require('./task').IonicTask,
    Task = require('./task').Task,
    IonicLoginTask = require('./login').IonicTask;

var IonicTask = function() {};

IonicTask.prototype = new Task();

IonicTask.prototype.run = function(ionic) {
  var self = this;
  self.ionic = ionic;

  self.project = null;

  try {
    self.project = IonicProject.load();
  } catch (ex) {
    self.ionic.fail(ex.message);
    return
  }

  var set = false,
      build = false,
      key = '',
      val = '';

  if (argv['_'][1] == 'set' || argv['_'][1] == 'unset' || argv['_'][1] == 'build') {
    if (argv['_'][1] == 'build') {
      build = true;
      ioLib.writeIoConfig(false, false, true);
    } else {
      if (argv['_'][1] == 'set') {
        set = true;
      }
      if (argv['_'][2]) {
        key = argv['_'][2];
        if (argv['_'][3] && set) {
          val = argv['_'][3];
        }
      } else {
        self.ionic.fail("Invalid syntax, use 'ionic config <command> key value'");
      }
    }
  } else {
    self.ionic.fail("Invalid command, must use 'set' or 'unset'");
  }
  if (!build) {
    ioLib.writeIoConfig(key, val, set);
  }
};

exports.IonicTask = IonicTask;
