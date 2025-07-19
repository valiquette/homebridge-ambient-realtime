/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type { ambientPlatform } from '../ambient_platform.js';

export class motionSensor {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
	){}
	createAccessory(device: any, uuid: string, motionSensor: PlatformAccessory, newSensor: any) {
		const value = device.lastData[newSensor.dataPoint];
		const motion = value>newSensor.threshold ? true : false;

		if(!motionSensor){
			this.platform.log.info('Adding custom sensor for %s', device.info.name);
			motionSensor = new this.platform.api.platformAccessory(device.info.name, uuid);
		} else{
			this.platform.log.debug('update Accessory %s custom sensor', device.info.name);
		}
		motionSensor.getService(this.platform.Service.AccessoryInformation)!
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name)
		  .setCharacteristic(this.platform.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.platform.Characteristic.Model, 'WS')
		  .setCharacteristic(this.platform.Characteristic.ProductData, 'motion');

		let sensor=motionSensor.getService(this.platform.Service.MotionSensor);
		if(!sensor){
		  sensor = new this.platform.Service.MotionSensor(newSensor.name);
		  motionSensor.addService(sensor);
		  sensor.addCharacteristic(this.platform.Characteristic.ConfiguredName);
		  sensor.addCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel);
		  sensor.setCharacteristic(this.platform.Characteristic.ConfiguredName, device.info.name+' '+newSensor.name);
		  sensor
		    .getCharacteristic(this.platform.Characteristic.MotionDetected)
		    .onGet(this.getStatusMotion.bind(this, sensor));
		}
		sensor
		  .getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
		  .setProps({
		    minValue: 0,
		    maxValue: 10000,
		  });
		sensor
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+newSensor.name)
		  .setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.platform.Characteristic.MotionDetected, motion)
		  .setCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, value);
		return motionSensor;
	}

	async getStatusMotion(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.platform.Characteristic.MotionDetected).value;
			return currentValue;
		}
	}
}