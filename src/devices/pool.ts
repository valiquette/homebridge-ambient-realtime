/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type ambientPlatform from '../ambient_platform.js';

export default class poolSensor {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createAccessory(device: any, uuid: string, poolSensor: PlatformAccessory, name: any) {
		const index: any = name.substring(name.length-1)*1;
		const temp = ((device.lastData[`temp${index}f`] - 32 + 0.01) * 5 / 9).toFixed(1) || 0;
		const batt = Number(!device.lastData[`batt${index}`]) || 0;  //1=OK, 0=Low

		if(!poolSensor){
			this.log.info('Adding Waterproof sensor %s for %s', name, device.info.name);
			poolSensor = new this.platform.api.platformAccessory(`${device.info.name} ${name}`, uuid);
		} else{
			this.log.debug('Update %s Waterproof sensor', `${device.info.name} ${name}`);
		}
		poolSensor.getService(this.Service.AccessoryInformation)!
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.Characteristic.Model, 'WH31P');

		let tempSensor = poolSensor.getService(this.Service.TemperatureSensor);
		if(!tempSensor){
			tempSensor = new this.Service.TemperatureSensor(name);
		  poolSensor.addService(tempSensor);
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

		let batteryStatus=poolSensor.getService(this.Service.Battery);
		if(device.lastData[`batt${index}`] !== undefined){
		  if(!batteryStatus){
		  batteryStatus = new this.Service.Battery(name);
		  poolSensor.addService(batteryStatus);

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
			 poolSensor.removeService(batteryStatus);
		  }
		}

		return poolSensor;
	}

	async getStatusTemp(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.CurrentTemperature).value;
			return currentValue;
		}
	}

	async getStatusLowBattery(batteryStatus: Service, name: any): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.log.warn('Waterproof Sensor %s Battery Status Low', name);
			}
		}catch (error) {
			this.log.error('caught low battery error');
		}
		return currentValue;
	}
}