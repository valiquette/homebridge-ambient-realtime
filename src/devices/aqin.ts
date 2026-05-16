/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type ambientPlatform from '../ambient_platform.js';

export default class aqinSensor {
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
		private log = platform.log,
	) {
		this.Service = platform.Service;
		this.Characteristic = platform.Characteristic;
	}

	createAccessory(device: any, uuid: string, aqinSensor: PlatformAccessory) {
		const name ='Indoor Air Quality';
		if(!aqinSensor){
			this.log.info('Adding air quality sensor for %s', device.info.name);
			aqinSensor = new this.platform.api.platformAccessory(`${device.info.name} ${name}`, uuid);
		} else{
			this.log.debug('Update %s AQIN', `${device.info.name} ${name}`);
		}
		aqinSensor.getService(this.Service.AccessoryInformation)!
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.Characteristic.Model, 'AQIN');

		let tempSensor = aqinSensor.getService(this.Service.TemperatureSensor);
		if(!tempSensor){
		  tempSensor = new this.Service.TemperatureSensor(name);
		  aqinSensor.addService(tempSensor);
		  tempSensor.addCharacteristic(this.Characteristic.ConfiguredName);
		  tempSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
		}
		tempSensor
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.Characteristic.CurrentTemperature, ((device.lastData.pm_in_temp_aqin- 32 + .01) * 5 / 9).toFixed(1));
	  tempSensor
			.getCharacteristic(this.Characteristic.CurrentTemperature)
			.onGet(this.getStatusTemp.bind(this, tempSensor));

		let humSensor = aqinSensor.getService(this.Service.HumiditySensor);
		if(!humSensor){
		  humSensor = new this.Service.HumiditySensor(name);
		  aqinSensor.addService(humSensor);
		  humSensor.addCharacteristic(this.Characteristic.ConfiguredName);
		  humSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
		}

		humSensor
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.Characteristic.CurrentRelativeHumidity, device.lastData.pm_in_humidity_aqin);
		humSensor
			.getCharacteristic(this.Characteristic.CurrentRelativeHumidity)
			.onGet(this.getStatusHum.bind(this, humSensor));

		let airSensor = aqinSensor.getService(this.Service.AirQualitySensor);
		if(!airSensor){
		  airSensor = new this.Service.AirQualitySensor(name);
		  aqinSensor.addService(airSensor);
		  airSensor.addCharacteristic(this.Characteristic.ConfiguredName);
		  airSensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
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
		  .setCharacteristic(this.Characteristic.PM10Density, device.lastData.pm10_in_aqin)
		  .setCharacteristic(this.Characteristic.PM2_5Density, device.lastData.pm25_in_aqin);
		airSensor
			.getCharacteristic(this.Characteristic.AirQuality)
			.onGet(this.getStatusAir.bind(this, airSensor));


		let co2Sensor=aqinSensor.getService(this.Service.CarbonDioxideSensor);
		if(!co2Sensor){
		  co2Sensor = new this.Service.CarbonDioxideSensor(name);
		  aqinSensor.addService(co2Sensor);
		  co2Sensor.addCharacteristic(this.Characteristic.ConfiguredName);
		  co2Sensor.setCharacteristic(this.Characteristic.ConfiguredName, `${device.info.name} ${name}`);
		}

		let co2;
		if(device.lastData.co2_in_aqin > 1200){
		  co2=this.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL;
		} else{
		  co2=this.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;
		}

		co2Sensor
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.StatusFault, this.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.Characteristic.CarbonDioxideDetected, co2)
		  .setCharacteristic(this.Characteristic.CarbonDioxideLevel, device.lastData.co2_in_aqin)
		  .setCharacteristic(this.Characteristic.CarbonDioxidePeakLevel, device.lastData.co2_in_24h_aqin);
		co2Sensor
			.getCharacteristic(this.Characteristic.CarbonDioxideDetected)
			.onGet(this.getStatusCo2.bind(this, co2Sensor));

		let batteryStatus = aqinSensor.getService(this.Service.Battery);
		if(!batteryStatus){
		  batteryStatus = new this.Service.Battery(name);
		  aqinSensor.addService(batteryStatus);
		}
		batteryStatus
		  .setCharacteristic(this.Characteristic.Name, `${device.info.name} ${name}`)
		  .setCharacteristic(this.Characteristic.StatusLowBattery, !device.lastData.batt_co2)
			.setCharacteristic(this.Characteristic.ChargingState, this.Characteristic.ChargingState.NOT_CHARGEABLE)
			.setCharacteristic(this.Characteristic.BatteryLevel, (device.lastData.batt_co2) * 100);
		batteryStatus
			.getCharacteristic(this.Characteristic.StatusLowBattery)
			.onGet(this.getStatusLowBattery.bind(this, batteryStatus));

		return aqinSensor;
	}

	async getStatusTemp(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.CurrentTemperature).value;
			return currentValue;
		}
	}

	async getStatusHum(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).value;
			return currentValue;
		}
	}

	async getStatusAir(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.AirQuality).value;
			return currentValue;
		}
	}

	async getStatusCo2(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.Characteristic.StatusFault).value === this.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.HapStatusError(this.platform.HapStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.Characteristic.CarbonDioxideDetected).value;
			return currentValue;
		}
	}

	async getStatusLowBattery(batteryStatus: Service): Promise<CharacteristicValue> {
		let currentValue: any = 0;
		try{
			currentValue = batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).value;
			if (currentValue === 1) {
				this.log.warn('AQIN Battery Status Low');
			}
		}catch (error) {
			this.log.error('caught low battery error');
		}
		return currentValue;
	}
}