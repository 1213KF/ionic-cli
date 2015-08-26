var argv = require('optimist').argv,
    moduleSettings = require('../../package.json'),
    IonicAppLib = require('ionic-app-lib'),
    IonicResources = IonicAppLib.resources,
    IonicStats = require('./stats').IonicStats;

var IonicTask = function() {};
IonicTask.prototype = new Task();

IonicTask.prototype.run = function() {
  IonicResources.generate(argv, moduleSettings.version);

  IonicStats.t();
};

module.exports = {
  IonicTask: IonicTask,
  addIonicIcons: IonicResources.addIonicIcons,
  copyIconFilesIntoResources: IonicResources.copyIconFilesIntoResources,
  getConfigData: IonicResources.getConfigData,
  hasExistingResources: IonicResources.hasExistingResources,
  writeConfigData: IonicResources.writeConfigData
}
