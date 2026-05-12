/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type ambientPlatform from '../ambient_platform.js';

export default class leakSensor {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createAccessory(device: any, uuid: string, waterSensor: PlatformAccessory, name: any) {
		let index: any = name.substring(name.length-1)*1;
		if(!Number.isInteger(index)){
			index = 'in';
		}
		let leak = device.lastData[`leak${index}`];
		let active = true;
		const batt = Number(device.lastData[`batleak${index}`]); //1=OK, 0=Low
		if(leak === 2){
			active = false;
			leak = 0;
		}

		if(!waterSensor){
			this.log.info('Adding leak sensor %s for %s', name, device.info.name);
			waterSensor = new this.platform.api.platformAccessory(`${device.info.name} ${name}`, uuid);
		} else{
			this.log.debug('Update %s leak sensor', `${device.info.name} ${name}`);
		}
		waterSensor.getService(this.Service.AccessoryInformation)!
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.Characteristic.Model, 'WH31LA');

		let leakSensor = waterSensor.getService(this.Service.LeakSensor);
		if(!leakSensor){
		  leakSensor = new this.Service.LeakSensor(name);
		  waterSensor.addService(leakSensor);
		  leakSensor.addCharacteristic(this.Characteristic.ConfiguredName);
		  leakSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
		  leakSensor
		    .getCharacteristic(this.Characteristic.LeakDetected)
		    .onGet(this.getStatusLeak.bind(this, leakSensor));
		}
		leakSensor
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.StatusActive, active)
		  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.Characteristic.LeakDetected, leak);

		let batteryStatus = waterSensor.getService(this.Service.Battery);
		if(!batteryStatus){
		  batteryStatus = new this.Service.Battery(name);
		  waterSensor.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus, name));
		}
		batteryStatus
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.StatusLowBattery, batt)
			.setCharacteristic(this.Characteristic.ChargingState, this.Characteristic.ChargingState.NOT_CHARGEABLE)
			.setCharacteristic(this.Characteristic.BatteryLevel, Number(!batt) * 100);

		return waterSensor;
	}

	async getStatusLeak(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.LeakDetected).value;
			return currentValue;
		}
	}

	async getStatusLowBattery(batteryStatus: Service, name: any): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.log.warn('Leak Detector %s Battery Status Low', name);
			}
		}catch (error) {
			this.log.error('caught low battery error');
		}
		return currentValue;
	}
}