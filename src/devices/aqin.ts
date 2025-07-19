/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CharacteristicValue, PlatformAccessory, Service, Characteristic } from 'homebridge';
import type { ambientPlatform } from '../ambient_platform.js';

export class aqinSensor {
	public readonly Service!: typeof Service;
	public readonly Characteristic!: typeof Characteristic;
	constructor(
		private readonly platform: ambientPlatform,
	){}
	createAccessory(device: any, uuid: string, aqinSensor: PlatformAccessory) {
		if(!aqinSensor){
			this.platform.log.info('Adding air quality sensor for %s', device.info.name);
			aqinSensor = new this.platform.api.platformAccessory(device.info.name, uuid);
		} else{
			this.platform.log.debug('update Accessory %s AQIN', device.info.name);
		}
		aqinSensor.getService(this.platform.Service.AccessoryInformation)!
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name)
		  .setCharacteristic(this.platform.Characteristic.Manufacturer,	this.platform.config.manufacturer ? this.platform.config.manufacturer : 'Ambient')
		  .setCharacteristic(this.platform.Characteristic.SerialNumber, device.macAddress)
		  .setCharacteristic(this.platform.Characteristic.Model, 'WS45');

		const name ='Indoor Air Quality';
		let tempSensor=aqinSensor.getService(this.platform.Service.TemperatureSensor);
		if(!tempSensor){
		  tempSensor = new this.platform.Service.TemperatureSensor(name);
		  aqinSensor.addService(tempSensor);
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
		  .setCharacteristic(this.platform.Characteristic.CurrentTemperature, ((device.lastData.pm_in_temp_aqin- 32 + .01) * 5 / 9).toFixed(1));

		let humSensor=aqinSensor.getService(this.platform.Service.HumiditySensor);
		if(!humSensor){
		  humSensor = new this.platform.Service.HumiditySensor(name);
		  aqinSensor.addService(humSensor);
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
		  .setCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, device.lastData.pm_in_humidity_aqin);

		let airSensor=aqinSensor.getService(this.platform.Service.AirQualitySensor);
		if(!airSensor){
		  airSensor = new this.platform.Service.AirQualitySensor(name);
		  aqinSensor.addService(airSensor);
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
		  .setCharacteristic(this.platform.Characteristic.PM10Density, device.lastData.pm10_in_aqin)
		  .setCharacteristic(this.platform.Characteristic.PM2_5Density, device.lastData.pm25_in_aqin);


		let co2Sensor=aqinSensor.getService(this.platform.Service.CarbonDioxideSensor);
		if(!co2Sensor){
		  co2Sensor = new this.platform.Service.CarbonDioxideSensor(name);
		  aqinSensor.addService(co2Sensor);
		  co2Sensor.addCharacteristic(this.platform.Characteristic.ConfiguredName);
		  co2Sensor.setCharacteristic(this.platform.Characteristic.ConfiguredName, device.info.name+' '+name);
		  co2Sensor
		    .getCharacteristic(this.platform.Characteristic.CarbonDioxideDetected)
		    .onGet(this.getStatusCo2.bind(this, co2Sensor));
		}

		let co2;
		if(device.lastData.co2_in_aqin > 1200){
		  co2=this.platform.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL;
		} else{
		  co2=this.platform.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL;
		}

		co2Sensor
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
		  .setCharacteristic(this.platform.Characteristic.StatusFault, this.platform.Characteristic.StatusFault.NO_FAULT)
		  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW)
		  .setCharacteristic(this.platform.Characteristic.CarbonDioxideDetected, co2)
		  .setCharacteristic(this.platform.Characteristic.CarbonDioxideLevel, device.lastData.co2_in_aqin)
		  .setCharacteristic(this.platform.Characteristic.CarbonDioxidePeakLevel, device.lastData.co2_in_24h_aqin);

		let batteryStatus=aqinSensor.getService(this.platform.Service.Battery);
		if(!batteryStatus){
		  batteryStatus = new this.platform.Service.Battery(name);
		  aqinSensor.addService(batteryStatus);

		  batteryStatus
		    .getCharacteristic(this.platform.Characteristic.StatusLowBattery)
		    .onGet(this.getStatusLowBattery.bind(this, batteryStatus));
		}
		batteryStatus
		  .setCharacteristic(this.platform.Characteristic.Name, device.info.name+' '+name)
		  .setCharacteristic(this.platform.Characteristic.StatusLowBattery, !device.lastData.batt_co2);

		return aqinSensor;
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

	async getStatusAir(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.platform.Characteristic.AirQuality).value;
			return currentValue;
		}
	}

	async getStatusCo2(sensorStatus: Service): Promise<CharacteristicValue> {
		if (sensorStatus.getCharacteristic(this.platform.Characteristic.StatusFault).value === this.platform.Characteristic.StatusFault.GENERAL_FAULT) {
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		} else {
			const currentValue: any = sensorStatus.getCharacteristic(this.platform.Characteristic.CarbonDioxideDetected).value;
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