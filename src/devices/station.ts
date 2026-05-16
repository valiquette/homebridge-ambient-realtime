/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type ambientPlatform from '../ambient_platform.js';

export default class station {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createAccessory(device: any, uuid: string, weatherStation: PlatformAccessory) {
		const name = 'Outdoor';
		 if(!weatherStation){
			this.log.info('Adding Outdoor sensors for %s', device.info.name);
			weatherStation = new this.platform.api.platformAccessory(`${device.info.name} ${name}`, uuid);
		} else{
			this.log.debug('Update %s Weather Station', `${device.info.name} ${name}`);
		}
			weatherStation.getService(this.Service.AccessoryInformation)!
			  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
			  .setCharacteristic(this.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
			  .setCharacteristic(this.Characteristic.SerialNumber, device.macAddress)
			  .setCharacteristic(this.Characteristic.Model, this.platform.config.station ? this.platform.config.station : 'WS');

			let tempSensor = weatherStation.getService(this.Service.TemperatureSensor);
			if(!tempSensor){
			  tempSensor = new this.Service.TemperatureSensor(name);
			  weatherStation.addService(tempSensor);
			  tempSensor.addCharacteristic(this.Characteristic.ConfiguredName);
			  tempSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
				/*
			  tempSensor
			    .getCharacteristic(this.Characteristic.CurrentTemperature)
			    .onGet(this.getStatusTemp.bind(this, tempSensor));
				*/
			}
			tempSensor
			  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
			  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
			  .setCharacteristic(this.Characteristic.CurrentTemperature, ((device.lastData.tempf- 32 + .01) * 5 / 9).toFixed(1));
			tempSensor
				.getCharacteristic(this.Characteristic.CurrentTemperature)
				.onGet(this.getStatusTemp.bind(this, tempSensor));

			let humSensor = weatherStation.getService(this.Service.HumiditySensor);
			if(!humSensor){
			  humSensor = new this.Service.HumiditySensor(name);
			  weatherStation.addService(humSensor);
			  humSensor.addCharacteristic(this.Characteristic.ConfiguredName);
			  humSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
			  humSensor
			    .getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
			    .onGet(this.getStatusHum.bind(this, humSensor));
			}

			humSensor
			  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
			  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
			  .setCharacteristic(this.Characteristic.CurrentRelativeHumidity, device.lastData.humidity);

			let batteryStatus = weatherStation.getService(this.Service.Battery);
			if(device.lastData.battout !== undefined){
			  if(!batteryStatus){
			    batteryStatus = new this.Service.Battery(name);
			    weatherStation.addService(batteryStatus);
			  }
			  batteryStatus
			    .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
			    .setCharacteristic(this.Characteristic.StatusLowBattery, !device.lastData.battout)
					.setCharacteristic(this.Characteristic.ChargingState, this.Characteristic.ChargingState.NOT_CHARGEABLE)
					.setCharacteristic(this.Characteristic.BatteryLevel, (device.lastData.battout) * 100);
				batteryStatus
					.getCharacteristic(this.Characteristic.StatusLowBattery)
					.onGet(this.getStatusLowBattery.bind(this, batteryStatus));
			} else {
			  if(batteryStatus){
			   weatherStation.removeService(batteryStatus);
			  }
			}

			return weatherStation;
	}

	async getStatusTemp(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.CurrentTemperature).value;
			return currentValue;
		}
	}

	async getStatusHum(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).value;
			return currentValue;
		}
	}

	 async getStatusLowBattery(batteryStatus: Service): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.log.warn('Station Battery Status Low');
			}
		}catch (error) {
			this.log.error('caught low battery error');
		}
		return currentValue;
	}
}


