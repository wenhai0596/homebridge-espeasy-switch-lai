var request = require('request');
var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-espeasy-switch-lai', 'ESPEasyLai', ESPEasy_Lai);
};

function ESPEasy_Lai(log, config) {
    this.log = log;
    this.name = config.name || 'ESPEasySwitch';
    this.type = config.type || 'switch';
    this.ip = config.ip;
    this.doorRelayPin = config.doorRelayPin;
    this.duration = config.duration || false;
    
    if (!this.ip) {
        throw new Error('Your must provide IP address of the switch');
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
        .setCharacteristic(Characteristic.Model, 'espeasy')
        .setCharacteristic(Characteristic.SerialNumber, 'abcd-1234-5678');

    this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerS.bind(this))
        .on('set', this.setPowerS.bind(this));
}

ESPEasy_Lai.prototype = {
    getPowerS: function(callback) {
        var log = this.log;

        request.get({
            url: 'http://' + this.ip + '/control?cmd=status,gpio,' + this.doorRelayPin,
            timeout: 1200
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                var json = JSON.parse(body);
                log.debug('State: ' + json.state);
                callback(null, (json.state == 1));
                return;
            }

            log.debug('Error getting power state: (%s)', error);

            callback();
        });
    },

    setPowerS: function(state, callback) {
        var log = this.log;
		var command = '/control?cmd=GPIO,' + this.doorRelayPin + ((state) ? 1: 0);

		if (this.duration && state) {
			command = '/control?cmd=Pulse,12,1,' + (parseInt(this.duration) * 1000);
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

			setTimeout(function() {
				this.service.getCharacteristic(Characteristic.On).updateValue(false);
			}, 2000);
		

        callback();
    },

    identify: function(callback) {
        callback();
    },

    getServices: function() {
        return [this.serviceInfo, this.service];
    }
};
