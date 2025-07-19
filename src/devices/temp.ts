/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type { ambientPlatform } from '../ambient_platform.js';

export class tempSensor {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
	){}
	createAccessory(device: any, uuid: string, indoorSensor: PlatformAccessory, name: any) {
		let index: any = name.substring(name.length-1)*1;
		if(!Number.isInteger(index)){
			index = 'in';
		}
		const temp = ((device.lastData[`temp${index}f`]- 32 + .01) * 5 / 9).toFixed(1);
		const humdidity = device.lastData[`humidity${index}`];
		const batt = !device.lastData[`batt${index}`];  //1=OK, 0=Low

		if(!indoorSensor){
			this.platform.log.info('Adding temp & humidity sensor for %s', device.info.name);
			indoorSensor = new this.platform.api.platformAccessory(device.info.name, uuid);
		} else{
			this.platform.log.debug('update Accessory %s temp & humidity sensor', device.info.name);
		}
		indoorSensor.getService(this.platform.Service.AccessoryInformation)!
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name)
		  .setCharacteristic(this.platform.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.platform.Characteristic.Model, 'WH32');

		let tempSensor=indoorSensor.getService(this.platform.Service.TemperatureSensor);
		if(!tempSensor){
		  tempSensor = new this.platform.Service.TemperatureSensor(name);
		  indoorSensor.addService(tempSensor);
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
		  .setCharacteristic(this.platform.Characteristic.CurrentTemperature, temp);

		let humSensor=indoorSensor.getService(this.platform.Service.HumiditySensor);
		if(!humSensor){
		  humSensor = new this.platform.Service.HumiditySensor(name);
		  indoorSensor.addService(humSensor);
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
		  .setCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, humdidity);

		let batteryStatus=indoorSensor.getService(this.platform.Service.Battery);
		if(device.lastData.battin !== undefined){
		  if(!batteryStatus){
		  batteryStatus = new this.platform.Service.Battery(name);
		  indoorSensor.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus));
		  }
		  batteryStatus
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
		  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, batt);

		} else {
		  if(batteryStatus){
			 indoorSensor.removeService(batteryStatus);
		  }
		}

		return indoorSensor;
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