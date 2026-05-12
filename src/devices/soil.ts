/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type ambientPlatform from '../ambient_platform.js';

export default class soilSensor {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createAccessory(device: any, uuid: string, soilSensor: PlatformAccessory, name: any) {
		const index: any = name.substring(name.length-1)*1;

		const temp = ((device.lastData[`soiltemp${index}f`] - 32 + 0.01) * 5 / 9).toFixed(1) || 0;
		const humidity = device.lastData[`soilhum${index}`] || 0;
		const batt = Number(!device.lastData[`battsm${index}`]) || 0;  //1=OK, 0=Low

		if(!soilSensor){
			this.log.info('Adding Soil Temp & Humidity sensor %s for %s', name, device.info.name);
			soilSensor = new this.platform.api.platformAccessory(`${device.info.name} ${name}`, uuid);
		} else{
			this.log.debug('Update %s Soil Temp & Humidity sensor', `${device.info.name} ${name}`);
		}
		soilSensor.getService(this.Service.AccessoryInformation)!
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.Characteristic.Model, 'WH31SM');

		if(device.lastData[`soiltemp${index}f`]){
			let tempSensor=soilSensor.getService(this.Service.TemperatureSensor);
			if(!tempSensor){
				tempSensor = new this.Service.TemperatureSensor(name);
				soilSensor.addService(tempSensor);
				tempSensor.addCharacteristic(this.Characteristic.ConfiguredName);
				tempSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
				tempSensor
					.getCharacteristic(this.Characteristic.CurrentTemperature)
					.onGet(this.getStatusTemp.bind(this, tempSensor));
			}
			tempSensor
				.setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
				.setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
				.setCharacteristic(this.Characteristic.StatusLowBattery, this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
				.setCharacteristic(this.Characteristic.CurrentTemperature, temp);
		}

		if(device.lastData[`soilhum${index}`]){
			let humSensor=soilSensor.getService(this.Service.HumiditySensor);
			if(!humSensor){
				humSensor = new this.Service.HumiditySensor(name);
				soilSensor.addService(humSensor);
				humSensor.addCharacteristic(this.Characteristic.ConfiguredName);
				humSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
				humSensor
					.getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
					.onGet(this.getStatusHum.bind(this, humSensor));
			}
			humSensor
				.setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
				.setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
				.setCharacteristic(this.Characteristic.CurrentRelativeHumidity, humidity);
		}

		let batteryStatus = soilSensor.getService(this.Service.Battery);
		if(device.lastData[`batt${index}`] !== undefined){
		  if(!batteryStatus){
		  batteryStatus = new this.Service.Battery(name);
		  soilSensor.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus, name));
		  }
		  batteryStatus
				.setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
				.setCharacteristic(this.Characteristic.StatusLowBattery, batt)
				.setCharacteristic(this.Characteristic.ChargingState, this.Characteristic.ChargingState.NOT_CHARGEABLE)
				.setCharacteristic(this.Characteristic.BatteryLevel, batt * 100);

		} else {
		  if(batteryStatus){
			 soilSensor.removeService(batteryStatus);
		  }
		}

		return soilSensor;
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

	async getStatusLowBattery(batteryStatus: Service, name: any): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.log.warn('Soil Sensor %s Battery Status Low', name);
			}
		}catch (error) {
			this.log.error('caught low battery error');
		}
		return currentValue;
	}
}