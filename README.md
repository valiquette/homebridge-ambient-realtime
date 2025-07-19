<p align="left">
 <img width="300" src="logo/homebridge-ambient.png" />
</p>

# homebridge-ambient-realtime
[![verified-by-homebridge](https://img.shields.io/badge/homebridge-verified-blueviolet?color=%23491F59&style=for-the-badge&logoColor=%23FFFFFF&logo=homebridge)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
<br>Ambient platform plugin for [Homebridge](https://github.com/nfarina/homebridge).

## About

<br> Supports Ambiant weather station and additional sensors using Ambiant's realtime API, no polling required, incoming data events are recieved once evey minute.
<br> If you have more than one weather station on account you may filter the weather stations for each home based on the location name assigned in the app for the location you want to display in HomeKit.
<br> Once the plugin starts the last data set Ambient has for your weather station will be shown in the homebridge log as the inital data from the subscribe event. Any item on that list can be configured as a custom sensor using those values as the data points. For details on these values see [Ambient device specs](https://github.com/ambient-weather/api-docs/wiki/Device-Data-Specs).
<br> Note the examples in the sample config below. The actual recieved value will be stored in the sensor as light level value.
<br> I can test agaist the devices I have available, other sensors have only been tested agaist Ambient's API documentaion.
<br> For now custom sensors only trigger when the threshold is exceeded.



## Installation
1. Install this plugin using: npm install -g homebridge-ambient-realtime
3. Use plugin settings to edit ``config.json`` and add your account info.
4. Run Homebridge
5. Pair to HomeKit

## Config.json example with child bridge
```
{
    "name": "Ambient",
    "api_app_key": "application key",
    "api_key": "your key goes here",
    "locationAddress": "123 Easy Street",
    "showOutdoor": true,
        "showIndoor": true,
        "showAqin": true,
        "showIndoorAir": false,
        "showOutdoorAir": true,
        "showOtherTemp": false,
        "showLeak": false,
        "sensors": [
            {
                "name": "Wind",
                "dataPoint": "windspeedmph",
                "threshold": 4,
                "type": 0
            },
            {
                "name": "Rain",
                "dataPoint": "eventrainin",
                "threshold": 0,
                "type": 0
            },
            {
                "name": "Lightning",
                "dataPoint": "lightning_hour",
                "threshold": 0,
                "type": 1
            }
        ],
        "showSocketData": false,
    "_bridge": {
        "username": "0E:43:35:74:24:77"
    },
    "platform": "ambient"
}
```