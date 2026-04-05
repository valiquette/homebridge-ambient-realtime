
const minTemp = -10;
const maxTemp = 99;
const minHum = 20;
const maxHum = 50;

function batt(ok: boolean) {
	if (ok) {
		return Number(Math.random() >= 0.1);
	} else{
		return Number(Math.random() <= 0.1);
	}
};
function temp() {
	return Number((Math.random() * (maxTemp - minTemp) + minTemp).toFixed(2));
};
function hum() {
	return Number((Math.random() * (maxHum - minHum) + minHum).toFixed(2));
};

export class sampleData{
	getData(){
		const data = {
			'dateutc': Date.now(),
			'tempf': temp(),
			'humidity': hum(),
			'windspeedmph': Number((Math.random() * (10 - 0) + 0).toFixed(0)),
			'windgustmph': Number((Math.random() * (20 - 0) + 0).toFixed(0)),
			'maxdailygust': 20.8,
			'winddir': Number((Math.random() * (360 - 0) + 0).toFixed(0)),
			'winddir_avg10m': 226,
			'uv': 6,
			'solarradiation': 696.21,
			'hourlyrainin': 0,
			'eventrainin': 0,
			'dailyrainin': 0,
			'weeklyrainin': 0,
			'monthlyrainin': 1.55,
			'yearlyrainin': 2.85,
			'battout': batt(true),
			'battrain': batt(true),
			'tempinf': temp(),
			'humidityin': 44,
			'baromrelin': 30.112,
			'baromabsin': 28.975,
			'battin': batt(true),
			'pm25': 9,
			'pm25_24h': 7.5,
			'aqi_pm25': 38,
			'aqi_pm25_24h': 31,
			'batt_25': batt(true),
			'soiltemp1f': temp(),
			'soilhum1': hum(),
			'battsm1': batt(true),
			'soilhum2': hum(),
			'battsm2': batt(true),
			'soilhum3': hum(),
			'battsm3': batt(true),
			'temp1f': temp(),
			'batt1': batt(true),
			'temp2f': temp(),
			'humidity2': hum(),
			'batt2': batt(true),
			'temp3f': temp(),
			'humidity3': hum(),
			'batt3': batt(true),
			'temp4f': temp(),
			'humidity4': hum(),
			'batt4': batt(true),
			'temp5f': temp(),
			'humidity5': hum(),
			'batt5': batt(true),
			'temp6f': temp(),
			'humidity6': 74,
			'batt6': batt(true),
			'temp7f': temp(),
			'humidity7': hum(),
			'batt7': batt(true),
			'temp8f':temp(),
			'humidity8': hum(),
			'batt8': batt(true),
			'leafwetness1': 71,
			'batt_lw1': batt(true),
			'leak1': Number(Math.random() >= 0.9),
			'batleak1': batt(false),
			'leak2': Number(Math.random() >= 0.9),
			'batleak2':batt(false),
			'leak3': Number(Math.random() >= 0.9),
			'batleak3': batt(false),
			'leak4': Number(Math.random() >= 0.9),
			'batleak4':batt(false),
			'lightning_day': Number(Math.random() >= 0.9),
			'lightning_time': 1772879660000,
			'lightning_distance': 16.78,
			'batt_lightning': batt(false),
			'pm_in_temp_aqin': 77,
			'pm_in_humidity_aqin': 41,
			'pm10_in_aqin': 24,
			'pm10_in_24h_aqin': 74.6,
			'aqi_pm10_aqin': 22,
			'aqi_pm10_24h_aqin': 61,
			'pm25_in_aqin': 23.3,
			'pm25_in_24h_aqin': 72.2,
			'co2_in_aqin': 1071,
			'co2_in_24h_aqin': 1156,
			'aqi_pm25_aqin': 75,
			'aqi_pm25_24h_aqin': 161,
			'batt_co2': batt(true),
			'feelsLike': 44.56,
			'dewPoint': 25.47,
			'feelsLike2': 56.8,
			'dewPoint2': 36.2,
			'feelsLike3': 76,
			'dewPoint3': 68.8,
			'feelsLike4': 75.2,
			'dewPoint4': 68.9,
			'feelsLike5': -6,
			'dewPoint5': -16.6,
			'feelsLike6': -17.5,
			'dewPoint6': -23.2,
			'feelsLike7': -4.4,
			'dewPoint7': -13.4,
			'feelsLike8': 4.1,
			'dewPoint8': -4.4,
			'feelsLikein': 73.5,
			'dewPointin': 51,
			'lastRain': '2026-03-26T18:43:00.000Z',
			'lightning_hour': 0,
			'deviceId': '6743d2dc5673a65301f1af28',
			'tz': 'America/Denver',
			'date': new Date().toJSON(),
		};
		return data;
	}
}