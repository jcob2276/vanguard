import { useEffect, useState } from 'react';
import { addDays } from '../calendarHelpers';

interface UseCalendarWeatherParams {
  today: string;
  homeLat: number | null | undefined;
  homeLng: number | null | undefined;
  rangeStart: string;
  rangeEnd: string;
}

interface WeatherCurrent {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  iconCode: string;
  name: string;
  isOWM: boolean;
}

interface WeatherHourlyPoint {
  hour: number;
  temp: number;
  weatherCode: number;
  precipProb: number;
}

interface WeatherDailyPoint {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

interface WeatherState {
  current: WeatherCurrent | null;
  daily: Record<string, WeatherDailyPoint>;
  hourly: Record<string, WeatherHourlyPoint[]>;
  error: boolean;
}

function getCityName(lat: number, lng: number) {
  if (Math.abs(lat - 49.6950) < 0.005 && Math.abs(lng - 21.7225) < 0.005) return 'Świerzowa Polska';
  if (Math.abs(lat - 49.68886) < 0.05 && Math.abs(lng - 21.76466) < 0.05) return 'Krosno';
  if (Math.abs(lat - 52.2297) < 0.05 && Math.abs(lng - 21.0122) < 0.05) return 'Warszawa';
  return 'Moja lokalizacja';
}

function getWMOWeatherDescription(code: number) {
  switch (code) {
    case 0: return 'Jasno';
    case 1:
    case 2: return 'Zachmurzenie częściowe';
    case 3: return 'Pochmurno';
    case 45:
    case 48: return 'Mgła';
    case 51:
    case 53:
    case 55: return 'Mżawka';
    case 61:
    case 63:
    case 65: return 'Deszcz';
    case 71:
    case 73:
    case 75: return 'Śnieg';
    case 80:
    case 81:
    case 82: return 'Przelotny deszcz';
    case 95:
    case 96:
    case 99: return 'Burza';
    default: return 'Umiarkowane zachmurzenie';
  }
}

export function useCalendarWeather({ today, homeLat, homeLng, rangeStart, rangeEnd }: UseCalendarWeatherParams) {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    const lat = homeLat ?? 49.6950;
    const lng = homeLng ?? 21.7225;
    const start = rangeStart;
    const end = rangeEnd;
    const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;

    let isMounted = true;

    async function fetchWeather() {
      try {
        let currentData = null;
        if (apiKey) {
          try {
            const owmRes = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=pl`
            );
            if (owmRes.ok) {
              const owmData = await owmRes.json();
              currentData = {
                temp: Math.round(owmData.main.temp),
                feelsLike: Math.round(owmData.main.feels_like),
                humidity: owmData.main.humidity,
                windSpeed: Math.round(owmData.wind.speed * 3.6),
                description: owmData.weather[0]?.description || '',
                iconCode: owmData.weather[0]?.icon || '',
                name: getCityName(lat, lng),
                isOWM: true,
              };
            }
          } catch (err) {
            console.warn('[Calendar] OpenWeatherMap API fetch failed, falling back to Open-Meteo:', err);
          }
        }

        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}&daily=weather_code,temperature_2m_max,temperature_2m_min&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=Europe/Warsaw`;
        const res = await fetch(openMeteoUrl);
        if (!res.ok) throw new Error('Failed to fetch Open-Meteo');
        const data = await res.json();

        const todayDate = today;
        const tomorrowDate = addDays(today, 1);
        const hourlyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${todayDate}&end_date=${tomorrowDate}&hourly=temperature_2m,weather_code,precipitation_probability&timezone=Europe/Warsaw`;
        const hourlyRes = await fetch(hourlyUrl);
        const hourlyData: Record<string, WeatherHourlyPoint[]> = {};
        if (hourlyRes.ok) {
          const hd = await hourlyRes.json();
          if (hd.hourly && hd.hourly.time) {
            for (let i = 0; i < hd.hourly.time.length; i++) {
              const isoStr: string = hd.hourly.time[i];
              const dateKey = isoStr.slice(0, 10);
              const hour = parseInt(isoStr.slice(11, 13), 10);
              if (!hourlyData[dateKey]) hourlyData[dateKey] = [];
              hourlyData[dateKey].push({
                hour,
                temp: Math.round(hd.hourly.temperature_2m[i]),
                weatherCode: hd.hourly.weather_code[i],
                precipProb: hd.hourly.precipitation_probability[i] ?? 0,
              });
            }
          }
        }

        if (isMounted) {
          if (!currentData && data.current) {
            currentData = {
              temp: Math.round(data.current.temperature_2m),
              feelsLike: Math.round(data.current.apparent_temperature),
              humidity: data.current.relative_humidity_2m,
              windSpeed: Math.round(data.current.wind_speed_10m),
              description: getWMOWeatherDescription(data.current.weather_code),
              iconCode: String(data.current.weather_code) + (data.current.is_day ? 'd' : 'n'),
              name: getCityName(lat, lng),
              isOWM: false,
            };
          }

          const daily: Record<string, WeatherDailyPoint> = {};
          if (data.daily && data.daily.time) {
            for (let i = 0; i < data.daily.time.length; i++) {
              const dStr = data.daily.time[i];
              daily[dStr] = {
                date: dStr,
                weatherCode: data.daily.weather_code[i],
                tempMax: Math.round(data.daily.temperature_2m_max[i]),
                tempMin: Math.round(data.daily.temperature_2m_min[i]),
              };
            }
          }

          setWeather({
            current: currentData,
            daily,
            hourly: hourlyData,
            error: false,
          });
          setWeatherLoading(false);
        }
      } catch (err) {
        console.error('Error fetching weather:', err);
        if (isMounted) {
          setWeather({
            current: null,
            daily: {},
            hourly: {},
            error: true,
          });
          setWeatherLoading(false);
        }
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [homeLat, homeLng, rangeStart, rangeEnd, today]);

  return { weather, weatherLoading };
}
