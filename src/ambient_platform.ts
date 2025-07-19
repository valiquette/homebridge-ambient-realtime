/* eslint-disable @typescript-eslint/no-explicit-any */
import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

import { station } from './devices/station.js';
import { tempSensor } from './devices/temp.js';
import { aqinSensor } from './devices/aqin.js';
import { airSensor } from './devices/air.js';
import { leakSensor } from './devices/leak.js';
import { motionSensor } from './devices/motion.js';
import { occupancySensor } from './devices/occupancy.js';

import { io } from 'socket.io-client';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ambientPlatform implements DynamicPlatformPlugin {
	[x: string]: any;
	public readonly Service: typeof Service;
	public readonly Characteristic: typeof Characteristic;

	// this is used to track restored cached accessories
	public readonly accessories: PlatformAccessory[] = [];

	constructor(
		public readonly log: Logging,
		public readonly config: PlatformConfig,
		public readonly api: API,
	) {
		this.Service = api.hap.Service;
		this.Characteristic = api.hap.Characteristic;
		this.genUUID = api.hap.uuid.generate;

		this.log.debug('Finished initializing platform:', config.name);

		this.timeStamp = new Date();
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
		this.showLeak = config.showLeak;
		this.maxLeak = config.maxLeak ? config.maxLeak : 4;
		this.maxTemp = config.maxtemp ? config.maxTemp : 8;
		this.showSocketData = config.showSocketData ? config.showSocketData : false;

		this.weatherStation = null;
		this.locationAddress = config.locationAddress;
		if (!config.api_key || !config.api_app_key) {
			this.log.error('Valid API keys are required, please check the plugin config');
			return;
		}
		this.log.info('Starting Ambient platform using homebridge API', api.version);

		api.on('didFinishLaunching', () => {
			log.debug('Executed didFinishLaunching callback');
			this.connectAPI();
		});
	}

	//**
	//** REQUIRED - Homebridge will call the "configureAccessory" method once for every cached accessory restored
	//**

	configureAccessory(accessory: PlatformAccessory) {
		// Added cached devices to the accessories array
		this.log.debug('Found cached accessory %s with %s', accessory.displayName, accessory.services);
		this.accessories.push(accessory);
	}

	identify() {
		this.log.info('Identify ambient');
	}

	//https://ambientweather.docs.apiary.io/#

	connectAPI() {
		const socket = io(this.endpoint, {
			reconnectionDelayMax: 10000,
			transports: ['websocket'],
			upgrade: true,
			auth: {
				token: '123abc',
			},
			query: {
				api: 1,
				applicationKey: this.api_app_key,
			},
		},
		);
		this.log.info('connecting...');

		socket.on('connect', () => {
			this.log.info('opened socket id', socket.id);
			this.log.info('Connected to Ambient Weather');
			this.log.info('Subscribing to Ambient Weather Realtime API...');
			socket.emit('subscribe', { apiKeys: [this.api_key] });
		});

		socket.on('disconnect', () => {
			this.log.info('closed socket id', socket.id);
			this.log.info('Disconected from Ambient Weather');
			this.log.warn('Weather Station offline at %s! Sensors will show as non-responding until the connection is restored.', new Date().toLocaleString());
			this.updatefault();
		});

		socket.on('subscribed', (data) => {
			//this.log.debug('subscribed',JSON.stringify(data,null,2));
			this.log.debug('Subscribed to %s device(s)', data.devices.length);
			data.devices.forEach((device: { info: { name: any; }; }) => {
				this.log.success('Subscribed to Ambient Weather Realtime API updates for %s', device.info.name);
			});
			this.addAccessory(data.devices);
		});

		socket.on('data', (data) => {
			//this.log.debug('data',JSON.stringify(data,null,2))
			if (this.showSocketData) {
				this.log.debug('data recieved %s current outdoor temp %s ', data.date, data.tempf);
			}

			/*
			//for testing
			data.temp1f=96.0;
			data.batt1=1; //batt1...batt10 - OK/Low indication, Int, 1=OK, 0=Low (Meteobridge Users 1=Low, 0=OK)
			data.humidity1=30;
			data.leak1=2;
			data.batleak1=0; //batleak1...batleak4 - Leak Detector Battery - 1=Low 0=OK
			data.pm25=50;
			data.batt_25=1;
			data.pm25_in=100;
			//for testing
			*/

			this.updateStatus(data);
		});
	}

	addAccessory(devices: any[]) {
		let uuid: any;
		let name: string;
		let index: any;
		let accessory: PlatformAccessory;

		devices.forEach((device: any) => {
			if (this.locationAddress === device.info.coords.address.split(',')[0] || this.locationAddress == null) {
				this.log.info('Found a match for configured location %s', device.info.coords.address.split(',')[0]);

				/*
				//for testing
				device.lastData.temp1f=69.0;
				device.lastData.humidity1=20;
				device.lastData.batt1=1;
				device.lastData.leak1=0;
				device.lastData.batleak1=0;
				device.lastData.pm25=22;
				device.lastData.batt_25=1;
				device.lastData.pm25_in=80;
				//for testing
				*/

				this.log.info('initial data from subscribed event', JSON.stringify(device.lastData, null, 2));
				if (this.showOutdoor && device.lastData.tempf) {
					uuid = this.genUUID('station');
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
					uuid = this.genUUID('station');
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.log.debug('Removed cached device', device.id);
						this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
						delete this.accessories[index];
					}
				}

				if (this.showIndoor && device.lastData.tempinf) {
					name = 'indoor';
					uuid = this.genUUID(name);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (!this.accessories[index]) {
						this.log.debug('Registering platform accessory temp');
						accessory = new tempSensor(this).createAccessory(device, uuid, this.accessories[index], name);
						this.accessories.push(accessory);
						this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
					} else {
						accessory = new tempSensor(this).createAccessory(device, uuid, this.accessories[index], name);
					}
				} else {
					if (this.showIndoor) {
						this.log.info('Skipping indoor, sensor not found');
					}
					uuid = this.genUUID('indoor');
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.log.debug('Removed cached device indoor', device.id);
						this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
						delete this.accessories[index];
					}
				}

				if (this.showAqin && device.lastData.co2_in_aqin) {
					uuid = this.genUUID('aqin');
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
					uuid = this.genUUID('aqin');
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.log.debug('Removed cached device aqin', device.id);
						this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
						delete this.accessories[index];
					}
				}

				if (this.showAirIn && device.lastData.pm25_in) {
					uuid = this.genUUID('air_in');
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (!this.accessories[index]) {
						this.log.debug('Registering platform accessory indoor air');
						accessory = new airSensor(this).createAccessory(device, uuid, this.accessories[index], 'in');
						this.accessories.push(accessory);
						this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
					} else {
						accessory = new airSensor(this).createAccessory(device, uuid, this.accessories[index], 'in');
					}
				} else {
					if (this.showAirIn) {
						this.log.info('Skipping indoor air sensor not found');
					}
					uuid = this.genUUID('air_in');
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.log.debug('Removed cached device aqin', device.id);
						this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
						delete this.accessories[index];
					}
				}
				if (this.showAirOut && device.lastData.pm25) {
					uuid = this.genUUID('air_out');
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (!this.accessories[index]) {
						this.log.debug('Registering platform accessory outdoor air');
						accessory = new airSensor(this).createAccessory(device, uuid, this.accessories[index], 'out');
						this.accessories.push(accessory);
						this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
					} else {
						accessory = new airSensor(this).createAccessory(device, uuid, this.accessories[index], 'out');
					}
				} else {
					if (this.showAirOut) {
						this.log.info('Skipping outdoor air sensor not found');
					}
					uuid = this.genUUID('air_out');
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.log.debug('Removed cached device aqin', device.id);
						this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
						delete this.accessories[index];
					}
				}

				if (this.showOtherTemp) {
					for (let n = 1; n <= this.maxTemp; n++) {
						name = 'temp' + n;
						uuid = this.genUUID(name);
						if (device.lastData[`temp${n}f`]) {
							if (!this.accessories[index]) {
								this.log.debug('Registering platform accessory temp%s', index);
								accessory = new tempSensor(this).createAccessory(device, uuid, this.accessories[index], name);
								this.accessories.push(accessory);
								this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
							} else {
								accessory = new tempSensor(this).createAccessory(device, uuid, this.accessories[index], name);
							}
						} else {
							this.log.debug('Skipping temp%s, sensor not found', n);
							if (this.accessories[index]) {
								this.log.debug('Removed cached device temp%s', n);
								this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
								delete this.accessories[index];
							}
						}
					}
				}

				if (this.showLeak) {
					for (let n = 1; n <= this.maxLeak; n++) {
						name = 'leak' + n;
						uuid = this.genUUID(name);
						index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
						if (device.lastData[`leak${n}`] != null) {
							if (!this.accessories[index]) {
								this.log.debug('Registering platform accessory leak%s', n);
								accessory = new leakSensor(this).createAccessory(device, uuid, this.accessories[index], name);
								this.accessories.push(accessory);
								this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
							} else {
								accessory = new leakSensor(this).createAccessory(device, uuid, this.accessories[index], name);
							}
						} else {
							this.log.debug('Skipping leak%s, sensor not found', n);
							if (this.accessories[index]) {
								this.log.debug('Removed cached device leak%s', n);
								this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
								delete this.accessories[index];
							}
						}
					}
				}

				if (Array.isArray(this.customSensor)) {
					this.customSensor.forEach((sensor: any) => {
						if (device.lastData[sensor.dataPoint] != null) {
							uuid = this.genUUID(sensor.name);
							index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
							if (this.accessories[index]) {
								const checkType: any = this.accessories[index].getService(this.Service.AccessoryInformation)!
									.getCharacteristic(this.Characteristic.ProductData);
								if ((checkType.value === 'motion' && sensor.type === 1) || (checkType.value === 'occupancy' && sensor.type === 0)) {
									this.log.warn('Changing sensor between Motion and Occupancy, check room assignments in Homekit');
									this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
									delete this.accessories[index];
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
							this.log.info('Skipping sensor not found');
							uuid = this.genUUID(sensor.name);
							index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
							if (this.accessories[index]) {
								this.log.debug('Removed cached device', device.id);
								this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [this.accessories[index]]);
								delete this.accessories[index];
							}
						}
					});
				}
			} else {
				this.log.info('Skipping location %s does not match configured location %s', device.info.coords.address.split(',')[0], this.locationAddress);
			}
			this.updateStatus(device.lastData);
		});
	}
	updateStatus(data: any) {
		let tempSensor: Service;
		let humditySensor: Service;
		let leakSensor: Service;
		let airSensor: Service;
		let co2Sensor: Service;
		let batteryStatus: Service;
		let uuid: any;
		let index: any;

		try {
			if (this.showOutdoor && data.tempf) {
				uuid = this.genUUID('station');
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
					if (batteryStatus) {
						batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.battout);
					}
				}
			}

			if (this.showIndoor && data.tempinf) {
				uuid = this.genUUID('indoor');
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					this.weatherStation = this.accessories[index];
					tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
					tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					tempSensor.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(((data.tempinf - 32 + .01) * 5 / 9).toFixed(1));
					humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
					humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					humditySensor.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(data.humidityin);
					batteryStatus = this.weatherStation.getService(this.Service.Battery);
					if (batteryStatus) {
						batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.battin);
					}
				}
			}

			for (let n: number = 1; n <= this.maxTemp; n++) {
				if (data[`temp${n}f`] != null) {
					uuid = this.genUUID('temp' + n);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.weatherStation = this.accessories[index];
						tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
						tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
						tempSensor.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(((data[`temp${n}f`] - 32 + .01) * 5 / 9).toFixed(1));
						humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
						humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
						humditySensor.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(data[`humidity${n}`]);
						batteryStatus = this.weatherStation.getService(this.Service.Battery);
						batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data[`batt${n}`]);
					}
				}
			}

			for (let n: number = 1; n <= this.maxLeak; n++) {
				if (data[`leak${n}`] != null) {
					uuid = this.genUUID('leak' + n);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						this.weatherStation = this.accessories[index];
						leakSensor = this.weatherStation.getService(this.Service.LeakSensor);
						if (data[`leak${n}`] === 2) {
							leakSensor.getCharacteristic(this.Characteristic.StatusActive).updateValue(false);
							leakSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
							batteryStatus = this.weatherStation.getService(this.Service.Battery);
							batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(data[`batleak${n}`]);
						} else {
							leakSensor.getCharacteristic(this.Characteristic.StatusActive).updateValue(true);
							leakSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
							leakSensor.getCharacteristic(this.Characteristic.LeakDetected).updateValue(data[`leak${n}`]);
							batteryStatus = this.weatherStation.getService(this.Service.Battery);
							batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(data[`batleak${n}`]);
						}
					}
				}
			}

			if (this.showAqin && data.co2_in_aqin) {
				uuid = this.genUUID('aqin');
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					this.weatherStation = this.accessories[index];
					tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
					tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					tempSensor.getCharacteristic(this.Characteristic.CurrentTemperature).updateValue(((data.tempinf - 32 + .01) * 5 / 9).toFixed(1));

					humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
					humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.NO_FAULT);
					humditySensor.getCharacteristic(this.Characteristic.CurrentRelativeHumidity).updateValue(data.humidityin);

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
					batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.batt_co2);
				}
			}
			if (this.showAirIn && data.pm25_in) {
				uuid = this.genUUID('air_in');
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

					//batteryStatus=this.weatherStation.getService(this.Service.Battery)
					//batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.batt_25_in)//check for batt
				}
			}
			if (this.showAirOut && data.pm25) {
				uuid = this.genUUID('air_out');
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
					batteryStatus.getCharacteristic(this.Characteristic.StatusLowBattery).updateValue(!data.batt_25);
				}
			}

			if (Array.isArray(this.customSensor)) {
				this.customSensor.forEach((device: any) => {
					uuid = this.genUUID(device.name);
					index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
					if (this.accessories[index]) {
						const value = data[device.dataPoint];
						const motion = value > device.threshold ? true : false;
						let sensor;
						this.weatherStation = this.accessories[index];
						switch (device.type) {
						case 0:
							sensor = this.weatherStation.getService(this.Service.MotionSensor);
							sensor.getCharacteristic(this.Characteristic.MotionDetected).updateValue(motion);
							sensor.getCharacteristic(this.Characteristic.CurrentAmbientLightLevel).updateValue(value);
							break;
						case 1:
							sensor = this.weatherStation.getService(this.Service.OccupancySensor);
							sensor.getCharacteristic(this.Characteristic.OccupancyDetected).updateValue(motion);
							sensor.getCharacteristic(this.Characteristic.CurrentAmbientLightLevel).updateValue(value);
							break;
						}
					}
				});
			}
		} catch (err) {
			this.log.error('Error updating status %s', err);
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

		try {
			if (this.showOutdoor) {
				uuid = this.genUUID('station');
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				this.weatherStation = this.accessories[index];
				tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
				tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
				humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
			}

			if (this.showIndoor) {
				uuid = this.genUUID('indoor');
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				this.weatherStation = this.accessories[index];
				tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
				tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				humditySensor = this.weatherStation.getService(this.Service.HumiditySensor);
				humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
			}

			for (let n: number = 1; n <= this.maxTemp; n++) {
				uuid = this.genUUID('temp' + n);
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					this.weatherStation = this.accessories[index];
					tempSensor = this.weatherStation.getService(this.Service.TemperatureSensor);
					tempSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
					humditySensor = this.indoor.getService(this.Service.HumiditySensor);
					humditySensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				}
			}

			for (let n: number = 1; n <= this.maxLeak; n++) {
				uuid = this.genUUID('leak' + n);
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				if (this.accessories[index]) {
					this.weatherStation = this.accessories[index];
					leakSensor = this.weatherStation.getService(this.Service.LeakSensor);
					leakSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
				}
			}

			if (this.showAqin) {
				uuid = this.genUUID('aqin');
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
				uuid = this.genUUID('air_in');
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				this.aqin = this.accessories[index];
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				airSensor = this.weatherStation.getService(this.Service.AirQualitySensor);
				airSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
			}

			if (this.showAirOut) {
				uuid = this.genUUID('air_out');
				index = this.accessories.findIndex(accessory => accessory.UUID === uuid);
				this.aqin = this.accessories[index];
				airSensor = this.weatherStation.getService(this.Service.AirQualitySensor);
				airSensor.getCharacteristic(this.Characteristic.StatusFault).updateValue(this.Characteristic.StatusFault.GENERAL_FAULT);
			}

			if (Array.isArray(this.customSensor)) {
				this.customSensor.forEach((device: any) => {
					let sensor;
					uuid = this.genUUID(device.name);
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
	}
}
