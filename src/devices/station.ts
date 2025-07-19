/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type { ambientPlatform } from '../ambient_platform.js';

export class station {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
	){}
	createAccessory(device: any, uuid: string, weatherStation: PlatformAccessory) {
		 if(!weatherStation){
			this.platform.log.info('Adding Outdoor sensors for %s', device.info.name);
			weatherStation = new this.platform.api.platformAccessory(device.info.name, uuid);
		} else{
			this.platform.log.debug('update Accessory %s outdoor station', device.info.name);
		}
			weatherStation.getService(this.platform.Service.AccessoryInformation)!
			  .setCharacteristic(this.platform.Characteristic.Name, device.info.name)
			  .setCharacteristic(this.platform.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
			  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.macAddress)
			  .setCharacteristic(this.platform.Characteristic.Model, this.platform.config.station ? this.platform.config.station : 'WS4000');

			const name = 'Outdoor';
			let tempSensor = weatherStation.getService(this.platform.Service.TemperatureSensor);
			if(!tempSensor){
			  tempSensor = new this.platform.Service.TemperatureSensor(name);
			  weatherStation.addService(tempSensor);
			  tempSensor.addCharacteristic(this.platform.Characteristic.ConfiguredName);
			  tempSensor.setCharacteristic(this.platform.Characteristic.ConfiguredName, device.info.name+' '+name);
			  tempSensor
			    .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
			    .onGet(this.getStatusTemp.bind(this, tempSensor));
			}
			tempSensor
			  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
			  .setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
			  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
			  .setCharacteristic(this.platform.Characteristic.CurrentTemperature, ((device.lastData.tempf- 32 + .01) * 5 / 9).toFixed(1));

			let humSensor = weatherStation.getService(this.platform.Service.HumiditySensor);
			if(!humSensor){
			  humSensor = new this.platform.Service.HumiditySensor(name);
			  weatherStation.addService(humSensor);
			  humSensor.addCharacteristic(this.platform.Characteristic.ConfiguredName);
			  humSensor.setCharacteristic(this.platform.Characteristic.ConfiguredName, device.info.name+' '+name);
			  humSensor
			    .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
			    .onGet(this.getStatusHum.bind(this, humSensor));
			}

			humSensor
			  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
			  .setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
			  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
			  .setCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, device.lastData.humidity);

			let batteryStatus = weatherStation.getService(this.platform.Service.Battery);
			if(device.lastData.battout !== undefined){
			  if(!batteryStatus){
			    batteryStatus = new this.platform.Service.Battery(name);
			    weatherStation.addService(batteryStatus);

			    batteryStatus
			      .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
			      .onGet(this.getStatusLowBattery.bind(this, batteryStatus));
			  }
			  batteryStatus
			    .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
			    .setCharacteristic(this.platform.Characteristic.StatusLowBattery, !device.lastData.battout);

			} else {
			  if(batteryStatus){
			   weatherStation.removeService(batteryStatus);
			  }
			}

			return weatherStation;
	}

	async getStatusTemp(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value;
			return currentValue;
		}
	}

	async getStatusHum(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity).value;
			return currentValue;
		}
	}

	 async getStatusLowBattery(batteryStatus: Service): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.platform.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.platform.log.warn('Battery Status Low');
			}
		}catch (error) {
			this.platform.log.error('caught low battery error');
		}
		return currentValue;
	}
}


