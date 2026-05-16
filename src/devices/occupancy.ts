/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type ambientPlatform from '../ambient_platform.js';

export default class occupancySensor {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createAccessory(device: any, uuid: string, occupancySensor: PlatformAccessory, newSensor: any) {
		const value = device.lastData[newSensor.dataPoint];
		const occupancy = value>newSensor.threshold ? true : false;

		if(!occupancySensor){
			this.log.info('Adding custom sensor %s for %s', newSensor.name, device.info.name);
			occupancySensor = new this.platform.api.platformAccessory(`${device.info.name} ${newSensor.name}`, uuid);
		} else{
			this.log.debug('Update %s custom sensor %s for %s', device.info.name, newSensor.name, newSensor.dataPoint );
		}
		occupancySensor.getService(this.Service.AccessoryInformation)!
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${newSensor.name}`)
		  .setCharacteristic(this.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.Characteristic.Model, 'Custom-' + newSensor.name)
		  .setCharacteristic(this.Characteristic.ProductData, 'occupancy');

		let sensor = occupancySensor.getService(this.Service.OccupancySensor);
		if(!sensor){
		  sensor = new this.Service.OccupancySensor(newSensor.name);
		  occupancySensor.addService(sensor);
		  sensor.addCharacteristic(this.Characteristic.ConfiguredName);
		  sensor.addCharacteristic(this.Characteristic.CurrentAmbientLightLevel);
		  sensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${newSensor.name}`);
		}
		sensor
		  .getCharacteristic(this.Characteristic.CurrentAmbientLightLevel)
		  .setProps({
		    minValue: 0,
		    maxValue: 10000,
		  });
		sensor
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${newSensor.name}`)
		  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.Characteristic.OccupancyDetected, occupancy)
		  .setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, value);
		sensor
			.getCharacteristic(this.Characteristic.OccupancyDetected)
			.onGet(this.getStatusoccupancy.bind(this, sensor));

		if(newSensor.dataPointBatt !== undefined){
			let batteryStatus = occupancySensor.getService(this.Service.Battery);
			if(!batteryStatus){
				batteryStatus = new this.Service.Battery(newSensor.name);
				occupancySensor.addService(batteryStatus);
			}
			batteryStatus
				.setCharacteristic(this.Characteristic.Name, `${device.info.name} ${newSensor.name}`)
				.setCharacteristic(this.Characteristic.StatusLowBattery, device.lastData[newSensor.dataPointBatt])
				.setCharacteristic(this.Characteristic.ChargingState, this.Characteristic.ChargingState.NOT_CHARGEABLE)
				.setCharacteristic(this.Characteristic.BatteryLevel, Number(!device.lastData[newSensor.dataPointBatt]) * 100);
			batteryStatus
				.getCharacteristic(this.Characteristic.StatusLowBattery)
				.onGet(this.getStatusLowBattery.bind(this, batteryStatus, newSensor.name));
		}

		return occupancySensor;
	}

	async getStatusoccupancy(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.OccupancyDetected).value;
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