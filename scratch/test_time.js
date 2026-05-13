const now = new Date();
const localTimeString = now.toLocaleString('pl-PL', { 
    timeZone: 'Europe/Warsaw',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});
console.log('Current Date:', now.toISOString());
console.log('Local Time String (Warsaw):', localTimeString);
