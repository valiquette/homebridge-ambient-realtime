/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type { ambientPlatform } from '../ambient_platform.js';

export class leakSensor {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
	){}
	createAccessory(device: any, uuid: string, waterSensor: PlatformAccessory, name: any) {
		let index: any = name.substring(name.length-1)*1;
		if(!Number.isInteger(index)){
			index = 'in';
		}
		let leak = device.lastData[`leak${index}`];
		let active = true;
		const batt = device.lastData[`batleak${index}`]; //1=OK, 0=Low
		if(leak === 2){
			active = false;
			leak = 0;
		}

		if(!waterSensor){
			this.platform.log.info('Adding leak sensor for %s', device.info.name);
			waterSensor = new this.platform.api.platformAccessory(device.info.name, uuid);
		} else{
			this.platform.log.debug('update Accessory %s leak sensor', device.info.name);
		}
		waterSensor.getService(this.platform.Service.AccessoryInformation)!
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name)
		  .setCharacteristic(this.platform.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.platform.Characteristic.Model, 'WH31LA');

		let leakSensor=waterSensor.getService(this.platform.Service.TemperatureSensor);
		if(!leakSensor){
		  leakSensor = new this.platform.Service.LeakSensor(name);
		  waterSensor.addService(leakSensor);
		  leakSensor.addCharacteristic(this.platform.Characteristic.ConfiguredName);
		  leakSensor.setCharacteristic(this.platform.Characteristic.ConfiguredName, device.info.name+' '+name);
		  leakSensor
		    .getCharacteristic(this.platform.Characteristic.LeakDetected)
		    .onGet(this.getStatusLeak.bind(this, leakSensor));
		}
		leakSensor
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
		  .setCharacteristic(this.platform.Characteristic.StatusActive, active)
		  .setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
		  .setCharacteristic(this.platform.Characteristic.LeakDetected, leak);

		let batteryStatus=waterSensor.getService(this.platform.Service.Battery);
		if(!batteryStatus){
		  batteryStatus = new this.platform.Service.Battery(name);
		  waterSensor.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus));
		}
		batteryStatus
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
		  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, batt);

		return waterSensor;
	}

	async getStatusLeak(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.platform.Characteristic.LeakDetected).value;
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