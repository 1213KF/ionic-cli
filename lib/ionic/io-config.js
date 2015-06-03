var fs = require('fs'),
    path = require('path'),
    parseUrl = require('url').parse,
    request = require('request'),
    argv = require('optimist').argv,
    prompt = require('prompt'),
    FormData = require('form-data'),
    IonicProject = require('./project'),
    IonicTask = require('./task').IonicTask,
    IonicStats = require('./stats').IonicStats;
    Task = require('./task').Task,
    IonicLoginTask = require('./login').IonicTask;

var IonicTask = function() {};

var CONFIG_FILE = './.io-config.json'

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
      key = '',
      val = '';

  if (argv['_'][1] == 'set' || argv['_'][1] == 'unset') {
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
  } else {
    self.ionic.fail("Invalid command, must use 'set' or 'unset'");
  }

  fs.readFile(CONFIG_FILE, function(err, data) {
    if (err) {
      console.log("ERROR: ", err);
    } else {
      var jsonObj = JSON.parse(data);
      if (set) {
        jsonObj[key] = val
      } else if (!set && jsonObj[key]) {
        delete jsonObj[key]
      }
      fs.writeFile(CONFIG_FILE, JSON.stringify(jsonObj), function(error) {
        if (err) {
          console.log("ERROR: ", error);
        } else {
          console.log(jsonObj);
          console.log("Successfully saved " + key );
        }
      });
    }
  });
};

exports.IonicTask = IonicTask;
