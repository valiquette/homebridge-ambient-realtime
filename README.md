<p align="left">
 <img width="300" src="logo/homebridge-ambient.png" />
</p>

# homebridge-ambient-realtime
<br>Ambient platform plugin for [Homebridge](https://github.com/nfarina/homebridge).

## About

<br> Supports Ambiant weather station and additional sensors using Ambiant's realtime API, no polling required and incoming data events are recieved once evey minute.
<br> If you have more than one weather station on account you may filter the weather stations for each home based on the location name assigned in the app for the location you want to display in HomeKit.
<br> Once the plugin is connected the last data set will be shown in the log. Any item on that list can be configured as a custom sensor using these values as the data points. ote the examples in the sample config below. The actual recieved value will be stored in the sensor as light level value.
<br> I can only test agaist the device I have available. Other sensors could be added if had access to the data that is returned when the plugin starts.
<br>
<br> To do list will include adding support for more indoor TH sensors and leak sensor.


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
    "showIndoor1": true,
    "showIndoor2": false,
    "showIndoor3": false,
    "showAqin": true,
    "showAir": true,
    "showCo2": true,
    "sensors": [
        {
            "name": "Wind",
            "dataPoint": "windspeedmph",
            "threshold": 5,
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
    "_bridge": {
        "username": "0E:43:35:74:24:77"
    },
    "platform": "ambient"
}
```