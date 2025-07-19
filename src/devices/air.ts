/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type { ambientPlatform } from '../ambient_platform.js';

export class airSensor {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
	){}
	createAccessory(device: any, uuid: string, airSensorX: PlatformAccessory, type: any) {
		let name ='Outdoor Air Quality';
		let pm ='pm25';
		let batt: any =!device.lastData.batt_25;

		if(type === 'in'){
			name ='Indoor Air Quality';
			pm='pm25_in';
			batt=0;
		}
		if(!airSensorX){
			this.platform.log.info('Adding air quality sensor for %s', device.info.name);
			airSensorX = new this.platform.api.platformAccessory(device.info.name, uuid);
		} else{
			this.platform.log.debug('update Accessory %s AQIN', device.info.name);
		}
		airSensorX.getService(this.platform.Service.AccessoryInformation)!
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name)
		  .setCharacteristic(this.platform.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.platform.Characteristic.Model, 'WS45');

		let airSensor=airSensorX.getService(this.platform.Service.AirQualitySensor);
		if(!airSensor){
		  airSensor = new this.platform.Service.AirQualitySensor(name);
		  airSensorX.addService(airSensor);
		  airSensor.addCharacteristic(this.platform.Characteristic.ConfiguredName);
		  airSensor.setCharacteristic(this.platform.Characteristic.ConfiguredName, device.info.name+' '+name);
		  airSensor
		    .getCharacteristic(this.platform.Characteristic.AirQuality)
		    .onGet(this.getStatusAir.bind(this, airSensor));
		}

		let aqi=this.platform.Characteristic.AirQuality.UNKNOWN;
		if(device.lastData.aqi_pm25_aqin >300) {
		  aqi=this.platform.Characteristic.AirQuality.POOR;
		} else if(device.lastData.aqi_pm25_aqin >200) {
		  aqi=this.platform.Characteristic.AirQuality.POOR;
		} else if(device.lastData.aqi_pm25_aqin >150) {
		  aqi=this.platform.Characteristic.AirQuality.INFERIOR;
		} else if(device.lastData.aqi_pm25_aqin >100) {
		  aqi=this.platform.Characteristic.AirQuality.FAIR;
		} else if(device.lastData.aqi_pm25_aqin >50) {
		  aqi=this.platform.Characteristic.AirQuality.GOOD;
		} else if(device.lastData.aqi_pm25_aqin >0) {
		  aqi=this.platform.Characteristic.AirQuality.EXCELLENT;
		}
		airSensor
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
		  .setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL)
		  .setCharacteristic(this.platform.Characteristic.AirQuality, aqi)
		  .setCharacteristic(this.platform.Characteristic.PM2_5Density, device.lastData[pm]);

		let batteryStatus=airSensorX.getService(this.platform.Service.Battery);
		if(!batteryStatus){
		  batteryStatus = new this.platform.Service.Battery(name);
		  airSensorX.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus));
		}
		batteryStatus
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
		  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, batt);

		return airSensorX;
	}

	async getStatusAir(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.platform.Characteristic.AirQuality).value;
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