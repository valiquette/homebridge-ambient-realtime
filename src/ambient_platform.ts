/* eslint-disable @typescript-eslint/no-explicit-any */
import { API, Characteristic, DynamicPlatformPlugin, HAPStatus, HapStatusError, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import station from './devices/station.js';
import tempSensor from './devices/temp.js';
import poolSensor from './devices/pool.js';
import soilSensor from './devices/soil.js';
import aqinSensor from './devices/aqin.js';
import airSensor from './devices/air.js';
import airSensorIn from './devices/air_in.js';
import leakSensor from './devices/leak.js';
import motionSensor from './devices/motion.js';
import occupancySensor from './devices/occupancy.js';

import { io } from 'socket.io-client';

//import { sampleData } from './sample.js'; //for testing

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */

export default class ambientPlatform implements DynamicPlatformPlugin {
	[x: string]: any;
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;
	public readonly HAPStatus!: typeof HAPStatus;
	public readonly HapStatusError: typeof HapStatusError;
	public readonly accessories: PlatformAccessory[] = [];

	constructor(
		public readonly log: Logging,
		public readonly config: PlatformConfig,
		public readonly api: API,
	) {
		this.Service = api.hap.Service;
		this.Characteristic = api.hap.Characteristic;
		this.HapStatusError = api.hap.HapStatusError;
		this.genUUID = api.hap.uuid.generate;

		this.log.debug(`Finished initializing platform: ${config.name}`);

		this.timeStamp = new Date();
		this.macAddress = [];
		this.reconnected = false;
		this.endpoint = 'https://rt2.ambientweather.net';
		this.api_key = config.api_key;
		this.api_app_key = config.api_app_key;
		this.showOutdoor = config.showOutdoor;
		this.showIndoor = config.showIndoor;
		this.showAqin = config.showAqin;
		this.showAirIn = config.showIndoorAir;
		this.showAirOut = config.showOutdoorAir;
		this.customSensor = config.sensors;
		this.showOtherTemp = config.showOtherTemp;
		this.showSoil = config.showSoil;
		this.showLeak = config.showLeak;
		this.maxLeak = config.maxLeak ? config.maxLeak : 4;
		this.maxTemp = config.maxTemp ? config.maxTemp : 8;
		this.maxSoil = config.maxSoil ? config.maxSoil : 8;
		this.showSocketData = config.showSocketData ? config.showSocketData : false;

		this.weatherStation = null;
		this.locationAddress = config.locationAddress;
		if (!config.api_key || !config.api_app_key) {
			this.log.error('Valid API keys are required, please check the plugin config');
			return;
		}
		this.log.info(`Starting Ambient platform using homebridge API ${api.version}`);

		api.on('didFinishLaunching', () => {
			log.debug('Executed didFinishLaunching callback');
			this.connectAPI();
		});
	}

	//**
	//** REQUIRED - Homebridge will call the 'configureAccessory' method once for every cached accessory restored
	//**

	configureAccessory(accessory: PlatformAccessory) {
		// Added cached devices to the accessories array
		this.log.debug(`Found cached accessory ${accessory.displayName} with ${accessory.services}`);
		this.accessories.push(accessory);
	}

	identify() {
		this.log.info('Identify ambient');
	}

	//https://ambientweather.docs.apiary.io/#

	connectAPI() {
		const socket = io(this.endpoint, {
			transports: ['websocket'],
			query: {
				api: 1,
				applicationKey: this.api_app_key,
			},
		},
		);
		this.log.info('connecting...');

		socket.on('connect', () => {
			this.log.info(`Opened Socket id ${socket.id}`);
			this.log.info('Connected to Ambient Weather');
			this.log.info('Subscribing to Ambient Weather Realtime API...');
			socket.emit('subscribe', { apiKeys: [this.api_key] });
		});

		socket.on('reconnect', (attempt) => {
			this.log.info('recovered', socket.recovered);
		  this.log.debug('reconnected on attempt', attempt);
		});

		socket.on('reconnect_attempt', (attempt) => {
		  this.log.debug('reconnecting attempt', attempt);
		});

		socket.on('disconnect', (msg) => {
			this.log.info(`Disconected from Ambient Weather, ${msg}`);
			this.log.debug(`Socket id ${socket.id} closed`);
			this.log.warn(`Weather Station offline at ${ new Date().toLocaleString()}! Sensors will show as non-responding in Homekit until the connection is restored.`);
			this.updatefault();
		});

		socket.on('subscribed', (data) => {
			//this.log.debug('subscribed',JSON.stringify(data,null,2));
			this.log.debug(`Subscribed to ${data.devices.length} device(s)`);
			data.devices.forEach((device: { info: { name: any; }; }) => {
				this.log.success(`Subscribed to Ambient Weather Realtime API updates for ${device.info.name}`);
			});
			this.addAccessory(data.devices);
		});

		socket.on('data', (data) => {
			this.log.debug('data',JSON.stringify(data,null,2));
			if (this.showSocketData) {
				this.log.debug(`data recieved ${data.date} current outdoor temp ${data.tempf}°F humidity ${data.humidity} battery ${data.battout ? 'good' : 'bad'}`);
			}
			//**** Testing *****//
			//data = new sampleData().getData();
			//this.log.info(`test data ${data.date} current outdoor temp ${data.tempf}°F humidity ${data.humidity} battery ${data.battout ? 'good' : 'bad'}`);
			//**** Testing *****//
		});

		socket.on('connect_error', (err) => {
			this.log.error ('connect error', err.message);
			this.log.debug('connect error', JSON.stringify(err,null,2));
		});

		socket.onAny((eventName, data) => {
			switch (eventName) {
			case 'subscribed':
				break;
			case 'data':
				break;
			default:
				this.log.warn ('unknown event - onAny', eventName);
				this.log.warn(JSON.stringify(data,null,2));
				break;
			}
		});
	}

	addAccessory(devices: any[]) {
		let uuid: any;
		let index: any;
		let accessory: PlatformAccessory;

		try {
			devices.forEach((device: any) => {
				if (this.locationAddress === device.info.coords.address.split(',')[0] || this.locationAddress == null) {
					this.log.info(`Found a match for configured location ${device.info.coords.address.split(',')[0]}`);
					this.macAddress.push(device.macAddress);

					//**** Testing *****//
					//device.lastData = new sampleData().getData();
					//**** Testing *****//
					if (!this.reconnected) {
						this.reconnected = true;
						this.log.info('initial data from subscribed event', JSON.stringify(device.lastData, null, 2));
					};
					if (this.showOutdoor && device.lastData.tempf) {
						uuid = this.genUUID(`${device.macAddress}station`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (!this.accessories[index]) {
							this.log.debug('Registering platform accessory station');
							accessory = new station(this).createAccessory(device, uuid, this.accessories[index]);
							this.accessories.push(accessory);
							this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
						} else {
							accessory = new station(this).createAccessory(device, uuid, this.accessories[index]);
						}
					} else {
						uuid = this.genUUID(`${device.macAddress}station`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.accessories[index]) {
							this.log.debug('Removed cached device', index);
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
							this.accessories.splice(index, 1);
						}
					}

					if (this.showIndoor && device.lastData.tempinf) {
						uuid = this.genUUID(`${device.macAddress}indoor`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (!this.accessories[index]) {
							this.log.debug('Registering platform accessory temp');
							accessory = new tempSensor(this).createAccessory(device, uuid, this.accessories[index], 'indoor');
							this.accessories.push(accessory);
							this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
						} else {
							accessory = new tempSensor(this).createAccessory(device, uuid, this.accessories[index], 'indoor');
						}
					} else {
						if (this.showIndoor) {
							this.log.info('Skipping indoor, sensor not found');
						}
						uuid = this.genUUID(`${device.macAddress}indoor`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.accessories[index]) {
							this.log.debug('Removed cached device indoor', index);
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
							this.accessories.splice(index, 1);
						}
					}

					if (this.showAqin && device.lastData.co2_in_aqin) {
						uuid = this.genUUID(`${device.macAddress}aqin`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (!this.accessories[index]) {
							this.log.debug('Registering platform accessory aqin');
							accessory = new aqinSensor(this).createAccessory(device, uuid, this.accessories[index]);
							this.accessories.push(accessory);
							this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
						} else {
							accessory = new aqinSensor(this).createAccessory(device, uuid, this.accessories[index]);
						}
					} else {
						if (this.showAqin) {
							this.log.info('Skipping aqin, sensor not found');
						}
						uuid = this.genUUID(`${device.macAddress}aqin`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.accessories[index]) {
							this.log.debug(`Removed cached device aqin index ${index}`);
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
							this.accessories.splice(index, 1);
						}
					}
					if (this.showAirIn && device.lastData.pm25_in) {
						uuid = this.genUUID(`${device.macAddress}air_in`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (!this.accessories[index]) {
							this.log.debug('Registering platform accessory indoor air');
							accessory = new airSensorIn(this).createAccessory(device, uuid, this.accessories[index]);
							this.accessories.push(accessory);
							this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
						} else {
							accessory = new airSensorIn(this).createAccessory(device, uuid, this.accessories[index]);
						}
					} else {
						if (this.showAirIn) {
							this.log.info('Skipping indoor air sensor not found');
						}
						uuid = this.genUUID(`${device.macAddress}air_in`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.accessories[index]) {
							this.log.debug('Removed cached device aqin', index);
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
							this.accessories.splice(index, 1);
						}
					}

					if (this.showAirOut && device.lastData.pm25) {
						uuid = this.genUUID(`${device.macAddress}air_out`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (!this.accessories[index]) {
							this.log.debug('Registering platform accessory outdoor air');
							accessory = new airSensor(this).createAccessory(device, uuid, this.accessories[index]);
							this.accessories.push(accessory);
							this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
						} else {
							accessory = new airSensor(this).createAccessory(device, uuid, this.accessories[index]);
						}
					} else {
						if (this.showAirOut) {
							this.log.info('Skipping outdoor air sensor not found');
						}
						uuid = this.genUUID(`${device.macAddress}air_out`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.accessories[index]) {
							this.log.debug('Removed cached device aqin', index);
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
							this.accessories.splice(index, 1);
						}
					}

					for (let n = 1; n <= this.maxTemp; n++) {
						uuid = this.genUUID(`${device.macAddress}temp${n}`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.showOtherTemp) {
							if (device.lastData[`temp${n}f`] && device.lastData[`humidity${n}`]) {
								if (!this.accessories[index]) {
									this.log.debug(`Registering platform accessory temp${index}`);
									accessory = new tempSensor(this).createAccessory(device, uuid, this.accessories[index], `temp${n}`);
									this.accessories.push(accessory);
									this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
								} else {
									accessory = new tempSensor(this).createAccessory(device, uuid, this.accessories[index], `temp${n}`);
								}
							} else if (device.lastData[`temp${n}f`] && !device.lastData[`humidity${n}`]) {
								if (!this.accessories[index]) {
									this.log.debug(`Registering platform accessory temp${index}`);
									accessory = new poolSensor(this).createAccessory(device, uuid, this.accessories[index], `temp${n}`);
									this.accessories.push(accessory);
									this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
								} else {
									accessory = new poolSensor(this).createAccessory(device, uuid, this.accessories[index], `temp${n}`);
								}
							} else {
								this.log.debug(`Skipping temp${n}, sensor not found`);
							}
						} else if (this.accessories[index]) {
							this.log.debug(`Removed cached device temp${n}`);
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
							this.accessories.splice(index, 1);
						}
					}

					for (let n = 1; n <= this.maxSoil; n++) {
						uuid = this.genUUID(`${device.macAddress}soil${n}`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.showSoil) {
							//if (device.lastData[`soiltemp${n}f`] && device.lastData[`soilhum${n}`]) {
							if (device.lastData[`soilhum${n}`]) {
								if (!this.accessories[index]) {
									this.log.debug(`Registering platform accessory soil${index}`);
									accessory = new soilSensor(this).createAccessory(device, uuid, this.accessories[index], `soil${n}`);
									this.accessories.push(accessory);
									this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
								} else {
									accessory = new soilSensor(this).createAccessory(device, uuid, this.accessories[index], `soil${n}`);
								}
							} else {
								this.log.debug(`Skipping soil${n}, sensor not found`);
							}
						} else if (this.accessories[index]) {
							this.log.debug(`Removed cached device soil${n}`);
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
							this.accessories.splice(index, 1);
						}
					}

					for (let n = 1; n <= this.maxLeak; n++) {
						uuid = this.genUUID(`${device.macAddress}leak${n}`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.showLeak) {
							if (device.lastData[`leak${n}`] != null) {
								if (!this.accessories[index]) {
									this.log.debug(`Registering platform accessory leak${n}`);
									accessory = new leakSensor(this).createAccessory(device, uuid, this.accessories[index], `leak${n}`);
									this.accessories.push(accessory);
									this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
								} else {
									accessory = new leakSensor(this).createAccessory(device, uuid, this.accessories[index], `leak${n}`);
								}
							} else {
								this.log.debug(`Skipping leak${n}, sensor not found`);
							}
						} else if (this.accessories[index]) {
							this.log.debug(`Removed cached device leak${n}`);
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
							this.accessories.splice(index, 1);
						}
					}


					if (Array.isArray(this.customSensor)) {
						this.customSensor.forEach((sensor: any, idx: any) => {
							if (device.lastData[sensor.dataPoint] != null) {
								uuid = this.genUUID(`${device.macAddress}${sensor.name}`);
								index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
								if (this.accessories[index]) {
									const checkType: any = this.accessories[index].getService(this.Service.AccessoryInformation)!
										.getCharacteristic(this.Characteristic.ProductData);
									if ((checkType.value === 'motion' && sensor.type === 1) || (checkType.value === 'occupancy' && sensor.type === 0)) {
										this.log.warn('Changing sensor between Motion and Occupancy, check room assignments in Homekit');
										this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
										this.accessories.splice(index, 1);
									}
								}
								if (!this.accessories[index]) {
									this.log.debug('Registering platform accessory');
									switch (sensor.type) {
									case 0: accessory = new motionSensor(this).createAccessory(device, uuid, this.accessories[index], sensor); break;
									case 1: accessory = new occupancySensor(this).createAccessory(device, uuid, this.accessories[index], sensor); break;
									}
									this.accessories.push(accessory);
									this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
								} else {
									switch (sensor.type) {
									case 0: accessory = new motionSensor(this).createAccessory(device, uuid, this.accessories[index], sensor); break;
									case 1: accessory = new occupancySensor(this).createAccessory(device, uuid, this.accessories[index], sensor); break;
									}
								}
							} else {
								this.log.info(`Skipping sensor ${sensor.name} not found`);
								uuid = this.genUUID(`${device.macAddress}${sensor.name}`);
								index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
								this.customSensor.splice(idx,1); //remove from custom array
								if (this.accessories[index]) {
									this.log.debug('Removed cached device', index);
									this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
									this.accessories.splice(index, 1);
								}
							}
						});
					}
				} else {
					this.log.info(`Skipping location ${device.info.coords.address.split(',')[0]} does not match configured location ${this.locationAddress}`);
				}
				device.lastData.macAddress = device.macAddress;
				this.updateStatus(device.lastData);
			});
		} catch (err: any) {
			//this.log.error(`Error updating initial status ${this.accessories[index].displayName} sensor: ${err.message || err}`);
			this.log.error(`Error adding accessory ${'unknown'} sensor: ${ err.message || err}`);
			this.log.debug(`Error adding accessory ${'unknown'} sensor: ${err}`);
		}
	}

	updateStatus(data: any) {
		let tempSensor: Service;
		let humditySensor: Service;
		let leakSensor: Service;
		let airSensor: Service;
		let co2Sensor: Service;
		let batteryStatus: Service;
		let uuid: string;
		let index: number;

		try {
			if(data?.macAddress === undefined){
				this.log.warn('invalid mac address', JSON.stringify(data,null,2));
				return;
			}

			if (this.showOutdoor && data.tempf) {
				uuid = this.genUUID(`${data.macAddress}station`);
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					this.weatherStation = this.accessories[index];
					tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
					tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					tempSensor.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(((data.tempf - 32 + .01) * 5 / 9).toFixed(1));
					humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
					humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					humditySensor.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(data.humidity);
					batteryStatus = this.weatherStation.getService(this.Service.Battery);
					if (batteryStatus && Number.isFinite(data.battout)) {
						batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.battout);
						batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue((data.battout)*100);
					}
				}
			}

			if (this.showIndoor && data.tempinf) {
				uuid = this.genUUID(`${data.macAddress}indoor`);
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					if (Number.isFinite(data.tempinf) && Number.isFinite(data.humidityin)){
						this.weatherStation = this.accessories[index];
						tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
						tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
						tempSensor.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(((data.tempinf - 32 + .01) * 5 / 9).toFixed(1));
						humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
						humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
						humditySensor.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(data.humidityin);
						batteryStatus = this.weatherStation.getService(this.Service.Battery);
						if (batteryStatus && Number.isFinite(data.battin)) {
							batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.battin);
							batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue((data.battin)*100);
						}
					}
				}
			}

			if (this.showAqin && data.pm_in_temp_aqin) {
				uuid = this.genUUID(`${data.macAddress}aqin`);
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					this.weatherStation = this.accessories[index];
					tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
					tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					tempSensor.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(((data.pm_in_temp_aqin - 32 + .01) * 5 / 9).toFixed(1));

					humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
					humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					humditySensor.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(data.pm_in_humidity_aqin);

					airSensor = this.weatherStation.getService(this.Service.AirQualitySensor);
					airSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					airSensor.getCharacteristic(this.Characteristic.PM10Density).updateValue(data.pm10_in_aqin);
					airSensor.getCharacteristic(this.Characteristic.PM2_5Density).updateValue(data.pm25_in_aqin);

					if (data.aqi_pm25_aqin > 300) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.POOR);
					} else if (data.aqi_pm25_aqin > 200) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.POOR);
					} else if (data.aqi_pm25_aqin > 150) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.INFERIOR);
					} else if (data.aqi_pm25_aqin > 100) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.FAIR);
					} else if (data.aqi_pm25_aqin > 50) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.GOOD);
					} else if (data.aqi_pm25_aqin > 0) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.EXCELLENT);
					} else {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.UNKNOWN);
					}

					co2Sensor = this.weatherStation.getService(this.Service.CarbonDioxideSensor);
					co2Sensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					co2Sensor.getCharacteristic(this.Characteristic.CarbonDioxideLevel).updateValue(data.co2_in_aqin);
					co2Sensor.getCharacteristic(this.Characteristic.CarbonDioxidePeakLevel).updateValue(data.co2_in_24h_aqin);
					if (data.co2_in_aqin > 1200) {
						co2Sensor.getCharacteristic(this.Characteristic.CarbonDioxideDetected)
							.updateValue(this.Characteristic.CarbonDioxideDetected.CO2_LEVELS_ABNORMAL);
					} else {
						co2Sensor.getCharacteristic(this.Characteristic.CarbonDioxideDetected)
							.updateValue(this.Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL);
					}

					batteryStatus = this.weatherStation.getService(this.Service.Battery);
					if (batteryStatus && Number.isFinite(data.batt_co2)) {
						batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.batt_co2);
						batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue((data.batt_co2)*100);
					}
				}
			}

			if (this.showAirIn && data.pm25_in) {
				uuid = this.genUUID(`${data.macAddress}air_in`);
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					this.weatherStation = this.accessories[index];
					airSensor = this.weatherStation.getService(this.Service.AirQualitySensor);
					airSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					airSensor.getCharacteristic(this.Characteristic.PM2_5Density).updateValue(data.pm25_in);

					if (data.pm25_in > 300) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.POOR);
					} else if (data.pm25_in > 200) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.POOR);
					} else if (data.pm25_in > 150) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.INFERIOR);
					} else if (data.pm25_in > 100) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.FAIR);
					} else if (data.pm25_in > 50) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.GOOD);
					} else if (data.pm25_in > 0) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.EXCELLENT);
					} else {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.UNKNOWN);
					}

					batteryStatus=this.weatherStation.getService(this.Service.Battery);
					if (batteryStatus && Number.isFinite(data.batt_25_in)) {
						batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.batt_25_in);
						batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue((data.batt_25_in)*100);

					}
				}
			}

			if (this.showAirOut && data.pm25) {
				uuid = this.genUUID(`${data.macAddress}air_out`);
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					this.weatherStation = this.accessories[index];
					airSensor = this.weatherStation.getService(this.Service.AirQualitySensor);
					airSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					airSensor.getCharacteristic(this.Characteristic.PM2_5Density).updateValue(data.pm25);

					if (data.pm25 > 300) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.POOR);
					} else if (data.pm25 > 200) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.POOR);
					} else if (data.pm25 > 150) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.INFERIOR);
					} else if (data.pm25 > 100) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.FAIR);
					} else if (data.pm25 > 50) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.GOOD);
					} else if (data.pm25 > 0) {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.EXCELLENT);
					} else {
						airSensor.getCharacteristic(this.Characteristic.AirQuality).updateValue(this.Characteristic.AirQuality.UNKNOWN);
					}

					batteryStatus = this.weatherStation.getService(this.Service.Battery);
					if (batteryStatus && Number.isFinite(data.batt_25)) {
						batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.batt_25);
						batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue((data.batt_25)*100);
					}
				}
			}

			for (let n: number = 1; n <= this.maxTemp; n++) {
				if (Number.isFinite(data[`temp${n}f`])){
					uuid = this.genUUID(`${data.macAddress}temp${n}`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.weatherStation = this.accessories[index];
						tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
						tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
						tempSensor.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(((data[`temp${n}f`] - 32 + .01) * 5 / 9).toFixed(1));
						if (Number.isFinite(data[`humidity${n}f`])){
							humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
							humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
							humditySensor.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(data[`humidity${n}`]);
						}
						if (Number.isFinite(data[`batt${n}`])) {
							batteryStatus = this.weatherStation.getService(this.Service.Battery);
							batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data[`batt${n}`]);
							batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue((data[`batt${n}`])*100);
						}
					}
				}
			}

			for (let n: number = 1; n <= this.maxSoil; n++) {
				if (Number.isFinite(data[`soilhum${n}`])){
					uuid = this.genUUID(`${data.macAddress}soil${n}`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.weatherStation = this.accessories[index];
						if (Number.isFinite(data[`soiltemp${n}f`])){
							tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
							tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
							tempSensor.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(((data[`soiltemp${n}f`] - 32 + .01) * 5 / 9).toFixed(1));
						}
						if (Number.isFinite(data[`soilhum${n}`])){
							humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
							humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
							humditySensor.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(data[`soilhum${n}`]);
						}
						if (Number.isFinite(data[`battsm${n}`])) {
							batteryStatus = this.weatherStation.getService(this.Service.Battery);
							batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data[`battsm${n}`]);
							batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue((data[`battsm${n}`])*100);
						}
					}
				}
			}

			for (let n: number = 1; n <= this.maxLeak; n++) {
				if (Number.isFinite(data[`leak${n}`])) {
					uuid = this.genUUID(`${data.macAddress}leak${n}`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.weatherStation = this.accessories[index];
						leakSensor = this.weatherStation.getService(this.Service.LeakSensor);
						if (data[`leak${n}`] === 2) {
							leakSensor.getCharacteristic(this.Characteristic.StatusActive).updateValue(false);
							leakSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
							batteryStatus = this.weatherStation.getService(this.Service.Battery);
							batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(data[`batleak${n}`]);
							batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(Number(!data[`batleak${n}`])*100);
						} else {
							leakSensor.getCharacteristic(this.Characteristic.StatusActive).updateValue(true);
							leakSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
							leakSensor.getCharacteristic(this.Characteristic.LeakDetected).updateValue(data[`leak${n}`]);
							batteryStatus = this.weatherStation.getService(this.Service.Battery);
							batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(data[`batleak${n}`]);
							batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(Number(!data[`batleak${n}`])*100);
						}
					}
				}
			}

			if (Array.isArray(this.customSensor)) {
				this.customSensor.forEach((device: any) => {
					uuid = this.genUUID(device.name);
					uuid = this.genUUID(`${device.macAddress}${device.name}`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						if (Number.isFinite(data[device.dataPoint])) {
							const value = data[device.dataPoint];
							const batt = data[device.dataPointBatt];
							const motion = value > device.threshold ? true : false;
							let sensor;
							this.weatherStation = this.accessories[index];
							switch (device.type) {
							case 0:
								sensor = this.weatherStation.getService(this.Service.MotionSensor);
								sensor.getCharacteristic(this.Characteristic.MotionDetected).updateValue(motion);
								sensor.getCharacteristic(this.Characteristic.CurrentAmbientLightLevel).updateValue(value);
								batteryStatus = this.weatherStation.getService(this.Service.Battery);
								if (batteryStatus && Number.isFinite(batt)) {
									batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(batt);
									batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(Number(!batt)*100);
								}
								break;
							case 1:
								sensor = this.weatherStation.getService(this.Service.OccupancySensor);
								sensor.getCharacteristic(this.Characteristic.OccupancyDetected).updateValue(motion);
								sensor.getCharacteristic(this.Characteristic.CurrentAmbientLightLevel).updateValue(value);
								batteryStatus = this.weatherStation.getService(this.Service.Battery);
								if (batteryStatus && Number.isFinite(batt)) {
									batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(batt);
									batteryStatus.getCharacteristic(this.Characteristic.BatteryLevel).updateValue(Number(!batt)*100);
								}
								break;
							}
						} else {
							this.log.debug(`failed to update custom sensor, bad value ${device.dataPoint}`);
						}
					}
				});
			}

		} catch (err: any) {
			//this.log.error(`Error updating initial status ${this.accessories[index].displayName} sensor: ${err.message || err}`);
			this.log.error(`Error updating initial status ${'unknown'} sensor: ${ err.message || err}`);
			this.log.debug(`Error updating initial status ${'unknown'} sensor: ${err}`);
		}
	}

	updatefault() {
		let tempSensor: Service;
		let humditySensor: Service;
		let leakSensor: Service;
		let airSensor: Service;
		let co2Sensor: Service;
		let uuid: string;
		let index: number;

		this.macAddress.forEach((macAddress: string) => {
			try {
				if (this.showOutdoor) {
					uuid = this.genUUID(`${macAddress}station`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					this.weatherStation = this.accessories[index];
					tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
					tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
					humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
					humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				}

				if (this.showIndoor) {
					uuid = this.genUUID(`${macAddress}indoor`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					this.weatherStation = this.accessories[index];
					tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
					tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
					humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
					humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				}

				if (this.showAqin) {
					uuid = this.genUUID(`${macAddress}aqin`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					this.weatherStation = this.accessories[index];
					tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
					tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
					humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
					humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
					airSensor = this.weatherStation.getService(this.Service.AirQualitySensor);
					airSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
					co2Sensor = this.weatherStation.getService(this.Service.CarbonDioxideSensor);
					co2Sensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				}

				if (this.showAirIn) {
					uuid = this.genUUID(`${macAddress}air_in`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					this.aqin = this.accessories[index];
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					airSensor = this.weatherStation.getService(this.Service.AirQualitySensor);
					airSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				}

				if (this.showAirOut) {
					uuid = this.genUUID(`${macAddress}air_out`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					this.aqin = this.accessories[index];
					airSensor = this.weatherStation.getService(this.Service.AirQualitySensor);
					airSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				}

				for (let n: number = 1; n <= this.maxTemp; n++) {
					uuid = this.genUUID(`${macAddress}temp${n}`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.weatherStation = this.accessories[index];
						tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
						if(tempSensor){
							tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
						}
						humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
						if(humditySensor){
							humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
						}
					}
				}

				for (let n: number = 1; n <= this.maxSoil; n++) {
					uuid = this.genUUID(`${macAddress}soil${n}`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.weatherStation = this.accessories[index];
						tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
						if(tempSensor){
							tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
						}
						humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
						if(humditySensor){
							humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
						}
					}
				}

				for (let n: number = 1; n <= this.maxLeak; n++) {
					uuid = this.genUUID(`${macAddress}leak${n}`);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.weatherStation = this.accessories[index];
						leakSensor = this.weatherStation.getService(this.Service.LeakSensor);
						leakSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
					}
				}

				if (Array.isArray(this.customSensor)) {
					this.customSensor.forEach((device: any) => {
						let sensor;
						uuid = this.genUUID(`${macAddress}${device.name}`);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (this.accessories[index]) {
							this.weatherStation = this.accessories[index];
							switch (device.type) {
							case 0:
								sensor = this.weatherStation.getService(this.Service.MotionSensor);
								sensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
								break;
							case 1:
								sensor = this.weatherStation.getService(this.Service.OccupancySensor);
								sensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
								break;
							}
						}
					});
				}
			} catch (err) {
				this.log.error('Error setting fault status', err);
			}
		});
	}
}
