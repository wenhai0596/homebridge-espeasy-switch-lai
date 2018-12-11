var request = require('request');
let Service, Characteristic;
module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-espeasy-switch-lai', 'ESPEasySwitch', ESPEasySwitch);
}
function ESPEasySwitch(log, config) {
    this.log = log;
    this.name = config.name || 'ESPEasySwitch';
    this.type = config.type || 'switch';
    this.ip = config.ip;
    this.doorRelayPin = this.relayNumberToGPIO(config.doorRelayPin);
    this.pulse = config.pulse || false;
    this.action = config.action || 'off';
    this.duration = config.duration || 60;
    
    if (!this.ip) {
        throw new Error('Your must provide IP address of the switch.');
	}

    switch (this.type) {
        case 'outlet':
            this.service = new Service.Outlet(this.name);
            break;

        default:
            this.service = new Service.Switch(this.name);
            break;
    }

    this.serviceInfo = new Service.AccessoryInformation();

    this.serviceInfo
        .setCharacteristic(Characteristic.Manufacturer, 'Lai')
        .setCharacteristic(Characteristic.Model, 'espessy')
        .setCharacteristic(Characteristic.SerialNumber, Math.random().toString(36));

    this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
}

ESPEasySwitch.prototype = {
    getPowerState: function(callback) {
        var log = this.log;

		if (this.pulse) {
			callback(null, false);
			return;
		}

        request.get({
            url: 'http://' + this.ip + '/control?cmd=status,' + this.doorRelayPin,
            timeout: 12000
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                var json = JSON.parse(body);

                log.debug('State: ' + json.state);
                callback(null, (json.state == 1));
                return;
            }

            log.debug('Error getting power state. (%s)', error);

            callback();
        });
    },

    setPowerState: function(state, callback) {
        var log = this.log;
		var command = '/control?cmd=GPIO,' + this.doorRelayPin + ((state) ? 1: 0);

		if (this.pulse && state) {
			command = '/control?cmd=Pulse,12,' + ((this.action == 'on') ? 1 : 0) + ',' + (parseInt(this.duration) * 1000);
		}

        request.get({
            url: 'http://' + this.ip + command,
            timeout: 12000
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                if (body == 'OK') {
                    return;
				}

                log.debug('Response Error: %s', body);
                return;
            }

            log.debug('Error setting device control. (%s)', error);
        });

		if (this.pulse) {
			var that = this;
			
			setTimeout(function() {
				that.service.getCharacteristic(Characteristic.On).updateValue(false);
			}, 2000);
		}

        callback();
    },

    identify: function(callback) {
        callback();
    },

    getServices: function() {
        return [this.serviceInfo, this.service];
    }
  relayNumberToGPIO(relay) {
    switch (relay) {
    case 1:
      return 12;
    case 2:
      return 5;
    case 3:
      return 4;
    case 4:
      return 15;
    default:
      return 12;
    }
  }
};