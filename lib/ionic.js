/*
 _             _      
(_)           (_)     
 _  ___  _ __  _  ___ 
| |/ _ \| '_ \| |/ __|
| | (_) | | | | | (__ 
|_|\___/|_| |_|_|\___|

http://ionicframework.com/

A utility for starting and administering Ionic based mobile app projects.
Licensed under the MIT license. See LICENSE For more.

Copyright 2013 Drifty (http://drifty.com/)
*/
                   
var IonicStartTask = require('./ionic/start').IonicStartTask,
    IonicPlatformTask = require('./ionic/platform').IonicPlatformTask,
    IonicRunTask = require('./ionic/run').IonicRunTask,
    IonicEmulateTask = require('./ionic/emulate').IonicEmulateTask;
    IonicBuildTask = require('./ionic/build').IonicBuildTask,
    IonicLoginTask = require('./ionic/login').IonicLoginTask,
    IonicUploadTask = require('./ionic/upload').IonicUploadTask,
    IonicPackageTask = require('./ionic/package').IonicPackageTask;

var fs = require('fs'), 
    argv = require('optimist').argv;

var TASKS = [
  {
    title: 'start',
    name: 'start',
    usage: 'appname',
    task: IonicStartTask
  }, 
  {
    title: 'emulate',
    name: 'emulate',
    usage: 'emulate',
    task: IonicEmulateTask
  },
  {
    title: 'run',
    name: 'run',
    usage: 'run',
    task: IonicRunTask
  },
  {
    title: 'build',
    name: 'build',
    usage: 'build',
    task: IonicBuildTask
  },
  {
    title: 'platform',
    name: 'platform',
    usage: 'platform',
    task: IonicPlatformTask
  },
  {
    title: 'login',
    name: 'login',
    usage: '[email]',
    task: IonicLoginTask
  },
  {
    title: 'upload',
    name: 'upload',
    alt: ['up'],
    usage: '',
    task: IonicUploadTask
  },
  {
    title: 'package',
    name: 'package',
    alt: ['pack'],
    usage: 'mode platform',
    task: IonicPackageTask
  }
];

Ionic = function() {};

Ionic.prototype = {
  IONIC_DASH: 'http://apps.ionicframework.com/',
  IONIC_COOKIES: 'ionic.cookies',
  IONIC_API: 'api/v1/',  
  _tryBuildingTask: function() {
    if(argv._.length == 0) {
      return false;
    }
    var taskName = argv._[0];

    return this._getTaskWithName(taskName);
  },

  _getTaskWithName: function(name) {
    for(var i = 0; i < TASKS.length; i++) {
      var t = TASKS[i];
      if(t.name === name) {
        return t;
      }
      if(t.alt) {
        for(var j = 0; j < t.alt.length; j++) {
          var alt = t.alt[j];
          if(alt === name) {
            return t;
          }   
        }
      }
    }
  },

  _printGenericUsage: function() {
    this._printIonic();
    process.stderr.write('Usage: ionic task args\n\n===============\n\nAvailable tasks:\n\n');

    for(var i = 0; i < TASKS.length; i++) {
      var task = TASKS[i];
      process.stderr.write('  ' + task.name + ' - ' + task.task.HELP_LINE + '\n');
    }

    process.stderr.write('\n');
    process.exit(1);
  },

  _printIonic: function() {
    process.stdout.write('\n   __          __  \n');
    process.stdout.write('| /  \\ |\\ | | /  `\n' + '| \\__/ | \\| | \\__,\n\n');
  },

  _loadTaskRunner: function(which) {

  },

  run: function() {
    var task = this._tryBuildingTask();
    if(!task) {
      return this._printGenericUsage();
    }

    console.log('Running', task.title, 'task...')

    var taskObj = new task.task();
    taskObj.run(this);
  },

  fail: function(msg) {
    process.stderr.write(msg + '\n');
    process.exit(1);
  }

};

exports.Ionic = Ionic;
