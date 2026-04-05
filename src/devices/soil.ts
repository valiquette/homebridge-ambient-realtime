/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type { ambientPlatform } from '../ambient_platform.js';

export class soilSensor {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
	){}
	createAccessory(device: any, uuid: string, soilSensor: PlatformAccessory, name: any) {
		const index: any = name.substring(name.length-1)*1;

		const temp = ((device.lastData[`soiltemp${index}f`] - 32 + 0.01) * 5 / 9).toFixed(1) || 0;
		const humidity = device.lastData[`soilhum${index}`] || 0;
		const batt = Number(!device.lastData[`battsm${index}`]) || 0;  //1=OK, 0=Low

		if(!soilSensor){
			this.platform.log.info('Adding Soil Temp & Humidity sensor %s for %s', name, device.info.name);
			soilSensor = new this.platform.api.platformAccessory(`${device.info.name} ${name}`, uuid);
		} else{
			this.platform.log.debug('Update %s Soil Temp & Humidity sensor', `${device.info.name} ${name}`);
		}
		soilSensor.getService(this.platform.Service.AccessoryInformation)!
		  .setCharacteristic(this.platform.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.platform.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.platform.Characteristic.Model, 'WH31SM');

		if(device.lastData[`soiltemp${index}f`]){
			let tempSensor=soilSensor.getService(this.platform.Service.TemperatureSensor);
			if(!tempSensor){
				tempSensor = new this.platform.Service.TemperatureSensor(name);
				soilSensor.addService(tempSensor);
				tempSensor.addCharacteristic(this.platform.Characteristic.ConfiguredName);
				tempSensor.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
				tempSensor
					.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
					.onGet(this.getStatusTemp.bind(this, tempSensor));
			}
			tempSensor
				.setCharacteristic(this.platform.Characteristic.Name, `${device.info.name} ${name}`)
				.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
				.setCharacteristic(this.platform.Characteristic.StatusLowBattery, this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
				.setCharacteristic(this.platform.Characteristic.CurrentTemperature, temp);
		}

		if(device.lastData[`soilhum${index}`]){
			let humSensor=soilSensor.getService(this.platform.Service.HumiditySensor);
			if(!humSensor){
				humSensor = new this.platform.Service.HumiditySensor(name);
				soilSensor.addService(humSensor);
				humSensor.addCharacteristic(this.platform.Characteristic.ConfiguredName);
				humSensor.setCharacteristic(this.platform.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
				humSensor
					.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
					.onGet(this.getStatusHum.bind(this, humSensor));
			}
			humSensor
				.setCharacteristic(this.platform.Characteristic.Name, `${device.info.name} ${name}`)
				.setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
				.setCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humidity);
		}

		let batteryStatus = soilSensor.getService(this.platform.Service.Battery);
		if(device.lastData[`batt${index}`] !== undefined){
		  if(!batteryStatus){
		  batteryStatus = new this.platform.Service.Battery(name);
		  soilSensor.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus, name));
		  }
		  batteryStatus
				.setCharacteristic(this.platform.Characteristic.Name, `${device.info.name} ${name}`)
				.setCharacteristic(this.platform.Characteristic.StatusLowBattery, batt)
				.setCharacteristic(this.platform.Characteristic.ChargingState, this.platform.Characteristic.ChargingState.NOT_CHARGEABLE)
				.setCharacteristic(this.platform.Characteristic.BatteryLevel, batt * 100);

		} else {
		  if(batteryStatus){
			 soilSensor.removeService(batteryStatus);
		  }
		}

		return soilSensor;
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

	async getStatusLowBattery(batteryStatus: Service, name: any): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.platform.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.platform.log.warn('Soil Sensor %s Battery Status Low', name);
			}
		}catch (error) {
			this.platform.log.error('caught low battery error');
		}
		return currentValue;
	}
}