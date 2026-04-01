/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type { ambientPlatform } from 'homebridge-ambient-realtime/src/ambient_platform.js';

export class poolSensor {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
	){}
	createAccessory(device: any, uuid: string, poolSensor: PlatformAccessory, name: any) {
		const index: any = name.substring(name.length-1)*1;
		const temp = ((device.lastData[`temp${index}f`] - 32 + 0.01) * 5 / 9).toFixed(1) || 0;
		const batt = !device.lastData[`batt${index}`] || 0;  //1=OK, 0=Low

		if(!poolSensor){
			this.platform.log.info('Adding Pool sensor %s for %s', name, device.info.name);
			poolSensor = new this.platform.api.platformAccessory(`${device.info.name} ${name}`, uuid);
		} else{
			this.platform.log.debug('Update %s Pool sensor', `${device.info.name} ${name}`);
		}
		poolSensor.getService(this.platform.Service.AccessoryInformation)!
		  .setCharacteristic(this.platform.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.platform.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.platform.Characteristic.Model, 'WH31P');

		let tempSensor=poolSensor.getService(this.platform.Service.TemperatureSensor);
		if(!tempSensor){
			tempSensor = new this.platform.Service.TemperatureSensor(name);
		  poolSensor.addService(tempSensor);
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

		let batteryStatus=poolSensor.getService(this.platform.Service.Battery);
		if(device.lastData[`batt${index}`] !== undefined){
		  if(!batteryStatus){
		  batteryStatus = new this.platform.Service.Battery(name);
		  poolSensor.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus, name));
		  }
		  batteryStatus
		  .setCharacteristic(this.platform.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, batt);

		} else {
		  if(batteryStatus){
			 poolSensor.removeService(batteryStatus);
		  }
		}

		return poolSensor;
	}

	async getStatusTemp(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.platform.Characteristic.CurrentTemperature).value;
			return currentValue;
		}
	}

	async getStatusLowBattery(batteryStatus: Service, name: any): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.platform.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.platform.log.warn('Pool Sensor %s Battery Status Low', name);
			}
		}catch (error) {
			this.platform.log.error('caught low battery error');
		}
		return currentValue;
	}
}