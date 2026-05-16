import type { API } from 'homebridge';
import { PLATFORM_NAME } from './settings.js';
import ambientPlatform from './ambient_platform.js';

export default (api: API) => {
	api.registerPlatform(PLATFORM_NAME, ambientPlatform);
};
