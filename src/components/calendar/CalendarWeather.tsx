import React from 'react';
import {
  Sun,
  Moon,
  CloudMoon,
  CloudSun,
  Cloud,
  Wind,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from 'lucide-react';

export const WMO_WEATHER_DESC: Record<number, string> = {
  0: 'Jasno',
  1: 'Zachmurzenie częściowe',
  2: 'Zachmurzenie częściowe',
  3: 'Pochmurno',
  45: 'Mgła',
  48: 'Mgła',
  51: 'Mżawka',
  53: 'Mżawka',
  55: 'Mżawka',
  61: 'Deszcz',
  63: 'Deszcz',
  65: 'Deszcz',
  71: 'Śnieg',
  73: 'Śnieg',
  75: 'Śnieg',
  80: 'Przelotny deszcz',
  81: 'Przelotny deszcz',
  82: 'Przelotny deszcz',
  95: 'Burza',
  96: 'Burza',
  99: 'Burza',
};

export function getWMOWeatherIcon(code: number, size = 12, isNight = false) {
  switch (code) {
    case 0:
      return isNight ? <Moon size={size} className="text-indigo-300 animate-pulse" /> : <Sun size={size} className="text-amber-400" />;
    case 1:
    case 2:
      return isNight ? <CloudMoon size={size} className="text-slate-300" /> : <CloudSun size={size} className="text-amber-300" />;
    case 3:
      return <Cloud size={size} className="text-slate-400" />;
    case 45:
    case 48:
      return <Wind size={size} className="text-zinc-400" />;
    case 51:
    case 53:
    case 55:
      return <CloudDrizzle size={size} className="text-sky-300" />;
    case 61:
    case 63:
    case 65:
      return <CloudRain size={size} className="text-blue-400" />;
    case 71:
    case 73:
    case 75:
      return <CloudSnow size={size} className="text-sky-200" />;
    case 80:
    case 81:
    case 82:
      return <CloudRain size={size} className="text-sky-400" />;
    case 95:
    case 96:
    case 99:
      return <CloudLightning size={size} className="text-amber-500 animate-pulse" />;
    default:
      return <Cloud size={size} className="text-slate-400" />;
  }
}
