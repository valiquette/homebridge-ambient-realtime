/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type ambientPlatform from '../ambient_platform.js';

export default class airSensor {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createAccessory(device: any, uuid: string, airSensorOut: PlatformAccessory) {
		const name ='Outdoor Air Quality';

		if(!airSensorOut){
			this.log.info('Adding outdoor air quality sensor for %s', device.info.name);
			airSensorOut = new this.platform.api.platformAccessory(`${device.info.name} ${name}`, uuid);
		} else{
			this.log.debug('Update %s PM25', `${device.info.name} ${name}`);
		}
		airSensorOut.getService(this.Service.AccessoryInformation)!
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.Characteristic.Model, 'PM25');

		let airSensor = airSensorOut.getService(this.Service.AirQualitySensor);
		if(!airSensor){
		  airSensor = new this.Service.AirQualitySensor(name);
		  airSensorOut.addService(airSensor);
		  airSensor.addCharacteristic(this.Characteristic.ConfiguredName);
		  airSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
		  airSensor
		    .getCharacteristic(this.Characteristic.AirQuality)
		    .onGet(this.getStatusAir.bind(this, airSensor));
		}

		let aqi=this.Characteristic.AirQuality.UNKNOWN;
		if(device.lastData.aqi_pm25_aqin >300) {
		  aqi=this.Characteristic.AirQuality.POOR;
		} else if(device.lastData.aqi_pm25_aqin >200) {
		  aqi=this.Characteristic.AirQuality.POOR;
		} else if(device.lastData.aqi_pm25_aqin >150) {
		  aqi=this.Characteristic.AirQuality.INFERIOR;
		} else if(device.lastData.aqi_pm25_aqin >100) {
		  aqi=this.Characteristic.AirQuality.FAIR;
		} else if(device.lastData.aqi_pm25_aqin >50) {
		  aqi=this.Characteristic.AirQuality.GOOD;
		} else if(device.lastData.aqi_pm25_aqin >0) {
		  aqi=this.Characteristic.AirQuality.EXCELLENT;
		}
		airSensor
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.Characteristic.AirQuality, aqi)
		  .setCharacteristic(this.Characteristic.PM2_5Density, device.lastData.pm25);

		let batteryStatus = airSensorOut.getService(this.Service.Battery);
		if(!batteryStatus){
		  batteryStatus = new this.Service.Battery(name);
		  airSensorOut.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus));
		}
		batteryStatus
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.StatusLowBattery, !device.lastData.batt_25)
			.setCharacteristic(this.Characteristic.ChargingState, this.Characteristic.ChargingState.NOT_CHARGEABLE)
			.setCharacteristic(this.Characteristic.BatteryLevel, (device.lastData.batt_25) * 100);


		return airSensorOut;
	}

	async getStatusAir(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.AirQuality).value;
			return currentValue;
		}
	}

	async getStatusLowBattery(batteryStatus: Service): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.log.warn('Air Sensor Battery Status Low');
			}
		}catch (error) {
			this.log.error('caught low battery error');
		}
		return currentValue;
	}
}